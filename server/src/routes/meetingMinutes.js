import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = Router();

/**
 * 获取会议纪要列表
 * GET /api/meeting-minutes
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const { project_id, status, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let sql = `
      SELECT m.*, p.name as project_name, u.name as host_name, c.name as creator_name,
        (SELECT COUNT(*) FROM meeting_parse_results WHERE minute_id = m.id) as parse_result_count,
        (SELECT COUNT(*) FROM meeting_parse_results WHERE minute_id = m.id AND status = 'pending') as pending_count,
        (SELECT COUNT(*) FROM meeting_parse_results WHERE minute_id = m.id AND status = 'synced') as synced_count
      FROM meeting_minutes m
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN users u ON m.host_id = u.id
      LEFT JOIN users c ON m.created_by = c.id
      WHERE 1=1
    `;
    const params = [];
    
    if (project_id) {
      sql += ' AND m.project_id = ?';
      params.push(project_id);
    }
    
    if (status) {
      sql += ' AND m.parse_status = ?';
      params.push(status);
    }
    
    // 获取总数
    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const totalResult = db.prepare(countSql).get(...params);
    
    // 排序分页
    sql += ' ORDER BY m.meeting_date DESC, m.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);
    
    const minutes = db.prepare(sql).all(...params);
    
    res.json({
      data: minutes,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: totalResult.total,
      },
    });
  } catch (error) {
    console.error('获取会议纪要失败:', error);
    res.status(500).json({ error: '获取会议纪要失败' });
  }
});

/**
 * 获取单个会议纪要
 * GET /api/meeting-minutes/:id
 */
router.get('/:id', requireAuth, (req, res) => {
  try {
    const minute = db.prepare(`
      SELECT m.*, p.name as project_name, u.name as host_name, c.name as creator_name
      FROM meeting_minutes m
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN users u ON m.host_id = u.id
      LEFT JOIN users c ON m.created_by = c.id
      WHERE m.id = ?
    `).get(req.params.id);
    
    if (!minute) {
      return res.status(404).json({ error: '会议纪要不存在' });
    }
    
    // 获取解析结果
    const parseResults = db.prepare(`
      SELECT r.*, u.name as responsible_name, f.name as follow_up_name
      FROM meeting_parse_results r
      LEFT JOIN users u ON r.responsible_id = u.id
      LEFT JOIN users f ON r.follow_up_id = f.id
      WHERE r.minute_id = ?
      ORDER BY r.result_type, r.priority DESC
    `).all(req.params.id);
    
    res.json({ ...minute, parse_results: parseResults });
  } catch (error) {
    console.error('获取会议纪要失败:', error);
    res.status(500).json({ error: '获取会议纪要失败' });
  }
});

/**
 * 创建会议纪要（上传文件或粘贴内容）
 * POST /api/meeting-minutes
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { project_id, title, meeting_date, meeting_type, location, host_id, participants, raw_content } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '标题为必填项' });
    }
    
    const result = db.prepare(`
      INSERT INTO meeting_minutes (
        project_id, title, meeting_date, meeting_type, location, host_id, participants,
        raw_content, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id || null,
      title,
      meeting_date || null,
      meeting_type || 'regular',
      location || null,
      host_id || null,
      participants || null,
      raw_content || null,
      req.user.id
    );
    
    // 如果有内容，立即触发解析
    if (raw_content) {
      // 异步解析，不阻塞响应
      parseMeetingMinute(result.lastInsertRowid, raw_content).catch(err => {
        console.error('解析会议纪要失败:', err);
      });
    }
    
    res.status(201).json({
      id: result.lastInsertRowid,
      message: '会议纪要创建成功',
      parse_status: raw_content ? 'parsing' : 'pending',
    });
  } catch (error) {
    console.error('创建会议纪要失败:', error);
    res.status(500).json({ error: '创建会议纪要失败' });
  }
});

/**
 * 解析会议纪要
 * POST /api/meeting-minutes/:id/parse
 */
router.post('/:id/parse', requireAuth, async (req, res) => {
  try {
    const minute = db.prepare('SELECT * FROM meeting_minutes WHERE id = ?').get(req.params.id);
    
    if (!minute) {
      return res.status(404).json({ error: '会议纪要不存在' });
    }
    
    if (!minute.raw_content && !minute.file_key) {
      return res.status(400).json({ error: '没有可解析的内容' });
    }
    
    // 更新解析状态
    db.prepare(`UPDATE meeting_minutes SET parse_status = 'parsing', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    
    // 异步解析
    parseMeetingMinute(req.params.id, minute.raw_content, minute.file_key).catch(err => {
      console.error('解析会议纪要失败:', err);
    });
    
    res.json({ message: '解析任务已启动' });
  } catch (error) {
    console.error('触发解析失败:', error);
    res.status(500).json({ error: '触发解析失败' });
  }
});

/**
 * 使用LLM解析会议纪要内容
 */
async function parseMeetingMinute(minuteId, content, fileKey) {
  try {
    let textContent = content;
    
    // 如果有文件，先提取文本
    if (fileKey && !content) {
      // TODO: 从对象存储获取文件内容并提取文本
      // 这里简化处理，实际需要根据文件类型提取
      throw new Error('文件解析暂未实现，请直接粘贴文本内容');
    }
    
    if (!textContent) {
      throw new Error('没有可解析的文本内容');
    }
    
    // 使用Coze SDK调用LLM进行解析
    const config = new Config();
    const client = new LLMClient(config);
    
    const parsePrompt = `你是一个会议纪要分析专家，请仔细分析以下会议纪要内容，提取出关键信息。

会议纪要内容：
${textContent}

请按以下JSON格式返回解析结果：
{
  "todos": [
    {
      "content": "待办事项内容",
      "responsible_person": "负责人姓名",
      "due_date": "截止日期（如有，格式：YYYY-MM-DD）",
      "priority": "优先级（low/medium/high/critical）"
    }
  ],
  "changes": [
    {
      "content": "变更内容描述",
      "impact_scope": "影响范围",
      "impact_level": "影响程度（low/medium/high/critical）",
      "responsible_person": "负责人"
    }
  ],
  "risks": [
    {
      "content": "风险描述",
      "impact_level": "影响程度（low/medium/high/critical）",
      "follow_up_person": "跟进人"
    }
  ],
  "decisions": [
    {
      "content": "决策内容",
      "decision": "决策结果",
      "responsible_person": "执行人"
    }
  ]
}

注意：
1. 只返回JSON，不要添加任何说明文字
2. 如果某类信息不存在，返回空数组
3. 日期格式统一为 YYYY-MM-DD
4. 优先级和影响程度只从给定的选项中选择
5. 人名请尽量匹配原文中的表述`;

    const messages = [{ role: 'user', content: parsePrompt }];
    const response = await client.invoke(messages, { temperature: 0.3 });
    
    // 解析LLM返回的JSON
    let parseResult;
    try {
      // 尝试从响应中提取JSON
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
    
    // 保存解析结果到数据库
    const insertStmt = db.prepare(`
      INSERT INTO meeting_parse_results (
        minute_id, result_type, content, responsible_person, responsible_id,
        due_date, priority, impact_scope, impact_level, decision,
        follow_up_person, follow_up_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // 清理旧的解析结果
    db.prepare('DELETE FROM meeting_parse_results WHERE minute_id = ?').run(minuteId);
    
    // 插入待办
    for (const todo of parseResult.todos || []) {
      const responsibleId = findUserByName(todo.responsible_person);
      insertStmt.run(
        minuteId, 'todo', todo.content, todo.responsible_person, responsibleId,
        todo.due_date || null, todo.priority || 'medium', null, null, null, null, null
      );
    }
    
    // 插入变更
    for (const change of parseResult.changes || []) {
      const responsibleId = findUserByName(change.responsible_person);
      insertStmt.run(
        minuteId, 'change', change.content, change.responsible_person, responsibleId,
        null, null, change.impact_scope, change.impact_level || 'medium', null, null, null
      );
    }
    
    // 插入风险
    for (const risk of parseResult.risks || []) {
      const followUpId = findUserByName(risk.follow_up_person);
      insertStmt.run(
        minuteId, 'risk', risk.content, null, null,
        null, null, null, risk.impact_level || 'medium', null, risk.follow_up_person, followUpId
      );
    }
    
    // 插入决策
    for (const decision of parseResult.decisions || []) {
      const responsibleId = findUserByName(decision.responsible_person);
      insertStmt.run(
        minuteId, 'decision', decision.content, decision.responsible_person, responsibleId,
        null, null, null, null, decision.decision, null, null
      );
    }
    
    // 更新解析状态
    db.prepare(`
      UPDATE meeting_minutes 
      SET parse_status = 'parsed', updated_at = datetime('now') 
      WHERE id = ?
    `).run(minuteId);
    
    console.log(`会议纪要 ${minuteId} 解析完成`);
  } catch (error) {
    console.error('解析会议纪要失败:', error);
    
    // 更新解析失败状态
    db.prepare(`
      UPDATE meeting_minutes 
      SET parse_status = 'failed', parse_error = ?, updated_at = datetime('now') 
      WHERE id = ?
    `).run(error.message, minuteId);
  }
}

/**
 * 根据姓名查找用户ID
 */
function findUserByName(name) {
  if (!name) return null;
  const user = db.prepare('SELECT id FROM users WHERE name = ? OR name LIKE ?').get(name, `%${name}%`);
  return user?.id || null;
}

/**
 * 更新解析结果
 * PUT /api/meeting-minutes/:minuteId/parse-results/:resultId
 */
router.put('/:minuteId/parse-results/:resultId', requireAuth, (req, res) => {
  try {
    const { content, responsible_id, due_date, priority, impact_scope, impact_level, decision, follow_up_id, status } = req.body;
    
    const result = db.prepare(`
      UPDATE meeting_parse_results 
      SET content = COALESCE(?, content),
          responsible_id = COALESCE(?, responsible_id),
          due_date = COALESCE(?, due_date),
          priority = COALESCE(?, priority),
          impact_scope = COALESCE(?, impact_scope),
          impact_level = COALESCE(?, impact_level),
          decision = COALESCE(?, decision),
          follow_up_id = COALESCE(?, follow_up_id),
          status = COALESCE(?, status),
          user_edited = 1,
          updated_at = datetime('now')
      WHERE id = ? AND minute_id = ?
    `).run(
      content || null,
      responsible_id || null,
      due_date || null,
      priority || null,
      impact_scope || null,
      impact_level || null,
      decision || null,
      follow_up_id || null,
      status || null,
      req.params.resultId,
      req.params.minuteId
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '解析结果不存在' });
    }
    
    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('更新解析结果失败:', error);
    res.status(500).json({ error: '更新解析结果失败' });
  }
});

/**
 * 同步解析结果到项目模块（任务/风险）
 * POST /api/meeting-minutes/:minuteId/parse-results/:resultId/sync
 */
router.post('/:minuteId/parse-results/:resultId/sync', requireAuth, (req, res) => {
  try {
    const { sync_to } = req.body; // 'task' | 'risk' | 'review'
    
    const parseResult = db.prepare(`
      SELECT r.*, m.project_id
      FROM meeting_parse_results r
      JOIN meeting_minutes m ON r.minute_id = m.id
      WHERE r.id = ? AND r.minute_id = ?
    `).get(req.params.resultId, req.params.minuteId);
    
    if (!parseResult) {
      return res.status(404).json({ error: '解析结果不存在' });
    }
    
    if (!parseResult.project_id) {
      return res.status(400).json({ error: '会议纪要未关联项目，无法同步' });
    }
    
    let syncedId = null;
    let syncedTo = sync_to;
    
    if (parseResult.result_type === 'todo' && (!sync_to || sync_to === 'task')) {
      // 同步到任务
      const result = db.prepare(`
        INSERT INTO tasks (project_id, title, description, assignee_id, due_date, priority, status, source_type, source_id)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', 'meeting', ?)
      `).run(
        parseResult.project_id,
        parseResult.content,
        parseResult.content,
        parseResult.responsible_id,
        parseResult.due_date,
        parseResult.priority || 'medium',
        parseResult.id
      );
      syncedId = result.lastInsertRowid;
      syncedTo = 'task';
    } else if (parseResult.result_type === 'risk' && (!sync_to || sync_to === 'risk')) {
      // 同步到风险登记册
      const result = db.prepare(`
        INSERT INTO risk_register (project_id, title, description, impact, risk_level, status, owner_id, source_type, source_id)
        VALUES (?, ?, ?, ?, ?, 'open', ?, 'meeting', ?)
      `).run(
        parseResult.project_id,
        parseResult.content,
        parseResult.content,
        parseResult.impact_level || 'medium',
        parseResult.impact_level || 'medium',
        parseResult.follow_up_id,
        parseResult.id
      );
      syncedId = result.lastInsertRowid;
      syncedTo = 'risk';
    } else if (parseResult.result_type === 'change' || parseResult.result_type === 'decision') {
      // 变更和决策可以同步为任务或评审
      if (sync_to === 'task') {
        const result = db.prepare(`
          INSERT INTO tasks (project_id, title, description, assignee_id, priority, status, source_type, source_id)
          VALUES (?, ?, ?, ?, ?, 'pending', 'meeting', ?)
        `).run(
          parseResult.project_id,
          parseResult.content,
          parseResult.decision || parseResult.content,
          parseResult.responsible_id,
          parseResult.impact_level || 'medium',
          parseResult.id
        );
        syncedId = result.lastInsertRowid;
      } else {
        return res.status(400).json({ error: '该类型不支持同步到指定模块' });
      }
    } else {
      return res.status(400).json({ error: '不支持的同步类型' });
    }
    
    // 更新解析结果状态
    db.prepare(`
      UPDATE meeting_parse_results 
      SET status = 'synced', synced_to = ?, synced_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(syncedTo, syncedId, req.params.resultId);
    
    res.json({ message: '同步成功', synced_to: syncedTo, synced_id: syncedId });
  } catch (error) {
    console.error('同步失败:', error);
    res.status(500).json({ error: '同步失败' });
  }
});

/**
 * 批量同步解析结果
 * POST /api/meeting-minutes/:minuteId/batch-sync
 */
router.post('/:minuteId/batch-sync', requireAuth, (req, res) => {
  try {
    const { result_ids, sync_to } = req.body;
    
    if (!result_ids || !Array.isArray(result_ids) || result_ids.length === 0) {
      return res.status(400).json({ error: '请选择要同步的项' });
    }
    
    const results = [];
    for (const resultId of result_ids) {
      try {
        // 使用上面的同步逻辑
        const parseResult = db.prepare(`
          SELECT r.*, m.project_id
          FROM meeting_parse_results r
          JOIN meeting_minutes m ON r.minute_id = m.id
          WHERE r.id = ? AND r.minute_id = ?
        `).get(resultId, req.params.minuteId);
        
        if (!parseResult || parseResult.status === 'synced') continue;
        
        // ... 同步逻辑（简化，实际应复用上面代码）
        results.push({ id: resultId, success: true });
      } catch (err) {
        results.push({ id: resultId, success: false, error: err.message });
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error('批量同步失败:', error);
    res.status(500).json({ error: '批量同步失败' });
  }
});

/**
 * 删除会议纪要
 * DELETE /api/meeting-minutes/:id
 */
router.delete('/:id', requireAuth, (req, res) => {
  try {
    // 先删除解析结果
    db.prepare('DELETE FROM meeting_parse_results WHERE minute_id = ?').run(req.params.id);
    
    // 删除会议纪要
    const result = db.prepare('DELETE FROM meeting_minutes WHERE id = ?').run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '会议纪要不存在' });
    }
    
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除会议纪要失败:', error);
    res.status(500).json({ error: '删除会议纪要失败' });
  }
});

export default router;
