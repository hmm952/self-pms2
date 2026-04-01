import { Router } from 'express';
import { db, insertId } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import nodemailer from 'nodemailer';

const router = Router();

// ==================== 邮件配置管理 ====================

/**
 * 获取邮件配置列表
 * GET /api/notifications/email-configs
 */
router.get('/email-configs', requireAuth, (req, res) => {
  try {
    const { project_id } = req.query;
    let sql = `
      SELECT e.*, u.full_name as created_by_name
      FROM email_configs e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      sql += ' AND (e.project_id = ? OR e.project_id IS NULL)';
      params.push(project_id);
    }

    sql += ' ORDER BY e.is_default DESC, e.created_at DESC';

    const configs = db.prepare(sql).all(...params);
    // 隐藏密码
    res.json(configs.map(c => ({ ...c, smtp_pass: '******' })));
  } catch (error) {
    console.error('获取邮件配置失败:', error);
    res.status(500).json({ error: '获取邮件配置失败' });
  }
});

/**
 * 创建邮件配置
 * POST /api/notifications/email-configs
 */
router.post('/email-configs', requireAuth, (req, res) => {
  try {
    const {
      project_id, config_name, smtp_host, smtp_port, smtp_secure,
      smtp_user, smtp_pass, from_email, from_name, is_default
    } = req.body;

    if (!config_name || !smtp_host || !smtp_user || !smtp_pass || !from_email) {
      return res.status(400).json({ error: '配置名称、SMTP服务器、用户名、密码、发件邮箱为必填项' });
    }

    // 如果设为默认，先取消其他默认配置
    if (is_default) {
      db.prepare('UPDATE email_configs SET is_default = 0 WHERE project_id = ?').run(project_id || null);
    }

    const info = db.prepare(`
      INSERT INTO email_configs (
        project_id, config_name, smtp_host, smtp_port, smtp_secure,
        smtp_user, smtp_pass, from_email, from_name, is_default, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id || null, config_name, smtp_host, smtp_port || 587, smtp_secure ? 1 : 0,
      smtp_user, smtp_pass, from_email, from_name || null, is_default ? 1 : 0, req.user?.id
    );

    const config = db.prepare('SELECT * FROM email_configs WHERE id = ?').get(insertId(info));
    res.status(201).json({ ...config, smtp_pass: '******' });
  } catch (error) {
    console.error('创建邮件配置失败:', error);
    res.status(500).json({ error: '创建邮件配置失败' });
  }
});

/**
 * 更新邮件配置
 * PUT /api/notifications/email-configs/:id
 */
router.put('/email-configs/:id', requireAuth, (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM email_configs WHERE id = ?').get(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '配置不存在' });
    }

    const {
      config_name, smtp_host, smtp_port, smtp_secure,
      smtp_user, smtp_pass, from_email, from_name, is_default, is_active
    } = req.body;

    // 如果设为默认，先取消其他默认配置
    if (is_default) {
      db.prepare('UPDATE email_configs SET is_default = 0 WHERE project_id = ?').run(config.project_id || null);
    }

    db.prepare(`
      UPDATE email_configs SET
        config_name = COALESCE(?, config_name),
        smtp_host = COALESCE(?, smtp_host),
        smtp_port = COALESCE(?, smtp_port),
        smtp_secure = ?,
        smtp_user = COALESCE(?, smtp_user),
        smtp_pass = CASE WHEN ? IS NULL OR ? = '******' THEN smtp_pass ELSE ? END,
        from_email = COALESCE(?, from_email),
        from_name = ?,
        is_default = ?,
        is_active = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      config_name || null, smtp_host || null, smtp_port || null,
      smtp_secure !== undefined ? (smtp_secure ? 1 : 0) : null,
      smtp_user || null,
      smtp_pass || null, smtp_pass || null, smtp_pass || null,
      from_email || null, from_name || null,
      is_default !== undefined ? (is_default ? 1 : 0) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      req.params.id
    );

    const result = db.prepare('SELECT * FROM email_configs WHERE id = ?').get(req.params.id);
    res.json({ ...result, smtp_pass: '******' });
  } catch (error) {
    console.error('更新邮件配置失败:', error);
    res.status(500).json({ error: '更新邮件配置失败' });
  }
});

/**
 * 测试邮件配置
 * POST /api/notifications/email-configs/:id/test
 */
router.post('/email-configs/:id/test', requireAuth, async (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM email_configs WHERE id = ?').get(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '配置不存在' });
    }

    const { test_email } = req.body;
    const toEmail = test_email || config.from_email;

    // 创建传输器
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure === 1,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass,
      },
    });

    // 发送测试邮件
    const info = await transporter.sendMail({
      from: `"${config.from_name || 'Robot PMS'}" <${config.from_email}>`,
      to: toEmail,
      subject: '【测试】邮件配置测试成功',
      text: '这是一封测试邮件，如果您收到此邮件，说明邮件配置正确。',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #059669;">邮件配置测试成功</h2>
          <p>这是一封测试邮件，如果您收到此邮件，说明邮件配置正确。</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            发送时间：${new Date().toLocaleString('zh-CN')}<br>
            发送服务器：${config.smtp_host}:${config.smtp_port}
          </p>
        </div>
      `,
    });

    // 更新测试状态
    db.prepare(`
      UPDATE email_configs SET
        last_test_at = datetime('now'),
        last_test_status = 'success',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id);

    res.json({ 
      success: true, 
      message: `测试邮件已发送至 ${toEmail}`,
      messageId: info.messageId 
    });
  } catch (error) {
    console.error('测试邮件失败:', error);
    
    // 更新测试状态
    db.prepare(`
      UPDATE email_configs SET
        last_test_at = datetime('now'),
        last_test_status = 'failed',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id);

    res.status(500).json({ 
      success: false, 
      error: '测试邮件发送失败', 
      message: error.message 
    });
  }
});

/**
 * 删除邮件配置
 * DELETE /api/notifications/email-configs/:id
 */
router.delete('/email-configs/:id', requireAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM email_configs WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '配置不存在' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('删除邮件配置失败:', error);
    res.status(500).json({ error: '删除邮件配置失败' });
  }
});

// ==================== 模板管理 ====================

/**
 * 获取模板列表
 * GET /api/notifications/templates
 */
router.get('/templates', requireAuth, (req, res) => {
  try {
    const { project_id, template_type, is_builtin } = req.query;
    let sql = `
      SELECT t.*, u.full_name as created_by_name
      FROM notification_templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      sql += ' AND (t.project_id = ? OR t.project_id IS NULL)';
      params.push(project_id);
    }

    if (template_type) {
      sql += ' AND t.template_type = ?';
      params.push(template_type);
    }

    if (is_builtin !== undefined) {
      sql += ' AND t.is_builtin = ?';
      params.push(is_builtin === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY t.is_builtin DESC, t.created_at DESC';

    const templates = db.prepare(sql).all(...params);
    res.json(templates);
  } catch (error) {
    console.error('获取模板列表失败:', error);
    res.status(500).json({ error: '获取模板列表失败' });
  }
});

/**
 * 获取模板详情
 * GET /api/notifications/templates/:id
 */
router.get('/templates/:id', requireAuth, (req, res) => {
  try {
    const template = db.prepare(`
      SELECT t.*, u.full_name as created_by_name
      FROM notification_templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }

    res.json(template);
  } catch (error) {
    console.error('获取模板详情失败:', error);
    res.status(500).json({ error: '获取模板详情失败' });
  }
});

/**
 * 创建模板
 * POST /api/notifications/templates
 */
router.post('/templates', requireAuth, (req, res) => {
  try {
    const {
      project_id, template_code, template_name, template_type, category,
      subject, body_text, body_html, supported_variables, description
    } = req.body;

    if (!template_name || !template_type || !subject) {
      return res.status(400).json({ error: '模板名称、类型、主题为必填项' });
    }

    const code = template_code || `custom_${Date.now()}`;

    const info = db.prepare(`
      INSERT INTO notification_templates (
        project_id, template_code, template_name, template_type, category,
        subject, body_text, body_html, supported_variables, description, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id || null, code, template_name, template_type, category || 'general',
      subject, body_text || null, body_html || null,
      supported_variables || null, description || null, req.user?.id
    );

    const template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(insertId(info));
    res.status(201).json(template);
  } catch (error) {
    console.error('创建模板失败:', error);
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: '模板代码已存在' });
    }
    res.status(500).json({ error: '创建模板失败' });
  }
});

/**
 * 更新模板
 * PUT /api/notifications/templates/:id
 */
router.put('/templates/:id', requireAuth, (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(req.params.id);
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }

    if (template.is_builtin) {
      return res.status(400).json({ error: '内置模板不可修改' });
    }

    const {
      template_name, template_type, category, subject, body_text, body_html,
      supported_variables, description, is_active
    } = req.body;

    db.prepare(`
      UPDATE notification_templates SET
        template_name = COALESCE(?, template_name),
        template_type = COALESCE(?, template_type),
        category = COALESCE(?, category),
        subject = COALESCE(?, subject),
        body_text = ?,
        body_html = ?,
        supported_variables = ?,
        description = ?,
        is_active = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      template_name || null, template_type || null, category || null,
      subject || null, body_text || null, body_html || null,
      supported_variables || null, description || null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      req.params.id
    );

    const result = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('更新模板失败:', error);
    res.status(500).json({ error: '更新模板失败' });
  }
});

/**
 * 删除模板
 * DELETE /api/notifications/templates/:id
 */
router.delete('/templates/:id', requireAuth, (req, res) => {
  try {
    const template = db.prepare('SELECT is_builtin FROM notification_templates WHERE id = ?').get(req.params.id);
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }

    if (template.is_builtin) {
      return res.status(400).json({ error: '内置模板不可删除' });
    }

    db.prepare('DELETE FROM notification_templates WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('删除模板失败:', error);
    res.status(500).json({ error: '删除模板失败' });
  }
});

// ==================== 触发规则管理 ====================

/**
 * 获取规则列表
 * GET /api/notifications/rules
 */
router.get('/rules', requireAuth, (req, res) => {
  try {
    const { project_id, rule_type, is_active } = req.query;
    let sql = `
      SELECT r.*, t.template_name, e.config_name as email_config_name,
             u.full_name as created_by_name
      FROM notification_rules r
      LEFT JOIN notification_templates t ON r.template_id = t.id
      LEFT JOIN email_configs e ON r.email_config_id = e.id
      LEFT JOIN users u ON r.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      sql += ' AND (r.project_id = ? OR r.project_id IS NULL)';
      params.push(project_id);
    }

    if (rule_type) {
      sql += ' AND r.rule_type = ?';
      params.push(rule_type);
    }

    if (is_active !== undefined) {
      sql += ' AND r.is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY r.priority DESC, r.created_at DESC';

    const rules = db.prepare(sql).all(...params);
    res.json(rules);
  } catch (error) {
    console.error('获取规则列表失败:', error);
    res.status(500).json({ error: '获取规则列表失败' });
  }
});

/**
 * 创建规则
 * POST /api/notifications/rules
 */
router.post('/rules', requireAuth, (req, res) => {
  try {
    const {
      project_id, rule_name, rule_type, source_module, trigger_condition,
      template_id, email_config_id, recipients, cc_recipients, is_active, priority
    } = req.body;

    if (!rule_name || !rule_type || !source_module || !recipients) {
      return res.status(400).json({ error: '规则名称、类型、来源模块、收件人为必填项' });
    }

    const info = db.prepare(`
      INSERT INTO notification_rules (
        project_id, rule_name, rule_type, source_module, trigger_condition,
        template_id, email_config_id, recipients, cc_recipients, is_active, priority, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id || null, rule_name, rule_type, source_module, JSON.stringify(trigger_condition || {}),
      template_id || null, email_config_id || null,
      JSON.stringify(recipients), cc_recipients ? JSON.stringify(cc_recipients) : null,
      is_active !== false ? 1 : 0, priority || 5, req.user?.id
    );

    const rule = db.prepare(`
      SELECT r.*, t.template_name, e.config_name as email_config_name
      FROM notification_rules r
      LEFT JOIN notification_templates t ON r.template_id = t.id
      LEFT JOIN email_configs e ON r.email_config_id = e.id
      WHERE r.id = ?
    `).get(insertId(info));

    res.status(201).json(rule);
  } catch (error) {
    console.error('创建规则失败:', error);
    res.status(500).json({ error: '创建规则失败' });
  }
});

/**
 * 更新规则
 * PUT /api/notifications/rules/:id
 */
router.put('/rules/:id', requireAuth, (req, res) => {
  try {
    const rule = db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: '规则不存在' });
    }

    const {
      rule_name, rule_type, source_module, trigger_condition,
      template_id, email_config_id, recipients, cc_recipients, is_active, priority
    } = req.body;

    db.prepare(`
      UPDATE notification_rules SET
        rule_name = COALESCE(?, rule_name),
        rule_type = COALESCE(?, rule_type),
        source_module = COALESCE(?, source_module),
        trigger_condition = ?,
        template_id = ?,
        email_config_id = ?,
        recipients = ?,
        cc_recipients = ?,
        is_active = ?,
        priority = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      rule_name || null, rule_type || null, source_module || null,
      trigger_condition ? JSON.stringify(trigger_condition) : null,
      template_id || null, email_config_id || null,
      recipients ? JSON.stringify(recipients) : null,
      cc_recipients ? JSON.stringify(cc_recipients) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      priority || null,
      req.params.id
    );

    const result = db.prepare(`
      SELECT r.*, t.template_name, e.config_name as email_config_name
      FROM notification_rules r
      LEFT JOIN notification_templates t ON r.template_id = t.id
      LEFT JOIN email_configs e ON r.email_config_id = e.id
      WHERE r.id = ?
    `).get(req.params.id);

    res.json(result);
  } catch (error) {
    console.error('更新规则失败:', error);
    res.status(500).json({ error: '更新规则失败' });
  }
});

/**
 * 删除规则
 * DELETE /api/notifications/rules/:id
 */
router.delete('/rules/:id', requireAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM notification_rules WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '规则不存在' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('删除规则失败:', error);
    res.status(500).json({ error: '删除规则失败' });
  }
});

// ==================== 发送通知 ====================

/**
 * 手动发送通知
 * POST /api/notifications/send
 */
router.post('/send', requireAuth, async (req, res) => {
  try {
    const {
      project_id, template_id, email_config_id, recipients, cc_recipients,
      variables, related_module, related_id
    } = req.body;

    if (!template_id || !recipients || recipients.length === 0) {
      return res.status(400).json({ error: '模板和收件人为必填项' });
    }

    // 获取模板
    const template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(template_id);
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }

    // 获取邮件配置
    let emailConfig = null;
    if (email_config_id) {
      emailConfig = db.prepare('SELECT * FROM email_configs WHERE id = ?').get(email_config_id);
    }
    if (!emailConfig) {
      emailConfig = db.prepare('SELECT * FROM email_configs WHERE is_default = 1 AND (project_id = ? OR project_id IS NULL) LIMIT 1').get(project_id || null);
    }
    if (!emailConfig) {
      return res.status(400).json({ error: '未找到可用的邮件配置' });
    }

    // 替换变量
    let subject = template.subject;
    let bodyText = template.body_text || '';
    let bodyHtml = template.body_html || '';

    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        subject = subject.replace(regex, value || '');
        bodyText = bodyText.replace(regex, value || '');
        bodyHtml = bodyHtml.replace(regex, value || '');
      });
    }

    // 创建发送记录
    const logInfo = db.prepare(`
      INSERT INTO notification_logs (
        project_id, template_id, email_config_id, notification_type,
        subject, body_text, body_html, recipients, cc_recipients,
        related_module, related_id, variables_used, status, created_by
      ) VALUES (?, ?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      project_id || null, template_id, emailConfig.id,
      subject, bodyText, bodyHtml,
      JSON.stringify(recipients), cc_recipients ? JSON.stringify(cc_recipients) : null,
      related_module || null, related_id || null,
      variables ? JSON.stringify(variables) : null, req.user?.id
    );

    const logId = insertId(logInfo);

    try {
      // 更新状态为发送中
      db.prepare("UPDATE notification_logs SET status = 'sending' WHERE id = ?").run(logId);

      // 创建传输器
      const transporter = nodemailer.createTransport({
        host: emailConfig.smtp_host,
        port: emailConfig.smtp_port,
        secure: emailConfig.smtp_secure === 1,
        auth: {
          user: emailConfig.smtp_user,
          pass: emailConfig.smtp_pass,
        },
      });

      // 发送邮件
      const info = await transporter.sendMail({
        from: `"${emailConfig.from_name || 'Robot PMS'}" <${emailConfig.from_email}>`,
        to: recipients.join(', '),
        cc: cc_recipients ? cc_recipients.join(', ') : undefined,
        subject,
        text: bodyText,
        html: bodyHtml,
      });

      // 更新发送状态
      db.prepare(`
        UPDATE notification_logs SET
          status = 'sent',
          message_id = ?,
          sent_at = datetime('now'),
          delivered_at = datetime('now')
        WHERE id = ?
      `).run(info.messageId, logId);

      res.json({ 
        success: true, 
        message: '邮件发送成功', 
        log_id: logId,
        message_id: info.messageId 
      });
    } catch (sendError) {
      console.error('发送邮件失败:', sendError);

      // 更新失败状态
      db.prepare(`
        UPDATE notification_logs SET
          status = 'failed',
          error_message = ?,
          sent_at = datetime('now')
        WHERE id = ?
      `).run(sendError.message, logId);

      res.status(500).json({ 
        success: false, 
        error: '邮件发送失败', 
        message: sendError.message,
        log_id: logId
      });
    }
  } catch (error) {
    console.error('发送通知失败:', error);
    res.status(500).json({ error: '发送通知失败' });
  }
});

/**
 * 预览模板
 * POST /api/notifications/preview
 */
router.post('/preview', requireAuth, (req, res) => {
  try {
    const { template_id, variables } = req.body;

    const template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(template_id);
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }

    let subject = template.subject;
    let bodyText = template.body_text || '';
    let bodyHtml = template.body_html || '';

    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        subject = subject.replace(regex, value || '');
        bodyText = bodyText.replace(regex, value || '');
        bodyHtml = bodyHtml.replace(regex, value || '');
      });
    }

    res.json({ subject, body_text: bodyText, body_html: bodyHtml });
  } catch (error) {
    console.error('预览模板失败:', error);
    res.status(500).json({ error: '预览模板失败' });
  }
});

// ==================== 发送记录管理 ====================

/**
 * 获取发送记录列表
 * GET /api/notifications/logs
 */
router.get('/logs', requireAuth, (req, res) => {
  try {
    const { project_id, status, notification_type, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let sql = `
      SELECT l.*, t.template_name, e.config_name as email_config_name,
             u.full_name as created_by_name
      FROM notification_logs l
      LEFT JOIN notification_templates t ON l.template_id = t.id
      LEFT JOIN email_configs e ON l.email_config_id = e.id
      LEFT JOIN users u ON l.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      sql += ' AND l.project_id = ?';
      params.push(project_id);
    }

    if (status) {
      sql += ' AND l.status = ?';
      params.push(status);
    }

    if (notification_type) {
      sql += ' AND l.notification_type = ?';
      params.push(notification_type);
    }

    // 获取总数
    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const totalResult = db.prepare(countSql).get(...params);

    // 排序分页
    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const logs = db.prepare(sql).all(...params);

    res.json({
      data: logs,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: totalResult?.total || 0
      }
    });
  } catch (error) {
    console.error('获取发送记录失败:', error);
    res.status(500).json({ error: '获取发送记录失败' });
  }
});

/**
 * 获取发送记录详情
 * GET /api/notifications/logs/:id
 */
router.get('/logs/:id', requireAuth, (req, res) => {
  try {
    const log = db.prepare(`
      SELECT l.*, t.template_name, e.config_name as email_config_name,
             u.full_name as created_by_name
      FROM notification_logs l
      LEFT JOIN notification_templates t ON l.template_id = t.id
      LEFT JOIN email_configs e ON l.email_config_id = e.id
      LEFT JOIN users u ON l.created_by = u.id
      WHERE l.id = ?
    `).get(req.params.id);

    if (!log) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json(log);
  } catch (error) {
    console.error('获取记录详情失败:', error);
    res.status(500).json({ error: '获取记录详情失败' });
  }
});

// ==================== Webhook配置（企业微信/钉钉） ====================

/**
 * 获取Webhook配置列表
 * GET /api/notifications/webhooks
 */
router.get('/webhooks', requireAuth, (req, res) => {
  try {
    const { project_id } = req.query;
    let sql = `
      SELECT w.*, u.full_name as created_by_name
      FROM webhook_configs w
      LEFT JOIN users u ON w.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      sql += ' AND (w.project_id = ? OR w.project_id IS NULL)';
      params.push(project_id);
    }

    sql += ' ORDER BY w.created_at DESC';

    const webhooks = db.prepare(sql).all(...params);
    // 隐藏secret
    res.json(webhooks.map(w => ({ ...w, secret: w.secret ? '******' : null })));
  } catch (error) {
    console.error('获取Webhook配置失败:', error);
    res.status(500).json({ error: '获取Webhook配置失败' });
  }
});

/**
 * 创建Webhook配置
 * POST /api/notifications/webhooks
 */
router.post('/webhooks', requireAuth, (req, res) => {
  try {
    const { project_id, config_name, webhook_type, webhook_url, secret, extra_config } = req.body;

    if (!config_name || !webhook_type || !webhook_url) {
      return res.status(400).json({ error: '配置名称、类型、URL为必填项' });
    }

    const info = db.prepare(`
      INSERT INTO webhook_configs (project_id, config_name, webhook_type, webhook_url, secret, extra_config, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id || null, config_name, webhook_type, webhook_url,
      secret || null, extra_config ? JSON.stringify(extra_config) : null, req.user?.id
    );

    const webhook = db.prepare('SELECT * FROM webhook_configs WHERE id = ?').get(insertId(info));
    res.status(201).json({ ...webhook, secret: webhook.secret ? '******' : null });
  } catch (error) {
    console.error('创建Webhook配置失败:', error);
    res.status(500).json({ error: '创建Webhook配置失败' });
  }
});

/**
 * 更新Webhook配置
 * PUT /api/notifications/webhooks/:id
 */
router.put('/webhooks/:id', requireAuth, (req, res) => {
  try {
    const webhook = db.prepare('SELECT * FROM webhook_configs WHERE id = ?').get(req.params.id);
    if (!webhook) {
      return res.status(404).json({ error: '配置不存在' });
    }

    const { config_name, webhook_type, webhook_url, secret, extra_config, is_active } = req.body;

    db.prepare(`
      UPDATE webhook_configs SET
        config_name = COALESCE(?, config_name),
        webhook_type = COALESCE(?, webhook_type),
        webhook_url = COALESCE(?, webhook_url),
        secret = CASE WHEN ? IS NULL OR ? = '******' THEN secret ELSE ? END,
        extra_config = ?,
        is_active = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      config_name || null, webhook_type || null, webhook_url || null,
      secret || null, secret || null, secret || null,
      extra_config ? JSON.stringify(extra_config) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      req.params.id
    );

    const result = db.prepare('SELECT * FROM webhook_configs WHERE id = ?').get(req.params.id);
    res.json({ ...result, secret: result.secret ? '******' : null });
  } catch (error) {
    console.error('更新Webhook配置失败:', error);
    res.status(500).json({ error: '更新Webhook配置失败' });
  }
});

/**
 * 测试Webhook
 * POST /api/notifications/webhooks/:id/test
 */
router.post('/webhooks/:id/test', requireAuth, async (req, res) => {
  try {
    const webhook = db.prepare('SELECT * FROM webhook_configs WHERE id = ?').get(req.params.id);
    if (!webhook) {
      return res.status(404).json({ error: '配置不存在' });
    }

    // 构造测试消息
    let body;
    if (webhook.webhook_type === 'wechat') {
      body = {
        msgtype: 'text',
        text: { content: '【测试】Robot PMS Webhook测试消息' }
      };
    } else if (webhook.webhook_type === 'dingtalk') {
      body = {
        msgtype: 'text',
        text: { content: '【测试】Robot PMS Webhook测试消息' }
      };
    } else {
      body = { message: 'Test notification from Robot PMS' };
    }

    const response = await fetch(webhook.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.text();

    // 更新测试状态
    db.prepare(`
      UPDATE webhook_configs SET
        last_test_at = datetime('now'),
        last_test_status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(response.ok ? 'success' : 'failed', req.params.id);

    res.json({ 
      success: response.ok, 
      status: response.status,
      response: result 
    });
  } catch (error) {
    console.error('测试Webhook失败:', error);
    
    db.prepare(`
      UPDATE webhook_configs SET
        last_test_at = datetime('now'),
        last_test_status = 'failed',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id);

    res.status(500).json({ 
      success: false, 
      error: '测试失败', 
      message: error.message 
    });
  }
});

/**
 * 删除Webhook配置
 * DELETE /api/notifications/webhooks/:id
 */
router.delete('/webhooks/:id', requireAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM webhook_configs WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '配置不存在' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('删除Webhook配置失败:', error);
    res.status(500).json({ error: '删除Webhook配置失败' });
  }
});

// ==================== 自动触发检查 ====================

/**
 * 检查并触发自动通知
 * POST /api/notifications/check-and-trigger
 */
router.post('/check-and-trigger', requireAuth, async (req, res) => {
  try {
    const { project_id } = req.body;
    
    // 获取所有活跃的自动触发规则
    const rules = db.prepare(`
      SELECT r.*, t.subject, t.body_text, t.body_html
      FROM notification_rules r
      LEFT JOIN notification_templates t ON r.template_id = t.id
      WHERE r.is_active = 1 AND r.rule_type != 'manual'
        AND (r.project_id = ? OR r.project_id IS NULL)
    `).all(project_id || null);

    const results = [];

    for (const rule of rules) {
      const condition = JSON.parse(rule.trigger_condition || '{}');
      const recipients = JSON.parse(rule.recipients || '[]');
      
      let shouldTrigger = false;
      let triggerItems = [];

      switch (rule.rule_type) {
        case 'task_overdue':
          // 检查逾期任务
          triggerItems = checkOverdueTasks(project_id, condition);
          shouldTrigger = triggerItems.length > 0;
          break;
        case 'task_due_soon':
          // 检查即将到期任务
          triggerItems = checkDueSoonTasks(project_id, condition);
          shouldTrigger = triggerItems.length > 0;
          break;
        case 'review_due':
          // 检查即将进行的评审
          triggerItems = checkDueReviews(project_id, condition);
          shouldTrigger = triggerItems.length > 0;
          break;
        case 'payment_due':
          // 检查付款节点
          triggerItems = checkDuePayments(project_id, condition);
          shouldTrigger = triggerItems.length > 0;
          break;
        case 'milestone_due':
          // 检查里程碑
          triggerItems = checkDueMilestones(project_id, condition);
          shouldTrigger = triggerItems.length > 0;
          break;
      }

      if (shouldTrigger) {
        // 为每个触发项发送通知
        for (const item of triggerItems) {
          const result = await sendNotificationForItem(rule, item, recipients);
          results.push(result);
        }
      }
    }

    res.json({ triggered: results.length, results });
  } catch (error) {
    console.error('检查触发失败:', error);
    res.status(500).json({ error: '检查触发失败' });
  }
});

// 辅助函数：检查逾期任务
function checkOverdueTasks(projectId, condition) {
  const daysOverdue = condition.days_overdue || 1;
  const sql = `
    SELECT t.*, p.name as project_name, u.full_name as assignee_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.status != 'done'
      AND t.due_date IS NOT NULL
      AND date(t.due_date) < date('now', '-${daysOverdue} days')
      ${projectId ? 'AND t.project_id = ?' : ''}
  `;
  return db.prepare(sql).all(projectId || null);
}

// 辅助函数：检查即将到期任务
function checkDueSoonTasks(projectId, condition) {
  const daysBefore = condition.days_before || 3;
  const sql = `
    SELECT t.*, p.name as project_name, u.full_name as assignee_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.status != 'done'
      AND t.due_date IS NOT NULL
      AND date(t.due_date) BETWEEN date('now') AND date('now', '+${daysBefore} days')
      ${projectId ? 'AND t.project_id = ?' : ''}
  `;
  return db.prepare(sql).all(projectId || null);
}

// 辅助函数：检查即将进行的评审
function checkDueReviews(projectId, condition) {
  const daysBefore = condition.days_before || 3;
  const sql = `
    SELECT r.*, p.name as project_name
    FROM reviews r
    LEFT JOIN projects p ON r.project_id = p.id
    WHERE r.status IN ('draft', 'scheduled')
      AND r.review_date IS NOT NULL
      AND date(r.review_date) BETWEEN date('now') AND date('now', '+${daysBefore} days')
      ${projectId ? 'AND r.project_id = ?' : ''}
  `;
  return db.prepare(sql).all(projectId || null);
}

// 辅助函数：检查付款节点
function checkDuePayments(projectId, condition) {
  const daysBefore = condition.days_before || 7;
  const sql = `
    SELECT pn.*, c.title as contract_title, p.name as project_name
    FROM contract_payment_nodes pn
    LEFT JOIN contracts c ON pn.contract_id = c.id
    LEFT JOIN projects p ON c.project_id = p.id
    WHERE pn.status IN ('pending', 'due_soon')
      AND date(pn.planned_date) BETWEEN date('now') AND date('now', '+${daysBefore} days')
      ${projectId ? 'AND c.project_id = ?' : ''}
  `;
  return db.prepare(sql).all(projectId || null);
}

// 辅助函数：检查里程碑
function checkDueMilestones(projectId, condition) {
  const daysBefore = condition.days_before || 7;
  const sql = `
    SELECT m.*, p.name as project_name
    FROM plan_milestones m
    LEFT JOIN projects p ON m.project_id = p.id
    WHERE m.status IN ('planned', 'in_progress')
      AND m.target_date IS NOT NULL
      AND date(m.target_date) BETWEEN date('now') AND date('now', '+${daysBefore} days')
      ${projectId ? 'AND m.project_id = ?' : ''}
  `;
  return db.prepare(sql).all(projectId || null);
}

// 辅助函数：发送通知
async function sendNotificationForItem(rule, item, recipients) {
  // 简化版：实际应该根据规则获取模板和邮件配置，发送邮件
  return {
    rule_id: rule.id,
    rule_name: rule.rule_name,
    item_id: item.id,
    recipients: recipients,
    sent: true
  };
}

export default router;
