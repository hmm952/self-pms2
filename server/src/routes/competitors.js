/**
 * 竞品分析 REST API
 */
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db, insertId, changeCount } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendServerError } from '../utils/http.js';

const router = Router();

const threatLevels = ['low', 'medium', 'high'];

router.get(
  '/',
  requireAuth,
  query('projectId').optional().isInt(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      let rows;
      if (req.query.projectId) {
        rows = db
          .prepare(`SELECT * FROM competitors WHERE project_id = ? ORDER BY last_updated DESC, id DESC`)
          .all(req.query.projectId);
      } else {
        rows = db.prepare(`SELECT * FROM competitors ORDER BY last_updated DESC`).all();
      }
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
    const row = db.prepare(`SELECT * FROM competitors WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ message: '竞品记录不存在' });
    res.json(row);
  } catch (e) {
    sendServerError(res, e);
  }
});

router.post(
  '/',
  requireAuth,
  body('project_id').isInt(),
  body('name').trim().notEmpty(),
  body('model_or_line').optional().trim(),
  body('price_position').optional().trim(),
  body('key_features').optional(),
  body('gap_analysis').optional(),
  body('threat_level').optional().isIn(threatLevels),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const {
      project_id,
      name,
      model_or_line,
      price_position,
      key_features,
      gap_analysis,
      threat_level,
    } = req.body;
    try {
      const info = db
        .prepare(
          `INSERT INTO competitors (project_id, name, model_or_line, price_position, key_features, gap_analysis, threat_level, last_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        )
        .run(
          project_id,
          name,
          model_or_line ?? null,
          price_position ?? null,
          key_features ?? null,
          gap_analysis ?? null,
          threat_level || 'medium',
        );
      const row = db.prepare(`SELECT * FROM competitors WHERE id = ?`).get(insertId(info));
      res.status(201).json(row);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

router.put(
  '/:id',
  requireAuth,
  param('id').isInt(),
  body('name').optional().trim().notEmpty(),
  body('model_or_line').optional({ nullable: true }).trim(),
  body('price_position').optional({ nullable: true }).trim(),
  body('key_features').optional({ nullable: true }),
  body('gap_analysis').optional({ nullable: true }),
  body('threat_level').optional().isIn(threatLevels),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM competitors WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ message: '竞品记录不存在' });
    const next = { ...existing, ...req.body };
    try {
      db.prepare(
        `UPDATE competitors SET
          name = ?, model_or_line = ?, price_position = ?, key_features = ?,
          gap_analysis = ?, threat_level = ?, last_updated = datetime('now')
         WHERE id = ?`,
      ).run(
        next.name,
        next.model_or_line ?? null,
        next.price_position ?? null,
        next.key_features ?? null,
        next.gap_analysis ?? null,
        next.threat_level || 'medium',
        id,
      );
      res.json(db.prepare(`SELECT * FROM competitors WHERE id = ?`).get(id));
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

router.delete('/:id', requireAuth, param('id').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const r = db.prepare(`DELETE FROM competitors WHERE id = ?`).run(req.params.id);
    if (changeCount(r) === 0) return res.status(404).json({ message: '竞品记录不存在' });
    res.status(204).send();
  } catch (e) {
    sendServerError(res, e);
  }
});

export default router;
