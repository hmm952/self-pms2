/**
 * KPI 指标库与自动核算 REST API
 * 支持：KPI指标库管理、自动核算、考核报告生成
 */
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db, insertId, changeCount } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendServerError } from '../utils/http.js';

const router = Router();

const metricCategories = ['project', 'personal', 'team', 'organization'];
const calculationMethods = ['manual', 'auto_task_completion', 'auto_review_pass', 'auto_schedule', 'auto_defect_close'];
const reportTypes = ['monthly', 'quarterly', 'project'];

// ==================== KPI 指标库 ====================

/** GET /api/kpi-v2/metrics - 获取KPI指标列表 */
router.get('/metrics', requireAuth, (req, res) => {
  try {
    const rows = db
      .prepare(`SELECT * FROM kpi_metrics WHERE is_active = 1 ORDER BY category, weight DESC, id`)
      .all();
    res.json(rows);
  } catch (e) {
    sendServerError(res, e);
  }
});

/** GET /api/kpi-v2/metrics/:id - 获取单个KPI指标 */
router.get('/metrics/:id', requireAuth, param('id').isInt(), (req, res) => {
  try {
    const row = db.prepare(`SELECT * FROM kpi_metrics WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ message: '指标不存在' });
    res.json(row);
  } catch (e) {
    sendServerError(res, e);
  }
});

/** POST /api/kpi-v2/metrics - 创建KPI指标 */
router.post(
  '/metrics',
  requireAuth,
  body('name').trim().notEmpty(),
  body('code').trim().notEmpty(),
  body('category').optional().isIn(metricCategories),
  body('description').optional().trim(),
  body('unit').optional().trim(),
  body('weight').optional().isFloat({ min: 0, max: 100 }),
  body('calculation_method').optional().isIn(calculationMethods),
  body('formula').optional().trim(),
  body('target_value').optional().isFloat(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, code, category = 'project', description, unit = '%', weight = 1, calculation_method = 'manual', formula, target_value } = req.body;

    try {
      const info = db
        .prepare(
          `INSERT INTO kpi_metrics (name, code, category, description, unit, weight, calculation_method, formula, target_value)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(name, code, category, description || null, unit, weight, calculation_method, formula || null, target_value ?? null);

      const row = db.prepare(`SELECT * FROM kpi_metrics WHERE id = ?`).get(insertId(info));
      res.status(201).json(row);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ message: '指标代码已存在' });
      }
      sendServerError(res, e);
    }
  },
);

/** PUT /api/kpi-v2/metrics/:id - 更新KPI指标 */
router.put(
  '/metrics/:id',
  requireAuth,
  param('id').isInt(),
  body('name').optional().trim().notEmpty(),
  body('category').optional().isIn(metricCategories),
  body('weight').optional().isFloat({ min: 0, max: 100 }),
  body('calculation_method').optional().isIn(calculationMethods),
  body('target_value').optional().isFloat(),
  body('is_active').optional().isInt(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = Number(req.params.id);
    try {
      const existing = db.prepare(`SELECT * FROM kpi_metrics WHERE id = ?`).get(id);
      if (!existing) return res.status(404).json({ message: '指标不存在' });

      const next = { ...existing, ...req.body, updated_at: new Date().toISOString() };

      db.prepare(
        `UPDATE kpi_metrics SET
          name = ?, description = ?, unit = ?, weight = ?, calculation_method = ?, formula = ?, target_value = ?, is_active = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(next.name, next.description, next.unit, next.weight, next.calculation_method, next.formula, next.target_value, next.is_active, id);

      res.json(db.prepare(`SELECT * FROM kpi_metrics WHERE id = ?`).get(id));
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** DELETE /api/kpi-v2/metrics/:id - 删除KPI指标 */
router.delete('/metrics/:id', requireAuth, param('id').isInt(), (req, res) => {
  try {
    const r = db.prepare(`DELETE FROM kpi_metrics WHERE id = ?`).run(req.params.id);
    if (changeCount(r) === 0) return res.status(404).json({ message: '指标不存在' });
    res.status(204).send();
  } catch (e) {
    sendServerError(res, e);
  }
});

// ==================== KPI 自动核算 ====================

/** POST /api/kpi-v2/calculate - 执行KPI核算 */
router.post(
  '/calculate',
  requireAuth,
  body('projectId').optional().isInt(),
  body('userId').optional().isInt(),
  body('periodYear').isInt({ min: 2000, max: 2100 }),
  body('periodMonth').isInt({ min: 1, max: 12 }),
  body('metricIds').optional().isArray(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { projectId, userId, periodYear, periodMonth, metricIds } = req.body;
    const operatorId = req.user.id;

    try {
      // 获取要计算的指标
      let metricsQuery = `SELECT * FROM kpi_metrics WHERE is_active = 1`;
      const metricsArgs = [];
      if (metricIds && metricIds.length > 0) {
        metricsQuery += ` AND id IN (${metricIds.map(() => '?').join(',')})`;
        metricsArgs.push(...metricIds);
      }
      const metrics = db.prepare(metricsQuery).all(...metricsArgs);

      if (metrics.length === 0) {
        return res.status(400).json({ message: '没有可计算的指标' });
      }

      const results = [];

      // 确定计算范围
      let projectIds = [];
      if (projectId) {
        projectIds = [Number(projectId)];
      } else {
        projectIds = db.prepare(`SELECT id FROM projects WHERE status = 'active'`).all().map((p) => p.id);
      }

      let userIds = [];
      if (userId) {
        userIds = [Number(userId)];
      } else {
        // 获取所有项目成员
        userIds = db
          .prepare(
            `SELECT DISTINCT user_id FROM project_members WHERE project_id IN (${projectIds.map(() => '?').join(',')})`,
          )
          .all(...projectIds)
          .map((u) => u.user_id);
      }

      // 逐个计算
      for (const metric of metrics) {
        for (const pid of projectIds) {
          for (const uid of userIds) {
            const calcResult = calculateMetric(metric, pid, uid, periodYear, periodMonth);

            // 保存或更新快照
            db.prepare(
              `INSERT INTO kpi_snapshots (project_id, user_id, metric_id, period_year, period_month, target_value, actual_value, score, weight, data_source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(project_id, user_id, metric_id, period_year, period_month)
               DO UPDATE SET actual_value = excluded.actual_value, score = excluded.score, calculated_at = datetime('now')`,
            ).run(
              pid,
              uid,
              metric.id,
              periodYear,
              periodMonth,
              metric.target_value,
              calcResult.actualValue,
              calcResult.score,
              metric.weight,
              JSON.stringify(calcResult.dataSource),
            );

            results.push({
              metric_id: metric.id,
              metric_name: metric.name,
              project_id: pid,
              user_id: uid,
              actual_value: calcResult.actualValue,
              score: calcResult.score,
              target_value: metric.target_value,
            });
          }
        }
      }

      res.json({
        success: true,
        calculated_at: new Date().toISOString(),
        calculated_by: operatorId,
        results_count: results.length,
        results,
      });
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** GET /api/kpi-v2/snapshots - 获取KPI快照列表 */
router.get(
  '/snapshots',
  requireAuth,
  query('projectId').optional().isInt(),
  query('userId').optional().isInt(),
  query('periodYear').optional().isInt(),
  query('periodMonth').optional().isInt(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { projectId, userId, periodYear, periodMonth } = req.query;

    try {
      let sql = `
        SELECT s.*, 
               m.name as metric_name, m.code as metric_code, m.category, m.unit,
               p.name as project_name,
               u.full_name as user_name
        FROM kpi_snapshots s
        LEFT JOIN kpi_metrics m ON m.id = s.metric_id
        LEFT JOIN projects p ON p.id = s.project_id
        LEFT JOIN users u ON u.id = s.user_id
        WHERE 1=1
      `;
      const args = [];

      if (projectId) {
        sql += ` AND s.project_id = ?`;
        args.push(Number(projectId));
      }
      if (userId) {
        sql += ` AND s.user_id = ?`;
        args.push(Number(userId));
      }
      if (periodYear) {
        sql += ` AND s.period_year = ?`;
        args.push(Number(periodYear));
      }
      if (periodMonth) {
        sql += ` AND s.period_month = ?`;
        args.push(Number(periodMonth));
      }

      sql += ` ORDER BY s.period_year DESC, s.period_month DESC, s.project_id, s.user_id, m.weight DESC`;

      const rows = db.prepare(sql).all(...args);
      res.json(rows);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** GET /api/kpi-v2/dashboard - 获取KPI仪表盘数据 */
router.get(
  '/dashboard',
  requireAuth,
  query('projectId').optional().isInt(),
  query('periodYear').optional().isInt(),
  query('periodMonth').optional().isInt(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // 默认当前月份
    const now = new Date();
    const periodYear = Number(req.query.periodYear) || now.getFullYear();
    const periodMonth = Number(req.query.periodMonth) || now.getMonth() + 1;
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;

    try {
      // 1. 指标完成情况
      let metricsSql = `
        SELECT 
          m.id, m.name, m.code, m.category, m.unit, m.weight, m.target_value,
          AVG(s.actual_value) as avg_actual,
          AVG(s.score) as avg_score
        FROM kpi_metrics m
        LEFT JOIN kpi_snapshots s ON s.metric_id = m.id AND s.period_year = ? AND s.period_month = ?
      `;
      const metricsArgs = [periodYear, periodMonth];

      if (projectId) {
        metricsSql += ` AND s.project_id = ?`;
        metricsArgs.push(projectId);
      }

      metricsSql += ` WHERE m.is_active = 1 GROUP BY m.id ORDER BY m.category, m.weight DESC`;

      const metrics = db.prepare(metricsSql).all(...metricsArgs);

      // 2. 用户KPI排名
      let rankingSql = `
        SELECT 
          s.user_id, u.full_name, d.name as department_name,
          SUM(s.score * s.weight) / SUM(s.weight) as weighted_score,
          COUNT(DISTINCT s.metric_id) as metric_count
        FROM kpi_snapshots s
        LEFT JOIN users u ON u.id = s.user_id
        LEFT JOIN user_departments d ON d.id = u.department_id
        WHERE s.period_year = ? AND s.period_month = ?
      `;
      const rankingArgs = [periodYear, periodMonth];

      if (projectId) {
        rankingSql += ` AND s.project_id = ?`;
        rankingArgs.push(projectId);
      }

      rankingSql += ` GROUP BY s.user_id ORDER BY weighted_score DESC LIMIT 10`;

      const ranking = db.prepare(rankingSql).all(...rankingArgs);

      // 3. 趋势数据（近6个月）
      const trendMonths = [];
      const trendData = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(periodYear, periodMonth - 1 - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        trendMonths.push(`${y}-${String(m).padStart(2, '0')}`);

        let trendSql = `
          SELECT AVG(score) as avg_score
          FROM kpi_snapshots
          WHERE period_year = ? AND period_month = ?
        `;
        const trendArgs = [y, m];
        if (projectId) {
          trendSql += ` AND project_id = ?`;
          trendArgs.push(projectId);
        }

        const result = db.prepare(trendSql).get(...trendArgs);
        trendData.push(result?.avg_score || 0);
      }

      // 4. 汇总统计
      const summary = {
        total_metrics: metrics.length,
        avg_score: metrics.length > 0 ? metrics.reduce((sum, m) => sum + (m.avg_score || 0), 0) / metrics.length : 0,
        achieved_count: metrics.filter((m) => (m.avg_score || 0) >= (m.target_value || 0)).length,
        period_year: periodYear,
        period_month: periodMonth,
      };

      res.json({
        metrics,
        ranking,
        trend: { months: trendMonths, data: trendData },
        summary,
      });
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

// ==================== KPI 考核报告 ====================

/** GET /api/kpi-v2/reports - 获取考核报告列表 */
router.get(
  '/reports',
  requireAuth,
  query('projectId').optional().isInt(),
  query('periodYear').optional().isInt(),
  query('periodMonth').optional().isInt(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { projectId, periodYear, periodMonth } = req.query;

    try {
      let sql = `
        SELECT r.*, p.name as project_name, u.full_name as generated_by_name
        FROM kpi_reports r
        LEFT JOIN projects p ON p.id = r.project_id
        LEFT JOIN users u ON u.id = r.generated_by
        WHERE 1=1
      `;
      const args = [];

      if (projectId) {
        sql += ` AND r.project_id = ?`;
        args.push(Number(projectId));
      }
      if (periodYear) {
        sql += ` AND r.period_year = ?`;
        args.push(Number(periodYear));
      }
      if (periodMonth) {
        sql += ` AND r.period_month = ?`;
        args.push(Number(periodMonth));
      }

      sql += ` ORDER BY r.generated_at DESC`;

      const rows = db.prepare(sql).all(...args);
      res.json(rows);
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** POST /api/kpi-v2/reports - 生成考核报告 */
router.post(
  '/reports',
  requireAuth,
  body('projectId').optional().isInt(),
  body('periodYear').isInt({ min: 2000, max: 2100 }),
  body('periodMonth').isInt({ min: 1, max: 12 }),
  body('reportType').optional().isIn(reportTypes),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { projectId, periodYear, periodMonth, reportType = 'monthly' } = req.body;
    const operatorId = req.user.id;

    try {
      // 获取该期间的所有KPI快照
      let snapshotsSql = `
        SELECT s.*, m.name as metric_name, m.category, u.full_name as user_name, d.name as department_name
        FROM kpi_snapshots s
        LEFT JOIN kpi_metrics m ON m.id = s.metric_id
        LEFT JOIN users u ON u.id = s.user_id
        LEFT JOIN user_departments d ON d.id = u.department_id
        WHERE s.period_year = ? AND s.period_month = ?
      `;
      const args = [periodYear, periodMonth];

      if (projectId) {
        snapshotsSql += ` AND s.project_id = ?`;
        args.push(Number(projectId));
      }

      const snapshots = db.prepare(snapshotsSql).all(...args);

      // 计算加权总分
      const userScores = {};
      for (const s of snapshots) {
        if (!userScores[s.user_id]) {
          userScores[s.user_id] = { user_id: s.user_id, user_name: s.user_name, department_name: s.department_name, total_weight: 0, weighted_sum: 0, metrics: [] };
        }
        userScores[s.user_id].total_weight += s.weight;
        userScores[s.user_id].weighted_sum += (s.score || 0) * s.weight;
        userScores[s.user_id].metrics.push({
          metric_name: s.metric_name,
          category: s.category,
          actual_value: s.actual_value,
          score: s.score,
          target_value: s.target_value,
        });
      }

      const userRankings = Object.values(userScores).map((u) => ({
        ...u,
        total_score: u.total_weight > 0 ? Math.round(u.weighted_sum / u.total_weight * 10) / 10 : 0,
      })).sort((a, b) => b.total_score - a.total_score);

      // 计算整体得分
      const totalScore = userRankings.length > 0
        ? Math.round(userRankings.reduce((sum, u) => sum + u.total_score, 0) / userRankings.length * 10) / 10
        : 0;

      // 生成摘要
      const summary = `考核期间：${periodYear}年${periodMonth}月
参与人数：${userRankings.length}人
平均得分：${totalScore}分
优秀（≥90）：${userRankings.filter((u) => u.total_score >= 90).length}人
良好（80-90）：${userRankings.filter((u) => u.total_score >= 80 && u.total_score < 90).length}人
待改进（<70）：${userRankings.filter((u) => u.total_score < 70).length}人`;

      // 保存报告
      const info = db
        .prepare(
          `INSERT INTO kpi_reports (project_id, period_year, period_month, report_type, total_score, summary, generated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(projectId || null, periodYear, periodMonth, reportType, totalScore, summary, operatorId);

      const report = db.prepare(`SELECT * FROM kpi_reports WHERE id = ?`).get(insertId(info));

      res.status(201).json({
        report,
        user_rankings: userRankings,
        details: snapshots,
      });
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** DELETE /api/kpi-v2/reports/:id - 删除考核报告 */
router.delete('/reports/:id', requireAuth, param('id').isInt(), (req, res) => {
  try {
    const r = db.prepare(`DELETE FROM kpi_reports WHERE id = ?`).run(req.params.id);
    if (changeCount(r) === 0) return res.status(404).json({ message: '报告不存在' });
    res.status(204).send();
  } catch (e) {
    sendServerError(res, e);
  }
});

// ==================== 辅助函数 ====================

/** 计算单个指标 */
function calculateMetric(metric, projectId, userId, periodYear, periodMonth) {
  let actualValue = 0;
  let dataSource = {};

  const startDate = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`;
  const endDate = `${periodYear}-${String(periodMonth).padStart(2, '0')}-${new Date(periodYear, periodMonth, 0).getDate()}`;

  switch (metric.calculation_method) {
    case 'auto_task_completion': {
      // 任务完成率 = 按时完成的任务数 / 总任务数
      const totalTasks = db
        .prepare(`SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND assignee_id = ?`)
        .get(projectId, userId)?.c || 0;

      const completedOnTime = db
        .prepare(
          `SELECT COUNT(*) as c FROM tasks 
           WHERE project_id = ? AND assignee_id = ? AND status = 'done' 
           AND (end_date IS NULL OR end_date <= due_date OR (end_date IS NULL AND updated_at <= COALESCE(due_date, '9999-12-31')))`,
        )
        .get(projectId, userId)?.c || 0;

      actualValue = totalTasks > 0 ? Math.round((completedOnTime / totalTasks) * 100) : 0;
      dataSource = { totalTasks, completedOnTime };
      break;
    }

    case 'auto_review_pass': {
      // 评审通过率 = 通过的评审数 / 总评审数
      const totalReviews = db
        .prepare(
          `SELECT COUNT(*) as c FROM reviews 
           WHERE project_id = ? AND applicant_id = ?`,
        )
        .get(projectId, userId)?.c || 0;

      const passedReviews = db
        .prepare(
          `SELECT COUNT(*) as c FROM reviews 
           WHERE project_id = ? AND applicant_id = ? AND status IN ('passed', 'conditional')`,
        )
        .get(projectId, userId)?.c || 0;

      actualValue = totalReviews > 0 ? Math.round((passedReviews / totalReviews) * 100) : 0;
      dataSource = { totalReviews, passedReviews };
      break;
    }

    case 'auto_schedule': {
      // 进度达成率 = 按期完成的里程碑数 / 总里程碑数
      const totalMilestones = db
        .prepare(
          `SELECT COUNT(*) as c FROM plan_milestones WHERE project_id = ?`,
        )
        .get(projectId)?.c || 0;

      const achievedOnTime = db
        .prepare(
          `SELECT COUNT(*) as c FROM plan_milestones 
           WHERE project_id = ? AND status = 'achieved' 
           AND (updated_at <= COALESCE(target_date, '9999-12-31'))`,
        )
        .get(projectId)?.c || 0;

      actualValue = totalMilestones > 0 ? Math.round((achievedOnTime / totalMilestones) * 100) : 0;
      dataSource = { totalMilestones, achievedOnTime };
      break;
    }

    case 'auto_defect_close': {
      // 缺陷闭环率 = 已关闭的评审问题数 / 总问题数
      const totalIssues = db
        .prepare(
          `SELECT COUNT(*) as c FROM review_issues ri
           LEFT JOIN reviews r ON r.id = ri.review_id
           WHERE r.project_id = ?`,
        )
        .get(projectId)?.c || 0;

      const closedIssues = db
        .prepare(
          `SELECT COUNT(*) as c FROM review_issues ri
           LEFT JOIN reviews r ON r.id = ri.review_id
           WHERE r.project_id = ? AND ri.status IN ('resolved', 'closed')`,
        )
        .get(projectId)?.c || 0;

      actualValue = totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 0;
      dataSource = { totalIssues, closedIssues };
      break;
    }

    default:
      // manual - 需要手动录入
      actualValue = 0;
      dataSource = { manual: true };
  }

  // 计算得分（实际值/目标值 * 100，最高100）
  const targetValue = metric.target_value || 100;
  const score = Math.min(100, Math.round((actualValue / targetValue) * 100));

  return { actualValue, score, dataSource };
}

export default router;
