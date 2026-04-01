/**
 * 机器人单产品线项目管理系统 — API 入口
 * REST 前缀: /api
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { seedIfEmpty } from './seed.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import projectsRoutes from './routes/projects.js';
import tasksRoutes from './routes/tasks.js';
import reviewsRoutes from './routes/reviews.js';
import contractsRoutes from './routes/contracts.js';
import kpiRoutes from './routes/kpi.js';
import competitorsRoutes from './routes/competitors.js';
import integrationsRoutes from './routes/integrations.js';
import milestonesRoutes from './routes/milestones.js';
import taskLinksRoutes from './routes/taskLinks.js';
import taskCommentsRoutes from './routes/taskComments.js';
import taskAttachmentsRoutes from './routes/taskAttachments.js';
import taskRemindersRoutes from './routes/taskReminders.js';
import timeLogsRoutes from './routes/timeLogs.js';
import kpiV2Routes from './routes/kpiV2.js';
import apiConfigsRoutes from './routes/apiConfigs.js';
import meetingMinutesRoutes from './routes/meetingMinutes.js';
import knowledgeRoutes from './routes/knowledge.js';
import contractsRagRoutes from './routes/contractsRag.js';
import competitorsRagRoutes from './routes/competitorsRag.js';
import notificationsRoutes from './routes/notifications.js';

seedIfEmpty();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// 使用环境变量 DEPLOY_RUN_PORT 或默认 5000 端口
const PORT = Number(process.env.DEPLOY_RUN_PORT || process.env.PORT || 5000);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// 健康检查端点
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'robot-pms-api', ts: new Date().toISOString() });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/tasks/:taskId/comments', taskCommentsRoutes);
app.use('/api/tasks/:taskId/attachments', taskAttachmentsRoutes);
app.use('/api/tasks/:taskId/reminders', taskRemindersRoutes);
app.use('/api/reminders', taskRemindersRoutes);
app.use('/api/milestones', milestonesRoutes);
app.use('/api/task-links', taskLinksRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/kpi-v2', kpiV2Routes);
app.use('/api/time-logs', timeLogsRoutes);
app.use('/api/competitors', competitorsRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/api-configs', apiConfigsRoutes);
app.use('/api/meeting-minutes', meetingMinutesRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/contracts-rag', contractsRagRoutes);
app.use('/api/competitors-rag', competitorsRagRoutes);
app.use('/api/notifications', notificationsRoutes);

// 静态文件服务（前端构建产物）
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// SPA 路由处理：所有非 API 请求返回 index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[robot-pms] API 已启动: http://localhost:${PORT}`);
  console.log(`[robot-pms] 健康检查: http://localhost:${PORT}/health`);
});
