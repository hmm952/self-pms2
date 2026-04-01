/**
 * SQLite 数据库（Node.js 内置 node:sqlite / DatabaseSync）
 * 无需原生编译，在 Node.js 22.5+（推荐 24 LTS）下直接可用。
 * 表结构覆盖：用户权限、项目、任务、评审、合同、KPI、竞品分析
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath =
  process.env.DATABASE_PATH ||
  path.join(__dirname, '..', 'data', 'robot_pms.db');

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true });
db.exec(`PRAGMA journal_mode = WAL;`);

/** INSERT 后将 lastInsertRowid 转为 number（兼容 bigint） */
export function insertId(runResult) {
  const id = runResult.lastInsertRowid;
  return typeof id === 'bigint' ? Number(id) : id;
}

/** DELETE/UPDATE 后统一读取受影响行数（兼容 bigint） */
export function changeCount(runResult) {
  const c = runResult.changes;
  return typeof c === 'bigint' ? Number(c) : c;
}

/** 初始化完整表结构（幂等：仅 CREATE IF NOT EXISTS） */
function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email TEXT,
      full_name TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      product_line TEXT DEFAULT '工业机器人',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
      start_date TEXT,
      end_date TEXT,
      budget_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_in_project TEXT DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      review_type TEXT NOT NULL DEFAULT 'design' CHECK (review_type IN ('design', 'process', 'safety', 'quality', 'milestone', 'other')),
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'passed', 'conditional', 'rejected', 'cancelled')),
      lead_reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      review_date TEXT,
      conclusion TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      counterparty TEXT NOT NULL,
      contract_type TEXT DEFAULT 'procurement',
      amount REAL,
      currency TEXT DEFAULT 'CNY',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'negotiating', 'signed', 'executing', 'closed', 'terminated')),
      effective_date TEXT,
      expiry_date TEXT,
      document_ref TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kpi_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      metric_name TEXT NOT NULL,
      metric_unit TEXT,
      period_year INTEGER NOT NULL,
      period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
      target_value REAL,
      actual_value REAL,
      score REAL,
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, user_id, metric_name, period_year, period_month)
    );

    CREATE TABLE IF NOT EXISTS competitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      model_or_line TEXT,
      price_position TEXT,
      key_features TEXT,
      gap_analysis TEXT,
      threat_level TEXT DEFAULT 'medium' CHECK (threat_level IN ('low', 'medium', 'high')),
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_project ON reviews(project_id);
    CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts(project_id);
    CREATE INDEX IF NOT EXISTS idx_kpi_project ON kpi_records(project_id);
    CREATE INDEX IF NOT EXISTS idx_competitors_project ON competitors(project_id);
  `);
}

/** 计划 / 里程碑 / WBS / 外部联动预留（会议纪要、评审、邮件） */
function migratePlanModule() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plan_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phase_template TEXT NOT NULL DEFAULT 'custom' CHECK (phase_template IN ('evt', 'dvt', 'pvt', 'mp', 'custom')),
      target_date TEXT,
      status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'achieved', 'delayed', 'cancelled')),
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_external_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      link_type TEXT NOT NULL CHECK (link_type IN ('meeting', 'review', 'email', 'other')),
      ref_id TEXT,
      ref_title TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_plan_milestones_project ON plan_milestones(project_id);
    CREATE INDEX IF NOT EXISTS idx_task_links_task ON task_external_links(task_id);
  `);

  const names = new Set(
    db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name),
  );
  const addCol = (sql) => {
    try {
      db.exec(sql);
    } catch (e) {
      if (!String(e.message).includes('duplicate column')) throw e;
    }
  };
  if (!names.has('parent_id')) addCol('ALTER TABLE tasks ADD COLUMN parent_id INTEGER');
  if (!names.has('milestone_id')) addCol('ALTER TABLE tasks ADD COLUMN milestone_id INTEGER');
  if (!names.has('start_date')) addCol('ALTER TABLE tasks ADD COLUMN start_date TEXT');
  if (!names.has('end_date')) addCol('ALTER TABLE tasks ADD COLUMN end_date TEXT');
  if (!names.has('progress')) addCol('ALTER TABLE tasks ADD COLUMN progress REAL DEFAULT 0');
  if (!names.has('sort_order')) addCol('ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0');

  db.exec(`
    UPDATE tasks SET end_date = due_date
    WHERE (end_date IS NULL OR end_date = '') AND due_date IS NOT NULL AND due_date != '';
  `);
}

/** 任务扩展：备注、附件、提醒（用于任务详情与提醒预警） */
function migrateTaskExtensions() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_key TEXT NOT NULL,
      file_size INTEGER,
      content_type TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reminder_type TEXT NOT NULL DEFAULT 'due_date' CHECK (reminder_type IN ('due_date', 'before_due', 'overdue', 'custom')),
      reminder_time TEXT NOT NULL,
      is_sent INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_reminders_task ON task_reminders(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_reminders_pending ON task_reminders(is_sent, reminder_time);
  `);
}

runMigrations();
migratePlanModule();
migrateTaskExtensions();
migrateReviewExtensions();
migrateWorkloadAndKpi();
migrateMeetingMinutes();
migrateContractRag();
migrateCompetitorRag();
migrateNotificationModule();

export { db, runMigrations, migratePlanModule, migrateTaskExtensions, migrateReviewExtensions, migrateWorkloadAndKpi, migrateMeetingMinutes, migrateContractRag, migrateCompetitorRag, migrateNotificationModule };

/** 评审扩展：模板、专家、打分、问题、附件 */
function migrateReviewExtensions() {
  // 重建 reviews 表以修复 CHECK 约束（添加 draft 状态）
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='reviews'").get();
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes("'draft'")) {
      // 旧表约束不包含 draft，需要重建
      db.exec(`
        CREATE TABLE IF NOT EXISTS reviews_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          review_type TEXT NOT NULL DEFAULT 'design' CHECK (review_type IN ('design', 'process', 'safety', 'quality', 'milestone', 'other')),
          status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'passed', 'conditional', 'rejected', 'cancelled')),
          lead_reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          review_date TEXT,
          conclusion TEXT,
          milestone_id INTEGER REFERENCES plan_milestones(id),
          phase TEXT DEFAULT 'evt' CHECK (phase IN ('evt', 'dvt', 'pvt', 'mp', 'other')),
          template_id INTEGER,
          location TEXT,
          agenda TEXT,
          applicant_id INTEGER REFERENCES users(id),
          total_score REAL,
          report_key TEXT,
          started_at TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        INSERT INTO reviews_new SELECT id, project_id, title, review_type, status, lead_reviewer_id, review_date, conclusion, 
          milestone_id, phase, template_id, location, agenda, applicant_id, total_score, report_key, started_at, completed_at, created_at, updated_at
        FROM reviews;
        
        DROP TABLE reviews;
        ALTER TABLE reviews_new RENAME TO reviews;
        CREATE INDEX IF NOT EXISTS idx_reviews_project ON reviews(project_id);
      `);
    }
  } catch (e) {
    if (!String(e.message).includes('no such column')) throw e;
  }

  // 添加 reviews 表扩展字段
  const reviewCols = new Set(
    db.prepare('PRAGMA table_info(reviews)').all().map((c) => c.name),
  );
  const addCol = (sql) => {
    try {
      db.exec(sql);
    } catch (e) {
      if (!String(e.message).includes('duplicate column')) throw e;
    }
  };
  
  // 这些字段可能已经在上面的重建中创建了，但为了幂等性仍然检查
  if (!reviewCols.has('milestone_id')) addCol('ALTER TABLE reviews ADD COLUMN milestone_id INTEGER REFERENCES plan_milestones(id)');
  if (!reviewCols.has('phase')) addCol("ALTER TABLE reviews ADD COLUMN phase TEXT DEFAULT 'evt'");
  if (!reviewCols.has('template_id')) addCol('ALTER TABLE reviews ADD COLUMN template_id INTEGER');
  if (!reviewCols.has('location')) addCol('ALTER TABLE reviews ADD COLUMN location TEXT');
  if (!reviewCols.has('agenda')) addCol('ALTER TABLE reviews ADD COLUMN agenda TEXT');
  if (!reviewCols.has('applicant_id')) addCol('ALTER TABLE reviews ADD COLUMN applicant_id INTEGER REFERENCES users(id)');
  if (!reviewCols.has('total_score')) addCol('ALTER TABLE reviews ADD COLUMN total_score REAL');
  if (!reviewCols.has('report_key')) addCol('ALTER TABLE reviews ADD COLUMN report_key TEXT');
  if (!reviewCols.has('started_at')) addCol('ALTER TABLE reviews ADD COLUMN started_at TEXT');
  if (!reviewCols.has('completed_at')) addCol('ALTER TABLE reviews ADD COLUMN completed_at TEXT');

  db.exec(`
    -- 评审模板表
    CREATE TABLE IF NOT EXISTS review_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'evt' CHECK (phase IN ('evt', 'dvt', 'pvt', 'mp', 'other')),
      description TEXT,
      scoring_criteria TEXT,
      checklist_items TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 评审专家表
    CREATE TABLE IF NOT EXISTS review_experts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'expert' CHECK (role IN ('lead', 'expert', 'observer')),
      invite_status TEXT NOT NULL DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'declined')),
      invited_at TEXT NOT NULL DEFAULT (datetime('now')),
      responded_at TEXT,
      UNIQUE(review_id, user_id)
    );

    -- 评审打分表
    CREATE TABLE IF NOT EXISTS review_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      expert_id INTEGER NOT NULL REFERENCES review_experts(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(review_id, expert_id, category)
    );

    -- 评审问题表
    CREATE TABLE IF NOT EXISTS review_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'major' CHECK (severity IN ('critical', 'major', 'minor', 'suggestion')),
      description TEXT NOT NULL,
      expert_id INTEGER REFERENCES review_experts(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'closed')),
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      due_date TEXT,
      resolution TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 评审材料附件表
    CREATE TABLE IF NOT EXISTS review_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_key TEXT NOT NULL,
      file_size INTEGER,
      content_type TEXT,
      category TEXT DEFAULT 'material',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 评审流程记录表
    CREATE TABLE IF NOT EXISTS review_workflow_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_review_experts_review ON review_experts(review_id);
    CREATE INDEX IF NOT EXISTS idx_review_scores_review ON review_scores(review_id);
    CREATE INDEX IF NOT EXISTS idx_review_issues_review ON review_issues(review_id);
    CREATE INDEX IF NOT EXISTS idx_review_issues_status ON review_issues(status);
    CREATE INDEX IF NOT EXISTS idx_review_attachments_review ON review_attachments(review_id);
    CREATE INDEX IF NOT EXISTS idx_review_workflow_review ON review_workflow_log(review_id);
  `);

  // 插入默认评审模板
  insertDefaultTemplates();
}

/** 插入默认评审模板（EVT/DVT/PVT/MP） */
function insertDefaultTemplates() {
  const templates = [
    {
      name: 'EVT 工程验证评审',
      phase: 'evt',
      description: '工程验证试产阶段评审，验证设计可行性和基本功能',
      scoring_criteria: JSON.stringify([
        { category: '设计完成度', weight: 30, description: '设计文档完整性、图纸准确性' },
        { category: '功能验证', weight: 25, description: '核心功能实现情况、测试覆盖率' },
        { category: '可制造性', weight: 20, description: 'DFM/DFA评估、工艺可行性' },
        { category: '供应链准备', weight: 15, description: '关键物料到位情况、供应商资质' },
        { category: '风险管理', weight: 10, description: '风险识别与应对措施' },
      ]),
      checklist_items: JSON.stringify([
        { item: '设计文档完整', required: true },
        { item: 'BOM清单已冻结', required: true },
        { item: '功能测试报告', required: true },
        { item: '关键物料样品确认', required: true },
        { item: '风险评估报告', required: false },
      ]),
    },
    {
      name: 'DVT 设计验证评审',
      phase: 'dvt',
      description: '设计验证试产阶段评审，验证产品可靠性和一致性',
      scoring_criteria: JSON.stringify([
        { category: '产品性能', weight: 25, description: '性能指标达成情况' },
        { category: '可靠性测试', weight: 25, description: '环境测试、寿命测试结果' },
        { category: '工艺验证', weight: 20, description: '工艺参数验证、产能评估' },
        { category: '质量控制', weight: 15, description: 'QC方案、检验标准' },
        { category: '认证准备', weight: 15, description: '安规认证、EMC测试准备' },
      ]),
      checklist_items: JSON.stringify([
        { item: 'DVT样品已制作', required: true },
        { item: '可靠性测试报告', required: true },
        { item: '工艺验证报告', required: true },
        { item: 'QC检验标准', required: true },
        { item: '认证申请材料', required: false },
      ]),
    },
    {
      name: 'PVT 制程验证评审',
      phase: 'pvt',
      description: '制程验证试产阶段评审，验证量产准备度',
      scoring_criteria: JSON.stringify([
        { category: '产能验证', weight: 25, description: '产能达标情况' },
        { category: '良率达成', weight: 25, description: '良率指标达成' },
        { category: '供应链成熟度', weight: 20, description: '供应商交付稳定性' },
        { category: '生产文档', weight: 15, description: 'SOP、作业指导书完整性' },
        { category: '人员培训', weight: 15, description: '操作人员培训情况' },
      ]),
      checklist_items: JSON.stringify([
        { item: 'PVT试产报告', required: true },
        { item: '产能验证报告', required: true },
        { item: '良率分析报告', required: true },
        { item: '生产SOP完成', required: true },
        { item: '人员培训记录', required: true },
      ]),
    },
    {
      name: 'MP 量产导入评审',
      phase: 'mp',
      description: '量产导入阶段评审，确认量产就绪状态',
      scoring_criteria: JSON.stringify([
        { category: '量产准备', weight: 30, description: '产能、人员、设备就绪情况' },
        { category: '供应链稳定', weight: 25, description: '物料供应稳定性、库存策略' },
        { category: '质量体系', weight: 20, description: '质量管理体系运行情况' },
        { category: '售后服务', weight: 15, description: '售后体系、备件准备' },
        { category: '合规认证', weight: 10, description: '认证证书获取情况' },
      ]),
      checklist_items: JSON.stringify([
        { item: '量产计划确认', required: true },
        { item: '供应链协议签署', required: true },
        { item: '质量体系文件', required: true },
        { item: '认证证书获取', required: true },
        { item: '售后方案确定', required: true },
      ]),
    },
  ];

  const existingCount = db.prepare('SELECT COUNT(*) as c FROM review_templates').get();
  if (existingCount.c === 0) {
    const stmt = db.prepare(
      `INSERT INTO review_templates (name, phase, description, scoring_criteria, checklist_items)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const t of templates) {
      stmt.run(t.name, t.phase, t.description, t.scoring_criteria, t.checklist_items);
    }
  }
}

/** 人力负载与KPI核算扩展 */
function migrateWorkloadAndKpi() {
  db.exec(`
    -- 工时记录表（按天填报）
    CREATE TABLE IF NOT EXISTS time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      work_date TEXT NOT NULL,
      hours REAL NOT NULL CHECK (hours > 0 AND hours <= 24),
      work_type TEXT NOT NULL DEFAULT 'development' CHECK (work_type IN ('development', 'meeting', 'review', 'testing', 'documentation', 'other')),
      description TEXT,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
      approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, user_id, work_date, task_id)
    );

    -- KPI指标库表
    CREATE TABLE IF NOT EXISTS kpi_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'project' CHECK (category IN ('project', 'personal', 'team', 'organization')),
      description TEXT,
      unit TEXT DEFAULT '%',
      weight REAL NOT NULL DEFAULT 1.0,
      calculation_method TEXT NOT NULL DEFAULT 'manual' CHECK (calculation_method IN ('manual', 'auto_task_completion', 'auto_review_pass', 'auto_schedule', 'auto_defect_close')),
      formula TEXT,
      target_value REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- KPI快照表（按月/按项目核算结果）
    CREATE TABLE IF NOT EXISTS kpi_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      metric_id INTEGER NOT NULL REFERENCES kpi_metrics(id) ON DELETE CASCADE,
      period_year INTEGER NOT NULL,
      period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
      target_value REAL,
      actual_value REAL,
      score REAL,
      weight REAL NOT NULL DEFAULT 1.0,
      data_source TEXT,
      calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT,
      UNIQUE(project_id, user_id, metric_id, period_year, period_month)
    );

    -- KPI考核报告表
    CREATE TABLE IF NOT EXISTS kpi_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      period_year INTEGER NOT NULL,
      period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
      report_type TEXT NOT NULL DEFAULT 'monthly' CHECK (report_type IN ('monthly', 'quarterly', 'project')),
      total_score REAL,
      summary TEXT,
      generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'))
    );

    -- 用户部门信息扩展
    CREATE TABLE IF NOT EXISTS user_departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      parent_id INTEGER REFERENCES user_departments(id) ON DELETE SET NULL,
      manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_time_logs_project ON time_logs(project_id);
    CREATE INDEX IF NOT EXISTS idx_time_logs_user ON time_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_time_logs_date ON time_logs(work_date);
    CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_project ON kpi_snapshots(project_id);
    CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_user ON kpi_snapshots(user_id);
    CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_period ON kpi_snapshots(period_year, period_month);
    CREATE INDEX IF NOT EXISTS idx_kpi_reports_project ON kpi_reports(project_id);
    CREATE INDEX IF NOT EXISTS idx_kpi_reports_period ON kpi_reports(period_year, period_month);
  `);

  // 为 users 表添加部门字段
  const userCols = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
  const addCol = (sql) => {
    try {
      db.exec(sql);
    } catch (e) {
      if (!String(e.message).includes('duplicate column')) throw e;
    }
  };
  if (!userCols.has('department_id')) addCol('ALTER TABLE users ADD COLUMN department_id INTEGER REFERENCES user_departments(id)');
  if (!userCols.has('standard_hours')) addCol('ALTER TABLE users ADD COLUMN standard_hours REAL DEFAULT 8.0');

  // 插入默认KPI指标
  insertDefaultKpiMetrics();
  
  // 插入默认部门
  insertDefaultDepartments();
}

/** 插入默认KPI指标（硬件PM核心指标） */
function insertDefaultKpiMetrics() {
  const metrics = [
    {
      name: '任务完成率',
      code: 'TASK_COMPLETION_RATE',
      category: 'project',
      description: '按时完成的任务数占总任务数的比例',
      unit: '%',
      weight: 30,
      calculation_method: 'auto_task_completion',
      formula: '按时完成任务数 / 总任务数 * 100',
      target_value: 95,
    },
    {
      name: '评审通过率',
      code: 'REVIEW_PASS_RATE',
      category: 'project',
      description: '一次性通过的评审数占总评审数的比例',
      unit: '%',
      weight: 25,
      calculation_method: 'auto_review_pass',
      formula: '通过评审数 / 总评审数 * 100',
      target_value: 90,
    },
    {
      name: '进度达成率',
      code: 'SCHEDULE_ACHIEVEMENT_RATE',
      category: 'project',
      description: '按期完成的里程碑数占总里程碑数的比例',
      unit: '%',
      weight: 25,
      calculation_method: 'auto_schedule',
      formula: '按期完成里程碑数 / 总里程碑数 * 100',
      target_value: 85,
    },
    {
      name: '缺陷闭环率',
      code: 'DEFECT_CLOSURE_RATE',
      category: 'project',
      description: '已关闭的缺陷数占总缺陷数的比例（评审问题视为缺陷来源）',
      unit: '%',
      weight: 20,
      calculation_method: 'auto_defect_close',
      formula: '已关闭缺陷数 / 总缺陷数 * 100',
      target_value: 95,
    },
    {
      name: '工时利用率',
      code: 'WORKLOAD_UTILIZATION',
      category: 'personal',
      description: '实际填报工时与标准工时的比例',
      unit: '%',
      weight: 20,
      calculation_method: 'manual',
      formula: '实际工时 / 标准工时 * 100',
      target_value: 85,
    },
    {
      name: '评审参与度',
      code: 'REVIEW_PARTICIPATION',
      category: 'personal',
      description: '参与评审次数与打分完成率',
      unit: '%',
      weight: 15,
      calculation_method: 'manual',
      formula: '已完成打分评审数 / 参与评审数 * 100',
      target_value: 100,
    },
  ];

  const existingCount = db.prepare('SELECT COUNT(*) as c FROM kpi_metrics').get();
  if (existingCount.c === 0) {
    const stmt = db.prepare(
      `INSERT INTO kpi_metrics (name, code, category, description, unit, weight, calculation_method, formula, target_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const m of metrics) {
      stmt.run(m.name, m.code, m.category, m.description, m.unit, m.weight, m.calculation_method, m.formula, m.target_value);
    }
  }
}

/** 插入默认部门 */
function insertDefaultDepartments() {
  const departments = [
    { name: '研发部', description: '产品研发与设计' },
    { name: '项目管理部', description: '项目规划与执行管理' },
    { name: '质量管理部', description: '质量体系与测试' },
    { name: '供应链部', description: '采购与供应商管理' },
    { name: '制造部', description: '生产制造与工艺' },
  ];

  const existingCount = db.prepare('SELECT COUNT(*) as c FROM user_departments').get();
  if (existingCount.c === 0) {
    const stmt = db.prepare(`INSERT INTO user_departments (name, description) VALUES (?, ?)`);
    for (const d of departments) {
      stmt.run(d.name, d.description);
    }
  }
}

/** 会议纪要与RAG知识库扩展 */
function migrateMeetingMinutes() {
  db.exec(`
    -- API配置表（存储讯飞RAG等第三方API配置）
    CREATE TABLE IF NOT EXISTS api_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      api_key TEXT,
      api_url TEXT,
      app_id TEXT,
      api_secret TEXT,
      extra_config TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 会议纪要表
    CREATE TABLE IF NOT EXISTS meeting_minutes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      meeting_date TEXT,
      meeting_type TEXT DEFAULT 'regular' CHECK (meeting_type IN ('regular', 'review', 'decision', 'brainstorm', 'other')),
      location TEXT,
      host_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      participants TEXT,
      raw_content TEXT,
      file_name TEXT,
      file_key TEXT,
      file_type TEXT,
      file_size INTEGER,
      parse_status TEXT NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'parsing', 'parsed', 'failed')),
      parse_error TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 会议纪要解析结果表
    CREATE TABLE IF NOT EXISTS meeting_parse_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      minute_id INTEGER NOT NULL REFERENCES meeting_minutes(id) ON DELETE CASCADE,
      result_type TEXT NOT NULL CHECK (result_type IN ('todo', 'change', 'risk', 'decision')),
      content TEXT NOT NULL,
      responsible_person TEXT,
      responsible_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      due_date TEXT,
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      impact_scope TEXT,
      impact_level TEXT CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
      decision TEXT,
      follow_up_person TEXT,
      follow_up_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'synced', 'ignored')),
      synced_to TEXT,
      synced_id INTEGER,
      user_edited INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 知识库文档表
    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL DEFAULT 'meeting' CHECK (doc_type IN ('meeting', 'review', 'contract', 'spec', 'other')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source_id INTEGER,
      source_type TEXT,
      embedding_status TEXT NOT NULL DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'embedded', 'failed')),
      chunk_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 知识库向量片段表（简化版，实际RAG由外部API处理）
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- RAG问答历史表
    CREATE TABLE IF NOT EXISTS rag_qa_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      source_docs TEXT,
      confidence REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 风险登记册表
    CREATE TABLE IF NOT EXISTS risk_register (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'technical' CHECK (category IN ('technical', 'schedule', 'cost', 'quality', 'resource', 'external')),
      probability TEXT NOT NULL DEFAULT 'medium' CHECK (probability IN ('low', 'medium', 'high')),
      impact TEXT NOT NULL DEFAULT 'medium' CHECK (impact IN ('low', 'medium', 'high', 'critical')),
      risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'monitoring', 'mitigated', 'closed')),
      mitigation TEXT,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      due_date TEXT,
      source_type TEXT,
      source_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_meeting_minutes_project ON meeting_minutes(project_id);
    CREATE INDEX IF NOT EXISTS idx_meeting_minutes_date ON meeting_minutes(meeting_date);
    CREATE INDEX IF NOT EXISTS idx_meeting_parse_results_minute ON meeting_parse_results(minute_id);
    CREATE INDEX IF NOT EXISTS idx_meeting_parse_results_type ON meeting_parse_results(result_type);
    CREATE INDEX IF NOT EXISTS idx_knowledge_documents_project ON knowledge_documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(doc_id);
    CREATE INDEX IF NOT EXISTS idx_rag_qa_history_project ON rag_qa_history(project_id);
    CREATE INDEX IF NOT EXISTS idx_risk_register_project ON risk_register(project_id);
    CREATE INDEX IF NOT EXISTS idx_risk_register_status ON risk_register(status);
  `);

  // 插入默认API配置模板
  insertDefaultApiConfigs();
}

/** 插入默认API配置模板 */
function insertDefaultApiConfigs() {
  const configs = [
    {
      provider: 'xunfei_rag',
      name: '科大讯飞星火RAG',
      api_url: 'https://api.xf-yun.com/v1/private/dts_create_embeddings',
    },
    {
      provider: 'xunfei_llm',
      name: '科大讯飞星火大模型',
      api_url: 'https://spark-api-open.xf-yun.com/v1/chat/completions',
    },
  ];

  for (const config of configs) {
    const existing = db.prepare(`SELECT id FROM api_configs WHERE provider = ?`).get(config.provider);
    if (!existing) {
      db.prepare(
        `INSERT INTO api_configs (provider, name, api_url) VALUES (?, ?, ?)`
      ).run(config.provider, config.name, config.api_url);
    }
  }
}

/** 合同RAG管理扩展 */
function migrateContractRag() {
  db.exec(`
    -- 合同文档表（存储合同文件信息）
    CREATE TABLE IF NOT EXISTS contract_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      file_name TEXT NOT NULL,
      file_key TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER,
      upload_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_current INTEGER NOT NULL DEFAULT 1,
      parse_status TEXT NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'parsing', 'parsed', 'failed')),
      parse_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(contract_id, version)
    );

    -- 合同解析结果表（存储RAG提取的关键信息）
    CREATE TABLE IF NOT EXISTS contract_parse_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      document_id INTEGER REFERENCES contract_documents(id) ON DELETE SET NULL,
      contract_name TEXT,
      counterparty TEXT,
      contract_amount REAL,
      currency TEXT DEFAULT 'CNY',
      sign_date TEXT,
      effective_date TEXT,
      expiry_date TEXT,
      payment_terms TEXT,
      delivery_terms TEXT,
      breach_liability TEXT,
      confidentiality_clause TEXT,
      special_terms TEXT,
      raw_extract TEXT,
      confidence REAL DEFAULT 0.0,
      user_confirmed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 付款节点表
    CREATE TABLE IF NOT EXISTS contract_payment_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      milestone_id INTEGER REFERENCES plan_milestones(id) ON DELETE SET NULL,
      node_name TEXT NOT NULL,
      node_description TEXT,
      planned_amount REAL NOT NULL,
      actual_amount REAL,
      currency TEXT DEFAULT 'CNY',
      planned_date TEXT NOT NULL,
      actual_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'due_soon', 'overdue', 'paid', 'partial', 'cancelled')),
      payment_method TEXT,
      payment_proof TEXT,
      invoice_status TEXT DEFAULT 'none' CHECK (invoice_status IN ('none', 'requested', 'received', 'verified')),
      reminder_sent INTEGER DEFAULT 0,
      reminder_date TEXT,
      notes TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 交付要求表
    CREATE TABLE IF NOT EXISTS contract_delivery_requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      requirement_name TEXT NOT NULL,
      requirement_description TEXT,
      deliverable_type TEXT CHECK (deliverable_type IN ('document', 'hardware', 'software', 'service', 'other')),
      planned_date TEXT,
      actual_date TEXT,
      acceptance_criteria TEXT,
      acceptance_status TEXT DEFAULT 'pending' CHECK (acceptance_status IN ('pending', 'submitted', 'accepted', 'rejected', 'waived')),
      verification_result TEXT,
      verification_notes TEXT,
      verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      verified_at TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 合同变更记录表
    CREATE TABLE IF NOT EXISTS contract_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      change_type TEXT NOT NULL CHECK (change_type IN ('amount', 'date', 'scope', 'party', 'terms', 'other')),
      change_number TEXT,
      change_title TEXT NOT NULL,
      change_description TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      impact_amount REAL,
      impact_days INTEGER,
      reason TEXT,
      initiator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
      approved_at TEXT,
      effective_date TEXT,
      document_key TEXT,
      affected_tasks TEXT,
      affected_milestones TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 合同问答历史表
    CREATE TABLE IF NOT EXISTS contract_qa_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      source_sections TEXT,
      confidence REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 合同提醒表
    CREATE TABLE IF NOT EXISTS contract_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      reminder_type TEXT NOT NULL CHECK (reminder_type IN ('payment', 'delivery', 'expiry', 'renewal', 'custom')),
      reference_id INTEGER,
      reminder_date TEXT NOT NULL,
      reminder_message TEXT,
      notify_users TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'acknowledged', 'dismissed')),
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contract_documents_contract ON contract_documents(contract_id);
    CREATE INDEX IF NOT EXISTS idx_contract_parse_results_contract ON contract_parse_results(contract_id);
    CREATE INDEX IF NOT EXISTS idx_contract_payment_nodes_contract ON contract_payment_nodes(contract_id);
    CREATE INDEX IF NOT EXISTS idx_contract_payment_nodes_status ON contract_payment_nodes(status);
    CREATE INDEX IF NOT EXISTS idx_contract_payment_nodes_date ON contract_payment_nodes(planned_date);
    CREATE INDEX IF NOT EXISTS idx_contract_delivery_requirements_contract ON contract_delivery_requirements(contract_id);
    CREATE INDEX IF NOT EXISTS idx_contract_delivery_requirements_task ON contract_delivery_requirements(task_id);
    CREATE INDEX IF NOT EXISTS idx_contract_changes_contract ON contract_changes(contract_id);
    CREATE INDEX IF NOT EXISTS idx_contract_qa_history_contract ON contract_qa_history(contract_id);
    CREATE INDEX IF NOT EXISTS idx_contract_reminders_contract ON contract_reminders(contract_id);
    CREATE INDEX IF NOT EXISTS idx_contract_reminders_date ON contract_reminders(reminder_date);
  `);
}

/** 竞品动态跟踪与分析扩展 */
function migrateCompetitorRag() {
  db.exec(`
    -- 竞品详细信息表
    CREATE TABLE IF NOT EXISTS competitor_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER NOT NULL UNIQUE REFERENCES competitors(id) ON DELETE CASCADE,
      official_website TEXT,
      company_name TEXT,
      company_location TEXT,
      founded_year INTEGER,
      employee_count TEXT,
      core_products TEXT,
      market_position TEXT,
      main_customers TEXT,
      annual_revenue TEXT,
      parent_company TEXT,
      subsidiaries TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 竞品技术参数表（机器人核心指标）
    CREATE TABLE IF NOT EXISTS competitor_parameters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      product_model TEXT,
      product_category TEXT CHECK (product_category IN ('industrial_arm', 'collaborative', 'mobile_robot', 'service_robot', 'specialty', 'other')),
      -- 核心技术参数
      payload_kg REAL,
      reach_mm REAL,
      repeat_accuracy_mm REAL,
      speed_deg_s REAL,
      protection_rating TEXT,
      battery_life_h REAL,
      weight_kg REAL,
      footprint_mm TEXT,
      degrees_of_freedom INTEGER,
      control_type TEXT,
      communication_interface TEXT,
      programming_method TEXT,
      -- 价格信息
      list_price REAL,
      currency TEXT DEFAULT 'CNY',
      price_note TEXT,
      -- 市场信息
      launch_date TEXT,
      end_of_life_date TEXT,
      target_industries TEXT,
      certifications TEXT,
      -- 其他
      additional_params TEXT,
      data_source TEXT,
      confidence_level REAL DEFAULT 0.8,
      last_verified TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 竞品动态信息表
    CREATE TABLE IF NOT EXISTS competitor_dynamics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      dynamic_type TEXT NOT NULL CHECK (dynamic_type IN ('new_product', 'product_update', 'patent', 'price_change', 'market_action', 'partnership', 'acquisition', 'exhibition', 'award', 'news', 'other')),
      title TEXT NOT NULL,
      summary TEXT,
      content TEXT,
      source_url TEXT,
      source_name TEXT,
      publish_date TEXT,
      tags TEXT,
      importance TEXT DEFAULT 'normal' CHECK (importance IN ('low', 'normal', 'high', 'critical')),
      is_verified INTEGER DEFAULT 0,
      verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      verified_at TEXT,
      raw_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 爬虫配置表
    CREATE TABLE IF NOT EXISTS competitor_crawler_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER REFERENCES competitors(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('website', 'rss', 'api', 'patent_db', 'news_site', 'social_media', 'other')),
      source_url TEXT NOT NULL,
      crawl_frequency TEXT DEFAULT 'weekly' CHECK (crawl_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
      crawl_config TEXT,
      last_crawl_at TEXT,
      last_crawl_status TEXT,
      last_crawl_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 竞品问答历史表
    CREATE TABLE IF NOT EXISTS competitor_qa_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER REFERENCES competitors(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      source_sections TEXT,
      confidence REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 迭代建议表
    CREATE TABLE IF NOT EXISTS competitor_iteration_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER REFERENCES competitors(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('feature', 'performance', 'pricing', 'marketing', 'partnership', 'other')),
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      related_dynamics TEXT,
      impact_analysis TEXT,
      implementation_effort TEXT CHECK (implementation_effort IN ('low', 'medium', 'high')),
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected', 'implemented')),
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 竞品对比报告表
    CREATE TABLE IF NOT EXISTS competitor_comparison_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      competitors_involved TEXT,
      comparison_data TEXT,
      analysis_summary TEXT,
      generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_competitor_details_competitor ON competitor_details(competitor_id);
    CREATE INDEX IF NOT EXISTS idx_competitor_parameters_competitor ON competitor_parameters(competitor_id);
    CREATE INDEX IF NOT EXISTS idx_competitor_parameters_product ON competitor_parameters(product_name);
    CREATE INDEX IF NOT EXISTS idx_competitor_dynamics_competitor ON competitor_dynamics(competitor_id);
    CREATE INDEX IF NOT EXISTS idx_competitor_dynamics_type ON competitor_dynamics(dynamic_type);
    CREATE INDEX IF NOT EXISTS idx_competitor_dynamics_date ON competitor_dynamics(publish_date);
    CREATE INDEX IF NOT EXISTS idx_competitor_crawler_competitor ON competitor_crawler_configs(competitor_id);
    CREATE INDEX IF NOT EXISTS idx_competitor_qa_competitor ON competitor_qa_history(competitor_id);
    CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_competitor ON competitor_iteration_suggestions(competitor_id);
    CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_project ON competitor_iteration_suggestions(project_id);
    CREATE INDEX IF NOT EXISTS idx_competitor_suggestions_status ON competitor_iteration_suggestions(status);
    CREATE INDEX IF NOT EXISTS idx_competitor_reports_project ON competitor_comparison_reports(project_id);
  `);
}

/** 制造业场景化自动通知模块 */
function migrateNotificationModule() {
  db.exec(`
    -- 邮件配置表
    CREATE TABLE IF NOT EXISTS email_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      config_name TEXT NOT NULL,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER DEFAULT 587,
      smtp_secure INTEGER DEFAULT 0,
      smtp_user TEXT NOT NULL,
      smtp_pass TEXT NOT NULL,
      from_email TEXT NOT NULL,
      from_name TEXT,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      last_test_at TEXT,
      last_test_status TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 通知模板表
    CREATE TABLE IF NOT EXISTS notification_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      template_code TEXT NOT NULL UNIQUE,
      template_name TEXT NOT NULL,
      template_type TEXT NOT NULL CHECK (template_type IN ('task_urge', 'test_urge', 'review_remind', 'payment_remind', 'milestone_warn', 'overdue_warn', 'custom')),
      category TEXT DEFAULT 'general' CHECK (category IN ('production', 'testing', 'review', 'contract', 'milestone', 'general')),
      subject TEXT NOT NULL,
      body_text TEXT,
      body_html TEXT,
      supported_variables TEXT,
      description TEXT,
      is_builtin INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 通知触发规则表
    CREATE TABLE IF NOT EXISTS notification_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      rule_name TEXT NOT NULL,
      rule_type TEXT NOT NULL CHECK (rule_type IN ('task_overdue', 'task_due_soon', 'review_due', 'payment_due', 'milestone_due', 'manual')),
      source_module TEXT NOT NULL CHECK (source_module IN ('task', 'review', 'contract', 'milestone', 'competitor')),
      trigger_condition TEXT NOT NULL,
      template_id INTEGER REFERENCES notification_templates(id) ON DELETE SET NULL,
      email_config_id INTEGER REFERENCES email_configs(id) ON DELETE SET NULL,
      recipients TEXT NOT NULL,
      cc_recipients TEXT,
      is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 5,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 通知发送记录表
    CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      rule_id INTEGER REFERENCES notification_rules(id) ON DELETE SET NULL,
      template_id INTEGER REFERENCES notification_templates(id) ON DELETE SET NULL,
      email_config_id INTEGER REFERENCES email_configs(id) ON DELETE SET NULL,
      notification_type TEXT NOT NULL DEFAULT 'email' CHECK (notification_type IN ('email', 'wechat', 'dingtalk', 'sms')),
      subject TEXT NOT NULL,
      body_text TEXT,
      body_html TEXT,
      recipients TEXT NOT NULL,
      cc_recipients TEXT,
      related_module TEXT,
      related_id INTEGER,
      variables_used TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'bounced')),
      error_message TEXT,
      message_id TEXT,
      sent_at TEXT,
      delivered_at TEXT,
      opened_at TEXT,
      clicked_at TEXT,
      replied_at TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 企业微信/钉钉配置表（预留）
    CREATE TABLE IF NOT EXISTS webhook_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      config_name TEXT NOT NULL,
      webhook_type TEXT NOT NULL CHECK (webhook_type IN ('wechat', 'dingtalk', 'feishu', 'slack', 'other')),
      webhook_url TEXT NOT NULL,
      secret TEXT,
      extra_config TEXT,
      is_active INTEGER DEFAULT 1,
      last_test_at TEXT,
      last_test_status TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_email_configs_project ON email_configs(project_id);
    CREATE INDEX IF NOT EXISTS idx_notification_templates_project ON notification_templates(project_id);
    CREATE INDEX IF NOT EXISTS idx_notification_templates_code ON notification_templates(template_code);
    CREATE INDEX IF NOT EXISTS idx_notification_rules_project ON notification_rules(project_id);
    CREATE INDEX IF NOT EXISTS idx_notification_rules_type ON notification_rules(rule_type);
    CREATE INDEX IF NOT EXISTS idx_notification_logs_project ON notification_logs(project_id);
    CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
    CREATE INDEX IF NOT EXISTS idx_notification_logs_date ON notification_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_webhook_configs_project ON webhook_configs(project_id);

    -- 插入内置模板
    INSERT OR IGNORE INTO notification_templates (template_code, template_name, template_type, category, subject, body_text, body_html, supported_variables, description, is_builtin) VALUES
    ('task_urge', '生产催办模板', 'task_urge', 'production', 
     '【催办】{project_name} - 任务"{task_title}"即将到期',
     '尊敬的{assignee_name}：\n\n您好！\n\n您负责的任务"{task_title}"（项目：{project_name}）将于{due_date}到期，当前进度：{progress}%。\n\n请尽快完成任务，如有问题请及时反馈。\n\n任务详情：{system_link}/tasks/{task_id}\n\n此邮件由系统自动发送，请勿回复。',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #1e40af;">任务催办通知</h2><p>尊敬的<strong>{assignee_name}</strong>：</p><p>您负责的任务<strong>"{task_title}"</strong>（项目：{project_name}）将于<strong style="color: #dc2626;">{due_date}</strong>到期。</p><p>当前进度：<strong>{progress}%</strong></p><p>请尽快完成任务，如有问题请及时反馈。</p><a href="{system_link}/tasks/{task_id}" style="display: inline-block; padding: 10px 20px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 5px;">查看任务详情</a><hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p></div>',
     'project_name,task_title,assignee_name,due_date,progress,system_link,task_id',
     '用于任务即将到期或已逾期的催办通知', 1),

    ('test_urge', '测试催改模板', 'test_urge', 'testing',
     '【测试催改】{project_name} - {test_item}待处理',
     '尊敬的{assignee_name}：\n\n您好！\n\n测试项目"{test_item}"（项目：{project_name}）存在问题待处理：\n\n问题描述：{issue_description}\n发现时间：{issue_date}\n优先级：{priority}\n\n请尽快处理并反馈结果。\n\n详情链接：{system_link}\n\n此邮件由系统自动发送，请勿回复。',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #ea580c;">测试问题催改通知</h2><p>尊敬的<strong>{assignee_name}</strong>：</p><p>测试项目<strong>"{test_item}"</strong>（项目：{project_name}）存在问题待处理：</p><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">问题描述</td><td style="padding: 8px; border: 1px solid #e5e7eb;">{issue_description}</td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">发现时间</td><td style="padding: 8px; border: 1px solid #e5e7eb;">{issue_date}</td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">优先级</td><td style="padding: 8px; border: 1px solid #e5e7eb;">{priority}</td></tr></table><p>请尽快处理并反馈结果。</p><hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p></div>',
     'project_name,test_item,assignee_name,issue_description,issue_date,priority,system_link',
     '用于测试问题催改通知', 1),

    ('review_remind', '评审提醒模板', 'review_remind', 'review',
     '【评审提醒】{project_name} - {review_title}即将进行',
     '尊敬的{participant_name}：\n\n您好！\n\n您被邀请参加以下评审会议：\n\n评审主题：{review_title}\n项目名称：{project_name}\n评审类型：{review_type}\n评审时间：{review_time}\n评审地点：{review_location}\n\n请提前准备相关材料，准时参加。\n\n详情链接：{system_link}/reviews/{review_id}\n\n此邮件由系统自动发送，请勿回复。',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #7c3aed;">评审会议提醒</h2><p>尊敬的<strong>{participant_name}</strong>：</p><p>您被邀请参加以下评审会议：</p><table style="width: 100%; border-collapse: collapse; margin: 15px 0;"><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb; width: 100px;">评审主题</td><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>{review_title}</strong></td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">项目名称</td><td style="padding: 8px; border: 1px solid #e5e7eb;">{project_name}</td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">评审时间</td><td style="padding: 8px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">{review_time}</td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">评审地点</td><td style="padding: 8px; border: 1px solid #e5e7eb;">{review_location}</td></tr></table><p>请提前准备相关材料，准时参加。</p><a href="{system_link}/reviews/{review_id}" style="display: inline-block; padding: 10px 20px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 5px;">查看评审详情</a><hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p></div>',
     'project_name,review_title,participant_name,review_type,review_time,review_location,system_link,review_id',
     '用于评审会议前的提醒通知', 1),

    ('payment_remind', '付款提醒模板', 'payment_remind', 'contract',
     '【付款提醒】{project_name} - {contract_name}付款节点即将到期',
     '尊敬的{handler_name}：\n\n您好！\n\n合同付款节点提醒：\n\n合同名称：{contract_name}\n项目名称：{project_name}\n付款节点：{payment_node}\n计划金额：{amount} {currency}\n计划日期：{planned_date}\n距到期还有：{days_remaining}天\n\n请及时跟进付款事宜。\n\n详情链接：{system_link}/contracts-rag/{contract_id}\n\n此邮件由系统自动发送，请勿回复。',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #059669;">付款节点提醒</h2><p>尊敬的<strong>{handler_name}</strong>：</p><p>合同付款节点即将到期：</p><table style="width: 100%; border-collapse: collapse; margin: 15px 0;"><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb; width: 100px;">合同名称</td><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>{contract_name}</strong></td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">付款节点</td><td style="padding: 8px; border: 1px solid #e5e7eb;">{payment_node}</td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">计划金额</td><td style="padding: 8px; border: 1px solid #e5e7eb;">{amount} {currency}</td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">计划日期</td><td style="padding: 8px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">{planned_date}</td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">距到期</td><td style="padding: 8px; border: 1px solid #e5e7eb;">{days_remaining}天</td></tr></table><a href="{system_link}/contracts-rag/{contract_id}" style="display: inline-block; padding: 10px 20px; background-color: #059669; color: white; text-decoration: none; border-radius: 5px;">查看合同详情</a><hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p></div>',
     'project_name,contract_name,handler_name,payment_node,amount,currency,planned_date,days_remaining,system_link,contract_id',
     '用于合同付款节点的提醒通知', 1),

    ('milestone_warn', '里程碑预警模板', 'milestone_warn', 'milestone',
     '【里程碑预警】{project_name} - {milestone_name}进度预警',
     '尊敬的{pm_name}：\n\n您好！\n\n项目里程碑进度预警：\n\n里程碑：{milestone_name}\n项目名称：{project_name}\n计划完成时间：{target_date}\n当前进度：{progress}%\n预期偏差：{deviation}天\n\n请及时关注并采取措施。\n\n详情链接：{system_link}/plan\n\n此邮件由系统自动发送，请勿回复。',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #f59e0b;">里程碑进度预警</h2><p>尊敬的<strong>{pm_name}</strong>：</p><p>项目里程碑进度预警：</p><table style="width: 100%; border-collapse: collapse; margin: 15px 0;"><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb; width: 100px;">里程碑</td><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>{milestone_name}</strong></td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">计划完成</td><td style="padding: 8px; border: 1px solid #e5e7eb;">{target_date}</td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">当前进度</td><td style="padding: 8px; border: 1px solid #e5e7eb;">{progress}%</td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">预期偏差</td><td style="padding: 8px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">{deviation}天</td></tr></table><p style="color: #dc2626;">请及时关注并采取措施。</p><a href="{system_link}/plan" style="display: inline-block; padding: 10px 20px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 5px;">查看里程碑</a><hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p></div>',
     'project_name,milestone_name,pm_name,target_date,progress,deviation,system_link',
     '用于里程碑进度偏差预警', 1),

    ('overdue_warn', '逾期预警模板', 'overdue_warn', 'general',
     '【逾期预警】{project_name} - {item_type}"{item_title}"已逾期',
     '尊敬的{assignee_name}：\n\n您好！\n\n您负责的{item_type}已逾期：\n\n名称：{item_title}\n项目：{project_name}\n截止时间：{due_date}\n已逾期：{overdue_days}天\n\n请尽快处理，如有困难请及时上报。\n\n详情链接：{system_link}\n\n此邮件由系统自动发送，请勿回复。',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #dc2626;">逾期预警通知</h2><p>尊敬的<strong>{assignee_name}</strong>：</p><p>您负责的{item_type}已逾期：</p><table style="width: 100%; border-collapse: collapse; margin: 15px 0;"><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb; width: 100px;">名称</td><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>{item_title}</strong></td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">截止时间</td><td style="padding: 8px; border: 1px solid #e5e7eb;">{due_date}</td></tr><tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">已逾期</td><td style="padding: 8px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">{overdue_days}天</td></tr></table><p style="color: #dc2626; font-weight: bold;">请尽快处理，如有困难请及时上报。</p><hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p></div>',
     'project_name,item_type,item_title,assignee_name,due_date,overdue_days,system_link',
     '用于各类逾期事项的预警通知', 1);
  `);
}
