/**
 * 知识库页面 - 前端本地模式
 * 
 * 说明：
 * - 使用前端内置模拟数据
 * - 不依赖后端API
 * - RAG功能为模拟演示
 */
import { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { 
  BookOpen, Send, RefreshCw, FileText, MessageSquare, 
  Database, Clock, User, Trash2
} from 'lucide-react';
import { mockKnowledgeDocuments, mockProjects } from '../mockData.js';

export default function KnowledgePage() {
  const { projectId, currentProject } = useProject();
  const [activeTab, setActiveTab] = useState('qa');

  // RAG问答状态
  const [question, setQuestion] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [answer, setAnswer] = useState(null);
  const [answering, setAnswering] = useState(false);

  // 知识库文档状态
  const [documents, setDocuments] = useState([]);

  // 加载文档
  useEffect(() => {
    if (projectId) {
      const projectDocs = mockKnowledgeDocuments.filter(d => d.project_id === projectId);
      setDocuments(projectDocs);
    } else {
      setDocuments(mockKnowledgeDocuments);
    }
  }, [projectId]);

  // 模拟RAG问答
  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    setAnswering(true);
    setAnswer(null);
    
    // 模拟AI回答延迟
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 模拟回答
    setAnswer({
      ok: true,
      answer: `这是一个模拟回答。您的问题："${question}"\n\n在真实环境中，这里会通过RAG技术从知识库中检索相关文档并生成回答。当前为演示模式，数据来自前端内置的模拟数据。`,
      sources: [
        { title: '产品需求文档.docx', score: 0.92 },
        { title: '技术方案.pdf', score: 0.85 },
      ],
      timestamp: new Date().toISOString(),
    });
    
    setAnswering(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">知识库</h1>
        <p className="mt-1 text-sm text-slate-600">
          {currentProject?.name || '全部项目'} · 文档管理与智能问答
        </p>
      </div>

      {/* Tab切换 */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('qa')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'qa'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          智能问答
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'documents'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          文档管理
        </button>
      </div>

      {/* 智能问答 */}
      {activeTab === 'qa' && (
        <div className="space-y-4">
          {/* 问答表单 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <form onSubmit={handleQuestionSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">选择项目</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">全部项目</option>
                  {mockProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700">您的问题</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="输入您的问题，系统将从知识库中检索相关文档并生成回答..."
                  disabled={answering}
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={answering || !question.trim()}
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {answering ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      思考中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      提问
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* 回答结果 */}
          {answer && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                <BookOpen className="w-4 h-4" />
                AI 回答
              </div>
              
              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
                {answer.answer}
              </div>
              
              {answer.sources && answer.sources.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-500 mb-2">参考文档：</div>
                  <div className="flex flex-wrap gap-2">
                    {answer.sources.map((source, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs"
                      >
                        <FileText className="w-3 h-3" />
                        {source.title}
                        <span className="text-slate-400">({(source.score * 100).toFixed(0)}%)</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 说明 */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            <strong>说明：</strong>当前为演示模式，RAG功能使用模拟数据。在真实环境中，需要配置科大讯飞RAG服务或其他向量数据库服务。
          </div>
        </div>
      )}

      {/* 文档管理 */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* 文档列表 */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">文档名称</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">类型</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">大小</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">上传时间</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      暂无文档
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="font-medium text-slate-900">{doc.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{doc.file_type || '文档'}</td>
                      <td className="px-4 py-3 text-slate-600">{doc.file_size || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          doc.status === 'indexed' ? 'bg-green-100 text-green-700' :
                          doc.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {doc.status === 'indexed' ? '已索引' :
                           doc.status === 'processing' ? '处理中' : '待处理'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 说明 */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <strong>说明：</strong>文档管理功能需要对接对象存储服务(S3/OSS)。在真实环境中，用户可以上传文档，系统会自动进行向量化处理并存储到向量数据库中。
          </div>
        </div>
      )}
    </div>
  );
}
