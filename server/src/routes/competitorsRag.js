import { Router } from 'express';
import { db, insertId } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const router = Router();

// ==================== 竞品列表与详情 ====================

/**
 * 获取竞品列表（扩展版）
 * GET /api/competitors-rag
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const { project_id, threat_level, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let sql = `
      SELECT c.*,
        cd.official_website, cd.company_name, cd.core_products,
        (SELECT COUNT(*) FROM competitor_parameters WHERE competitor_id = c.id) as product_count,
        (SELECT COUNT(*) FROM competitor_dynamics WHERE competitor_id = c.id) as dynamics_count,
        (SELECT MAX(publish_date) FROM competitor_dynamics WHERE competitor_id = c.id) as latest_dynamic_date
      FROM competitors c
      LEFT JOIN competitor_details cd ON c.id = cd.competitor_id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      sql += ' AND c.project_id = ?';
      params.push(project_id);
    }

    if (threat_level) {
      sql += ' AND c.threat_level = ?';
      params.push(threat_level);
    }

    // 获取总数
    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const totalResult = db.prepare(countSql).get(...params);

    // 排序分页
    sql += ' ORDER BY c.threat_level DESC, c.last_updated DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const competitors = db.prepare(sql).all(...params);

    res.json({
      data: competitors,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: totalResult?.total || 0
      }
    });
  } catch (error) {
    console.error('获取竞品列表失败:', error);
    res.status(500).json({ error: '获取竞品列表失败' });
  }
});

/**
 * 获取竞品详情
 * GET /api/competitors-rag/:id
 */
router.get('/:id', requireAuth, (req, res) => {
  try {
    const competitor = db.prepare(`
      SELECT c.*, cd.*
      FROM competitors c
      LEFT JOIN competitor_details cd ON c.id = cd.competitor_id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!competitor) {
      return res.status(404).json({ error: '竞品不存在' });
    }

    // 获取产品参数列表
    const parameters = db.prepare(`
      SELECT * FROM competitor_parameters 
      WHERE competitor_id = ? 
      ORDER BY created_at DESC
    `).all(req.params.id);

    // 获取最新动态
    const dynamics = db.prepare(`
      SELECT * FROM competitor_dynamics 
      WHERE competitor_id = ? 
      ORDER BY publish_date DESC, created_at DESC
      LIMIT 20
    `).all(req.params.id);

    // 获取爬虫配置
    const crawlerConfigs = db.prepare(`
      SELECT * FROM competitor_crawler_configs 
      WHERE competitor_id = ?
      ORDER BY created_at DESC
    `).all(req.params.id);

    res.json({
      ...competitor,
      parameters,
      dynamics,
      crawler_configs: crawlerConfigs,
    });
  } catch (error) {
    console.error('获取竞品详情失败:', error);
    res.status(500).json({ error: '获取竞品详情失败' });
  }
});

// ==================== 竞品基本信息管理 ====================

/**
 * 创建竞品
 * POST /api/competitors-rag
 */
router.post('/', requireAuth, (req, res) => {
  try {
    const {
      project_id, name, model_or_line, price_position, key_features,
      gap_analysis, threat_level,
      // 详情信息
      official_website, company_name, company_location, founded_year,
      employee_count, core_products, market_position, main_customers,
      annual_revenue, parent_company, subsidiaries, notes
    } = req.body;

    if (!project_id || !name) {
      return res.status(400).json({ error: '项目ID和竞品名称为必填项' });
    }

    const info = db.prepare(`
      INSERT INTO competitors (project_id, name, model_or_line, price_position, key_features, gap_analysis, threat_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id, name, model_or_line || null, price_position || null,
      key_features || null, gap_analysis || null, threat_level || 'medium'
    );

    const competitorId = insertId(info);

    // 创建详情记录
    db.prepare(`
      INSERT INTO competitor_details (competitor_id, official_website, company_name, company_location, founded_year, employee_count, core_products, market_position, main_customers, annual_revenue, parent_company, subsidiaries, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      competitorId, official_website || null, company_name || null, company_location || null,
      founded_year || null, employee_count || null, core_products || null, market_position || null,
      main_customers || null, annual_revenue || null, parent_company || null, subsidiaries || null, notes || null
    );

    const competitor = db.prepare(`
      SELECT c.*, cd.official_website, cd.company_name, cd.core_products
      FROM competitors c
      LEFT JOIN competitor_details cd ON c.id = cd.competitor_id
      WHERE c.id = ?
    `).get(competitorId);

    res.status(201).json(competitor);
  } catch (error) {
    console.error('创建竞品失败:', error);
    res.status(500).json({ error: '创建竞品失败' });
  }
});

/**
 * 更新竞品
 * PUT /api/competitors-rag/:id
 */
router.put('/:id', requireAuth, (req, res) => {
  try {
    const competitor = db.prepare('SELECT id FROM competitors WHERE id = ?').get(req.params.id);
    if (!competitor) {
      return res.status(404).json({ error: '竞品不存在' });
    }

    const {
      name, model_or_line, price_position, key_features,
      gap_analysis, threat_level,
      official_website, company_name, company_location, founded_year,
      employee_count, core_products, market_position, main_customers,
      annual_revenue, parent_company, subsidiaries, notes
    } = req.body;

    // 更新基本信息
    db.prepare(`
      UPDATE competitors SET
        name = COALESCE(?, name),
        model_or_line = ?,
        price_position = ?,
        key_features = ?,
        gap_analysis = ?,
        threat_level = COALESCE(?, threat_level),
        last_updated = datetime('now')
      WHERE id = ?
    `).run(
      name || null, model_or_line || null, price_position || null,
      key_features || null, gap_analysis || null, threat_level || null, req.params.id
    );

    // 更新或创建详情
    const detailExists = db.prepare('SELECT id FROM competitor_details WHERE competitor_id = ?').get(req.params.id);
    
    if (detailExists) {
      db.prepare(`
        UPDATE competitor_details SET
          official_website = ?,
          company_name = ?,
          company_location = ?,
          founded_year = ?,
          employee_count = ?,
          core_products = ?,
          market_position = ?,
          main_customers = ?,
          annual_revenue = ?,
          parent_company = ?,
          subsidiaries = ?,
          notes = ?,
          updated_at = datetime('now')
        WHERE competitor_id = ?
      `).run(
        official_website || null, company_name || null, company_location || null,
        founded_year || null, employee_count || null, core_products || null,
        market_position || null, main_customers || null, annual_revenue || null,
        parent_company || null, subsidiaries || null, notes || null, req.params.id
      );
    } else {
      db.prepare(`
        INSERT INTO competitor_details (competitor_id, official_website, company_name, company_location, founded_year, employee_count, core_products, market_position, main_customers, annual_revenue, parent_company, subsidiaries, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.params.id, official_website || null, company_name || null, company_location || null,
        founded_year || null, employee_count || null, core_products || null, market_position || null,
        main_customers || null, annual_revenue || null, parent_company || null, subsidiaries || null, notes || null
      );
    }

    const result = db.prepare(`
      SELECT c.*, cd.official_website, cd.company_name, cd.core_products
      FROM competitors c
      LEFT JOIN competitor_details cd ON c.id = cd.competitor_id
      WHERE c.id = ?
    `).get(req.params.id);

    res.json(result);
  } catch (error) {
    console.error('更新竞品失败:', error);
    res.status(500).json({ error: '更新竞品失败' });
  }
});

/**
 * 删除竞品
 * DELETE /api/competitors-rag/:id
 */
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM competitors WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '竞品不存在' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('删除竞品失败:', error);
    res.status(500).json({ error: '删除竞品失败' });
  }
});

// ==================== 竞品参数管理 ====================

/**
 * 获取竞品参数列表
 * GET /api/competitors-rag/:id/parameters
 */
router.get('/:id/parameters', requireAuth, (req, res) => {
  try {
    const parameters = db.prepare(`
      SELECT * FROM competitor_parameters 
      WHERE competitor_id = ? 
      ORDER BY created_at DESC
    `).all(req.params.id);
    res.json(parameters);
  } catch (error) {
    console.error('获取参数列表失败:', error);
    res.status(500).json({ error: '获取参数列表失败' });
  }
});

/**
 * 添加竞品参数
 * POST /api/competitors-rag/:id/parameters
 */
router.post('/:id/parameters', requireAuth, (req, res) => {
  try {
    const {
      product_name, product_model, product_category,
      payload_kg, reach_mm, repeat_accuracy_mm, speed_deg_s,
      protection_rating, battery_life_h, weight_kg, footprint_mm,
      degrees_of_freedom, control_type, communication_interface, programming_method,
      list_price, currency, price_note, launch_date, end_of_life_date,
      target_industries, certifications, additional_params, data_source, confidence_level
    } = req.body;

    if (!product_name) {
      return res.status(400).json({ error: '产品名称为必填项' });
    }

    const info = db.prepare(`
      INSERT INTO competitor_parameters (
        competitor_id, product_name, product_model, product_category,
        payload_kg, reach_mm, repeat_accuracy_mm, speed_deg_s,
        protection_rating, battery_life_h, weight_kg, footprint_mm,
        degrees_of_freedom, control_type, communication_interface, programming_method,
        list_price, currency, price_note, launch_date, end_of_life_date,
        target_industries, certifications, additional_params, data_source, confidence_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id, product_name, product_model || null, product_category || null,
      payload_kg || null, reach_mm || null, repeat_accuracy_mm || null, speed_deg_s || null,
      protection_rating || null, battery_life_h || null, weight_kg || null, footprint_mm || null,
      degrees_of_freedom || null, control_type || null, communication_interface || null, programming_method || null,
      list_price || null, currency || 'CNY', price_note || null, launch_date || null, end_of_life_date || null,
      target_industries || null, certifications || null, additional_params || null, data_source || null, confidence_level || 0.8
    );

    const parameter = db.prepare('SELECT * FROM competitor_parameters WHERE id = ?').get(insertId(info));
    res.status(201).json(parameter);
  } catch (error) {
    console.error('添加参数失败:', error);
    res.status(500).json({ error: '添加参数失败' });
  }
});

/**
 * 更新竞品参数
 * PUT /api/competitors-rag/:id/parameters/:paramId
 */
router.put('/:id/parameters/:paramId', requireAuth, (req, res) => {
  try {
    const param = db.prepare('SELECT id FROM competitor_parameters WHERE id = ? AND competitor_id = ?')
      .get(req.params.paramId, req.params.id);
    if (!param) {
      return res.status(404).json({ error: '参数记录不存在' });
    }

    const fields = [
      'product_name', 'product_model', 'product_category',
      'payload_kg', 'reach_mm', 'repeat_accuracy_mm', 'speed_deg_s',
      'protection_rating', 'battery_life_h', 'weight_kg', 'footprint_mm',
      'degrees_of_freedom', 'control_type', 'communication_interface', 'programming_method',
      'list_price', 'currency', 'price_note', 'launch_date', 'end_of_life_date',
      'target_industries', 'certifications', 'additional_params', 'data_source', 'confidence_level', 'last_verified'
    ];

    const updates = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => req.body[f] !== undefined ? req.body[f] : null);
    values.push(req.params.paramId);

    db.prepare(`UPDATE competitor_parameters SET ${updates}, updated_at = datetime('now') WHERE id = ?`).run(...values);

    const result = db.prepare('SELECT * FROM competitor_parameters WHERE id = ?').get(req.params.paramId);
    res.json(result);
  } catch (error) {
    console.error('更新参数失败:', error);
    res.status(500).json({ error: '更新参数失败' });
  }
});

/**
 * 删除竞品参数
 * DELETE /api/competitors-rag/:id/parameters/:paramId
 */
router.delete('/:id/parameters/:paramId', requireAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM competitor_parameters WHERE id = ? AND competitor_id = ?')
      .run(req.params.paramId, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '参数记录不存在' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('删除参数失败:', error);
    res.status(500).json({ error: '删除参数失败' });
  }
});

// ==================== 竞品动态管理 ====================

/**
 * 获取竞品动态列表
 * GET /api/competitors-rag/:id/dynamics
 */
router.get('/:id/dynamics', requireAuth, (req, res) => {
  try {
    const { type, limit = 20 } = req.query;
    let sql = 'SELECT * FROM competitor_dynamics WHERE competitor_id = ?';
    const params = [req.params.id];

    if (type) {
      sql += ' AND dynamic_type = ?';
      params.push(type);
    }

    sql += ' ORDER BY publish_date DESC, created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const dynamics = db.prepare(sql).all(...params);
    res.json(dynamics);
  } catch (error) {
    console.error('获取动态列表失败:', error);
    res.status(500).json({ error: '获取动态列表失败' });
  }
});

/**
 * 添加竞品动态
 * POST /api/competitors-rag/:id/dynamics
 */
router.post('/:id/dynamics', requireAuth, (req, res) => {
  try {
    const {
      dynamic_type, title, summary, content, source_url, source_name,
      publish_date, tags, importance, raw_data
    } = req.body;

    if (!dynamic_type || !title) {
      return res.status(400).json({ error: '动态类型和标题为必填项' });
    }

    const info = db.prepare(`
      INSERT INTO competitor_dynamics (
        competitor_id, dynamic_type, title, summary, content,
        source_url, source_name, publish_date, tags, importance, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id, dynamic_type, title, summary || null, content || null,
      source_url || null, source_name || null, publish_date || null,
      tags || null, importance || 'normal', raw_data || null
    );

    const dynamic = db.prepare('SELECT * FROM competitor_dynamics WHERE id = ?').get(insertId(info));
    res.status(201).json(dynamic);
  } catch (error) {
    console.error('添加动态失败:', error);
    res.status(500).json({ error: '添加动态失败' });
  }
});

/**
 * 更新竞品动态
 * PUT /api/competitors-rag/:id/dynamics/:dynamicId
 */
router.put('/:id/dynamics/:dynamicId', requireAuth, (req, res) => {
  try {
    const dynamic = db.prepare('SELECT id FROM competitor_dynamics WHERE id = ? AND competitor_id = ?')
      .get(req.params.dynamicId, req.params.id);
    if (!dynamic) {
      return res.status(404).json({ error: '动态记录不存在' });
    }

    const fields = ['dynamic_type', 'title', 'summary', 'content', 'source_url', 'source_name', 'publish_date', 'tags', 'importance', 'is_verified'];
    const updates = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => req.body[f] !== undefined ? req.body[f] : null);
    values.push(req.params.dynamicId);

    db.prepare(`UPDATE competitor_dynamics SET ${updates}, updated_at = datetime('now') WHERE id = ?`).run(...values);

    const result = db.prepare('SELECT * FROM competitor_dynamics WHERE id = ?').get(req.params.dynamicId);
    res.json(result);
  } catch (error) {
    console.error('更新动态失败:', error);
    res.status(500).json({ error: '更新动态失败' });
  }
});

/**
 * 删除竞品动态
 * DELETE /api/competitors-rag/:id/dynamics/:dynamicId
 */
router.delete('/:id/dynamics/:dynamicId', requireAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM competitor_dynamics WHERE id = ? AND competitor_id = ?')
      .run(req.params.dynamicId, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '动态记录不存在' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('删除动态失败:', error);
    res.status(500).json({ error: '删除动态失败' });
  }
});

// ==================== 爬虫配置管理 ====================

/**
 * 获取爬虫配置列表
 * GET /api/competitors-rag/:id/crawler-configs
 */
router.get('/:id/crawler-configs', requireAuth, (req, res) => {
  try {
    const configs = db.prepare(`
      SELECT * FROM competitor_crawler_configs 
      WHERE competitor_id = ?
      ORDER BY created_at DESC
    `).all(req.params.id);
    res.json(configs);
  } catch (error) {
    console.error('获取爬虫配置失败:', error);
    res.status(500).json({ error: '获取爬虫配置失败' });
  }
});

/**
 * 添加爬虫配置
 * POST /api/competitors-rag/:id/crawler-configs
 */
router.post('/:id/crawler-configs', requireAuth, (req, res) => {
  try {
    const { name, source_type, source_url, crawl_frequency, crawl_config, is_active } = req.body;

    if (!name || !source_type || !source_url) {
      return res.status(400).json({ error: '名称、来源类型和来源URL为必填项' });
    }

    const info = db.prepare(`
      INSERT INTO competitor_crawler_configs (
        competitor_id, name, source_type, source_url, crawl_frequency, crawl_config, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id, name, source_type, source_url,
      crawl_frequency || 'weekly', crawl_config || null, is_active !== undefined ? (is_active ? 1 : 0) : 1
    );

    const config = db.prepare('SELECT * FROM competitor_crawler_configs WHERE id = ?').get(insertId(info));
    res.status(201).json(config);
  } catch (error) {
    console.error('添加爬虫配置失败:', error);
    res.status(500).json({ error: '添加爬虫配置失败' });
  }
});

/**
 * 更新爬虫配置
 * PUT /api/competitors-rag/:id/crawler-configs/:configId
 */
router.put('/:id/crawler-configs/:configId', requireAuth, (req, res) => {
  try {
    const config = db.prepare('SELECT id FROM competitor_crawler_configs WHERE id = ? AND competitor_id = ?')
      .get(req.params.configId, req.params.id);
    if (!config) {
      return res.status(404).json({ error: '爬虫配置不存在' });
    }

    const { name, source_type, source_url, crawl_frequency, crawl_config, is_active } = req.body;

    db.prepare(`
      UPDATE competitor_crawler_configs SET
        name = COALESCE(?, name),
        source_type = COALESCE(?, source_type),
        source_url = COALESCE(?, source_url),
        crawl_frequency = COALESCE(?, crawl_frequency),
        crawl_config = ?,
        is_active = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || null, source_type || null, source_url || null,
      crawl_frequency || null, crawl_config || null,
      is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.configId
    );

    const result = db.prepare('SELECT * FROM competitor_crawler_configs WHERE id = ?').get(req.params.configId);
    res.json(result);
  } catch (error) {
    console.error('更新爬虫配置失败:', error);
    res.status(500).json({ error: '更新爬虫配置失败' });
  }
});

/**
 * 删除爬虫配置
 * DELETE /api/competitors-rag/:id/crawler-configs/:configId
 */
router.delete('/:id/crawler-configs/:configId', requireAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM competitor_crawler_configs WHERE id = ? AND competitor_id = ?')
      .run(req.params.configId, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '爬虫配置不存在' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('删除爬虫配置失败:', error);
    res.status(500).json({ error: '删除爬虫配置失败' });
  }
});

// ==================== RAG问答 ====================

/**
 * 竞品问答
 * POST /api/competitors-rag/:id/qa
 */
router.post('/:id/qa', requireAuth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: '问题不能为空' });
    }

    // 获取竞品信息
    const competitor = db.prepare(`
      SELECT c.*, cd.*
      FROM competitors c
      LEFT JOIN competitor_details cd ON c.id = cd.competitor_id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!competitor) {
      return res.status(404).json({ error: '竞品不存在' });
    }

    // 获取产品参数
    const parameters = db.prepare(`
      SELECT * FROM competitor_parameters WHERE competitor_id = ?
    `).all(req.params.id);

    // 获取最新动态
    const dynamics = db.prepare(`
      SELECT * FROM competitor_dynamics 
      WHERE competitor_id = ? 
      ORDER BY publish_date DESC LIMIT 10
    `).all(req.params.id);

    // 构建上下文
    const context = {
      competitor: {
        name: competitor.name,
        model_or_line: competitor.model_or_line,
        price_position: competitor.price_position,
        key_features: competitor.key_features,
        gap_analysis: competitor.gap_analysis,
        threat_level: competitor.threat_level,
        company_name: competitor.company_name,
        core_products: competitor.core_products,
        official_website: competitor.official_website,
      },
      parameters: parameters.map(p => ({
        product_name: p.product_name,
        product_model: p.product_model,
        product_category: p.product_category,
        payload_kg: p.payload_kg,
        reach_mm: p.reach_mm,
        repeat_accuracy_mm: p.repeat_accuracy_mm,
        speed_deg_s: p.speed_deg_s,
        protection_rating: p.protection_rating,
        battery_life_h: p.battery_life_h,
        weight_kg: p.weight_kg,
        list_price: p.list_price,
        currency: p.currency,
        launch_date: p.launch_date,
      })),
      dynamics: dynamics.map(d => ({
        type: d.dynamic_type,
        title: d.title,
        summary: d.summary,
        publish_date: d.publish_date,
      }))
    };

    // 调用LLM进行问答
    let answer;
    try {
      const llmClient = new LLMClient();
      const prompt = `你是一个竞品分析专家。请根据以下竞品信息回答用户问题。

竞品信息：
${JSON.stringify(context, null, 2)}

用户问题：${question}

请基于竞品信息给出专业、准确的回答。如果信息不足，请说明。`;

      const response = await llmClient.chat({
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      });

      answer = response.choices?.[0]?.message?.content || '抱歉，无法获取答案。';
    } catch (llmError) {
      console.error('LLM调用失败:', llmError);
      // 降级：返回基础信息
      answer = `基于已有信息，${competitor.name}的基本情况如下：\n\n`;
      if (competitor.key_features) {
        answer += `关键特性：${competitor.key_features}\n\n`;
      }
      if (parameters.length > 0) {
        answer += `产品参数：\n`;
        parameters.forEach(p => {
          answer += `- ${p.product_name}`;
          if (p.payload_kg) answer += ` (负载: ${p.payload_kg}kg)`;
          if (p.repeat_accuracy_mm) answer += ` (精度: ${p.repeat_accuracy_mm}mm)`;
          answer += `\n`;
        });
      }
    }

    // 保存问答历史
    db.prepare(`
      INSERT INTO competitor_qa_history (competitor_id, user_id, question, answer)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, req.user?.id, question, answer);

    res.json({ answer });
  } catch (error) {
    console.error('问答失败:', error);
    res.status(500).json({ error: '问答失败' });
  }
});

/**
 * 获取问答历史
 * GET /api/competitors-rag/:id/qa-history
 */
router.get('/:id/qa-history', requireAuth, (req, res) => {
  try {
    const history = db.prepare(`
      SELECT q.*, u.full_name as user_name
      FROM competitor_qa_history q
      LEFT JOIN users u ON q.user_id = u.id
      WHERE q.competitor_id = ?
      ORDER BY q.created_at DESC
      LIMIT 50
    `).all(req.params.id);
    res.json(history);
  } catch (error) {
    console.error('获取问答历史失败:', error);
    res.status(500).json({ error: '获取问答历史失败' });
  }
});

// ==================== 迭代建议管理 ====================

/**
 * 获取迭代建议列表
 * GET /api/competitors-rag/:id/suggestions
 */
router.get('/:id/suggestions', requireAuth, (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT s.*, u.full_name as created_by_name
      FROM competitor_iteration_suggestions s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.competitor_id = ?
    `;
    const params = [req.params.id];

    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY s.priority DESC, s.created_at DESC';

    const suggestions = db.prepare(sql).all(...params);
    res.json(suggestions);
  } catch (error) {
    console.error('获取迭代建议失败:', error);
    res.status(500).json({ error: '获取迭代建议失败' });
  }
});

/**
 * 添加迭代建议
 * POST /api/competitors-rag/:id/suggestions
 */
router.post('/:id/suggestions', requireAuth, (req, res) => {
  try {
    const {
      project_id, title, description, suggestion_type, priority,
      related_dynamics, impact_analysis, implementation_effort
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: '标题和描述为必填项' });
    }

    const info = db.prepare(`
      INSERT INTO competitor_iteration_suggestions (
        competitor_id, project_id, title, description, suggestion_type,
        priority, related_dynamics, impact_analysis, implementation_effort, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id, project_id || null, title, description, suggestion_type || 'feature',
      priority || 'medium', related_dynamics || null, impact_analysis || null,
      implementation_effort || 'medium', req.user?.id
    );

    const suggestion = db.prepare('SELECT * FROM competitor_iteration_suggestions WHERE id = ?').get(insertId(info));
    res.status(201).json(suggestion);
  } catch (error) {
    console.error('添加迭代建议失败:', error);
    res.status(500).json({ error: '添加迭代建议失败' });
  }
});

/**
 * 更新迭代建议状态
 * PUT /api/competitors-rag/:id/suggestions/:suggestionId
 */
router.put('/:id/suggestions/:suggestionId', requireAuth, (req, res) => {
  try {
    const { status, task_id } = req.body;

    const suggestion = db.prepare('SELECT id FROM competitor_iteration_suggestions WHERE id = ? AND competitor_id = ?')
      .get(req.params.suggestionId, req.params.id);
    if (!suggestion) {
      return res.status(404).json({ error: '迭代建议不存在' });
    }

    db.prepare(`
      UPDATE competitor_iteration_suggestions SET
        status = COALESCE(?, status),
        task_id = ?,
        reviewed_by = ?,
        reviewed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status || null, task_id || null, req.user?.id, req.params.suggestionId);

    const result = db.prepare('SELECT * FROM competitor_iteration_suggestions WHERE id = ?').get(req.params.suggestionId);
    res.json(result);
  } catch (error) {
    console.error('更新迭代建议失败:', error);
    res.status(500).json({ error: '更新迭代建议失败' });
  }
});

/**
 * 将迭代建议转为任务
 * POST /api/competitors-rag/:id/suggestions/:suggestionId/convert-to-task
 */
router.post('/:id/suggestions/:suggestionId/convert-to-task', requireAuth, (req, res) => {
  try {
    const suggestion = db.prepare(`
      SELECT s.*, c.project_id, c.name as competitor_name
      FROM competitor_iteration_suggestions s
      JOIN competitors c ON s.competitor_id = c.id
      WHERE s.id = ? AND s.competitor_id = ?
    `).get(req.params.suggestionId, req.params.id);

    if (!suggestion) {
      return res.status(404).json({ error: '迭代建议不存在' });
    }

    // 创建任务
    const taskInfo = db.prepare(`
      INSERT INTO tasks (project_id, title, description, priority, status, source_type, source_id)
      VALUES (?, ?, ?, ?, 'todo', 'competitor_analysis', ?)
    `).run(
      suggestion.project_id,
      `[竞品建议] ${suggestion.title}`,
      `来源：${suggestion.competitor_name}\n\n${suggestion.description}\n\n影响分析：${suggestion.impact_analysis || '无'}`,
      suggestion.priority === 'critical' ? 'critical' : suggestion.priority === 'high' ? 'high' : 'medium',
      `competitor_suggestion_${suggestion.id}`
    );

    const taskId = insertId(taskInfo);

    // 更新建议状态
    db.prepare(`
      UPDATE competitor_iteration_suggestions SET
        status = 'implemented',
        task_id = ?,
        reviewed_by = ?,
        reviewed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(taskId, req.user?.id, req.params.suggestionId);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.status(201).json({ task, suggestion: db.prepare('SELECT * FROM competitor_iteration_suggestions WHERE id = ?').get(req.params.suggestionId) });
  } catch (error) {
    console.error('转换任务失败:', error);
    res.status(500).json({ error: '转换任务失败' });
  }
});

// ==================== 对比分析 ====================

/**
 * 生成竞品对比报告
 * POST /api/competitors-rag/compare
 */
router.post('/compare', requireAuth, async (req, res) => {
  try {
    const { project_id, competitor_ids, our_product_name, our_parameters } = req.body;

    if (!project_id || !competitor_ids || competitor_ids.length === 0) {
      return res.status(400).json({ error: '项目ID和竞品ID为必填项' });
    }

    // 获取竞品信息
    const competitors = [];
    for (const id of competitor_ids) {
      const competitor = db.prepare(`
        SELECT c.*, cd.company_name, cd.official_website
        FROM competitors c
        LEFT JOIN competitor_details cd ON c.id = cd.competitor_id
        WHERE c.id = ?
      `).get(id);

      if (competitor) {
        const parameters = db.prepare(`
          SELECT * FROM competitor_parameters WHERE competitor_id = ?
        `).all(id);
        competitors.push({ ...competitor, parameters });
      }
    }

    // 构建对比数据
    const comparisonData = {
      competitors: competitors.map(c => ({
        id: c.id,
        name: c.name,
        company_name: c.company_name,
        threat_level: c.threat_level,
        parameters: c.parameters
      })),
      our_product: {
        name: our_product_name || '我方产品',
        parameters: our_parameters || {}
      }
    };

    // 调用LLM生成分析报告
    let analysisSummary = '';
    try {
      const llmClient = new LLMClient();
      const prompt = `你是一个机器人产品竞品分析专家。请根据以下数据生成一份竞品对比分析报告。

对比数据：
${JSON.stringify(comparisonData, null, 2)}

请从以下维度进行分析：
1. 技术参数对比（负载、精度、速度等核心指标）
2. 价格定位对比
3. 优劣势分析
4. 市场竞争态势
5. 建议应对策略

请用Markdown格式输出分析报告。`;

      const response = await llmClient.chat({
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      });

      analysisSummary = response.choices?.[0]?.message?.content || '';
    } catch (llmError) {
      console.error('LLM生成分析报告失败:', llmError);
      analysisSummary = '分析报告生成失败，请查看原始数据进行人工分析。';
    }

    // 保存对比报告
    const reportInfo = db.prepare(`
      INSERT INTO competitor_comparison_reports (project_id, title, competitors_involved, comparison_data, analysis_summary, generated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      project_id,
      `竞品对比分析 - ${new Date().toLocaleDateString()}`,
      JSON.stringify(competitor_ids),
      JSON.stringify(comparisonData),
      analysisSummary,
      req.user?.id
    );

    res.json({
      report_id: insertId(reportInfo),
      comparison_data: comparisonData,
      analysis_summary: analysisSummary
    });
  } catch (error) {
    console.error('生成对比报告失败:', error);
    res.status(500).json({ error: '生成对比报告失败' });
  }
});

/**
 * 获取对比报告列表
 * GET /api/competitors-rag/reports
 */
router.get('/reports/list', requireAuth, (req, res) => {
  try {
    const { project_id } = req.query;
    let sql = `
      SELECT r.*, u.full_name as generated_by_name
      FROM competitor_comparison_reports r
      LEFT JOIN users u ON r.generated_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      sql += ' AND r.project_id = ?';
      params.push(project_id);
    }

    sql += ' ORDER BY r.generated_at DESC LIMIT 20';

    const reports = db.prepare(sql).all(...params);
    res.json(reports);
  } catch (error) {
    console.error('获取报告列表失败:', error);
    res.status(500).json({ error: '获取报告列表失败' });
  }
});

/**
 * 获取对比报告详情
 * GET /api/competitors-rag/reports/:id
 */
router.get('/reports/:id', requireAuth, (req, res) => {
  try {
    const report = db.prepare(`
      SELECT r.*, u.full_name as generated_by_name
      FROM competitor_comparison_reports r
      LEFT JOIN users u ON r.generated_by = u.id
      WHERE r.id = ?
    `).get(req.params.id);

    if (!report) {
      return res.status(404).json({ error: '报告不存在' });
    }

    res.json(report);
  } catch (error) {
    console.error('获取报告详情失败:', error);
    res.status(500).json({ error: '获取报告详情失败' });
  }
});

// ==================== 自动分析 ====================

/**
 * 自动分析竞品动态，生成迭代建议
 * POST /api/competitors-rag/:id/auto-analyze
 */
router.post('/:id/auto-analyze', requireAuth, async (req, res) => {
  try {
    const competitor = db.prepare(`
      SELECT c.*, cd.company_name
      FROM competitors c
      LEFT JOIN competitor_details cd ON c.id = cd.competitor_id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!competitor) {
      return res.status(404).json({ error: '竞品不存在' });
    }

    // 获取竞品动态
    const dynamics = db.prepare(`
      SELECT * FROM competitor_dynamics 
      WHERE competitor_id = ? 
      ORDER BY publish_date DESC LIMIT 10
    `).all(req.params.id);

    // 获取产品参数
    const parameters = db.prepare(`
      SELECT * FROM competitor_parameters WHERE competitor_id = ?
    `).all(req.params.id);

    if (dynamics.length === 0) {
      return res.json({ message: '暂无动态数据可供分析', suggestions: [] });
    }

    // 调用LLM生成迭代建议
    let suggestions = [];
    try {
      const llmClient = new LLMClient();
      const prompt = `你是一个机器人产品策略专家。请分析以下竞品动态，生成产品迭代建议。

竞品名称：${competitor.name}
公司：${competitor.company_name || '未知'}

最新动态：
${dynamics.map((d, i) => `${i + 1}. [${d.dynamic_type}] ${d.title} (${d.publish_date || '日期未知'})
   摘要：${d.summary || '无'}`).join('\n')}

产品参数：
${parameters.map(p => `- ${p.product_name}: 负载${p.payload_kg}kg, 精度${p.repeat_accuracy_mm}mm, 价格${p.list_price}${p.currency}`).join('\n')}

请生成3-5条具体的迭代建议，每条包含：
1. 标题（简洁明确）
2. 描述（详细说明）
3. 类型（feature/performance/pricing/marketing/partnership/other）
4. 优先级（low/medium/high/critical）
5. 影响分析
6. 实施难度（low/medium/high）

请以JSON数组格式输出，例如：
[{"title":"...","description":"...","suggestion_type":"feature","priority":"high","impact_analysis":"...","implementation_effort":"medium"}]`;

      const response = await llmClient.chat({
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      });

      const content = response.choices?.[0]?.message?.content || '';
      
      // 尝试解析JSON
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('解析建议JSON失败:', parseError);
      }
    } catch (llmError) {
      console.error('LLM生成建议失败:', llmError);
    }

    // 保存建议到数据库
    const savedSuggestions = [];
    for (const suggestion of suggestions) {
      try {
        const info = db.prepare(`
          INSERT INTO competitor_iteration_suggestions (
            competitor_id, project_id, title, description, suggestion_type,
            priority, impact_analysis, implementation_effort, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.params.id, competitor.project_id,
          suggestion.title, suggestion.description, suggestion.suggestion_type || 'feature',
          suggestion.priority || 'medium', suggestion.impact_analysis || null,
          suggestion.implementation_effort || 'medium', req.user?.id
        );
        savedSuggestions.push(db.prepare('SELECT * FROM competitor_iteration_suggestions WHERE id = ?').get(insertId(info)));
      } catch (saveError) {
        console.error('保存建议失败:', saveError);
      }
    }

    res.json({ 
      message: `成功生成 ${savedSuggestions.length} 条迭代建议`,
      suggestions: savedSuggestions 
    });
  } catch (error) {
    console.error('自动分析失败:', error);
    res.status(500).json({ error: '自动分析失败' });
  }
});

export default router;
