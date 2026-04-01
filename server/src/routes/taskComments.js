/**
 * 任务备注 REST API
 * GET    /api/tasks/:taskId/comments
 * POST   /api/tasks/:taskId/comments
 * PUT    /api/tasks/:taskId/comments/:id
 * DELETE /api/tasks/:taskId/comments/:id
 */
import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db, insertId } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendServerError } from '../utils/http.js';

const router = Router({ mergeParams: true });

/** 获取任务的所有备注 */
router.get('/', requireAuth, param('taskId').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  const { taskId } = req.params;
  try {
    // 验证任务存在
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!task) return res.status(404).json({ message: '任务不存在' });

    const comments = db
      .prepare(
        `SELECT c.*, u.username, u.full_name
         FROM task_comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.task_id = ?
         ORDER BY c.created_at DESC`,
      )
      .all(taskId);
    res.json(comments);
  } catch (e) {
    sendServerError(res, e);
  }
});

/** 添加备注 */
router.post(
  '/',
  requireAuth,
  param('taskId').isInt(),
  body('content').trim().notEmpty().withMessage('备注内容不能为空'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { taskId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    try {
      // 验证任务存在
      const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
      if (!task) return res.status(404).json({ message: '任务不存在' });

      const info = db
        .prepare(
          `INSERT INTO task_comments (task_id, user_id, content)
           VALUES (?, ?, ?)`,
        )
        .run(taskId, userId, content);

      const comment = db
        .prepare(
          `SELECT c.*, u.username, u.full_name
           FROM task_comments c
           LEFT JOIN users u ON u.id = c.user_id
           WHERE c.id = ?`,
        )
        .get(insertId(info));

      res.status(201).json(comment);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** 更新备注 */
router.put(
  '/:id',
  requireAuth,
  param('taskId').isInt(),
  param('id').isInt(),
  body('content').trim().notEmpty().withMessage('备注内容不能为空'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { taskId, id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    try {
      const existing = db
        .prepare('SELECT * FROM task_comments WHERE id = ? AND task_id = ?')
        .get(id, taskId);
      
      if (!existing) return res.status(404).json({ message: '备注不存在' });
      
      // 只有备注作者可以修改
      if (existing.user_id !== userId) {
        return res.status(403).json({ message: '只能修改自己的备注' });
      }

      db.prepare(
        `UPDATE task_comments SET content = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(content, id);

      const comment = db
        .prepare(
          `SELECT c.*, u.username, u.full_name
           FROM task_comments c
           LEFT JOIN users u ON u.id = c.user_id
           WHERE c.id = ?`,
        )
        .get(id);

      res.json(comment);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** 删除备注 */
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
        .prepare('SELECT * FROM task_comments WHERE id = ? AND task_id = ?')
        .get(id, taskId);
      
      if (!existing) return res.status(404).json({ message: '备注不存在' });
      
      // 只有备注作者或管理员可以删除
      if (existing.user_id !== userId && !isAdmin) {
        return res.status(403).json({ message: '只能删除自己的备注' });
      }

      db.prepare('DELETE FROM task_comments WHERE id = ?').run(id);
      res.status(204).send();
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

export default router;
