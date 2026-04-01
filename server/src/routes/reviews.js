/**
 * 评审 REST API（完整版）
 * 支持：评审模板、专家管理、打分、问题跟踪、报告生成
 */
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db, insertId, changeCount } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendServerError } from '../utils/http.js';

const router = Router();

const reviewTypes = ['design', 'process', 'safety', 'quality', 'milestone', 'other'];
const reviewStatus = ['draft', 'scheduled', 'in_progress', 'passed', 'conditional', 'rejected', 'cancelled'];
const phases = ['evt', 'dvt', 'pvt', 'mp', 'other'];
const issueSeverities = ['critical', 'major', 'minor', 'suggestion'];
const issueStatus = ['open', 'acknowledged', 'in_progress', 'resolved', 'closed'];

// ==================== 评审模板 ====================

/** GET /api/reviews/templates - 获取评审模板列表 */
router.get('/templates', requireAuth, (req, res) => {
  try {
    const rows = db
      .prepare(`SELECT * FROM review_templates WHERE is_active = 1 ORDER BY phase, id`)
      .all();
    res.json(rows.map((r) => ({
      ...r,
      scoring_criteria: r.scoring_criteria ? JSON.parse(r.scoring_criteria) : null,
      checklist_items: r.checklist_items ? JSON.parse(r.checklist_items) : null,
    })));
  } catch (e) {
    sendServerError(res, e);
  }
});

/** GET /api/reviews/templates/:id - 获取单个模板 */
router.get('/templates/:id', requireAuth, param('id').isInt(), (req, res) => {
  try {
    const row = db.prepare(`SELECT * FROM review_templates WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ message: '模板不存在' });
    res.json({
      ...row,
      scoring_criteria: row.scoring_criteria ? JSON.parse(row.scoring_criteria) : null,
      checklist_items: row.checklist_items ? JSON.parse(row.checklist_items) : null,
    });
  } catch (e) {
    sendServerError(res, e);
  }
});

// ==================== 评审列表 ====================

/** GET /api/reviews - 获取评审列表 */
router.get(
  '/',
  requireAuth,
  query('projectId').optional().isInt(),
  query('phase').optional().isIn(phases),
  query('status').optional(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { projectId, phase, status } = req.query;
    try {
      let sql = `SELECT r.*, 
                 p.name as project_name,
                 m.name as milestone_name,
                 u.full_name as applicant_name,
                 t.name as template_name
                 FROM reviews r
                 LEFT JOIN projects p ON p.id = r.project_id
                 LEFT JOIN plan_milestones m ON m.id = r.milestone_id
                 LEFT JOIN users u ON u.id = r.applicant_id
                 LEFT JOIN review_templates t ON t.id = r.template_id`;
      
      const conditions = [];
      const params = [];

      if (projectId) {
        conditions.push('r.project_id = ?');
        params.push(Number(projectId));
      }
      if (phase) {
        conditions.push('r.phase = ?');
        params.push(phase);
      }
      if (status) {
        const statusList = status.split(',').filter((s) => reviewStatus.includes(s));
        if (statusList.length > 0) {
          conditions.push(`r.status IN (${statusList.map(() => '?').join(',')})`);
          params.push(...statusList);
        }
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY r.review_date IS NULL, r.review_date DESC, r.id DESC';

      const rows = db.prepare(sql).all(...params);
      res.json(rows);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** GET /api/reviews/:id - 获取评审详情 */
router.get('/:id', requireAuth, param('id').isInt(), (req, res) => {
  try {
    const review = db
      .prepare(
        `SELECT r.*, 
         p.name as project_name,
         m.name as milestone_name, m.phase_template as milestone_phase,
         u.full_name as applicant_name,
         t.name as template_name, t.scoring_criteria, t.checklist_items
         FROM reviews r
         LEFT JOIN projects p ON p.id = r.project_id
         LEFT JOIN plan_milestones m ON m.id = r.milestone_id
         LEFT JOIN users u ON u.id = r.applicant_id
         LEFT JOIN review_templates t ON t.id = r.template_id
         WHERE r.id = ?`,
      )
      .get(req.params.id);

    if (!review) return res.status(404).json({ message: '评审不存在' });

    // 获取评审专家
    const experts = db
      .prepare(
        `SELECT e.*, u.username, u.full_name, u.email
         FROM review_experts e
         LEFT JOIN users u ON u.id = e.user_id
         WHERE e.review_id = ?
         ORDER BY e.role DESC, e.id`,
      )
      .all(req.params.id);

    // 获取打分记录
    const scores = db
      .prepare(
        `SELECT s.*, u.full_name as expert_name
         FROM review_scores s
         LEFT JOIN review_experts e ON e.id = s.expert_id
         LEFT JOIN users u ON u.id = e.user_id
         WHERE s.review_id = ?
         ORDER BY s.category, s.id`,
      )
      .all(req.params.id);

    // 获取问题列表
    const issues = db
      .prepare(
        `SELECT i.*, u.full_name as assigned_name, e.user_id as expert_user_id
         FROM review_issues i
         LEFT JOIN users u ON u.id = i.assigned_to
         LEFT JOIN review_experts e ON e.id = i.expert_id
         WHERE i.review_id = ?
         ORDER BY i.severity, i.status, i.id`,
      )
      .all(req.params.id);

    // 获取附件列表
    const attachments = db
      .prepare(
        `SELECT a.*, u.full_name as uploader_name
         FROM review_attachments a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.review_id = ?
         ORDER BY a.created_at DESC`,
      )
      .all(req.params.id);

    // 获取流程日志
    const workflowLog = db
      .prepare(
        `SELECT w.*, u.full_name as operator_name
         FROM review_workflow_log w
         LEFT JOIN users u ON u.id = w.user_id
         WHERE w.review_id = ?
         ORDER BY w.created_at DESC`,
      )
      .all(req.params.id);

    res.json({
      ...review,
      scoring_criteria: review.scoring_criteria ? JSON.parse(review.scoring_criteria) : null,
      checklist_items: review.checklist_items ? JSON.parse(review.checklist_items) : null,
      experts,
      scores,
      issues,
      attachments,
      workflowLog,
    });
  } catch (e) {
    sendServerError(res, e);
  }
});

/** POST /api/reviews - 创建评审申请 */
router.post(
  '/',
  requireAuth,
  body('project_id').isInt(),
  body('title').trim().notEmpty(),
  body('phase').optional().isIn(phases),
  body('template_id').optional().isInt(),
  body('milestone_id').optional().isInt(),
  body('review_type').optional().isIn(reviewTypes),
  body('review_date').optional(),
  body('location').optional(),
  body('agenda').optional(),
  body('applicant_id').optional().isInt(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      project_id,
      title,
      phase,
      template_id,
      milestone_id,
      review_type,
      review_date,
      location,
      agenda,
      applicant_id,
    } = req.body;

    try {
      const info = db
        .prepare(
          `INSERT INTO reviews (
            project_id, title, phase, template_id, milestone_id, review_type,
            status, lead_reviewer_id, review_date, location, agenda, applicant_id
          ) VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?, ?, ?)`,
        )
        .run(
          project_id,
          title,
          phase || 'evt',
          template_id ?? null,
          milestone_id ?? null,
          review_type || 'milestone',
          review_date ?? null,
          location ?? null,
          agenda ?? null,
          applicant_id ?? req.user.id,
        );

      const reviewId = insertId(info);

      // 记录流程日志
      db.prepare(
        `INSERT INTO review_workflow_log (review_id, action, from_status, to_status, user_id, comment)
         VALUES (?, 'create', NULL, 'draft', ?, '创建评审申请')`,
      ).run(reviewId, req.user.id);

      const review = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(reviewId);
      res.status(201).json(review);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** PUT /api/reviews/:id - 更新评审基本信息 */
router.put(
  '/:id',
  requireAuth,
  param('id').isInt(),
  body('title').optional().trim().notEmpty(),
  body('phase').optional().isIn(phases),
  body('template_id').optional({ nullable: true }).isInt(),
  body('milestone_id').optional({ nullable: true }).isInt(),
  body('review_type').optional().isIn(reviewTypes),
  body('review_date').optional({ nullable: true }),
  body('location').optional({ nullable: true }),
  body('agenda').optional({ nullable: true }),
  body('conclusion').optional({ nullable: true }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ message: '评审不存在' });

    const next = { ...existing, ...req.body };

    try {
      db.prepare(
        `UPDATE reviews SET
          title = ?, phase = ?, template_id = ?, milestone_id = ?, review_type = ?,
          review_date = ?, location = ?, agenda = ?, conclusion = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
      ).run(
        next.title,
        next.phase,
        next.template_id ?? null,
        next.milestone_id ?? null,
        next.review_type,
        next.review_date ?? null,
        next.location ?? null,
        next.agenda ?? null,
        next.conclusion ?? null,
        id,
      );

      const review = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(id);
      res.json(review);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** POST /api/reviews/:id/submit - 提交评审申请 */
router.post('/:id/submit', requireAuth, param('id').isInt(), (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ message: '评审不存在' });
    if (existing.status !== 'draft') {
      return res.status(400).json({ message: '只有草稿状态可以提交' });
    }

    db.prepare(
      `UPDATE reviews SET status = 'scheduled', updated_at = datetime('now') WHERE id = ?`,
    ).run(id);

    db.prepare(
      `INSERT INTO review_workflow_log (review_id, action, from_status, to_status, user_id, comment)
       VALUES (?, 'submit', 'draft', 'scheduled', ?, '提交评审申请')`,
    ).run(id, req.user.id);

    const review = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(id);
    res.json(review);
  } catch (e) {
    sendServerError(res, e);
  }
});

/** POST /api/reviews/:id/start - 开始评审 */
router.post('/:id/start', requireAuth, param('id').isInt(), (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ message: '评审不存在' });
    if (existing.status !== 'scheduled') {
      return res.status(400).json({ message: '只有已排期状态可以开始评审' });
    }

    db.prepare(
      `UPDATE reviews SET status = 'in_progress', started_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    ).run(id);

    db.prepare(
      `INSERT INTO review_workflow_log (review_id, action, from_status, to_status, user_id, comment)
       VALUES (?, 'start', 'scheduled', 'in_progress', ?, '开始评审')`,
    ).run(id, req.user.id);

    const review = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(id);
    res.json(review);
  } catch (e) {
    sendServerError(res, e);
  }
});

/** POST /api/reviews/:id/complete - 完成评审 */
router.post(
  '/:id/complete',
  requireAuth,
  param('id').isInt(),
  body('result').isIn(['passed', 'conditional', 'rejected']),
  body('conclusion').optional(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = Number(req.params.id);
    const { result, conclusion } = req.body;

    try {
      const existing = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(id);
      if (!existing) return res.status(404).json({ message: '评审不存在' });
      if (existing.status !== 'in_progress') {
        return res.status(400).json({ message: '只有进行中状态可以完成评审' });
      }

      // 计算总分
      const scores = db
        .prepare(`SELECT category, AVG(score) as avg_score FROM review_scores WHERE review_id = ? GROUP BY category`)
        .all(id);
      
      const template = existing.template_id
        ? db.prepare(`SELECT scoring_criteria FROM review_templates WHERE id = ?`).get(existing.template_id)
        : null;

      let totalScore = null;
      if (template?.scoring_criteria) {
        const criteria = JSON.parse(template.scoring_criteria);
        let weightedSum = 0;
        let totalWeight = 0;
        for (const c of criteria) {
          const s = scores.find((s) => s.category === c.category);
          if (s) {
            weightedSum += s.avg_score * c.weight;
            totalWeight += c.weight;
          }
        }
        if (totalWeight > 0) {
          totalScore = Math.round(weightedSum / totalWeight * 10) / 10;
        }
      }

      db.prepare(
        `UPDATE reviews SET status = ?, conclusion = ?, total_score = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      ).run(result, conclusion ?? null, totalScore, id);

      db.prepare(
        `INSERT INTO review_workflow_log (review_id, action, from_status, to_status, user_id, comment)
         VALUES (?, 'complete', 'in_progress', ?, ?, ?)`,
      ).run(id, result, req.user.id, conclusion || `评审结果: ${result}`);

      // 同步更新里程碑状态
      if (existing.milestone_id) {
        const milestoneResult = result === 'passed' ? 'achieved' : result === 'conditional' ? 'active' : 'delayed';
        db.prepare(
          `UPDATE plan_milestones SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        ).run(milestoneResult, existing.milestone_id);
      }

      const review = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(id);
      res.json(review);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** DELETE /api/reviews/:id - 删除评审 */
router.delete('/:id', requireAuth, param('id').isInt(), (req, res) => {
  try {
    const existing = db.prepare(`SELECT id, status FROM reviews WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ message: '评审不存在' });
    if (!['draft', 'cancelled'].includes(existing.status)) {
      return res.status(400).json({ message: '只有草稿或已取消状态可以删除' });
    }

    db.prepare(`DELETE FROM reviews WHERE id = ?`).run(req.params.id);
    res.status(204).send();
  } catch (e) {
    sendServerError(res, e);
  }
});

// ==================== 评审专家管理 ====================

/** GET /api/reviews/:id/experts - 获取评审专家列表 */
router.get('/:id/experts', requireAuth, param('id').isInt(), (req, res) => {
  try {
    const experts = db
      .prepare(
        `SELECT e.*, u.username, u.full_name, u.email
         FROM review_experts e
         LEFT JOIN users u ON u.id = e.user_id
         WHERE e.review_id = ?
         ORDER BY e.role DESC, e.id`,
      )
      .all(req.params.id);
    res.json(experts);
  } catch (e) {
    sendServerError(res, e);
  }
});

/** POST /api/reviews/:id/experts - 添加评审专家 */
router.post(
  '/:id/experts',
  requireAuth,
  param('id').isInt(),
  body('user_id').isInt(),
  body('role').optional().isIn(['lead', 'expert', 'observer']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { user_id, role } = req.body;
    const reviewId = Number(req.params.id);

    try {
      const review = db.prepare(`SELECT id FROM reviews WHERE id = ?`).get(reviewId);
      if (!review) return res.status(404).json({ message: '评审不存在' });

      const existing = db
        .prepare(`SELECT id FROM review_experts WHERE review_id = ? AND user_id = ?`)
        .get(reviewId, user_id);
      if (existing) return res.status(400).json({ message: '该用户已是评审专家' });

      const info = db
        .prepare(
          `INSERT INTO review_experts (review_id, user_id, role) VALUES (?, ?, ?)`,
        )
        .run(reviewId, user_id, role || 'expert');

      const expert = db
        .prepare(
          `SELECT e.*, u.username, u.full_name, u.email
           FROM review_experts e
           LEFT JOIN users u ON u.id = e.user_id
           WHERE e.id = ?`,
        )
        .get(insertId(info));

      res.status(201).json(expert);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** PUT /api/reviews/:id/experts/:expertId - 更新专家角色/状态 */
router.put(
  '/:id/experts/:expertId',
  requireAuth,
  param('id').isInt(),
  param('expertId').isInt(),
  body('role').optional().isIn(['lead', 'expert', 'observer']),
  body('invite_status').optional().isIn(['pending', 'accepted', 'declined']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { role, invite_status } = req.body;
    const { id, expertId } = req.params;

    try {
      const existing = db
        .prepare(`SELECT * FROM review_experts WHERE id = ? AND review_id = ?`)
        .get(expertId, id);
      if (!existing) return res.status(404).json({ message: '专家记录不存在' });

      const updates = [];
      const params = [];
      if (role) {
        updates.push('role = ?');
        params.push(role);
      }
      if (invite_status) {
        updates.push('invite_status = ?', 'responded_at = datetime("now")');
        params.push(invite_status);
      }
      if (updates.length === 0) return res.status(400).json({ message: '无更新内容' });

      params.push(expertId, id);
      db.prepare(`UPDATE review_experts SET ${updates.join(', ')} WHERE id = ? AND review_id = ?`).run(...params);

      const expert = db
        .prepare(
          `SELECT e.*, u.username, u.full_name, u.email
           FROM review_experts e
           LEFT JOIN users u ON u.id = e.user_id
           WHERE e.id = ?`,
        )
        .get(expertId);

      res.json(expert);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** DELETE /api/reviews/:id/experts/:expertId - 移除评审专家 */
router.delete(
  '/:id/experts/:expertId',
  requireAuth,
  param('id').isInt(),
  param('expertId').isInt(),
  (req, res) => {
    try {
      const result = db
        .prepare(`DELETE FROM review_experts WHERE id = ? AND review_id = ?`)
        .run(req.params.expertId, req.params.id);
      if (changeCount(result) === 0) {
        return res.status(404).json({ message: '专家记录不存在' });
      }
      res.status(204).send();
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

// ==================== 评审打分 ====================

/** GET /api/reviews/:id/scores - 获取打分记录 */
router.get('/:id/scores', requireAuth, param('id').isInt(), (req, res) => {
  try {
    const scores = db
      .prepare(
        `SELECT s.*, e.user_id as expert_user_id, u.full_name as expert_name
         FROM review_scores s
         LEFT JOIN review_experts e ON e.id = s.expert_id
         LEFT JOIN users u ON u.id = e.user_id
         WHERE s.review_id = ?
         ORDER BY s.expert_id, s.category`,
      )
      .all(req.params.id);
    res.json(scores);
  } catch (e) {
    sendServerError(res, e);
  }
});

/** POST /api/reviews/:id/scores - 提交打分 */
router.post(
  '/:id/scores',
  requireAuth,
  param('id').isInt(),
  body('scores').isArray({ min: 1 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const reviewId = Number(req.params.id);
    const { scores } = req.body;
    const userId = req.user.id;

    try {
      const review = db.prepare(`SELECT id FROM reviews WHERE id = ?`).get(reviewId);
      if (!review) return res.status(404).json({ message: '评审不存在' });

      // 获取当前用户的专家记录
      let expert = db
        .prepare(`SELECT id FROM review_experts WHERE review_id = ? AND user_id = ?`)
        .get(reviewId, userId);

      // 如果不是专家，自动添加为观察员
      if (!expert) {
        const info = db
          .prepare(`INSERT INTO review_experts (review_id, user_id, role, invite_status) VALUES (?, ?, 'observer', 'accepted')`)
          .run(reviewId, userId);
        expert = { id: insertId(info) };
      }

      // 删除该专家之前的打分
      db.prepare(`DELETE FROM review_scores WHERE review_id = ? AND expert_id = ?`).run(reviewId, expert.id);

      // 插入新打分
      const stmt = db.prepare(
        `INSERT INTO review_scores (review_id, expert_id, category, score, comment) VALUES (?, ?, ?, ?, ?)`,
      );

      for (const s of scores) {
        if (s.score < 0 || s.score > 100) {
          return res.status(400).json({ message: '分数必须在0-100之间' });
        }
        stmt.run(reviewId, expert.id, s.category, s.score, s.comment ?? null);
      }

      const result = db
        .prepare(
          `SELECT s.*, u.full_name as expert_name
           FROM review_scores s
           LEFT JOIN review_experts e ON e.id = s.expert_id
           LEFT JOIN users u ON u.id = e.user_id
           WHERE s.review_id = ? AND s.expert_id = ?
           ORDER BY s.category`,
        )
        .all(reviewId, expert.id);

      res.status(201).json(result);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

// ==================== 评审问题管理 ====================

/** GET /api/reviews/:id/issues - 获取问题列表 */
router.get('/:id/issues', requireAuth, param('id').isInt(), (req, res) => {
  try {
    const issues = db
      .prepare(
        `SELECT i.*, u.full_name as assigned_name, t.title as task_title
         FROM review_issues i
         LEFT JOIN users u ON u.id = i.assigned_to
         LEFT JOIN tasks t ON t.id = i.task_id
         WHERE i.review_id = ?
         ORDER BY 
           CASE i.severity WHEN 'critical' THEN 1 WHEN 'major' THEN 2 WHEN 'minor' THEN 3 ELSE 4 END,
           i.status,
           i.id`,
      )
      .all(req.params.id);
    res.json(issues);
  } catch (e) {
    sendServerError(res, e);
  }
});

/** POST /api/reviews/:id/issues - 创建评审问题 */
router.post(
  '/:id/issues',
  requireAuth,
  param('id').isInt(),
  body('category').notEmpty(),
  body('severity').isIn(issueSeverities),
  body('description').trim().notEmpty(),
  body('assigned_to').optional().isInt(),
  body('due_date').optional(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const reviewId = Number(req.params.id);
    const { category, severity, description, assigned_to, due_date } = req.body;
    const userId = req.user.id;

    try {
      const review = db.prepare(`SELECT id FROM reviews WHERE id = ?`).get(reviewId);
      if (!review) return res.status(404).json({ message: '评审不存在' });

      // 获取当前用户的专家记录
      const expert = db
        .prepare(`SELECT id FROM review_experts WHERE review_id = ? AND user_id = ?`)
        .get(reviewId, userId);

      const info = db
        .prepare(
          `INSERT INTO review_issues (review_id, category, severity, description, expert_id, assigned_to, due_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          reviewId,
          category,
          severity,
          description,
          expert?.id ?? null,
          assigned_to ?? null,
          due_date ?? null,
        );

      const issue = db
        .prepare(
          `SELECT i.*, u.full_name as assigned_name
           FROM review_issues i
           LEFT JOIN users u ON u.id = i.assigned_to
           WHERE i.id = ?`,
        )
        .get(insertId(info));

      res.status(201).json(issue);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** PUT /api/reviews/:id/issues/:issueId - 更新问题 */
router.put(
  '/:id/issues/:issueId',
  requireAuth,
  param('id').isInt(),
  param('issueId').isInt(),
  body('status').optional().isIn(issueStatus),
  body('assigned_to').optional({ nullable: true }).isInt(),
  body('due_date').optional({ nullable: true }),
  body('resolution').optional({ nullable: true }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id, issueId } = req.params;
    const { status, assigned_to, due_date, resolution } = req.body;

    try {
      const existing = db
        .prepare(`SELECT * FROM review_issues WHERE id = ? AND review_id = ?`)
        .get(issueId, id);
      if (!existing) return res.status(404).json({ message: '问题不存在' });

      const updates = [];
      const params = [];

      if (status) {
        updates.push('status = ?');
        params.push(status);
        if (status === 'resolved' || status === 'closed') {
          updates.push('resolved_at = datetime("now")');
        }
      }
      if (assigned_to !== undefined) {
        updates.push('assigned_to = ?');
        params.push(assigned_to);
      }
      if (due_date !== undefined) {
        updates.push('due_date = ?');
        params.push(due_date);
      }
      if (resolution !== undefined) {
        updates.push('resolution = ?');
        params.push(resolution);
      }

      if (updates.length === 0) return res.status(400).json({ message: '无更新内容' });

      updates.push('updated_at = datetime("now")');
      params.push(issueId, id);

      db.prepare(`UPDATE review_issues SET ${updates.join(', ')} WHERE id = ? AND review_id = ?`).run(...params);

      const issue = db
        .prepare(
          `SELECT i.*, u.full_name as assigned_name
           FROM review_issues i
           LEFT JOIN users u ON u.id = i.assigned_to
           WHERE i.id = ?`,
        )
        .get(issueId);

      res.json(issue);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** POST /api/reviews/:id/issues/:issueId/create-task - 将问题转为待办任务 */
router.post(
  '/:id/issues/:issueId/create-task',
  requireAuth,
  param('id').isInt(),
  param('issueId').isInt(),
  body('title').optional(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id, issueId } = req.params;
    const { title, priority } = req.body;

    try {
      const issue = db
        .prepare(`SELECT i.*, r.project_id FROM review_issues i JOIN reviews r ON r.id = i.review_id WHERE i.id = ? AND i.review_id = ?`)
        .get(issueId, id);
      if (!issue) return res.status(404).json({ message: '问题不存在' });
      if (issue.task_id) return res.status(400).json({ message: '该问题已关联任务' });

      // 创建任务
      const taskInfo = db
        .prepare(
          `INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_date, reporter_id)
           VALUES (?, ?, ?, 'todo', ?, ?, ?, ?)`,
        )
        .run(
          issue.project_id,
          title || `[评审问题] ${issue.category}`,
          issue.description,
          priority || (issue.severity === 'critical' ? 'critical' : issue.severity === 'major' ? 'high' : 'medium'),
          issue.assigned_to,
          issue.due_date,
          req.user.id,
        );

      const taskId = insertId(taskInfo);

      // 更新问题
      db.prepare(`UPDATE review_issues SET task_id = ?, status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(taskId, issueId);

      // 创建外部链接
      db.prepare(
        `INSERT INTO task_external_links (task_id, link_type, ref_id, ref_title, note)
         VALUES (?, 'review', ?, ?, ?)`,
      ).run(taskId, String(id), `评审问题 #${issueId}`, `从评审问题自动创建`);

      const task = db
        .prepare(
          `SELECT t.*, u.username AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.id = ?`,
        )
        .get(taskId);

      res.status(201).json({ task, issueId: Number(issueId), taskId });
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** DELETE /api/reviews/:id/issues/:issueId - 删除问题 */
router.delete(
  '/:id/issues/:issueId',
  requireAuth,
  param('id').isInt(),
  param('issueId').isInt(),
  (req, res) => {
    try {
      const result = db
        .prepare(`DELETE FROM review_issues WHERE id = ? AND review_id = ?`)
        .run(req.params.issueId, req.params.id);
      if (changeCount(result) === 0) {
        return res.status(404).json({ message: '问题不存在' });
      }
      res.status(204).send();
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

// ==================== 评审附件管理 ====================

/** GET /api/reviews/:id/attachments - 获取附件列表 */
router.get('/:id/attachments', requireAuth, param('id').isInt(), async (req, res) => {
  try {
    const attachments = db
      .prepare(
        `SELECT a.*, u.full_name as uploader_name
         FROM review_attachments a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.review_id = ?
         ORDER BY a.created_at DESC`,
      )
      .all(req.params.id);

    // 生成签名 URL
    const { S3Storage } = await import('coze-coding-dev-sdk');
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });

    const attachmentsWithUrl = await Promise.all(
      attachments.map(async (att) => {
        try {
          const url = await storage.generatePresignedUrl({ key: att.file_key, expireTime: 86400 });
          return { ...att, url };
        } catch {
          return { ...att, url: null };
        }
      }),
    );

    res.json(attachmentsWithUrl);
  } catch (e) {
    sendServerError(res, e);
  }
});

/** POST /api/reviews/:id/attachments - 上传附件 */
router.post(
  '/:id/attachments',
  requireAuth,
  param('id').isInt(),
  async (req, res) => {
    const reviewId = Number(req.params.id);
    const userId = req.user.id;
    const { fileName, fileContent, contentType, fileSize, category } = req.body;

    try {
      const review = db.prepare(`SELECT id FROM reviews WHERE id = ?`).get(reviewId);
      if (!review) return res.status(404).json({ message: '评审不存在' });

      const { S3Storage } = await import('coze-coding-dev-sdk');
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: '',
        secretKey: '',
        bucketName: process.env.COZE_BUCKET_NAME,
        region: 'cn-beijing',
      });

      const buffer = Buffer.from(fileContent, 'base64');
      const fileKey = await storage.uploadFile({
        fileContent: buffer,
        fileName: `reviews/${reviewId}/${fileName}`,
        contentType: contentType || 'application/octet-stream',
      });

      const info = db
        .prepare(
          `INSERT INTO review_attachments (review_id, user_id, file_name, file_key, file_size, content_type, category)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          reviewId,
          userId,
          fileName,
          fileKey,
          fileSize || buffer.length,
          contentType || 'application/octet-stream',
          category || 'material',
        );

      const attachment = db
        .prepare(
          `SELECT a.*, u.full_name as uploader_name FROM review_attachments a LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?`,
        )
        .get(insertId(info));

      const url = await storage.generatePresignedUrl({ key: fileKey, expireTime: 86400 });
      res.status(201).json({ ...attachment, url });
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** DELETE /api/reviews/:id/attachments/:attachmentId - 删除附件 */
router.delete(
  '/:id/attachments/:attachmentId',
  requireAuth,
  param('id').isInt(),
  param('attachmentId').isInt(),
  async (req, res) => {
    try {
      const attachment = db
        .prepare(`SELECT * FROM review_attachments WHERE id = ? AND review_id = ?`)
        .get(req.params.attachmentId, req.params.id);
      if (!attachment) return res.status(404).json({ message: '附件不存在' });

      // 删除对象存储文件
      try {
        const { S3Storage } = await import('coze-coding-dev-sdk');
        const storage = new S3Storage({
          endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
          accessKey: '',
          secretKey: '',
          bucketName: process.env.COZE_BUCKET_NAME,
          region: 'cn-beijing',
        });
        await storage.deleteFile({ fileKey: attachment.file_key });
      } catch (e) {
        console.error('删除对象存储文件失败:', e.message);
      }

      db.prepare(`DELETE FROM review_attachments WHERE id = ?`).run(req.params.attachmentId);
      res.status(204).send();
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

// ==================== 评审报告 ====================

/** GET /api/reviews/:id/report - 生成评审报告 */
router.get('/:id/report', requireAuth, param('id').isInt(), async (req, res) => {
  try {
    const review = db
      .prepare(
        `SELECT r.*, p.name as project_name, m.name as milestone_name, u.full_name as applicant_name
         FROM reviews r
         LEFT JOIN projects p ON p.id = r.project_id
         LEFT JOIN plan_milestones m ON m.id = r.milestone_id
         LEFT JOIN users u ON u.id = r.applicant_id
         WHERE r.id = ?`,
      )
      .get(req.params.id);

    if (!review) return res.status(404).json({ message: '评审不存在' });

    const experts = db
      .prepare(
        `SELECT e.*, u.full_name, u.email FROM review_experts e LEFT JOIN users u ON u.id = e.user_id WHERE e.review_id = ?`,
      )
      .all(req.params.id);

    const scores = db
      .prepare(
        `SELECT s.category, AVG(s.score) as avg_score, COUNT(*) as count
         FROM review_scores s WHERE s.review_id = ? GROUP BY s.category`,
      )
      .all(req.params.id);

    const issues = db
      .prepare(`SELECT * FROM review_issues WHERE review_id = ? ORDER BY severity, id`)
      .all(req.params.id);

    const issuesSummary = {
      total: issues.length,
      critical: issues.filter((i) => i.severity === 'critical').length,
      major: issues.filter((i) => i.severity === 'major').length,
      minor: issues.filter((i) => i.severity === 'minor').length,
      suggestion: issues.filter((i) => i.severity === 'suggestion').length,
      open: issues.filter((i) => i.status === 'open').length,
      resolved: issues.filter((i) => ['resolved', 'closed'].includes(i.status)).length,
    };

    const report = {
      review,
      experts,
      scores,
      issues,
      issuesSummary,
      generatedAt: new Date().toISOString(),
    };

    res.json(report);
  } catch (e) {
    sendServerError(res, e);
  }
});

export default router;
