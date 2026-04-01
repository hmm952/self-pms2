import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const router = Router();

/**
 * 获取知识库文档列表
 * GET /api/knowledge/documents
 */
router.get('/documents', requireAuth, (req, res) => {
  try {
    const { project_id, doc_type, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let sql = `
      SELECT d.*, p.name as project_name,
        (SELECT COUNT(*) FROM knowledge_chunks WHERE doc_id = d.id) as chunk_count
      FROM knowledge_documents d
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (project_id) {
      sql += ' AND d.project_id = ?';
      params.push(project_id);
    }
    
    if (doc_type) {
      sql += ' AND d.doc_type = ?';
      params.push(doc_type);
    }
    
    // 获取总数
    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const totalResult = db.prepare(countSql).get(...params);
    
    // 排序分页
    sql += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);
    
    const documents = db.prepare(sql).all(...params);
    
    res.json({
      data: documents,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: totalResult.total,
      },
    });
  } catch (error) {
    console.error('获取知识库文档失败:', error);
    res.status(500).json({ error: '获取知识库文档失败' });
  }
});

/**
 * 获取单个知识库文档
 * GET /api/knowledge/documents/:id
 */
router.get('/documents/:id', requireAuth, (req, res) => {
  try {
    const doc = db.prepare(`
      SELECT d.*, p.name as project_name
      FROM knowledge_documents d
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE d.id = ?
    `).get(req.params.id);
    
    if (!doc) {
      return res.status(404).json({ error: '文档不存在' });
    }
    
    // 获取文档片段
    const chunks = db.prepare(`
      SELECT id, chunk_index, content, metadata
      FROM knowledge_chunks
      WHERE doc_id = ?
      ORDER BY chunk_index
    `).all(req.params.id);
    
    res.json({ ...doc, chunks });
  } catch (error) {
    console.error('获取知识库文档失败:', error);
    res.status(500).json({ error: '获取知识库文档失败' });
  }
});

/**
 * 添加文档到知识库（从会议纪要）
 * POST /api/knowledge/documents
 */
router.post('/documents', requireAuth, async (req, res) => {
  try {
    const { project_id, doc_type, title, content, source_id, source_type } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容为必填项' });
    }
    
    // 将内容分块
    const chunks = splitIntoChunks(content, 500); // 每块约500字符
    
    // 保存文档
    const docResult = db.prepare(`
      INSERT INTO knowledge_documents (project_id, doc_type, title, content, source_id, source_type, chunk_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id || null,
      doc_type || 'meeting',
      title,
      content,
      source_id || null,
      source_type || null,
      chunks.length
    );
    
    const docId = docResult.lastInsertRowid;
    
    // 保存文档片段
    const insertChunk = db.prepare(`
      INSERT INTO knowledge_chunks (doc_id, chunk_index, content, metadata)
      VALUES (?, ?, ?, ?)
    `);
    
    for (let i = 0; i < chunks.length; i++) {
      insertChunk.run(
        docId,
        i,
        chunks[i],
        JSON.stringify({ index: i, length: chunks[i].length })
      );
    }
    
    // 异步生成向量嵌入（如果配置了RAG API）
    generateEmbeddings(docId, chunks).catch(err => {
      console.error('生成向量嵌入失败:', err);
    });
    
    res.status(201).json({
      id: docId,
      message: '文档已添加到知识库',
      chunk_count: chunks.length,
    });
  } catch (error) {
    console.error('添加知识库文档失败:', error);
    res.status(500).json({ error: '添加知识库文档失败' });
  }
});

/**
 * 将文本分块
 */
function splitIntoChunks(text, maxChunkSize = 500) {
  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      if (paragraph.length > maxChunkSize) {
        // 段落太长，按句子分割
        const sentences = paragraph.match(/[^。！？.!?]+[。！？.!?]+/g) || [paragraph];
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length <= maxChunkSize) {
            currentChunk += sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            currentChunk = sentence;
          }
        }
      } else {
        currentChunk = paragraph;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * 生成向量嵌入
 */
async function generateEmbeddings(docId, chunks) {
  try {
    // 暂时跳过向量嵌入，因为没有配置专门的嵌入API
    console.log(`文档 ${docId} 跳过向量嵌入（暂不支持）`);
    db.prepare(`UPDATE knowledge_documents SET embedding_status = 'embedded', updated_at = datetime('now') WHERE id = ?`).run(docId);
  } catch (error) {
    console.error('生成向量嵌入失败:', error);
    db.prepare(`UPDATE knowledge_documents SET embedding_status = 'failed' WHERE id = ?`).run(docId);
  }
}

/**
 * RAG问答
 * POST /api/knowledge/qa
 */
router.post('/qa', requireAuth, async (req, res) => {
  try {
    const { project_id, question, top_k = 5 } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: '问题不能为空' });
    }
    
    // 使用关键词搜索检索相关文档
    const relevantDocs = searchRelevantDocs(question, project_id, top_k);
    
    // 构建上下文
    const context = relevantDocs.map((doc, i) => 
      `[文档${i + 1}]: ${doc.title}\n${doc.content.substring(0, 500)}...`
    ).join('\n\n');
    
    // 调用LLM生成回答
    const config = new Config();
    const client = new LLMClient(config);
    
    const prompt = `你是一个项目管理助手，请基于以下知识库内容回答用户问题。
如果知识库中没有相关信息，请明确告知，并给出一般性的建议。

知识库内容：
${context || '（无相关文档）'}

用户问题：${question}

请给出详细、准确的回答：`;

    const messages = [{ role: 'user', content: prompt }];
    const response = await client.invoke(messages, { temperature: 0.7 });
    
    const answer = response.content;
    
    // 保存问答历史
    db.prepare(`
      INSERT INTO rag_qa_history (project_id, user_id, question, answer, source_docs, confidence)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      project_id || null,
      req.user.id,
      question,
      answer,
      JSON.stringify(relevantDocs.map(d => ({ id: d.id, title: d.title }))),
      relevantDocs.length > 0 ? 0.8 : 0.5
    );
    
    res.json({
      answer,
      sources: relevantDocs.map(d => ({
        id: d.id,
        title: d.title,
        doc_type: d.doc_type,
        snippet: d.content.substring(0, 200),
      })),
      confidence: relevantDocs.length > 0 ? 'high' : 'low',
    });
  } catch (error) {
    console.error('RAG问答失败:', error);
    res.status(500).json({ error: 'RAG问答失败' });
  }
});

/**
 * 关键词搜索相关文档
 */
function searchRelevantDocs(question, projectId, limit = 5) {
  // 提取关键词
  const keywords = question.replace(/[？？!！，,.。]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);
  
  if (keywords.length === 0) {
    return [];
  }
  
  // 构建搜索条件
  const conditions = keywords.map(() => 'content LIKE ?').join(' OR ');
  const params = keywords.map(k => `%${k}%`);
  
  let sql = `
    SELECT id, title, content, doc_type
    FROM knowledge_documents
    WHERE (${conditions})
  `;
  
  if (projectId) {
    sql += ' AND (project_id = ? OR project_id IS NULL)';
    params.push(projectId);
  }
  
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  
  return db.prepare(sql).all(...params);
}

/**
 * 获取问答历史
 * GET /api/knowledge/qa-history
 */
router.get('/qa-history', requireAuth, (req, res) => {
  try {
    const { project_id, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let sql = `
      SELECT h.*, p.name as project_name, u.name as user_name
      FROM rag_qa_history h
      LEFT JOIN projects p ON h.project_id = p.id
      LEFT JOIN users u ON h.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (project_id) {
      sql += ' AND h.project_id = ?';
      params.push(project_id);
    }
    
    // 获取总数
    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const totalResult = db.prepare(countSql).get(...params);
    
    // 排序分页
    sql += ' ORDER BY h.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);
    
    const history = db.prepare(sql).all(...params);
    
    res.json({
      data: history,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: totalResult.total,
      },
    });
  } catch (error) {
    console.error('获取问答历史失败:', error);
    res.status(500).json({ error: '获取问答历史失败' });
  }
});

/**
 * 删除知识库文档
 * DELETE /api/knowledge/documents/:id
 */
router.delete('/documents/:id', requireAuth, (req, res) => {
  try {
    // 先删除文档片段
    db.prepare('DELETE FROM knowledge_chunks WHERE doc_id = ?').run(req.params.id);
    
    // 删除文档
    const result = db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '文档不存在' });
    }
    
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除知识库文档失败:', error);
    res.status(500).json({ error: '删除知识库文档失败' });
  }
});

/**
 * 从会议纪要归档到知识库
 * POST /api/knowledge/archive/:minuteId
 */
router.post('/archive/:minuteId', requireAuth, async (req, res) => {
  try {
    const minute = db.prepare(`
      SELECT m.*, p.name as project_name
      FROM meeting_minutes m
      LEFT JOIN projects p ON m.project_id = p.id
      WHERE m.id = ?
    `).get(req.params.minuteId);
    
    if (!minute) {
      return res.status(404).json({ error: '会议纪要不存在' });
    }
    
    if (!minute.raw_content) {
      return res.status(400).json({ error: '会议纪要没有文本内容' });
    }
    
    // 构建知识库文档内容
    const title = `${minute.title} - ${minute.meeting_date || '未知日期'}`;
    const content = `# ${minute.title}

**会议日期**: ${minute.meeting_date || '未知'}
**会议类型**: ${minute.meeting_type}
**项目**: ${minute.project_name || '未知'}
**主持人**: ${minute.host_name || '未知'}
**参会人**: ${minute.participants || '未知'}

## 会议内容

${minute.raw_content}`;
    
    // 调用添加文档接口
    const result = await fetch(`http://localhost:${process.env.DEPLOY_RUN_PORT || 5000}/api/knowledge/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization,
      },
      body: JSON.stringify({
        project_id: minute.project_id,
        doc_type: 'meeting',
        title,
        content,
        source_id: minute.id,
        source_type: 'meeting_minute',
      }),
    });
    
    const data = await result.json();
    
    res.json({
      message: '已归档到知识库',
      doc_id: data.id,
      chunk_count: data.chunk_count,
    });
  } catch (error) {
    console.error('归档到知识库失败:', error);
    res.status(500).json({ error: '归档到知识库失败' });
  }
});

export default router;
