import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const router = Router();

// ==================== 合同基础信息 ====================

/**
 * 获取合同列表（扩展版）
 * GET /api/contracts-rag
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const { project_id, status, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let sql = `
      SELECT c.*, p.name as project_name,
        (SELECT COUNT(*) FROM contract_documents WHERE contract_id = c.id) as document_count,
        (SELECT COUNT(*) FROM contract_payment_nodes WHERE contract_id = c.id) as payment_node_count,
        (SELECT COUNT(*) FROM contract_payment_nodes WHERE contract_id = c.id AND status = 'overdue') as overdue_count,
        (SELECT MAX(version) FROM contract_documents WHERE contract_id = c.id) as current_version
      FROM contracts c
      LEFT JOIN projects p ON c.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      sql += ' AND c.project_id = ?';
      params.push(project_id);
    }

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    // 获取总数
    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const totalResult = db.prepare(countSql).get(...params);

    // 排序分页
    sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const contracts = db.prepare(sql).all(...params);

    res.json({
      data: contracts,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: totalResult.total,
      },
    });
  } catch (error) {
    console.error('获取合同列表失败:', error);
    res.status(500).json({ error: '获取合同列表失败' });
  }
});

/**
 * 获取合同详情（含解析结果、付款节点、交付要求）
 * GET /api/contracts-rag/:id
 */
router.get('/:id', requireAuth, (req, res) => {
  try {
    const contract = db.prepare(`
      SELECT c.*, p.name as project_name
      FROM contracts c
      LEFT JOIN projects p ON c.project_id = p.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!contract) {
      return res.status(404).json({ error: '合同不存在' });
    }

    // 获取解析结果
    const parseResult = db.prepare(`
      SELECT * FROM contract_parse_results WHERE contract_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(req.params.id);

    // 获取文档版本列表
    const documents = db.prepare(`
      SELECT d.*, u.full_name as uploader_name
      FROM contract_documents d
      LEFT JOIN users u ON d.upload_by = u.id
      WHERE d.contract_id = ?
      ORDER BY d.version DESC
    `).all(req.params.id);

    // 获取付款节点
    const paymentNodes = db.prepare(`
      SELECT p.*, m.name as milestone_name
      FROM contract_payment_nodes p
      LEFT JOIN plan_milestones m ON p.milestone_id = m.id
      WHERE p.contract_id = ?
      ORDER BY p.planned_date
    `).all(req.params.id);

    // 获取交付要求
    const deliveryRequirements = db.prepare(`
      SELECT d.*, t.title as task_title
      FROM contract_delivery_requirements d
      LEFT JOIN tasks t ON d.task_id = t.id
      WHERE d.contract_id = ?
      ORDER BY d.sort_order, d.planned_date
    `).all(req.params.id);

    // 获取变更记录
    const changes = db.prepare(`
      SELECT c.*, i.full_name as initiator_name, a.full_name as approver_name
      FROM contract_changes c
      LEFT JOIN users i ON c.requested_by = i.id
      LEFT JOIN users a ON c.approved_by = a.id
      WHERE c.contract_id = ?
      ORDER BY c.created_at DESC
    `).all(req.params.id);

    res.json({
      ...contract,
      parse_result: parseResult,
      documents,
      payment_nodes: paymentNodes,
      delivery_requirements: deliveryRequirements,
      changes,
    });
  } catch (error) {
    console.error('获取合同详情失败:', error);
    res.status(500).json({ error: '获取合同详情失败' });
  }
});

// ==================== 合同文档管理 ====================

/**
 * 上传合同文档
 * POST /api/contracts-rag/:id/documents
 */
router.post('/:id/documents', requireAuth, async (req, res) => {
  try {
    const { file_name, file_key, file_type, file_size } = req.body;
    const contractId = req.params.id;

    // 检查合同是否存在
    const contract = db.prepare('SELECT id FROM contracts WHERE id = ?').get(contractId);
    if (!contract) {
      return res.status(404).json({ error: '合同不存在' });
    }

    // 获取当前最大版本号
    const maxVersion = db.prepare(`
      SELECT MAX(version) as max_v FROM contract_documents WHERE contract_id = ?
    `).get(contractId);
    const newVersion = (maxVersion?.max_v || 0) + 1;

    // 将旧文档标记为非当前版本
    db.prepare(`
      UPDATE contract_documents SET is_current = 0 WHERE contract_id = ?
    `).run(contractId);

    // 插入新文档
    const result = db.prepare(`
      INSERT INTO contract_documents (
        contract_id, version, file_name, file_key, file_type, file_size, upload_by, is_current
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(contractId, newVersion, file_name, file_key, file_type, file_size, req.user.id);

    // 异步触发解析
    parseContractDocument(result.lastInsertRowid, contractId, file_key).catch(err => {
      console.error('解析合同文档失败:', err);
    });

    res.status(201).json({
      id: result.lastInsertRowid,
      version: newVersion,
      message: '文档上传成功，正在解析中...',
    });
  } catch (error) {
    console.error('上传合同文档失败:', error);
    res.status(500).json({ error: '上传合同文档失败' });
  }
});

/**
 * 获取合同文档内容（用于下载）
 * GET /api/contracts-rag/:id/documents/:docId
 */
router.get('/:id/documents/:docId', requireAuth, (req, res) => {
  try {
    const doc = db.prepare(`
      SELECT d.*, c.project_id
      FROM contract_documents d
      JOIN contracts c ON d.contract_id = c.id
      WHERE d.id = ? AND d.contract_id = ?
    `).get(req.params.docId, req.params.id);

    if (!doc) {
      return res.status(404).json({ error: '文档不存在' });
    }

    res.json(doc);
  } catch (error) {
    console.error('获取合同文档失败:', error);
    res.status(500).json({ error: '获取合同文档失败' });
  }
});

/**
 * 解析合同文档（使用LLM提取关键信息）
 * POST /api/contracts-rag/:id/documents/:docId/parse
 */
router.post('/:id/documents/:docId/parse', requireAuth, async (req, res) => {
  try {
    const doc = db.prepare(`
      SELECT d.*, c.project_id
      FROM contract_documents d
      JOIN contracts c ON d.contract_id = c.id
      WHERE d.id = ? AND d.contract_id = ?
    `).get(req.params.docId, req.params.id);

    if (!doc) {
      return res.status(404).json({ error: '文档不存在' });
    }

    // 更新解析状态
    db.prepare(`
      UPDATE contract_documents SET parse_status = 'parsing', updated_at = datetime('now') WHERE id = ?
    `).run(doc.id);

    // 异步解析
    parseContractDocument(doc.id, doc.contract_id, doc.file_key).catch(err => {
      console.error('解析合同文档失败:', err);
    });

    res.json({ message: '解析任务已启动' });
  } catch (error) {
    console.error('触发解析失败:', error);
    res.status(500).json({ error: '触发解析失败' });
  }
});

/**
 * 使用LLM解析合同文档
 */
async function parseContractDocument(documentId, contractId, fileKey) {
  try {
    // 更新解析状态
    db.prepare(`
      UPDATE contract_documents SET parse_status = 'parsing', updated_at = datetime('now') WHERE id = ?
    `).run(documentId);

    // TODO: 实际项目中需要从对象存储获取文件内容并提取文本
    // 这里使用模拟的合同文本进行演示
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
    
    // 使用LLM解析合同关键信息
    const config = new Config();
    const client = new LLMClient(config);

    const parsePrompt = `你是一个合同分析专家，请分析以下合同信息，提取关键条款。

合同基本信息：
- 合同名称：${contract.title}
- 合作方：${contract.counterparty}
- 金额：${contract.amount} ${contract.currency}
- 生效日期：${contract.effective_date || '未指定'}
- 到期日期：${contract.expiry_date || '未指定'}

请按以下JSON格式返回解析结果：
{
  "contract_name": "合同全称",
  "counterparty": "合作方全称",
  "contract_amount": 合同总金额(数字),
  "currency": "货币代码",
  "sign_date": "签订日期(YYYY-MM-DD)",
  "effective_date": "生效日期(YYYY-MM-DD)",
  "expiry_date": "到期日期(YYYY-MM-DD)",
  "payment_terms": "付款条款概述",
  "payment_nodes": [
    {
      "node_name": "付款节点名称",
      "amount": 金额,
      "due_date": "应付日期(YYYY-MM-DD)",
      "description": "付款条件说明"
    }
  ],
  "delivery_terms": "交付条款概述",
  "delivery_requirements": [
    {
      "requirement_name": "交付物名称",
      "deliverable_type": "类型(document/hardware/software/service/other)",
      "planned_date": "计划交付日期(YYYY-MM-DD)",
      "acceptance_criteria": "验收标准"
    }
  ],
  "breach_liability": "违约责任条款",
  "confidentiality_clause": "保密条款",
  "special_terms": "特殊条款"
}

注意：
1. 只返回JSON，不要添加任何说明文字
2. 如果某类信息不存在，返回空字符串或空数组
3. 日期格式统一为 YYYY-MM-DD
4. 金额保留原始数值，不要添加货币符号`;

    const messages = [{ role: 'user', content: parsePrompt }];
    const response = await client.invoke(messages, { temperature: 0.3 });

    // 解析LLM返回的JSON
    let parseResult;
    try {
      const responseText = response.content;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parseResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法从响应中提取JSON');
      }
    } catch (parseError) {
      console.error('解析LLM响应失败:', parseError);
      throw new Error('LLM返回格式错误');
    }

    // 保存解析结果
    db.prepare(`
      INSERT INTO contract_parse_results (
        contract_id, document_id, contract_name, counterparty, contract_amount, currency,
        sign_date, effective_date, expiry_date, payment_terms, delivery_terms,
        breach_liability, confidentiality_clause, special_terms, raw_extract, confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contractId,
      documentId,
      parseResult.contract_name || contract.title,
      parseResult.counterparty || contract.counterparty,
      parseResult.contract_amount || contract.amount,
      parseResult.currency || contract.currency,
      parseResult.sign_date || null,
      parseResult.effective_date || contract.effective_date,
      parseResult.expiry_date || contract.expiry_date,
      parseResult.payment_terms || null,
      parseResult.delivery_terms || null,
      parseResult.breach_liability || null,
      parseResult.confidentiality_clause || null,
      parseResult.special_terms || null,
      JSON.stringify(parseResult),
      0.8
    );

    // 更新合同基本信息
    db.prepare(`
      UPDATE contracts SET
        title = COALESCE(?, title),
        counterparty = COALESCE(?, counterparty),
        amount = COALESCE(?, amount),
        currency = COALESCE(?, currency),
        effective_date = COALESCE(?, effective_date),
        expiry_date = COALESCE(?, expiry_date),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      parseResult.contract_name,
      parseResult.counterparty,
      parseResult.contract_amount,
      parseResult.currency,
      parseResult.effective_date,
      parseResult.expiry_date,
      contractId
    );

    // 创建付款节点
    if (parseResult.payment_nodes && parseResult.payment_nodes.length > 0) {
      const insertPaymentNode = db.prepare(`
        INSERT INTO contract_payment_nodes (
          contract_id, node_name, node_description, planned_amount, currency, planned_date, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < parseResult.payment_nodes.length; i++) {
        const node = parseResult.payment_nodes[i];
        insertPaymentNode.run(
          contractId,
          node.node_name || `付款节点${i + 1}`,
          node.description || null,
          node.amount || 0,
          parseResult.currency || 'CNY',
          node.due_date || null,
          i
        );
      }
    }

    // 创建交付要求
    if (parseResult.delivery_requirements && parseResult.delivery_requirements.length > 0) {
      const insertDeliveryReq = db.prepare(`
        INSERT INTO contract_delivery_requirements (
          contract_id, requirement_name, requirement_description, deliverable_type, planned_date, acceptance_criteria, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < parseResult.delivery_requirements.length; i++) {
        const req = parseResult.delivery_requirements[i];
        insertDeliveryReq.run(
          contractId,
          req.requirement_name || `交付物${i + 1}`,
          req.description || null,
          req.deliverable_type || 'other',
          req.planned_date || null,
          req.acceptance_criteria || null,
          i
        );
      }
    }

    // 更新解析状态
    db.prepare(`
      UPDATE contract_documents SET parse_status = 'parsed', updated_at = datetime('now') WHERE id = ?
    `).run(documentId);

    console.log(`合同文档 ${documentId} 解析完成`);
  } catch (error) {
    console.error('解析合同文档失败:', error);

    // 更新解析失败状态
    db.prepare(`
      UPDATE contract_documents SET parse_status = 'failed', parse_error = ?, updated_at = datetime('now') WHERE id = ?
    `).run(error.message, documentId);
  }
}

// ==================== 付款节点管理 ====================

/**
 * 获取付款节点列表
 * GET /api/contracts-rag/:id/payment-nodes
 */
router.get('/:id/payment-nodes', requireAuth, (req, res) => {
  try {
    const nodes = db.prepare(`
      SELECT p.*, m.name as milestone_name
      FROM contract_payment_nodes p
      LEFT JOIN plan_milestones m ON p.milestone_id = m.id
      WHERE p.contract_id = ?
      ORDER BY p.sort_order, p.planned_date
    `).all(req.params.id);

    res.json(nodes);
  } catch (error) {
    console.error('获取付款节点失败:', error);
    res.status(500).json({ error: '获取付款节点失败' });
  }
});

/**
 * 创建付款节点
 * POST /api/contracts-rag/:id/payment-nodes
 */
router.post('/:id/payment-nodes', requireAuth, (req, res) => {
  try {
    const {
      node_name, node_description, planned_amount, currency,
      planned_date, milestone_id, payment_method, notes, sort_order
    } = req.body;

    const result = db.prepare(`
      INSERT INTO contract_payment_nodes (
        contract_id, node_name, node_description, planned_amount, currency,
        planned_date, milestone_id, payment_method, notes, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id,
      node_name,
      node_description || null,
      planned_amount,
      currency || 'CNY',
      planned_date,
      milestone_id || null,
      payment_method || null,
      notes || null,
      sort_order || 0
    );

    // 如果关联了里程碑，更新里程碑的合同关联
    if (milestone_id) {
      db.prepare(`
        UPDATE plan_milestones SET contract_id = ?, updated_at = datetime('now') WHERE id = ?
      `).run(req.params.id, milestone_id);
    }

    res.status(201).json({ id: result.lastInsertRowid, message: '付款节点创建成功' });
  } catch (error) {
    console.error('创建付款节点失败:', error);
    res.status(500).json({ error: '创建付款节点失败' });
  }
});

/**
 * 更新付款节点
 * PUT /api/contracts-rag/:id/payment-nodes/:nodeId
 */
router.put('/:id/payment-nodes/:nodeId', requireAuth, (req, res) => {
  try {
    const {
      node_name, node_description, planned_amount, actual_amount,
      planned_date, actual_date, status, milestone_id, payment_method,
      payment_proof, invoice_status, notes
    } = req.body;

    db.prepare(`
      UPDATE contract_payment_nodes SET
        node_name = COALESCE(?, node_name),
        node_description = COALESCE(?, node_description),
        planned_amount = COALESCE(?, planned_amount),
        actual_amount = COALESCE(?, actual_amount),
        planned_date = COALESCE(?, planned_date),
        actual_date = COALESCE(?, actual_date),
        status = COALESCE(?, status),
        milestone_id = COALESCE(?, milestone_id),
        payment_method = COALESCE(?, payment_method),
        payment_proof = COALESCE(?, payment_proof),
        invoice_status = COALESCE(?, invoice_status),
        notes = COALESCE(?, notes),
        updated_at = datetime('now')
      WHERE id = ? AND contract_id = ?
    `).run(
      node_name || null,
      node_description || null,
      planned_amount || null,
      actual_amount || null,
      planned_date || null,
      actual_date || null,
      status || null,
      milestone_id || null,
      payment_method || null,
      payment_proof || null,
      invoice_status || null,
      notes || null,
      req.params.nodeId,
      req.params.id
    );

    res.json({ message: '付款节点更新成功' });
  } catch (error) {
    console.error('更新付款节点失败:', error);
    res.status(500).json({ error: '更新付款节点失败' });
  }
});

/**
 * 同步付款节点到里程碑
 * POST /api/contracts-rag/:id/payment-nodes/:nodeId/sync-milestone
 */
router.post('/:id/payment-nodes/:nodeId/sync-milestone', requireAuth, (req, res) => {
  try {
    const node = db.prepare(`
      SELECT p.*, c.project_id
      FROM contract_payment_nodes p
      JOIN contracts c ON p.contract_id = c.id
      WHERE p.id = ? AND p.contract_id = ?
    `).get(req.params.nodeId, req.params.id);

    if (!node) {
      return res.status(404).json({ error: '付款节点不存在' });
    }

    // 检查是否已关联里程碑
    if (node.milestone_id) {
      return res.status(400).json({ error: '该节点已关联里程碑' });
    }

    // 创建新里程碑
    const result = db.prepare(`
      INSERT INTO plan_milestones (project_id, name, description, planned_date, status, contract_id, payment_node_id)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      node.project_id,
      `付款：${node.node_name}`,
      node.node_description,
      node.planned_date,
      node.contract_id,
      node.id
    );

    // 更新付款节点关联
    db.prepare(`
      UPDATE contract_payment_nodes SET milestone_id = ?, updated_at = datetime('now') WHERE id = ?
    `).run(result.lastInsertRowid, node.id);

    res.json({ milestone_id: result.lastInsertRowid, message: '已同步到项目里程碑' });
  } catch (error) {
    console.error('同步里程碑失败:', error);
    res.status(500).json({ error: '同步里程碑失败' });
  }
});

/**
 * 检查并更新付款节点状态（定时任务调用）
 * POST /api/contracts-rag/check-payment-status
 */
router.post('/check-payment-status', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 查找即将到期的付款节点
    const dueSoonNodes = db.prepare(`
      SELECT p.*, c.title as contract_title, c.project_id, p2.name as project_name
      FROM contract_payment_nodes p
      JOIN contracts c ON p.contract_id = c.id
      LEFT JOIN projects p2 ON c.project_id = p2.id
      WHERE p.status = 'pending'
        AND p.planned_date <= ?
        AND p.planned_date >= ?
    `).all(sevenDaysLater, today);

    // 更新状态为即将到期
    for (const node of dueSoonNodes) {
      if (node.planned_date <= today) {
        db.prepare(`
          UPDATE contract_payment_nodes SET status = 'overdue', updated_at = datetime('now') WHERE id = ?
        `).run(node.id);
      } else {
        db.prepare(`
          UPDATE contract_payment_nodes SET status = 'due_soon', updated_at = datetime('now') WHERE id = ?
        `).run(node.id);
      }

      // 创建提醒
      db.prepare(`
        INSERT INTO contract_reminders (
          contract_id, reminder_type, reference_id, reminder_date, reminder_message, status
        ) VALUES (?, 'payment', ?, ?, ?, 'pending')
      `).run(
        node.contract_id,
        node.id,
        today,
        `付款节点"${node.node_name}"将于${node.planned_date}到期，金额：${node.planned_amount}${node.currency}`
      );
    }

    res.json({
      checked: dueSoonNodes.length,
      message: `已检查${dueSoonNodes.length}个即将到期的付款节点`,
    });
  } catch (error) {
    console.error('检查付款状态失败:', error);
    res.status(500).json({ error: '检查付款状态失败' });
  }
});

// ==================== 交付要求管理 ====================

/**
 * 获取交付要求列表
 * GET /api/contracts-rag/:id/delivery-requirements
 */
router.get('/:id/delivery-requirements', requireAuth, (req, res) => {
  try {
    const requirements = db.prepare(`
      SELECT d.*, t.title as task_title, t.status as task_status
      FROM contract_delivery_requirements d
      LEFT JOIN tasks t ON d.task_id = t.id
      WHERE d.contract_id = ?
      ORDER BY d.sort_order, d.planned_date
    `).all(req.params.id);

    res.json(requirements);
  } catch (error) {
    console.error('获取交付要求失败:', error);
    res.status(500).json({ error: '获取交付要求失败' });
  }
});

/**
 * 创建交付要求
 * POST /api/contracts-rag/:id/delivery-requirements
 */
router.post('/:id/delivery-requirements', requireAuth, (req, res) => {
  try {
    const {
      requirement_name, requirement_description, deliverable_type,
      planned_date, acceptance_criteria, task_id, sort_order
    } = req.body;

    const result = db.prepare(`
      INSERT INTO contract_delivery_requirements (
        contract_id, requirement_name, requirement_description, deliverable_type,
        planned_date, acceptance_criteria, task_id, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id,
      requirement_name,
      requirement_description || null,
      deliverable_type || 'other',
      planned_date || null,
      acceptance_criteria || null,
      task_id || null,
      sort_order || 0
    );

    // 如果关联了任务，更新任务的合同关联
    if (task_id) {
      db.prepare(`
        UPDATE tasks SET source_type = 'contract', source_id = ?, updated_at = datetime('now') WHERE id = ?
      `).run(req.params.id, task_id);
    }

    res.status(201).json({ id: result.lastInsertRowid, message: '交付要求创建成功' });
  } catch (error) {
    console.error('创建交付要求失败:', error);
    res.status(500).json({ error: '创建交付要求失败' });
  }
});

/**
 * 更新交付要求
 * PUT /api/contracts-rag/:id/delivery-requirements/:reqId
 */
router.put('/:id/delivery-requirements/:reqId', requireAuth, (req, res) => {
  try {
    const {
      requirement_name, requirement_description, deliverable_type,
      planned_date, actual_date, acceptance_criteria, acceptance_status,
      verification_result, verification_notes, task_id
    } = req.body;

    db.prepare(`
      UPDATE contract_delivery_requirements SET
        requirement_name = COALESCE(?, requirement_name),
        requirement_description = COALESCE(?, requirement_description),
        deliverable_type = COALESCE(?, deliverable_type),
        planned_date = COALESCE(?, planned_date),
        actual_date = COALESCE(?, actual_date),
        acceptance_criteria = COALESCE(?, acceptance_criteria),
        acceptance_status = COALESCE(?, acceptance_status),
        verification_result = COALESCE(?, verification_result),
        verification_notes = COALESCE(?, verification_notes),
        task_id = COALESCE(?, task_id),
        updated_at = datetime('now')
      WHERE id = ? AND contract_id = ?
    `).run(
      requirement_name || null,
      requirement_description || null,
      deliverable_type || null,
      planned_date || null,
      actual_date || null,
      acceptance_criteria || null,
      acceptance_status || null,
      verification_result || null,
      verification_notes || null,
      task_id || null,
      req.params.reqId,
      req.params.id
    );

    res.json({ message: '交付要求更新成功' });
  } catch (error) {
    console.error('更新交付要求失败:', error);
    res.status(500).json({ error: '更新交付要求失败' });
  }
});

/**
 * 同步交付要求到任务
 * POST /api/contracts-rag/:id/delivery-requirements/:reqId/sync-task
 */
router.post('/:id/delivery-requirements/:reqId/sync-task', requireAuth, (req, res) => {
  try {
    const reqItem = db.prepare(`
      SELECT d.*, c.project_id
      FROM contract_delivery_requirements d
      JOIN contracts c ON d.contract_id = c.id
      WHERE d.id = ? AND d.contract_id = ?
    `).get(req.params.reqId, req.params.id);

    if (!reqItem) {
      return res.status(404).json({ error: '交付要求不存在' });
    }

    // 检查是否已关联任务
    if (reqItem.task_id) {
      return res.status(400).json({ error: '该交付要求已关联任务' });
    }

    // 创建新任务
    const result = db.prepare(`
      INSERT INTO tasks (
        project_id, title, description, status, priority, due_date, source_type, source_id
      ) VALUES (?, ?, ?, 'todo', 'high', ?, 'contract', ?)
    `).run(
      reqItem.project_id,
      `交付：${reqItem.requirement_name}`,
      reqItem.requirement_description,
      reqItem.planned_date,
      reqItem.contract_id
    );

    // 更新交付要求关联
    db.prepare(`
      UPDATE contract_delivery_requirements SET task_id = ?, updated_at = datetime('now') WHERE id = ?
    `).run(result.lastInsertRowid, reqItem.id);

    res.json({ task_id: result.lastInsertRowid, message: '已同步到项目任务' });
  } catch (error) {
    console.error('同步任务失败:', error);
    res.status(500).json({ error: '同步任务失败' });
  }
});

/**
 * 校验交付物是否符合合同要求
 * POST /api/contracts-rag/:id/delivery-requirements/:reqId/verify
 */
router.post('/:id/delivery-requirements/:reqId/verify', requireAuth, (req, res) => {
  try {
    const { verification_result, verification_notes } = req.body;

    const reqItem = db.prepare(`
      SELECT d.*, c.project_id
      FROM contract_delivery_requirements d
      JOIN contracts c ON d.contract_id = c.id
      WHERE d.id = ? AND d.contract_id = ?
    `).get(req.params.reqId, req.params.id);

    if (!reqItem) {
      return res.status(404).json({ error: '交付要求不存在' });
    }

    // 更新校验结果
    const newStatus = verification_result === 'pass' ? 'accepted' : 
                      verification_result === 'fail' ? 'rejected' : 'submitted';

    db.prepare(`
      UPDATE contract_delivery_requirements SET
        acceptance_status = ?,
        verification_result = ?,
        verification_notes = ?,
        verified_by = ?,
        verified_at = datetime('now'),
        actual_date = COALESCE(actual_date, date('now')),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, verification_result, verification_notes, req.user.id, reqItem.id);

    res.json({ message: '校验结果已保存', status: newStatus });
  } catch (error) {
    console.error('校验交付物失败:', error);
    res.status(500).json({ error: '校验交付物失败' });
  }
});

// ==================== 合同变更管理 ====================

/**
 * 获取变更记录列表
 * GET /api/contracts-rag/:id/changes
 */
router.get('/:id/changes', requireAuth, (req, res) => {
  try {
    const changes = db.prepare(`
      SELECT c.*, i.name as initiator_name, a.name as approver_name
      FROM contract_changes c
      LEFT JOIN users i ON c.initiator_id = i.id
      LEFT JOIN users a ON c.approver_id = a.id
      WHERE c.contract_id = ?
      ORDER BY c.created_at DESC
    `).all(req.params.id);

    res.json(changes);
  } catch (error) {
    console.error('获取变更记录失败:', error);
    res.status(500).json({ error: '获取变更记录失败' });
  }
});

/**
 * 创建变更记录
 * POST /api/contracts-rag/:id/changes
 */
router.post('/:id/changes', requireAuth, (req, res) => {
  try {
    const {
      change_type, change_title, change_description, old_value, new_value,
      impact_amount, impact_days, reason, effective_date
    } = req.body;

    // 生成变更编号
    const count = db.prepare(`
      SELECT COUNT(*) as c FROM contract_changes WHERE contract_id = ?
    `).get(req.params.id);
    const changeNumber = `CHG-${req.params.id}-${String(count.c + 1).padStart(3, '0')}`;

    const result = db.prepare(`
      INSERT INTO contract_changes (
        contract_id, change_type, change_number, change_title, change_description,
        old_value, new_value, impact_amount, impact_days, reason, initiator_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(
      req.params.id,
      change_type,
      changeNumber,
      change_title,
      change_description || null,
      old_value || null,
      new_value || null,
      impact_amount || null,
      impact_days || null,
      reason || null,
      req.user.id
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      change_number: changeNumber,
      message: '变更记录创建成功',
    });
  } catch (error) {
    console.error('创建变更记录失败:', error);
    res.status(500).json({ error: '创建变更记录失败' });
  }
});

/**
 * 更新变更记录
 * PUT /api/contracts-rag/:id/changes/:changeId
 */
router.put('/:id/changes/:changeId', requireAuth, (req, res) => {
  try {
    const {
      change_title, change_description, old_value, new_value,
      impact_amount, impact_days, reason, status, effective_date
    } = req.body;

    db.prepare(`
      UPDATE contract_changes SET
        change_title = COALESCE(?, change_title),
        change_description = COALESCE(?, change_description),
        old_value = COALESCE(?, old_value),
        new_value = COALESCE(?, new_value),
        impact_amount = COALESCE(?, impact_amount),
        impact_days = COALESCE(?, impact_days),
        reason = COALESCE(?, reason),
        status = COALESCE(?, status),
        effective_date = COALESCE(?, effective_date),
        updated_at = datetime('now')
      WHERE id = ? AND contract_id = ?
    `).run(
      change_title || null,
      change_description || null,
      old_value || null,
      new_value || null,
      impact_amount || null,
      impact_days || null,
      reason || null,
      status || null,
      effective_date || null,
      req.params.changeId,
      req.params.id
    );

    res.json({ message: '变更记录更新成功' });
  } catch (error) {
    console.error('更新变更记录失败:', error);
    res.status(500).json({ error: '更新变更记录失败' });
  }
});

/**
 * 审批变更记录
 * POST /api/contracts-rag/:id/changes/:changeId/approve
 */
router.post('/:id/changes/:changeId/approve', requireAuth, (req, res) => {
  try {
    const change = db.prepare(`
      SELECT * FROM contract_changes WHERE id = ? AND contract_id = ?
    `).get(req.params.changeId, req.params.id);

    if (!change) {
      return res.status(404).json({ error: '变更记录不存在' });
    }

    if (change.status !== 'submitted') {
      return res.status(400).json({ error: '只能审批已提交的变更' });
    }

    // 更新变更状态
    db.prepare(`
      UPDATE contract_changes SET
        status = 'approved',
        approver_id = ?,
        approved_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(req.user.id, change.id);

    // 根据变更类型更新合同信息
    if (change.change_type === 'amount' && change.new_value) {
      db.prepare(`
        UPDATE contracts SET amount = ?, updated_at = datetime('now') WHERE id = ?
      `).run(parseFloat(change.new_value), req.params.id);
    } else if (change.change_type === 'date' && change.new_value) {
      db.prepare(`
        UPDATE contracts SET expiry_date = ?, updated_at = datetime('now') WHERE id = ?
      `).run(change.new_value, req.params.id);
    }

    // 如果有关联的任务/里程碑，进行调整
    if (change.affected_tasks) {
      const taskIds = JSON.parse(change.affected_tasks);
      for (const taskId of taskIds) {
        if (change.impact_days) {
          db.prepare(`
            UPDATE tasks SET
              due_date = date(due_date, '+' || ? || ' days'),
              updated_at = datetime('now')
            WHERE id = ?
          `).run(change.impact_days, taskId);
        }
      }
    }

    if (change.affected_milestones) {
      const milestoneIds = JSON.parse(change.affected_milestones);
      for (const milestoneId of milestoneIds) {
        if (change.impact_days) {
          db.prepare(`
            UPDATE plan_milestones SET
              planned_date = date(planned_date, '+' || ? || ' days'),
              updated_at = datetime('now')
            WHERE id = ?
          `).run(change.impact_days, milestoneId);
        }
      }
    }

    res.json({ message: '变更已审批通过' });
  } catch (error) {
    console.error('审批变更失败:', error);
    res.status(500).json({ error: '审批变更失败' });
  }
});

// ==================== 合同RAG问答 ====================

/**
 * 合同问答
 * POST /api/contracts-rag/:id/qa
 */
router.post('/:id/qa', requireAuth, async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: '问题不能为空' });
    }

    // 获取合同信息和解析结果
    const contract = db.prepare(`
      SELECT c.*, p.name as project_name
      FROM contracts c
      LEFT JOIN projects p ON c.project_id = p.id
      WHERE c.id = ?
    `).get(req.params.id);

    const parseResult = db.prepare(`
      SELECT * FROM contract_parse_results WHERE contract_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(req.params.id);

    const paymentNodes = db.prepare(`
      SELECT * FROM contract_payment_nodes WHERE contract_id = ? ORDER BY planned_date
    `).all(req.params.id);

    const deliveryReqs = db.prepare(`
      SELECT * FROM contract_delivery_requirements WHERE contract_id = ? ORDER BY planned_date
    `).all(req.params.id);

    const changes = db.prepare(`
      SELECT * FROM contract_changes WHERE contract_id = ? AND status = 'approved' ORDER BY created_at DESC
    `).all(req.params.id);

    // 构建上下文
    const context = `
合同基本信息：
- 合同名称：${contract.title}
- 合作方：${contract.counterparty}
- 合同金额：${contract.amount} ${contract.currency}
- 状态：${contract.status}
- 生效日期：${contract.effective_date || '未指定'}
- 到期日期：${contract.expiry_date || '未指定'}

${parseResult ? `
关键条款：
- 付款条款：${parseResult.payment_terms || '未指定'}
- 交付条款：${parseResult.delivery_terms || '未指定'}
- 违约责任：${parseResult.breach_liability || '未指定'}
- 保密条款：${parseResult.confidentiality_clause || '未指定'}
- 特殊条款：${parseResult.special_terms || '无'}
` : ''}

付款节点：
${paymentNodes.map(n => `- ${n.node_name}：${n.planned_amount}${n.currency}，计划日期${n.planned_date}，状态${n.status}`).join('\n') || '无'}

交付要求：
${deliveryReqs.map(r => `- ${r.requirement_name}：计划日期${r.planned_date || '未指定'}，验收状态${r.acceptance_status}`).join('\n') || '无'}

变更记录：
${changes.map(c => `- ${c.change_title}：${c.change_description}`).join('\n') || '无'}
`;

    // 调用LLM生成回答
    const config = new Config();
    const client = new LLMClient(config);

    const prompt = `你是一个合同管理助手，请基于以下合同信息回答用户问题。如果信息中没有相关内容，请明确告知。

${context}

用户问题：${question}

请给出准确、详细的回答：`;

    const messages = [{ role: 'user', content: prompt }];
    const response = await client.invoke(messages, { temperature: 0.7 });

    const answer = response.content;

    // 保存问答历史
    db.prepare(`
      INSERT INTO contract_qa_history (contract_id, user_id, question, answer, confidence)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, req.user.id, question, answer, 0.8);

    res.json({ answer });
  } catch (error) {
    console.error('合同问答失败:', error);
    res.status(500).json({ error: '合同问答失败' });
  }
});

/**
 * 获取问答历史
 * GET /api/contracts-rag/:id/qa-history
 */
router.get('/:id/qa-history', requireAuth, (req, res) => {
  try {
    const history = db.prepare(`
      SELECT q.*, u.name as user_name
      FROM contract_qa_history q
      LEFT JOIN users u ON q.user_id = u.id
      WHERE q.contract_id = ?
      ORDER BY q.created_at DESC
      LIMIT 50
    `).all(req.params.id);

    res.json(history);
  } catch (error) {
    console.error('获取问答历史失败:', error);
    res.status(500).json({ error: '获取问答历史失败' });
  }
});

// ==================== 合同提醒管理 ====================

/**
 * 获取合同提醒列表
 * GET /api/contracts-rag/:id/reminders
 */
router.get('/:id/reminders', requireAuth, (req, res) => {
  try {
    const reminders = db.prepare(`
      SELECT * FROM contract_reminders WHERE contract_id = ? ORDER BY reminder_date DESC
    `).all(req.params.id);

    res.json(reminders);
  } catch (error) {
    console.error('获取提醒列表失败:', error);
    res.status(500).json({ error: '获取提醒列表失败' });
  }
});

/**
 * 创建自定义提醒
 * POST /api/contracts-rag/:id/reminders
 */
router.post('/:id/reminders', requireAuth, (req, res) => {
  try {
    const { reminder_type, reminder_date, reminder_message, notify_users } = req.body;

    const result = db.prepare(`
      INSERT INTO contract_reminders (
        contract_id, reminder_type, reminder_date, reminder_message, notify_users
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      req.params.id,
      reminder_type || 'custom',
      reminder_date,
      reminder_message,
      notify_users || null
    );

    res.status(201).json({ id: result.lastInsertRowid, message: '提醒创建成功' });
  } catch (error) {
    console.error('创建提醒失败:', error);
    res.status(500).json({ error: '创建提醒失败' });
  }
});

export default router;
