/**
 * KPI / 人力绩效 REST API（按项目+人员+指标+年月维度）
 */
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db, insertId, changeCount } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendServerError } from '../utils/http.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  query('projectId').optional().isInt(),
  query('userId').optional().isInt(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { projectId, userId } = req.query;
    try {
      let sql = `
        SELECT k.*, u.username, u.full_name
        FROM kpi_records k
        LEFT JOIN users u ON u.id = k.user_id
        WHERE 1=1
      `;
      const args = [];
      if (projectId) {
        sql += ` AND k.project_id = ?`;
        args.push(projectId);
      }
      if (userId) {
        sql += ` AND k.user_id = ?`;
        args.push(userId);
      }
      sql += ` ORDER BY k.period_year DESC, k.period_month DESC, k.id DESC`;
      const rows = db.prepare(sql).all(...args);
      res.json(rows);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

router.get('/:id', requireAuth, param('id').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const row = db
      .prepare(
        `SELECT k.*, u.username FROM kpi_records k LEFT JOIN users u ON u.id = k.user_id WHERE k.id = ?`,
      )
      .get(req.params.id);
    if (!row) return res.status(404).json({ message: 'KPI 记录不存在' });
    res.json(row);
  } catch (e) {
    sendServerError(res, e);
  }
});

router.post(
  '/',
  requireAuth,
  body('project_id').isInt(),
  body('metric_name').trim().notEmpty(),
  body('period_year').isInt({ min: 2000, max: 2100 }),
  body('period_month').isInt({ min: 1, max: 12 }),
  body('user_id').optional().isInt(),
  body('metric_unit').optional().trim(),
  body('target_value').optional().isFloat(),
  body('actual_value').optional().isFloat(),
  body('score').optional().isFloat(),
  body('comment').optional(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const {
      project_id,
      user_id,
      metric_name,
      metric_unit,
      period_year,
      period_month,
      target_value,
      actual_value,
      score,
      comment,
    } = req.body;
    try {
      const info = db
        .prepare(
          `INSERT INTO kpi_records (project_id, user_id, metric_name, metric_unit, period_year, period_month, target_value, actual_value, score, comment)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          project_id,
          user_id ?? null,
          metric_name,
          metric_unit ?? null,
          period_year,
          period_month,
          target_value ?? null,
          actual_value ?? null,
          score ?? null,
          comment ?? null,
        );
      const row = db.prepare(`SELECT * FROM kpi_records WHERE id = ?`).get(insertId(info));
      res.status(201).json(row);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ message: '同一项目/人员/指标/年月已存在记录' });
      }
      sendServerError(res, e);
    }
  },
);

router.put(
  '/:id',
  requireAuth,
  param('id').isInt(),
  body('metric_name').optional().trim().notEmpty(),
  body('metric_unit').optional({ nullable: true }).trim(),
  body('period_year').optional().isInt({ min: 2000, max: 2100 }),
  body('period_month').optional().isInt({ min: 1, max: 12 }),
  body('user_id').optional({ nullable: true }).isInt(),
  body('target_value').optional({ nullable: true }).isFloat(),
  body('actual_value').optional({ nullable: true }).isFloat(),
  body('score').optional({ nullable: true }).isFloat(),
  body('comment').optional({ nullable: true }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM kpi_records WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ message: 'KPI 记录不存在' });
    const next = { ...existing, ...req.body };
    try {
      db.prepare(
        `UPDATE kpi_records SET
          user_id = ?, metric_name = ?, metric_unit = ?, period_year = ?, period_month = ?,
          target_value = ?, actual_value = ?, score = ?, comment = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
      ).run(
        next.user_id ?? null,
        next.metric_name,
        next.metric_unit ?? null,
        next.period_year,
        next.period_month,
        next.target_value ?? null,
        next.actual_value ?? null,
        next.score ?? null,
        next.comment ?? null,
        id,
      );
      res.json(db.prepare(`SELECT * FROM kpi_records WHERE id = ?`).get(id));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ message: '更新后与唯一约束冲突' });
      }
      sendServerError(res, e);
    }
  },
);

router.delete('/:id', requireAuth, param('id').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const r = db.prepare(`DELETE FROM kpi_records WHERE id = ?`).run(req.params.id);
    if (changeCount(r) === 0) return res.status(404).json({ message: 'KPI 记录不存在' });
    res.status(204).send();
  } catch (e) {
    sendServerError(res, e);
  }
});

export default router;
