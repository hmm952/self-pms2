/**
 * 前端内置模拟数据
 * 
 * 说明：
 * - 用于部署到静态托管平台（如Vercel）时，提供完整的演示数据
 * - 所有页面优先使用这些模拟数据，不依赖后端接口
 * - 确保部署后所有页面、菜单、功能板块都正常显示
 */

// ============================================
// 默认项目信息
// ============================================
export const mockProjects = [
  {
    id: 1,
    name: '六轴协作机器人 X1 研发项目',
    description: '单产品线全生命周期管理示例：结构、电控、软件、试产与认证。涵盖整机研发、核心零部件开发、系统集成与测试验证。',
    product_line: '协作机器人',
    status: 'active',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    budget_note: '预算与成本在 MVP 阶段仅作备注字段，后续可扩展子表。',
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
];

// ============================================
// 任务管理数据
// ============================================
export const mockTasks = [
  {
    id: 1,
    project_id: 1,
    title: '整机研发 WBS（根节点）',
    description: '六轴协作机器人X1整机研发项目主任务',
    status: 'in_progress',
    priority: 'high',
    assignee_id: 1,
    reporter_id: 1,
    parent_id: null,
    milestone_id: 1,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    due_date: '2026-12-31',
    progress: 35,
    sort_order: 0,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 2,
    project_id: 1,
    title: '完成整机BOM冻结与供应商短名单',
    description: '完成整机物料清单的冻结，确定核心零部件供应商短名单',
    status: 'in_progress',
    priority: 'high',
    assignee_id: 1,
    reporter_id: 1,
    parent_id: 1,
    milestone_id: 1,
    start_date: '2026-01-01',
    end_date: '2026-03-15',
    due_date: '2026-03-15',
    progress: 80,
    sort_order: 1,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 3,
    project_id: 1,
    title: '减速器选型与技术协议签署',
    description: '完成减速器供应商选型评估，签署技术协议',
    status: 'done',
    priority: 'high',
    assignee_id: 1,
    reporter_id: 1,
    parent_id: 1,
    milestone_id: 1,
    start_date: '2026-01-15',
    end_date: '2026-02-28',
    due_date: '2026-02-28',
    progress: 100,
    sort_order: 2,
    created_at: '2026-01-15 00:00:00',
    updated_at: '2026-02-28 00:00:00',
  },
  {
    id: 4,
    project_id: 1,
    title: '伺服电机驱动器开发',
    description: '完成伺服电机驱动器的硬件设计与软件开发',
    status: 'in_progress',
    priority: 'high',
    assignee_id: 1,
    reporter_id: 1,
    parent_id: 1,
    milestone_id: 2,
    start_date: '2026-02-01',
    end_date: '2026-05-31',
    due_date: '2026-05-31',
    progress: 45,
    sort_order: 3,
    created_at: '2026-02-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 5,
    project_id: 1,
    title: '控制系统软件开发',
    description: '完成机器人控制系统的核心软件开发',
    status: 'in_progress',
    priority: 'critical',
    assignee_id: 1,
    reporter_id: 1,
    parent_id: 1,
    milestone_id: 2,
    start_date: '2026-02-15',
    end_date: '2026-06-30',
    due_date: '2026-06-30',
    progress: 30,
    sort_order: 4,
    created_at: '2026-02-15 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 6,
    project_id: 1,
    title: 'EVT样机试制',
    description: '完成EVT阶段样机试制与功能验证',
    status: 'todo',
    priority: 'high',
    assignee_id: 1,
    reporter_id: 1,
    parent_id: 1,
    milestone_id: 1,
    start_date: '2026-04-01',
    end_date: '2026-05-31',
    due_date: '2026-05-31',
    progress: 0,
    sort_order: 5,
    created_at: '2026-03-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
];

// ============================================
// 评审流程数据
// ============================================
export const mockReviews = [
  {
    id: 1,
    project_id: 1,
    title: 'DFM/DFA 设计评审 — 减速器与关节模组',
    review_type: 'design',
    status: 'scheduled',
    lead_reviewer_id: 1,
    review_date: '2026-04-07',
    conclusion: null,
    milestone_id: 1,
    phase: 'evt',
    location: '3楼会议室A',
    agenda: '评审减速器与关节模组的设计方案，确认可制造性',
    created_at: '2026-03-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 2,
    project_id: 1,
    title: 'EVT阶段评审',
    review_type: 'milestone',
    status: 'draft',
    lead_reviewer_id: 1,
    review_date: '2026-05-30',
    conclusion: null,
    milestone_id: 1,
    phase: 'evt',
    location: '待定',
    agenda: 'EVT阶段成果评审，决定是否进入DVT',
    created_at: '2026-03-15 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 3,
    project_id: 1,
    title: '供应商质量审核 — 减速器供应商',
    review_type: 'quality',
    status: 'passed',
    lead_reviewer_id: 1,
    review_date: '2026-02-20',
    conclusion: '供应商质量体系符合要求，可纳入合格供应商名录',
    milestone_id: null,
    phase: 'evt',
    location: '供应商现场',
    agenda: '审核供应商质量管理体系',
    created_at: '2026-02-01 00:00:00',
    updated_at: '2026-02-20 00:00:00',
  },
];

// ============================================
// 合同条目数据
// ============================================
export const mockContracts = [
  {
    id: 1,
    project_id: 1,
    title: '核心伺服驱动器框架协议',
    counterparty: '深圳伺服技术供应商',
    contract_type: 'procurement',
    amount: 1280000,
    currency: 'CNY',
    status: 'negotiating',
    effective_date: null,
    expiry_date: '2027-12-31',
    document_ref: 'CTR-2026-001',
    created_at: '2026-02-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 2,
    project_id: 1,
    title: '减速器采购合同',
    counterparty: '苏州精密传动科技',
    contract_type: 'procurement',
    amount: 2560000,
    currency: 'CNY',
    status: 'signed',
    effective_date: '2026-02-15',
    expiry_date: '2027-02-14',
    document_ref: 'CTR-2026-002',
    created_at: '2026-02-15 00:00:00',
    updated_at: '2026-02-15 00:00:00',
  },
  {
    id: 3,
    project_id: 1,
    title: '控制器芯片授权协议',
    counterparty: '美国芯片技术公司',
    contract_type: 'procurement',
    amount: 500000,
    currency: 'USD',
    status: 'executing',
    effective_date: '2026-01-01',
    expiry_date: '2028-12-31',
    document_ref: 'CTR-2026-003',
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
];

// ============================================
// KPI核算数据
// ============================================
export const mockKpiRecords = [
  {
    id: 1,
    project_id: 1,
    user_id: 1,
    metric_name: '里程碑准时率',
    metric_unit: '%',
    period_year: 2026,
    period_month: 3,
    target_value: 90,
    actual_value: 85,
    score: 85,
    comment: '略有延迟，整体可控',
    created_at: '2026-03-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 2,
    project_id: 1,
    user_id: 1,
    metric_name: '任务完成率',
    metric_unit: '%',
    period_year: 2026,
    period_month: 3,
    target_value: 95,
    actual_value: 92,
    score: 92,
    comment: '任务执行良好',
    created_at: '2026-03-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 3,
    project_id: 1,
    user_id: 1,
    metric_name: '评审通过率',
    metric_unit: '%',
    period_year: 2026,
    period_month: 3,
    target_value: 90,
    actual_value: 100,
    score: 100,
    comment: '评审全部通过',
    created_at: '2026-03-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
];

// ============================================
// 竞品档案数据
// ============================================
export const mockCompetitors = [
  {
    id: 1,
    project_id: 1,
    name: '竞品A公司',
    model_or_line: 'C系列 10kg',
    price_position: '定价高于我方预估15%',
    key_features: '生态成熟、海外渠道强',
    gap_analysis: '我方在核心零部件自主化上有优势，需补强应用软件插件市场',
    threat_level: 'high',
    last_updated: '2026-03-30 00:00:00',
    created_at: '2026-01-01 00:00:00',
  },
  {
    id: 2,
    project_id: 1,
    name: '竞品B公司',
    model_or_line: 'X系列 6kg',
    price_position: '定价与我方相当',
    key_features: '性价比高、国内渠道广',
    gap_analysis: '我方在技术指标上有优势，需提升品牌知名度',
    threat_level: 'medium',
    last_updated: '2026-03-30 00:00:00',
    created_at: '2026-02-01 00:00:00',
  },
];

// ============================================
// 里程碑数据
// ============================================
export const mockMilestones = [
  {
    id: 1,
    project_id: 1,
    name: 'EVT — 工程验证试产',
    phase_template: 'evt',
    target_date: '2026-05-31',
    status: 'active',
    description: '工程验证试产阶段，验证设计可行性',
    sort_order: 10,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 2,
    project_id: 1,
    name: 'DVT — 设计验证试产',
    phase_template: 'dvt',
    target_date: '2026-08-31',
    status: 'planned',
    description: '设计验证试产阶段，验证产品可靠性',
    sort_order: 20,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 3,
    project_id: 1,
    name: 'PVT — 制程验证试产',
    phase_template: 'pvt',
    target_date: '2026-10-31',
    status: 'planned',
    description: '制程验证试产阶段，验证量产准备度',
    sort_order: 30,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 4,
    project_id: 1,
    name: 'MP — 量产导入',
    phase_template: 'mp',
    target_date: '2026-12-31',
    status: 'planned',
    description: '量产导入阶段',
    sort_order: 40,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
];

// ============================================
// 工时填报数据
// ============================================
export const mockTimeLogs = [
  {
    id: 1,
    project_id: 1,
    user_id: 1,
    task_id: 2,
    work_date: '2026-03-25',
    hours: 8,
    work_type: 'development',
    description: 'BOM清单整理与供应商对接',
    status: 'approved',
    approver_id: 1,
    approved_at: '2026-03-26 00:00:00',
    created_at: '2026-03-25 00:00:00',
    updated_at: '2026-03-26 00:00:00',
  },
  {
    id: 2,
    project_id: 1,
    user_id: 1,
    task_id: 4,
    work_date: '2026-03-26',
    hours: 8,
    work_type: 'development',
    description: '伺服电机驱动器电路设计',
    status: 'approved',
    approver_id: 1,
    approved_at: '2026-03-27 00:00:00',
    created_at: '2026-03-26 00:00:00',
    updated_at: '2026-03-27 00:00:00',
  },
  {
    id: 3,
    project_id: 1,
    user_id: 1,
    task_id: 5,
    work_date: '2026-03-27',
    hours: 6,
    work_type: 'development',
    description: '控制系统软件架构设计',
    status: 'submitted',
    approver_id: null,
    approved_at: null,
    created_at: '2026-03-27 00:00:00',
    updated_at: '2026-03-27 00:00:00',
  },
  {
    id: 4,
    project_id: 1,
    user_id: 1,
    task_id: 1,
    work_date: '2026-03-28',
    hours: 4,
    work_type: 'meeting',
    description: '项目周例会',
    status: 'submitted',
    approver_id: null,
    approved_at: null,
    created_at: '2026-03-28 00:00:00',
    updated_at: '2026-03-28 00:00:00',
  },
];

// ============================================
// 人力负载数据
// ============================================
export const mockWorkloadData = {
  members: [
    {
      userId: 1,
      userName: '张三',
      role: '项目经理',
      totalHours: 42,
      loadRate: 105,
      status: 'overload',
      weeklyHours: [8, 9, 8, 8, 9, 0, 0],
    },
    {
      userId: 2,
      userName: '李四',
      role: '结构工程师',
      totalHours: 38,
      loadRate: 95,
      status: 'warning',
      weeklyHours: [7, 8, 8, 8, 7, 0, 0],
    },
    {
      userId: 3,
      userName: '王五',
      role: '电控工程师',
      totalHours: 40,
      loadRate: 100,
      status: 'warning',
      weeklyHours: [8, 8, 8, 8, 8, 0, 0],
    },
    {
      userId: 4,
      userName: '赵六',
      role: '软件工程师',
      totalHours: 35,
      loadRate: 88,
      status: 'normal',
      weeklyHours: [7, 7, 7, 7, 7, 0, 0],
    },
    {
      userId: 5,
      userName: '钱七',
      role: '测试工程师',
      totalHours: 32,
      loadRate: 80,
      status: 'normal',
      weeklyHours: [6, 7, 6, 7, 6, 0, 0],
    },
  ],
  summary: {
    totalMembers: 5,
    normalCount: 2,
    warningCount: 2,
    overloadCount: 1,
  },
};

// ============================================
// 会议纪要数据
// ============================================
export const mockMeetingMinutes = [
  {
    id: 1,
    project_id: 1,
    title: 'EVT阶段启动会议',
    meeting_date: '2026-03-01',
    meeting_type: 'regular',
    location: '3楼会议室A',
    host_id: 1,
    participants: '张三、李四、王五',
    raw_content: '会议内容：\n1. 确认EVT阶段目标\n2. 分配任务负责人\n3. 讨论风险点',
    parse_status: 'parsed',
    created_at: '2026-03-01 00:00:00',
    updated_at: '2026-03-01 00:00:00',
  },
  {
    id: 2,
    project_id: 1,
    title: '供应商评审会议',
    meeting_date: '2026-03-15',
    meeting_type: 'review',
    location: '线上会议',
    host_id: 1,
    participants: '张三、李四、供应商代表',
    raw_content: '会议内容：\n1. 供应商资质审核结果\n2. 价格谈判\n3. 交付周期确认',
    parse_status: 'parsed',
    created_at: '2026-03-15 00:00:00',
    updated_at: '2026-03-15 00:00:00',
  },
];

// ============================================
// 知识库数据
// ============================================
export const mockKnowledgeDocuments = [
  {
    id: 1,
    project_id: 1,
    doc_type: 'spec',
    title: 'X1机器人技术规格书',
    content: '六轴协作机器人X1技术规格说明书...',
    chunk_count: 5,
    embedding_status: 'embedded',
    created_at: '2026-01-15 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 2,
    project_id: 1,
    doc_type: 'meeting',
    title: 'EVT阶段启动会议纪要',
    content: 'EVT阶段启动会议内容摘要...',
    chunk_count: 3,
    embedding_status: 'embedded',
    created_at: '2026-03-01 00:00:00',
    updated_at: '2026-03-01 00:00:00',
  },
];

// ============================================
// API配置数据
// ============================================
export const mockApiConfigs = [
  {
    id: 1,
    provider: 'xunfei_rag',
    name: '科大讯飞星火RAG',
    api_url: 'https://api.xf-yun.com/v1/private/dts_create_embeddings',
    app_id: '',
    key_status: '未配置',
    is_active: 1,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
  {
    id: 2,
    provider: 'xunfei_llm',
    name: '科大讯飞星火大模型',
    api_url: 'https://spark-api-open.xf-yun.com/v1/chat/completions',
    app_id: '',
    key_status: '未配置',
    is_active: 1,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-03-30 00:00:00',
  },
];

// ============================================
// 集成状态数据
// ============================================
export const mockIntegrationsStatus = {
  iflytekRag: {
    configured: false,
    hint: '在API配置页面设置讯飞RAG密钥',
  },
  smtp: {
    configured: false,
    hint: '在自动通知页面配置SMTP服务',
  },
};

// ============================================
// 用户数据
// ============================================
export const mockUsers = [
  {
    id: 1,
    username: 'user',
    full_name: '用户',
    email: 'user@example.com',
    role: 'user',
    department: '研发部',
  },
  {
    id: 2,
    username: 'admin',
    full_name: '管理员',
    email: 'admin@example.com',
    role: 'admin',
    department: '研发部',
  },
];

// ============================================
// 辅助函数：根据项目ID过滤数据
// ============================================
export function getProjectData(projectId) {
  return {
    tasks: mockTasks.filter(t => t.project_id === projectId),
    reviews: mockReviews.filter(r => r.project_id === projectId),
    contracts: mockContracts.filter(c => c.project_id === projectId),
    kpiRecords: mockKpiRecords.filter(k => k.project_id === projectId),
    competitors: mockCompetitors.filter(c => c.project_id === projectId),
    milestones: mockMilestones.filter(m => m.project_id === projectId),
    timeLogs: mockTimeLogs.filter(t => t.project_id === projectId),
    meetingMinutes: mockMeetingMinutes.filter(m => m.project_id === projectId),
    knowledgeDocuments: mockKnowledgeDocuments.filter(d => d.project_id === projectId),
  };
}
