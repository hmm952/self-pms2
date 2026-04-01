# Robot PMS - 机器人项目管理系统

## 项目概览

面向制造业硬件产品（机器人）的全栈项目管理系统，支持项目全生命周期管理，包括任务分配、进度跟踪、评审管理、合同管理、KPI考核、竞品分析、工时填报、人力负载、会议纪要解析和知识库问答。

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端 | React + Vite | 18.3.1 / 5.4.11 |
| UI | Tailwind CSS | 3.4.16 |
| 图标 | lucide-react | 1.7.0 |
| 路由 | react-router-dom | 6.28.0 |
| HTTP | axios | 1.7.9 |
| 后端 | Express | 4.21.2 |
| 数据库 | SQLite (node:sqlite) | 内置 |
| 认证 | JWT + bcryptjs | 9.0.2 / 2.4.3 |
| AI | coze-coding-dev-sdk | 0.7.17 |

### 部署架构

- **端口**: 5000 (通过环境变量 `DEPLOY_RUN_PORT` 或 `PORT`)
- **模式**: 前后端一体化部署（后端同时服务静态文件）
- **数据库**: SQLite (文件路径: `server/data/robot_pms.db`)

## 项目结构

```
/workspace/projects/
├── client/                    # 前端代码
│   ├── src/                   # React 源码
│   │   ├── components/        # UI 组件
│   │   │   ├── Layout.jsx         # 页面布局
│   │   │   ├── TaskDetailModal.jsx # 任务详情弹窗
│   │   │   └── ReminderBell.jsx   # 提醒通知组件
│   │   ├── context/           # React Context (Auth, Project)
│   │   ├── pages/             # 页面组件
│   │   │   ├── TasksPage.jsx      # 任务管理页面
│   │   │   ├── PlanMilestonePage.jsx
│   │   │   └── ...
│   │   ├── api/               # API 客户端
│   │   └── App.jsx            # 路由配置
│   ├── dist/                  # 构建产物
│   ├── package.json
│   └── vite.config.js
├── server/                    # 后端代码
│   ├── src/
│   │   ├── routes/            # API 路由
│   │   │   ├── auth.js            # 认证相关
│   │   │   ├── projects.js        # 项目管理
│   │   │   ├── tasks.js           # 任务管理（含筛选、同步、批量操作）
│   │   │   ├── taskComments.js    # 任务备注
│   │   │   ├── taskAttachments.js # 任务附件
│   │   │   ├── taskReminders.js   # 任务提醒
│   │   │   ├── milestones.js      # 里程碑
│   │   │   ├── reviews.js         # 评审管理
│   │   │   ├── contracts.js       # 合同管理
│   │   │   ├── kpi.js             # KPI考核
│   │   │   └── competitors.js     # 竞品分析
│   │   ├── middleware/        # 中间件
│   │   │   └── auth.js            # JWT认证中间件
│   │   ├── services/          # 业务服务
│   │   │   ├── planTaskService.js # 计划任务服务
│   │   │   ├── ragClient.js       # RAG 客户端
│   │   │   └── mailService.js     # 邮件服务
│   │   ├── config/            # 配置文件
│   │   ├── utils/             # 工具函数
│   │   ├── db.js              # 数据库操作
│   │   ├── seed.js            # 初始数据填充
│   │   └── index.js           # 服务入口
│   ├── data/                  # SQLite 数据库文件
│   ├── .env                   # 环境变量
│   └── package.json
├── .coze                      # 部署配置
├── AGENTS.md                  # 项目文档
└── README.md
```

## 核心功能模块

### 1. 认证系统 (`/api/auth`)
- `POST /login` - 用户登录，返回 JWT token (有效期 7 天)
- `GET /me` - 获取当前用户信息
- `POST /register` - 注册新用户 (需管理员权限)

**默认管理员账号**:
- 用户名: `admin`
- 密码: `admin123`

### 2. 项目管理 (`/api/projects`)
- CRUD 操作
- 管理员可删除项目
- 支持项目切换

### 3. 任务管理 (`/api/tasks`)
任务管理模块支持看板视图和列表视图，提供完整的任务生命周期管理。

#### 核心功能
- **看板视图**: 按状态分列展示（待办、进行中、阻塞、完成）
- **列表视图**: 表格形式展示，支持排序和筛选
- **任务详情**: 查看/编辑任务信息、更新进度、添加备注、上传附件
- **提醒预警**: 任务到期前自动提醒，逾期任务自动升级预警
- **外部同步**: 支持从会议纪要、评审等模块自动创建任务

#### API 接口
```
GET    /api/tasks                    # 获取任务列表（支持筛选）
       ?projectId=1                  # 按项目筛选
       &status=todo,in_progress      # 按状态筛选
       &priority=high,critical       # 按优先级筛选
       &assignee_id=1                # 按责任人筛选
       &overdue=1                    # 仅显示逾期任务

GET    /api/tasks/:id                # 获取任务详情（含备注、附件、提醒）
POST   /api/tasks                    # 创建任务
PUT    /api/tasks/:id                # 更新任务
DELETE /api/tasks/:id                # 删除任务（级联删除子任务）

POST   /api/tasks/sync               # 从外部模块同步创建任务
POST   /api/tasks/batch              # 批量操作（更新状态、分配、删除）

# 备注管理
GET    /api/tasks/:taskId/comments
POST   /api/tasks/:taskId/comments
PUT    /api/tasks/:taskId/comments/:id
DELETE /api/tasks/:taskId/comments/:id

# 附件管理（使用 S3 对象存储）
GET    /api/tasks/:taskId/attachments
POST   /api/tasks/:taskId/attachments
DELETE /api/tasks/:taskId/attachments/:id

# 提醒管理
GET    /api/tasks/:taskId/reminders
POST   /api/tasks/:taskId/reminders
DELETE /api/tasks/:taskId/reminders/:id
POST   /api/reminders/check          # 检查并发送到期提醒
GET    /api/reminders/pending        # 获取待发送提醒
```

#### 任务状态
| 状态 | 标签 | 说明 |
|------|------|------|
| `todo` | 待办 | 新建任务默认状态 |
| `in_progress` | 进行中 | 任务正在进行 |
| `blocked` | 阻塞 | 任务遇到阻碍 |
| `done` | 完成 | 任务已完成 |

#### 优先级
| 优先级 | 标签 | 颜色 |
|--------|------|------|
| `low` | 低 | 灰色 |
| `medium` | 中 | 蓝色 |
| `high` | 高 | 橙色 |
| `critical` | 紧急 | 红色 |

#### 同步创建任务（预留接口）
用于从其他模块（会议纪要、评审等）自动创建关联任务：
```javascript
POST /api/tasks/sync
{
  "project_id": 1,
  "title": "任务标题",
  "source_type": "meeting",     // meeting | review | email | other
  "source_id": "meeting-001",   // 来源唯一标识
  "source_title": "项目启动会议",
  "description": "任务描述",
  "priority": "high",
  "assignee_id": 1,
  "due_date": "2026-04-01"
}
```
- 自动检测重复：相同 `source_type` + `source_id` 不会重复创建
- 自动创建外部链接记录（`task_external_links` 表）

### 4. 里程碑管理 (`/api/milestones`)
- 项目里程碑规划
- 支持 `?projectId=` 过滤

### 5. 评审管理 (`/api/reviews`)
- 项目评审记录
- 支持 `?projectId=` 过滤

### 6. 合同管理 (`/api/contracts`)
- 合同信息维护
- 支持 `?projectId=` 过滤

### 7. KPI 考核 (`/api/kpi`)
- 人员绩效管理
- 支持 `?projectId=` 和 `?userId=` 过滤

### 8. 竞品分析 (`/api/competitors`)
- 竞品信息跟踪
- 支持 `?projectId=` 过滤

### 9. 工时填报 (`/api/time-logs`)
- 按天填报工时
- 支持批量填报、审批流程
- 工时汇总统计
- 支持 `?projectId=` 和 `?userId=` 过滤

### 10. 人力负载 (`/api/workload`)
- 人力负载看板
- 负载率计算与预警（超80%预警）
- 任务分配情况可视化

### 11. KPI 核算 V2 (`/api/kpi-v2`)
- 指标库管理（任务完成率、评审通过率、进度达成率等）
- 一键核算（自动从任务/评审/里程碑数据计算）
- KPI 仪表盘
- 考核报告生成与导出

### 12. API 配置管理 (`/api/api-configs`)
管理第三方 API 配置（如科大讯飞星火 RAG、大语言模型等）。

#### API 接口
```
GET    /api/api-configs             # 获取所有 API 配置
GET    /api/api-configs/:id         # 获取单个配置
POST   /api/api-configs             # 创建新配置（需管理员权限）
PUT    /api/api-configs/:id         # 更新配置（需管理员权限）
DELETE /api/api-configs/:id         # 删除配置（需管理员权限）
POST   /api/api-configs/:id/test    # 测试 API 连接
```

### 13. 会议纪要管理 (`/api/meeting-minutes`)
支持会议纪要上传/粘贴、AI 自动解析、一键同步任务/风险、知识库归档。

#### 核心功能
- **会议纪要创建**: 支持粘贴文本内容
- **AI 智能解析**: 自动提取待办、变更、风险、决策
- **一键同步**: 解析结果可同步到任务或风险登记册
- **知识库归档**: 会议纪要可归档到知识库，支持 RAG 问答

#### API 接口
```
GET    /api/meeting-minutes                    # 获取会议纪要列表
GET    /api/meeting-minutes/:id                # 获取详情（含解析结果）
POST   /api/meeting-minutes                    # 创建会议纪要
POST   /api/meeting-minutes/:id/parse          # 触发 AI 解析
PUT    /api/meeting-minutes/:minuteId/parse-results/:resultId  # 编辑解析结果
POST   /api/meeting-minutes/:minuteId/parse-results/:resultId/sync  # 同步到任务/风险
DELETE /api/meeting-minutes/:id                # 删除会议纪要
```

#### 解析结果类型
| 类型 | 说明 | 可同步到 |
|------|------|----------|
| `todo` | 待办事项 | 任务 |
| `change` | 变更记录 | 任务 |
| `risk` | 风险识别 | 风险登记册 |
| `decision` | 决策记录 | 任务 |

### 14. 知识库与 RAG 问答 (`/api/knowledge`)
基于会议纪要、评审记录等项目知识进行智能问答。

#### 核心功能
- **知识库文档管理**: 存储和索引项目知识文档
- **RAG 问答**: 基于知识库内容的智能问答
- **问答历史**: 记录历史问答，便于回溯

#### API 接口
```
# 知识库文档
GET    /api/knowledge/documents          # 获取文档列表
GET    /api/knowledge/documents/:id      # 获取文档详情
POST   /api/knowledge/documents          # 添加文档到知识库
DELETE /api/knowledge/documents/:id      # 删除文档
POST   /api/knowledge/archive/:minuteId  # 从会议纪要归档

# RAG 问答
POST   /api/knowledge/qa                 # RAG 问答
GET    /api/knowledge/qa-history         # 获取问答历史
```

## 开发指南

### 本地启动

```bash
# 后端 (已配置环境变量)
cd server
npm install
npm run dev

# 前端 (另开终端)
cd client
npm install
npm run dev
```

### 构建与部署

```bash
# 构建前端
cd client && pnpm run build

# 启动服务 (自动服务前端静态文件)
node server/src/index.js
```

### API 测试

```bash
# 健康检查
curl http://localhost:5000/health

# 登录
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 获取项目列表 (需认证)
curl http://localhost:5000/api/projects \
  -H "Authorization: Bearer <token>"
```

## 环境变量

关键配置位于 `server/.env`:

```bash
PORT=5000                           # 服务端口
JWT_SECRET=随机长字符串              # JWT 密钥
DATABASE_PATH=./data/robot_pms.db   # 数据库路径

# 可选: 科大讯飞 RAG
# IFLYTEK_RAG_BASE_URL=...
# IFLYTEK_RAG_API_KEY=...

# 可选: SMTP 邮件
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=...
# SMTP_PASS=...
```

## 权限系统

| 角色 | 权限 |
|------|------|
| `admin` | 完全访问权限，可创建用户、删除项目 |
| `user` | 可读写业务数据，不可删除项目 |

## 数据库设计

使用 SQLite 存储，主要表：
- `users` - 用户信息
- `projects` - 项目信息
- `tasks` - 任务（支持 WBS 层级、进度、里程碑关联）
- `plan_milestones` - 里程碑规划
- `task_external_links` - 任务外部链接（会议、评审等）
- `task_comments` - 任务备注
- `task_attachments` - 任务附件（存储 S3 key）
- `task_reminders` - 任务提醒
- `reviews` - 评审记录
- `contracts` - 合同
- `kpi_records` - KPI 记录
- `competitors` - 竞品分析
- `project_members` - 项目成员

## 预留集成

### RAG 检索 (`/api/integrations/rag/query`)
- 配置文件: `server/src/config/integrations.js`
- 客户端: `server/src/services/ragClient.js`

### 邮件服务 (`server/src/services/mailService.js`)
- 需安装 `nodemailer`
- SMTP 配置见 `.env`

## 常见问题

### 1. 端口冲突
修改 `server/.env` 中的 `PORT` 值

### 2. 数据库初始化
首次启动自动创建数据库并填充演示数据，无需手动操作

### 3. 前端代理
开发环境 Vite 已配置代理到后端，无需 CORS 配置

## 注意事项

- Node.js 版本要求: `>= 22.5.0` (推荐 24 LTS)
- SQLite 为实验性功能，首次启动会有警告提示，不影响使用
- 生产环境务必修改 `JWT_SECRET` 和默认管理员密码
