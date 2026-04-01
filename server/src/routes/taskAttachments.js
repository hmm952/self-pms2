/**
 * 任务附件 REST API（使用 S3 对象存储）
 * GET    /api/tasks/:taskId/attachments
 * POST   /api/tasks/:taskId/attachments
 * DELETE /api/tasks/:taskId/attachments/:id
 */
import { Router } from 'express';
import { param, validationResult } from 'express-validator';
import { db, insertId } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendServerError } from '../utils/http.js';

const router = Router({ mergeParams: true });

// 动态导入 SDK（ESM）
let S3Storage = null;
async function getStorage() {
  if (!S3Storage) {
    const module = await import('coze-coding-dev-sdk');
    S3Storage = module.S3Storage;
  }
  return new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    accessKey: '',
    secretKey: '',
    bucketName: process.env.COZE_BUCKET_NAME,
    region: 'cn-beijing',
  });
}

/** 获取任务的所有附件 */
router.get('/', requireAuth, param('taskId').isInt(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { taskId } = req.params;
  try {
    // 验证任务存在
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!task) return res.status(404).json({ message: '任务不存在' });

    const attachments = db
      .prepare(
        `SELECT a.*, u.username, u.full_name
         FROM task_attachments a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.task_id = ?
         ORDER BY a.created_at DESC`,
      )
      .all(taskId);

    // 为每个附件生成签名 URL
    const storage = await getStorage();
    const attachmentsWithUrl = await Promise.all(
      attachments.map(async (att) => {
        try {
          const url = await storage.generatePresignedUrl({
            key: att.file_key,
            expireTime: 86400, // 1 天有效期
          });
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

/** 上传附件 */
router.post(
  '/',
  requireAuth,
  param('taskId').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { taskId } = req.params;
    const userId = req.user.id;

    try {
      // 验证任务存在
      const task = db.prepare('SELECT id, title FROM tasks WHERE id = ?').get(taskId);
      if (!task) return res.status(404).json({ message: '任务不存在' });

      // 检查请求体是否包含文件数据
      const { fileName, fileContent, contentType, fileSize } = req.body;
      
      if (!fileName || !fileContent) {
        return res.status(400).json({ message: '缺少文件名或文件内容' });
      }

      // 验证文件名格式
      const validNamePattern = /^[a-zA-Z0-9._\-\/\u4e00-\u9fa5]+$/;
      if (!validNamePattern.test(fileName) || fileName.includes(' ')) {
        return res.status(400).json({ message: '文件名格式不正确，仅支持字母、数字、中文、点、下划线和短横' });
      }

      // 上传到对象存储
      const storage = await getStorage();
      const buffer = Buffer.from(fileContent, 'base64');
      const fileKey = await storage.uploadFile({
        fileContent: buffer,
        fileName: `tasks/${taskId}/${fileName}`,
        contentType: contentType || 'application/octet-stream',
      });

      // 保存记录到数据库
      const info = db
        .prepare(
          `INSERT INTO task_attachments (task_id, user_id, file_name, file_key, file_size, content_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(taskId, userId, fileName, fileKey, fileSize || buffer.length, contentType || 'application/octet-stream');

      const attachment = db
        .prepare(
          `SELECT a.*, u.username, u.full_name
           FROM task_attachments a
           LEFT JOIN users u ON u.id = a.user_id
           WHERE a.id = ?`,
        )
        .get(insertId(info));

      // 生成签名 URL
      const url = await storage.generatePresignedUrl({
        key: fileKey,
        expireTime: 86400,
      });

      res.status(201).json({ ...attachment, url });
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

/** 删除附件 */
router.delete(
  '/:id',
  requireAuth,
  param('taskId').isInt(),
  param('id').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { taskId, id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    try {
      const existing = db
        .prepare('SELECT * FROM task_attachments WHERE id = ? AND task_id = ?')
        .get(id, taskId);

      if (!existing) return res.status(404).json({ message: '附件不存在' });

      // 只有上传者或管理员可以删除
      if (existing.user_id !== userId && !isAdmin) {
        return res.status(403).json({ message: '只能删除自己上传的附件' });
      }

      // 从对象存储删除
      try {
        const storage = await getStorage();
        await storage.deleteFile({ fileKey: existing.file_key });
      } catch (e) {
        console.error('删除对象存储文件失败:', e.message);
        // 继续删除数据库记录
      }

      // 删除数据库记录
      db.prepare('DELETE FROM task_attachments WHERE id = ?').run(id);
      res.status(204).send();
    } catch (e) {
      sendServerError(res, e);
    }
  },
);

export default router;
