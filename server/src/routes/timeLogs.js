/**
 * 工时填报 REST API
 * 支持按天填报项目工时，人力负载统计
 */
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db, insertId, changeCount } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendServerError } from '../utils/http.js';

const router = Router();

const workTypes = ['development', 'meeting', 'review', 'testing', 'documentation', 'other'];
const timeLogStatus = ['draft', 'submitted', 'approved', 'rejected'];

// ==================== 工时记录 CRUD ====================

/** GET /api/time-logs - 获取工时记录列表 */
router.get(
  '/',
  requireAuth,
  query('projectId').optional().isInt(),
  query('userId').optional().isInt(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('workDate').optional().isISO8601(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { projectId, userId, startDate, endDate, workDate } = req.query;
    try {
      let sql = `
        SELECT t.*, 
               p.name as project_name,
               u.username, u.full_name,
               task.title as task_title,
               approver.full_name as approver_name
        FROM time_logs t
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN tasks task ON task.id = t.task_id
        LEFT JOIN users approver ON approver.id = t.approver_id
        WHERE 1=1
      `;
      const args = [];

      if (projectId) {
        sql += ` AND t.project_id = ?`;
        args.push(Number(projectId));
      }
      if (userId) {
        sql += ` AND t.user_id = ?`;
        args.push(Number(userId));
      }
      if (workDate) {
        sql += ` AND t.work_date = ?`;
        args.push(workDate);
      } else {
        if (startDate) {
          sql += ` AND t.work_date >= ?`;
          args.push(startDate);
        }
        if (endDate) {
          sql += ` AND t.work_date <= ?`;
          args.push(endDate);
        }
      }

      sql += ` ORDER BY t.work_date DESC, t.id DESC`;

      const rows = db.prepare(sql).all(...args);
      res.json(rows);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** GET /api/time-logs/summary - 获取工时汇总统计 */
router.get(
  '/summary',
  requireAuth,
  query('projectId').optional().isInt(),
  query('userId').optional().isInt(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('groupBy').optional().isIn(['user', 'project', 'date', 'type']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { projectId, userId, startDate, endDate, groupBy = 'user' } = req.query;
    try {
      let sql = '';
      const args = [];
      const conditions = [];

      if (projectId) {
        conditions.push('t.project_id = ?');
        args.push(Number(projectId));
      }
      if (userId) {
        conditions.push('t.user_id = ?');
        args.push(Number(userId));
      }
      if (startDate) {
        conditions.push('t.work_date >= ?');
        args.push(startDate);
      }
      if (endDate) {
        conditions.push('t.work_date <= ?');
        args.push(endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      switch (groupBy) {
        case 'user':
          sql = `
            SELECT 
              t.user_id,
              u.username, u.full_name, u.standard_hours,
              d.name as department_name,
              SUM(t.hours) as total_hours,
              COUNT(DISTINCT t.work_date) as work_days,
              COUNT(DISTINCT t.project_id) as project_count,
              COUNT(t.id) as log_count
            FROM time_logs t
            LEFT JOIN users u ON u.id = t.user_id
            LEFT JOIN user_departments d ON d.id = u.department_id
            ${whereClause}
            GROUP BY t.user_id
            ORDER BY total_hours DESC
          `;
          break;
        case 'project':
          sql = `
            SELECT 
              t.project_id,
              p.name as project_name,
              SUM(t.hours) as total_hours,
              COUNT(DISTINCT t.user_id) as member_count,
              COUNT(DISTINCT t.work_date) as work_days,
              COUNT(t.id) as log_count
            FROM time_logs t
            LEFT JOIN projects p ON p.id = t.project_id
            ${whereClause}
            GROUP BY t.project_id
            ORDER BY total_hours DESC
          `;
          break;
        case 'date':
          sql = `
            SELECT 
              t.work_date,
              SUM(t.hours) as total_hours,
              COUNT(DISTINCT t.user_id) as user_count,
              COUNT(t.id) as log_count
            FROM time_logs t
            ${whereClause}
            GROUP BY t.work_date
            ORDER BY t.work_date DESC
          `;
          break;
        case 'type':
          sql = `
            SELECT 
              t.work_type,
              SUM(t.hours) as total_hours,
              COUNT(t.id) as log_count
            FROM time_logs t
            ${whereClause}
            GROUP BY t.work_type
            ORDER BY total_hours DESC
          `;
          break;
      }

      const rows = db.prepare(sql).all(...args);

      // 计算负载率（按用户分组时）
      if (groupBy === 'user' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const workDays = calculateWorkDays(start, end);

        rows.forEach((row) => {
          const standardHours = row.standard_hours || 8;
          const expectedHours = workDays * standardHours;
          row.expected_hours = expectedHours;
          row.load_rate = expectedHours > 0 ? Math.round((row.total_hours / expectedHours) * 100) : 0;
          row.is_overload = row.load_rate > 80;
        });
      }

      res.json(rows);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** GET /api/time-logs/workload - 人力负载看板 */
router.get(
  '/workload',
  requireAuth,
  query('projectId').optional().isInt(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { projectId, startDate, endDate } = req.query;

    // 默认查询本周
    const today = new Date();
    const weekStart = startDate || getMonday(today).toISOString().split('T')[0];
    const weekEnd = endDate || getSunday(today).toISOString().split('T')[0];

    try {
      // 1. 获取所有项目成员
      let membersSql = `
        SELECT 
          u.id, u.username, u.full_name, u.standard_hours,
          d.name as department_name,
          pm.role_in_project
        FROM project_members pm
        LEFT JOIN users u ON u.id = pm.user_id
        LEFT JOIN user_departments d ON d.id = u.department_id
        WHERE pm.project_id = ?
      `;
      const members = projectId
        ? db.prepare(membersSql).all(Number(projectId))
        : db.prepare(`SELECT id, username, full_name, standard_hours, NULL as department_name, NULL as role_in_project FROM users`).all();

      // 2. 获取工时统计
      const workDays = calculateWorkDays(new Date(weekStart), new Date(weekEnd));

      let timeLogsSql = `
        SELECT 
          user_id,
          SUM(hours) as total_hours,
          COUNT(DISTINCT work_date) as work_days,
          GROUP_CONCAT(DISTINCT project_id) as project_ids
        FROM time_logs
        WHERE work_date >= ? AND work_date <= ?
      `;
      const args = [weekStart, weekEnd];

      if (projectId) {
        timeLogsSql += ` AND project_id = ?`;
        args.push(Number(projectId));
      }

      timeLogsSql += ` GROUP BY user_id`;

      const timeStats = db.prepare(timeLogsSql).all(...args);
      const timeMap = new Map(timeStats.map((t) => [t.user_id, t]));

      // 3. 获取任务分配情况
      let tasksSql = `
        SELECT 
          assignee_id,
          COUNT(*) as task_count,
          SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo_count,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done_count,
          SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked_count
        FROM tasks
        WHERE assignee_id IS NOT NULL
      `;
      const taskArgs = [];
      if (projectId) {
        tasksSql += ` AND project_id = ?`;
        taskArgs.push(Number(projectId));
      }
      tasksSql += ` GROUP BY assignee_id`;

      const taskStats = db.prepare(tasksSql).all(...taskArgs);
      const taskMap = new Map(taskStats.map((t) => [t.assignee_id, t]));

      // 4. 组装结果
      const result = members.map((m) => {
        const timeData = timeMap.get(m.id) || { total_hours: 0, work_days: 0, project_ids: '' };
        const taskData = taskMap.get(m.id) || { task_count: 0, todo_count: 0, in_progress_count: 0, done_count: 0, blocked_count: 0 };

        const standardHours = m.standard_hours || 8;
        const expectedHours = workDays * standardHours;
        const loadRate = expectedHours > 0 ? Math.round((timeData.total_hours / expectedHours) * 100) : 0;

        return {
          ...m,
          ...timeData,
          ...taskData,
          work_days_in_period: workDays,
          expected_hours: expectedHours,
          load_rate: loadRate,
          is_overload: loadRate > 80,
          load_status: loadRate > 100 ? 'overload' : loadRate > 80 ? 'warning' : 'normal',
        };
      });

      // 按负载率降序排序
      result.sort((a, b) => b.load_rate - a.load_rate);

      // 5. 汇总统计
      const summary = {
        total_members: result.length,
        total_hours: result.reduce((sum, r) => sum + r.total_hours, 0),
        avg_load_rate: result.length > 0 ? Math.round(result.reduce((sum, r) => sum + r.load_rate, 0) / result.length) : 0,
        overload_count: result.filter((r) => r.is_overload).length,
        warning_count: result.filter((r) => r.load_rate > 60 && r.load_rate <= 80).length,
        idle_count: result.filter((r) => r.load_rate < 40).length,
        period_start: weekStart,
        period_end: weekEnd,
        work_days: workDays,
      };

      res.json({ members: result, summary });
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** GET /api/time-logs/:id - 获取单条工时记录 */
router.get('/:id', requireAuth, param('id').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const row = db
      .prepare(
        `SELECT t.*, 
                p.name as project_name,
                u.username, u.full_name,
                task.title as task_title
         FROM time_logs t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN users u ON u.id = t.user_id
         LEFT JOIN tasks task ON task.id = t.task_id
         WHERE t.id = ?`,
      )
      .get(req.params.id);

    if (!row) return res.status(404).json({ message: '工时记录不存在' });
    res.json(row);
  } catch (e) {
    sendServerError(res, e);
  }
});

/** POST /api/time-logs - 创建工时记录 */
router.post(
  '/',
  requireAuth,
  body('project_id').isInt(),
  body('work_date').isISO8601(),
  body('hours').isFloat({ min: 0.5, max: 24 }),
  body('task_id').optional().isInt(),
  body('work_type').optional().isIn(workTypes),
  body('description').optional().trim(),
  body('status').optional().isIn(timeLogStatus),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user.id;
    const { project_id, task_id, work_date, hours, work_type = 'development', description, status = 'submitted' } = req.body;

    try {
      // 检查是否已存在同一天的记录
      const existing = db
        .prepare(
          `SELECT * FROM time_logs WHERE project_id = ? AND user_id = ? AND work_date = ? AND (task_id = ? OR (task_id IS NULL AND ? IS NULL))`,
        )
        .get(project_id, userId, work_date, task_id || null, task_id || null);

      if (existing) {
        return res.status(409).json({ message: '该日期已存在工时记录，请编辑现有记录' });
      }

      const info = db
        .prepare(
          `INSERT INTO time_logs (project_id, user_id, task_id, work_date, hours, work_type, description, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(project_id, userId, task_id || null, work_date, hours, work_type, description || null, status);

      const row = db
        .prepare(
          `SELECT t.*, p.name as project_name, u.username, u.full_name
           FROM time_logs t
           LEFT JOIN projects p ON p.id = t.project_id
           LEFT JOIN users u ON u.id = t.user_id
           WHERE t.id = ?`,
        )
        .get(insertId(info));

      res.status(201).json(row);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** POST /api/time-logs/batch - 批量创建工时记录（按周填报） */
router.post(
  '/batch',
  requireAuth,
  body('records').isArray({ min: 1, max: 7 }),
  body('records.*.project_id').isInt(),
  body('records.*.work_date').isISO8601(),
  body('records.*.hours').isFloat({ min: 0.5, max: 24 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user.id;
    const { records } = req.body;

    try {
      const stmt = db.prepare(
        `INSERT INTO time_logs (project_id, user_id, task_id, work_date, hours, work_type, description, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      const inserted = [];
      for (const r of records) {
        const info = stmt.run(
          r.project_id,
          userId,
          r.task_id || null,
          r.work_date,
          r.hours,
          r.work_type || 'development',
          r.description || null,
          r.status || 'submitted',
        );
        inserted.push(insertId(info));
      }

      const rows = db
        .prepare(
          `SELECT t.*, p.name as project_name, u.full_name
           FROM time_logs t
           LEFT JOIN projects p ON p.id = t.project_id
           LEFT JOIN users u ON u.id = t.user_id
           WHERE t.id IN (${inserted.map(() => '?').join(',')})`,
        )
        .all(...inserted);

      res.status(201).json(rows);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ message: '部分日期已存在工时记录' });
      }
      sendServerError(res, e);
    }
  },
);

/** PUT /api/time-logs/:id - 更新工时记录 */
router.put(
  '/:id',
  requireAuth,
  param('id').isInt(),
  body('hours').optional().isFloat({ min: 0.5, max: 24 }),
  body('work_type').optional().isIn(workTypes),
  body('description').optional().trim(),
  body('status').optional().isIn(timeLogStatus),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = Number(req.params.id);
    const userId = req.user.id;

    try {
      const existing = db.prepare(`SELECT * FROM time_logs WHERE id = ?`).get(id);
      if (!existing) return res.status(404).json({ message: '工时记录不存在' });

      // 只能修改自己的记录，管理员可以修改所有
      if (existing.user_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ message: '无权修改此记录' });
      }

      const next = { ...existing, ...req.body };

      db.prepare(
        `UPDATE time_logs SET
          hours = ?, work_type = ?, description = ?, status = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(next.hours, next.work_type, next.description || null, next.status, id);

      const row = db
        .prepare(
          `SELECT t.*, p.name as project_name, u.full_name
           FROM time_logs t
           LEFT JOIN projects p ON p.id = t.project_id
           LEFT JOIN users u ON u.id = t.user_id
           WHERE t.id = ?`,
        )
        .get(id);

      res.json(row);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** POST /api/time-logs/:id/approve - 审批工时记录 */
router.post(
  '/:id/approve',
  requireAuth,
  param('id').isInt(),
  body('approved').isBoolean(),
  body('reason').optional().trim(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = Number(req.params.id);
    const { approved, reason } = req.body;
    const approverId = req.user.id;

    try {
      const existing = db.prepare(`SELECT * FROM time_logs WHERE id = ?`).get(id);
      if (!existing) return res.status(404).json({ message: '工时记录不存在' });

      if (existing.status !== 'submitted') {
        return res.status(400).json({ message: '只能审批已提交的记录' });
      }

      const status = approved ? 'approved' : 'rejected';
      db.prepare(
        `UPDATE time_logs SET status = ?, approver_id = ?, approved_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`,
      ).run(status, approverId, id);

      const row = db
        .prepare(
          `SELECT t.*, p.name as project_name, u.full_name, approver.full_name as approver_name
           FROM time_logs t
           LEFT JOIN projects p ON p.id = t.project_id
           LEFT JOIN users u ON u.id = t.user_id
           LEFT JOIN users approver ON approver.id = t.approver_id
           WHERE t.id = ?`,
        )
        .get(id);

      res.json(row);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** DELETE /api/time-logs/:id - 删除工时记录 */
router.delete('/:id', requireAuth, param('id').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = Number(req.params.id);
  const userId = req.user.id;

  try {
    const existing = db.prepare(`SELECT * FROM time_logs WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ message: '工时记录不存在' });

    // 只能删除自己的草稿或未审批记录
    if (existing.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权删除此记录' });
    }

    if (existing.status === 'approved') {
      return res.status(400).json({ message: '已审批的记录不能删除' });
    }

    db.prepare(`DELETE FROM time_logs WHERE id = ?`).run(id);
    res.status(204).send();
  } catch (e) {
    sendServerError(res, e);
  }
});

// ==================== 辅助函数 ====================

/** 计算工作日数量（排除周末） */
function calculateWorkDays(startDate, endDate) {
  let count = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/** 获取本周一 */
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/** 获取本周日 */
function getSunday(date) {
  const monday = getMonday(date);
  return new Date(monday.setDate(monday.getDate() + 6));
}

export default router;
