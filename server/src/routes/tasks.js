/**
 * 任务 REST API（支持 WBS 父节点、里程碑、起止日、进度；?plan=1 返回甘特用扩展字段）
 * GET    /api/tasks?projectId=&status=&priority=&assignee_id=&overdue=&plan=1
 * GET    /api/tasks/:id
 * POST   /api/tasks
 * POST   /api/tasks/sync    - 从其他模块同步创建任务（预留接口）
 * POST   /api/tasks/batch   - 批量操作
 * PUT    /api/tasks/:id
 * DELETE /api/tasks/:id  — 级联删除子任务
 */
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db, insertId } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendServerError } from '../utils/http.js';
import {
  enrichPlanTasks,
  deleteTaskWithDescendants,
  rollupAncestorProgress,
} from '../services/planTaskService.js';

const router = Router();

const taskStatus = ['todo', 'in_progress', 'blocked', 'done'];
const priorityValues = ['low', 'medium', 'high', 'critical'];

function validateParentAndMilestone(projectId, parentId, milestoneId) {
  if (parentId) {
    const p = db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(parentId);
    if (!p) return '父任务不存在';
    if (p.project_id !== projectId) return '父任务必须与当前任务属于同一项目';
  }
  if (milestoneId) {
    const m = db.prepare('SELECT project_id FROM plan_milestones WHERE id = ?').get(milestoneId);
    if (!m) return '里程碑不存在';
    if (m.project_id !== projectId) return '里程碑必须与当前任务属于同一项目';
  }
  return null;
}

/** 新父节点是否落在当前任务子树中（会形成环） */
function parentWouldCreateCycle(taskId, newParentId) {
  if (!newParentId) return false;
  if (Number(newParentId) === Number(taskId)) return true;
  let cur = Number(newParentId);
  const seen = new Set();
  while (cur) {
    if (cur === Number(taskId)) return true;
    if (seen.has(cur)) break;
    seen.add(cur);
    const row = db.prepare('SELECT parent_id FROM tasks WHERE id = ?').get(cur);
    cur = row?.parent_id != null ? Number(row.parent_id) : null;
  }
  return false;
}

function selectTasksForProject(projectId) {
  return db
    .prepare(
      `SELECT t.*, u.username AS assignee_name, u.full_name AS assignee_full_name,
              r.username AS reporter_name, r.full_name AS reporter_full_name,
              m.name AS milestone_name, m.phase_template AS milestone_phase
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       LEFT JOIN users r ON r.id = t.reporter_id
       LEFT JOIN plan_milestones m ON m.id = t.milestone_id
       WHERE t.project_id = ?
       ORDER BY t.parent_id IS NOT NULL, t.parent_id, t.sort_order ASC, t.id ASC`,
    )
    .all(projectId);
}

/**
 * GET /api/tasks - 获取任务列表（支持多条件筛选）
 * 查询参数：
 * - projectId: 项目ID
 * - status: 任务状态（可多选，逗号分隔）
 * - priority: 优先级（可多选，逗号分隔）
 * - assignee_id: 责任人ID
 * - overdue: 是否逾期 (1=是)
 * - plan: 是否返回甘特用扩展字段
 */
router.get(
  '/',
  requireAuth,
  query('projectId').optional().isInt(),
  query('status').optional(),
  query('priority').optional(),
  query('assignee_id').optional().isInt(),
  query('overdue').optional().isIn(['0', '1']),
  query('plan').optional().isIn(['0', '1']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    const { projectId, status, priority, assignee_id, overdue, plan } = req.query;
    
    try {
      let sql = `SELECT t.*, 
                 u.username AS assignee_name, u.full_name AS assignee_full_name,
                 r.username AS reporter_name, r.full_name AS reporter_full_name,
                 m.name AS milestone_name, m.phase_template AS milestone_phase,
                 p.name AS project_name
                 FROM tasks t
                 LEFT JOIN users u ON u.id = t.assignee_id
                 LEFT JOIN users r ON r.id = t.reporter_id
                 LEFT JOIN plan_milestones m ON m.id = t.milestone_id
                 LEFT JOIN projects p ON p.id = t.project_id`;
      
      const conditions = [];
      const params = [];

      if (projectId) {
        conditions.push('t.project_id = ?');
        params.push(Number(projectId));
      }

      if (status) {
        const statusList = status.split(',').map(s => s.trim()).filter(s => taskStatus.includes(s));
        if (statusList.length > 0) {
          conditions.push(`t.status IN (${statusList.map(() => '?').join(',')})`);
          params.push(...statusList);
        }
      }

      if (priority) {
        const priorityList = priority.split(',').map(p => p.trim()).filter(p => priorityValues.includes(p));
        if (priorityList.length > 0) {
          conditions.push(`t.priority IN (${priorityList.map(() => '?').join(',')})`);
          params.push(...priorityList);
        }
      }

      if (assignee_id) {
        conditions.push('t.assignee_id = ?');
        params.push(Number(assignee_id));
      }

      if (overdue === '1') {
        conditions.push("t.due_date IS NOT NULL AND t.due_date < date('now') AND t.status != 'done'");
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY t.priority DESC, t.due_date ASC, t.updated_at DESC';

      const rows = db.prepare(sql).all(...params);
      
      if (plan === '1') {
        const enrichedRows = enrichPlanTasks(rows);
        return res.json(enrichedRows);
      }
      
      res.json(rows);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/**
 * GET /api/tasks/:id - 获取任务详情（包含备注、附件、提醒）
 */
router.get('/:id', requireAuth, param('id').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  try {
    const row = db
      .prepare(
        `SELECT t.*, 
                u.username AS assignee_name, u.full_name AS assignee_full_name,
                r.username AS reporter_name, r.full_name AS reporter_full_name,
                m.name AS milestone_name, m.phase_template AS milestone_phase,
                p.name AS project_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         LEFT JOIN users r ON r.id = t.reporter_id
         LEFT JOIN plan_milestones m ON m.id = t.milestone_id
         LEFT JOIN projects p ON p.id = t.project_id
         WHERE t.id = ?`,
      )
      .get(req.params.id);
    
    if (!row) return res.status(404).json({ message: '任务不存在' });

    // 获取备注
    const comments = db
      .prepare(
        `SELECT c.*, u.username, u.full_name
         FROM task_comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.task_id = ?
         ORDER BY c.created_at DESC`,
      )
      .all(req.params.id);

    // 获取附件
    const attachments = db
      .prepare(
        `SELECT a.*, u.username, u.full_name
         FROM task_attachments a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.task_id = ?
         ORDER BY a.created_at DESC`,
      )
      .all(req.params.id);

    // 获取提醒
    const reminders = db
      .prepare(
        `SELECT r.*, u.username
         FROM task_reminders r
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.task_id = ?
         ORDER BY r.reminder_time ASC`,
      )
      .all(req.params.id);

    res.json({ ...row, comments, attachments, reminders });
  } catch (e) {
    sendServerError(res, e);
  }
});

/**
 * POST /api/tasks - 创建任务
 */
router.post(
  '/',
  requireAuth,
  body('project_id').isInt(),
  body('title').trim().notEmpty(),
  body('description').optional(),
  body('status').optional().isIn(taskStatus),
  body('priority').optional().isIn(priorityValues),
  body('assignee_id').optional().isInt(),
  body('reporter_id').optional().isInt(),
  body('due_date').optional(),
  body('parent_id').optional({ nullable: true }).isInt(),
  body('milestone_id').optional({ nullable: true }).isInt(),
  body('start_date').optional({ nullable: true }),
  body('end_date').optional({ nullable: true }),
  body('progress').optional().isFloat({ min: 0, max: 100 }),
  body('sort_order').optional().isInt(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const {
      project_id,
      title,
      description,
      status,
      priority,
      assignee_id,
      reporter_id,
      due_date,
      parent_id,
      milestone_id,
      start_date,
      end_date,
      progress,
      sort_order,
    } = req.body;
    const err = validateParentAndMilestone(
      project_id,
      parent_id ?? null,
      milestone_id ?? null,
    );
    if (err) return res.status(400).json({ message: err });
    const end = end_date ?? due_date ?? null;
    const due = due_date ?? end;
    try {
      const info = db
        .prepare(
          `INSERT INTO tasks (
            project_id, title, description, status, priority,
            assignee_id, reporter_id, due_date, parent_id, milestone_id,
            start_date, end_date, progress, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          project_id,
          title,
          description ?? null,
          status || 'todo',
          priority || 'medium',
          assignee_id ?? null,
          reporter_id ?? req.user.id,
          due ?? null,
          parent_id ?? null,
          milestone_id ?? null,
          start_date ?? null,
          end ?? null,
          progress ?? 0,
          sort_order ?? 0,
        );
      const newId = insertId(info);
      rollupAncestorProgress(newId);
      const row = db
        .prepare(
          `SELECT t.*, u.username AS assignee_name, u.full_name AS assignee_full_name,
                  r.username AS reporter_name, r.full_name AS reporter_full_name,
                  m.name AS milestone_name, m.phase_template AS milestone_phase
           FROM tasks t
           LEFT JOIN users u ON u.id = t.assignee_id
           LEFT JOIN users r ON r.id = t.reporter_id
           LEFT JOIN plan_milestones m ON m.id = t.milestone_id
           WHERE t.id = ?`,
        )
        .get(newId);
      res.status(201).json(row);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/**
 * POST /api/tasks/sync - 从其他模块同步创建任务（预留接口）
 * 用于：会议纪要模块、评审模块等自动创建关联任务
 */
router.post(
  '/sync',
  requireAuth,
  body('project_id').isInt(),
  body('title').trim().notEmpty(),
  body('source_type').isIn(['meeting', 'review', 'email', 'other']),
  body('source_id').notEmpty(),
  body('source_title').optional(),
  body('description').optional(),
  body('priority').optional().isIn(priorityValues),
  body('assignee_id').optional().isInt(),
  body('due_date').optional(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      project_id,
      title,
      source_type,
      source_id,
      source_title,
      description,
      priority,
      assignee_id,
      due_date,
    } = req.body;

    try {
      // 检查是否已存在相同来源的任务（防止重复同步）
      const existing = db
        .prepare(
          `SELECT t.* FROM tasks t
           JOIN task_external_links l ON l.task_id = t.id
           WHERE t.project_id = ? AND l.link_type = ? AND l.ref_id = ?`,
        )
        .get(project_id, source_type, source_id);

      if (existing) {
        return res.status(200).json({ 
          message: '该来源已存在关联任务', 
          task: existing,
          isDuplicate: true 
        });
      }

      // 创建任务
      const taskInfo = db
        .prepare(
          `INSERT INTO tasks (
            project_id, title, description, status, priority,
            assignee_id, reporter_id, due_date
          ) VALUES (?, ?, ?, 'todo', ?, ?, ?, ?)`,
        )
        .run(
          project_id,
          title,
          description ?? null,
          priority || 'medium',
          assignee_id ?? null,
          req.user.id,
          due_date ?? null,
        );
      
      const taskId = insertId(taskInfo);

      // 创建外部链接
      db.prepare(
        `INSERT INTO task_external_links (task_id, link_type, ref_id, ref_title, note)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(taskId, source_type, source_id, source_title ?? null, `从${source_type}模块同步创建`);

      rollupAncestorProgress(taskId);

      const row = db
        .prepare(
          `SELECT t.*, u.username AS assignee_name, u.full_name AS assignee_full_name,
                  r.username AS reporter_name, r.full_name AS reporter_full_name
           FROM tasks t
           LEFT JOIN users u ON u.id = t.assignee_id
           LEFT JOIN users r ON r.id = t.reporter_id
           WHERE t.id = ?`,
        )
        .get(taskId);

      res.status(201).json({ ...row, source_type, source_id, isDuplicate: false });
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/**
 * POST /api/tasks/batch - 批量操作
 * 支持：批量更新状态、批量分配、批量删除
 */
router.post(
  '/batch',
  requireAuth,
  body('action').isIn(['update_status', 'assign', 'delete']),
  body('task_ids').isArray({ min: 1 }),
  body('value').optional(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { action, task_ids, value } = req.body;
    const placeholders = task_ids.map(() => '?').join(',');

    try {
      switch (action) {
        case 'update_status':
          if (!taskStatus.includes(value)) {
            return res.status(400).json({ message: '无效的状态值' });
          }
          db.prepare(
            `UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`,
          ).run(value, ...task_ids);
          break;

        case 'assign':
          if (value && !db.prepare('SELECT id FROM users WHERE id = ?').get(value)) {
            return res.status(400).json({ message: '用户不存在' });
          }
          db.prepare(
            `UPDATE tasks SET assignee_id = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`,
          ).run(value ?? null, ...task_ids);
          break;

        case 'delete':
          for (const id of task_ids) {
            deleteTaskWithDescendants(Number(id));
          }
          break;
      }

      res.json({ message: '批量操作成功', affected: task_ids.length });
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/**
 * PUT /api/tasks/:id - 更新任务
 */
router.put(
  '/:id',
  requireAuth,
  param('id').isInt(),
  body('title').optional().trim().notEmpty(),
  body('description').optional({ nullable: true }),
  body('status').optional().isIn(taskStatus),
  body('priority').optional().isIn(priorityValues),
  body('assignee_id').optional({ nullable: true }).isInt(),
  body('reporter_id').optional({ nullable: true }).isInt(),
  body('due_date').optional({ nullable: true }),
  body('parent_id').optional({ nullable: true }).isInt(),
  body('milestone_id').optional({ nullable: true }).isInt(),
  body('start_date').optional({ nullable: true }),
  body('end_date').optional({ nullable: true }),
  body('progress').optional().isFloat({ min: 0, max: 100 }),
  body('sort_order').optional().isInt(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ message: '任务不存在' });
    const next = { ...existing, ...req.body };
    if (next.parent_id !== null && next.parent_id !== undefined) {
      const pid = Number(next.parent_id);
      if (parentWouldCreateCycle(id, pid)) {
        return res.status(400).json({ message: '无效的父任务（不能为自身或子任务）' });
      }
    }
    const err = validateParentAndMilestone(
      existing.project_id,
      next.parent_id ?? null,
      next.milestone_id ?? null,
    );
    if (err) return res.status(400).json({ message: err });

    const end = next.end_date ?? next.due_date ?? null;
    const due = next.due_date ?? end;
    try {
      db.prepare(
        `UPDATE tasks SET
          title = ?, description = ?, status = ?, priority = ?,
          assignee_id = ?, reporter_id = ?, due_date = ?,
          parent_id = ?, milestone_id = ?, start_date = ?, end_date = ?,
          progress = ?, sort_order = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
      ).run(
        next.title,
        next.description ?? null,
        next.status,
        next.priority,
        next.assignee_id ?? null,
        next.reporter_id ?? null,
        due ?? null,
        next.parent_id ?? null,
        next.milestone_id ?? null,
        next.start_date ?? null,
        end ?? null,
        next.progress ?? 0,
        next.sort_order ?? 0,
        id,
      );
      rollupAncestorProgress(id);
      const row = db
        .prepare(
          `SELECT t.*, u.username AS assignee_name, u.full_name AS assignee_full_name,
                  r.username AS reporter_name, r.full_name AS reporter_full_name,
                  m.name AS milestone_name, m.phase_template AS milestone_phase
           FROM tasks t
           LEFT JOIN users u ON u.id = t.assignee_id
           LEFT JOIN users r ON r.id = t.reporter_id
           LEFT JOIN plan_milestones m ON m.id = t.milestone_id
           WHERE t.id = ?`,
        )
        .get(id);
      res.json(row);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/**
 * DELETE /api/tasks/:id - 删除任务（级联删除子任务）
 */
router.delete('/:id', requireAuth, param('id').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const existing = db.prepare(`SELECT id FROM tasks WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ message: '任务不存在' });
    deleteTaskWithDescendants(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    sendServerError(res, e);
  }
});

export default router;
