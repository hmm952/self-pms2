/**
 * 合同 REST API
 */
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db, insertId, changeCount } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendServerError } from '../utils/http.js';

const router = Router();

const contractStatus = [
  'draft',
  'negotiating',
  'signed',
  'executing',
  'closed',
  'terminated',
];

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
          .prepare(`SELECT * FROM contracts WHERE project_id = ? ORDER BY updated_at DESC`)
          .all(req.query.projectId);
      } else {
        rows = db.prepare(`SELECT * FROM contracts ORDER BY updated_at DESC`).all();
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
    const row = db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ message: '合同不存在' });
    res.json(row);
  } catch (e) {
    sendServerError(res, e);
  }
});

router.post(
  '/',
  requireAuth,
  body('project_id').isInt(),
  body('title').trim().notEmpty(),
  body('counterparty').trim().notEmpty(),
  body('contract_type').optional().trim(),
  body('amount').optional().isFloat(),
  body('currency').optional().trim(),
  body('status').optional().isIn(contractStatus),
  body('effective_date').optional(),
  body('expiry_date').optional(),
  body('document_ref').optional(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const {
      project_id,
      title,
      counterparty,
      contract_type,
      amount,
      currency,
      status,
      effective_date,
      expiry_date,
      document_ref,
    } = req.body;
    try {
      const info = db
        .prepare(
          `INSERT INTO contracts (project_id, title, counterparty, contract_type, amount, currency, status, effective_date, expiry_date, document_ref)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          project_id,
          title,
          counterparty,
          contract_type ?? null,
          amount ?? null,
          currency || 'CNY',
          status || 'draft',
          effective_date ?? null,
          expiry_date ?? null,
          document_ref ?? null,
        );
      const row = db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(insertId(info));
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
  body('title').optional().trim().notEmpty(),
  body('counterparty').optional().trim().notEmpty(),
  body('contract_type').optional({ nullable: true }).trim(),
  body('amount').optional({ nullable: true }).isFloat(),
  body('currency').optional().trim(),
  body('status').optional().isIn(contractStatus),
  body('effective_date').optional({ nullable: true }),
  body('expiry_date').optional({ nullable: true }),
  body('document_ref').optional({ nullable: true }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ message: '合同不存在' });
    const next = { ...existing, ...req.body };
    try {
      db.prepare(
        `UPDATE contracts SET
          title = ?, counterparty = ?, contract_type = ?, amount = ?, currency = ?,
          status = ?, effective_date = ?, expiry_date = ?, document_ref = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
      ).run(
        next.title,
        next.counterparty,
        next.contract_type ?? null,
        next.amount ?? null,
        next.currency || 'CNY',
        next.status,
        next.effective_date ?? null,
        next.expiry_date ?? null,
        next.document_ref ?? null,
        id,
      );
      res.json(db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(id));
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

router.delete('/:id', requireAuth, param('id').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const r = db.prepare(`DELETE FROM contracts WHERE id = ?`).run(req.params.id);
    if (changeCount(r) === 0) return res.status(404).json({ message: '合同不存在' });
    res.status(204).send();
  } catch (e) {
    sendServerError(res, e);
  }
});

export default router;
