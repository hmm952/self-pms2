/**
 * 任务提醒 REST API
 * GET    /api/tasks/:taskId/reminders
 * POST   /api/tasks/:taskId/reminders
 * DELETE /api/tasks/:taskId/reminders/:id
 * GET    /api/reminders/pending    - 获取当前用户的待发送提醒
 * POST   /api/reminders/check      - 检查并发送到期提醒（定时任务调用）
 */
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db, insertId } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendServerError } from '../utils/http.js';

const router = Router({ mergeParams: true });

const reminderTypes = ['due_date', 'before_due', 'overdue', 'custom'];

/** 获取任务的所有提醒 */
router.get('/', requireAuth, param('taskId').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { taskId } = req.params;
  try {
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!task) return res.status(404).json({ message: '任务不存在' });

    const reminders = db
      .prepare(
        `SELECT r.*, u.username
         FROM task_reminders r
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.task_id = ?
         ORDER BY r.reminder_time ASC`,
      )
      .all(taskId);
    res.json(reminders);
  } catch (e) {
    sendServerError(res, e);
  }
});

/** 创建提醒 */
router.post(
  '/',
  requireAuth,
  param('taskId').isInt(),
  body('reminder_type').optional().isIn(reminderTypes),
  body('reminder_time').isISO8601().withMessage('提醒时间格式不正确'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { taskId } = req.params;
    const { reminder_type, reminder_time } = req.body;
    const userId = req.user.id;

    try {
      const task = db.prepare('SELECT id, title, due_date FROM tasks WHERE id = ?').get(taskId);
      if (!task) return res.status(404).json({ message: '任务不存在' });

      const info = db
        .prepare(
          `INSERT INTO task_reminders (task_id, user_id, reminder_type, reminder_time)
           VALUES (?, ?, ?, ?)`,
        )
        .run(taskId, userId, reminder_type || 'custom', reminder_time);

      const reminder = db
        .prepare(
          `SELECT r.*, u.username, t.title as task_title, t.due_date as task_due_date
           FROM task_reminders r
           LEFT JOIN users u ON u.id = r.user_id
           LEFT JOIN tasks t ON t.id = r.task_id
           WHERE r.id = ?`,
        )
        .get(insertId(info));

      res.status(201).json(reminder);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** 删除提醒 */
router.delete(
  '/:id',
  requireAuth,
  param('taskId').isInt(),
  param('id').isInt(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { taskId, id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    try {
      const existing = db
        .prepare('SELECT * FROM task_reminders WHERE id = ? AND task_id = ?')
        .get(id, taskId);

      if (!existing) return res.status(404).json({ message: '提醒不存在' });

      if (existing.user_id !== userId && !isAdmin) {
        return res.status(403).json({ message: '只能删除自己的提醒' });
      }

      db.prepare('DELETE FROM task_reminders WHERE id = ?').run(id);
      res.status(204).send();
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** 获取当前用户的待发送提醒 */
router.get('/pending', requireAuth, (req, res) => {
  const userId = req.user.id;
  try {
    const reminders = db
      .prepare(
        `SELECT r.*, t.title as task_title, t.status as task_status, t.due_date as task_due_date,
                t.priority as task_priority, p.name as project_name
         FROM task_reminders r
         LEFT JOIN tasks t ON t.id = r.task_id
         LEFT JOIN projects p ON p.id = t.project_id
         WHERE r.user_id = ? AND r.is_sent = 0
         ORDER BY r.reminder_time ASC`,
      )
      .all(userId);
    res.json(reminders);
  } catch (e) {
    sendServerError(res, e);
  }
});

/**
 * 检查并发送到期提醒（定时任务或前端轮询调用）
 * 返回需要提醒的任务列表（前端展示用）
 */
router.post('/check', requireAuth, (req, res) => {
  const userId = req.user.id;
  const now = new Date().toISOString();
  const isAdmin = req.user.role === 'admin';

  try {
    // 查找需要发送的提醒
    const pendingReminders = db
      .prepare(
        `SELECT r.*, t.title as task_title, t.status as task_status, t.due_date as task_due_date,
                t.priority as task_priority, p.name as project_name, u.username
         FROM task_reminders r
         LEFT JOIN tasks t ON t.id = r.task_id
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.is_sent = 0 AND r.reminder_time <= ? AND r.user_id = ?
         ORDER BY r.reminder_time ASC`,
      )
      .all(now, userId);

    // 标记为已发送
    if (pendingReminders.length > 0) {
      const ids = pendingReminders.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE task_reminders SET is_sent = 1, sent_at = ? WHERE id IN (${placeholders})`).run(now, ...ids);
    }

    // 查找逾期任务（超过截止日期且未完成）
    const overdueTasks = db
      .prepare(
        `SELECT t.*, p.name as project_name, u.username as assignee_name
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE t.due_date IS NOT NULL 
           AND t.due_date < date('now') 
           AND t.status != 'done'
           AND (t.assignee_id = ? OR ? = 'admin')
         ORDER BY t.due_date ASC`,
      )
      .all(userId, req.user.role);

    // 查找即将到期的任务（24小时内）
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const upcomingTasks = db
      .prepare(
        `SELECT t.*, p.name as project_name, u.username as assignee_name
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE t.due_date IS NOT NULL 
           AND t.due_date >= date('now')
           AND t.due_date <= ?
           AND t.status != 'done'
           AND (t.assignee_id = ? OR ? = 'admin')
         ORDER BY t.due_date ASC`,
      )
      .all(tomorrow.toISOString().split('T')[0], userId, req.user.role);

    res.json({
      reminders: pendingReminders,
      overdue: overdueTasks,
      upcoming: upcomingTasks,
    });
  } catch (e) {
    sendServerError(res, e);
  }
});

export default router;
