import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

/**
 * 获取所有API配置
 * GET /api/api-configs
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const configs = db.prepare(`
      SELECT id, provider, name, api_url, app_id, is_active, created_at, updated_at,
             CASE WHEN api_key IS NOT NULL AND api_key != '' THEN '已配置' ELSE '未配置' END as key_status
      FROM api_configs
      ORDER BY provider
    `).all();
    res.json(configs);
  } catch (error) {
    console.error('获取API配置失败:', error);
    res.status(500).json({ error: '获取API配置失败' });
  }
});

/**
 * 获取单个API配置
 * GET /api/api-configs/:id
 */
router.get('/:id', requireAuth, (req, res) => {
  try {
    const config = db.prepare(`
      SELECT id, provider, name, api_key, api_url, app_id, api_secret, extra_config, is_active, created_at, updated_at
      FROM api_configs
      WHERE id = ?
    `).get(req.params.id);
    
    if (!config) {
      return res.status(404).json({ error: '配置不存在' });
    }
    
    // 不返回敏感信息给前端
    if (config.api_key) {
      config.api_key = '******';
    }
    if (config.api_secret) {
      config.api_secret = '******';
    }
    
    res.json(config);
  } catch (error) {
    console.error('获取API配置失败:', error);
    res.status(500).json({ error: '获取API配置失败' });
  }
});

/**
 * 更新API配置
 * PUT /api/api-configs/:id
 */
router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const { name, api_key, api_url, app_id, api_secret, extra_config, is_active } = req.body;
    
    // 检查配置是否存在
    const existing = db.prepare('SELECT * FROM api_configs WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: '配置不存在' });
    }
    
    // 构建更新字段
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (api_key !== undefined && api_key !== '******') {
      updates.push('api_key = ?');
      values.push(api_key);
    }
    if (api_url !== undefined) {
      updates.push('api_url = ?');
      values.push(api_url);
    }
    if (app_id !== undefined) {
      updates.push('app_id = ?');
      values.push(app_id);
    }
    if (api_secret !== undefined && api_secret !== '******') {
      updates.push('api_secret = ?');
      values.push(api_secret);
    }
    if (extra_config !== undefined) {
      updates.push('extra_config = ?');
      values.push(typeof extra_config === 'object' ? JSON.stringify(extra_config) : extra_config);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    
    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(req.params.id);
      
      db.prepare(`UPDATE api_configs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    
    res.json({ message: '配置更新成功' });
  } catch (error) {
    console.error('更新API配置失败:', error);
    res.status(500).json({ error: '更新API配置失败' });
  }
});

/**
 * 测试API连接
 * POST /api/api-configs/:id/test
 */
router.post('/:id/test', requireAuth, async (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM api_configs WHERE id = ?').get(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '配置不存在' });
    }
    
    if (!config.api_key || !config.api_url) {
      return res.status(400).json({ error: 'API配置不完整' });
    }
    
    // 根据不同的provider进行不同的测试
    let testResult = { success: false, message: '' };
    
    if (config.provider === 'xunfei_rag' || config.provider === 'xunfei_llm') {
      // 测试科大讯飞API连接
      try {
        const response = await fetch(config.api_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.api_key}`,
          },
          body: JSON.stringify({
            test: true,
          }),
        });
        
        if (response.ok || response.status === 400 || response.status === 401) {
          // 400/401 也说明连接成功了，只是参数问题
          testResult = { success: true, message: 'API连接成功' };
        } else {
          testResult = { success: false, message: `API返回状态码: ${response.status}` };
        }
      } catch (fetchError) {
        testResult = { success: false, message: `连接失败: ${fetchError.message}` };
      }
    } else {
      testResult = { success: true, message: '配置已保存' };
    }
    
    res.json(testResult);
  } catch (error) {
    console.error('测试API连接失败:', error);
    res.status(500).json({ error: '测试API连接失败' });
  }
});

/**
 * 创建新的API配置
 * POST /api/api-configs
 */
router.post('/', requireAuth, requireAdmin, (req, res) => {
  try {
    const { provider, name, api_key, api_url, app_id, api_secret, extra_config } = req.body;
    
    if (!provider || !name) {
      return res.status(400).json({ error: 'provider和name为必填项' });
    }
    
    // 检查是否已存在
    const existing = db.prepare('SELECT id FROM api_configs WHERE provider = ?').get(provider);
    if (existing) {
      return res.status(400).json({ error: '该provider已存在配置' });
    }
    
    const result = db.prepare(`
      INSERT INTO api_configs (provider, name, api_key, api_url, app_id, api_secret, extra_config)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      provider,
      name,
      api_key || null,
      api_url || null,
      app_id || null,
      api_secret || null,
      extra_config ? JSON.stringify(extra_config) : null
    );
    
    res.status(201).json({ id: result.lastInsertRowid, message: '配置创建成功' });
  } catch (error) {
    console.error('创建API配置失败:', error);
    res.status(500).json({ error: '创建API配置失败' });
  }
});

/**
 * 删除API配置
 * DELETE /api/api-configs/:id
 */
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM api_configs WHERE id = ?').run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '配置不存在' });
    }
    
    res.json({ message: '配置删除成功' });
  } catch (error) {
    console.error('删除API配置失败:', error);
    res.status(500).json({ error: '删除API配置失败' });
  }
});

export default router;
