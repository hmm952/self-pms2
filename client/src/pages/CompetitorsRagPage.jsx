import { useState, useEffect } from 'react';
import api from '../api/client.js';
import { useProject } from '../context/ProjectContext.jsx';
import {
  RefreshCw, Plus, Eye, Trash2, ExternalLink, Send, Zap,
  Building, Globe, Calendar, AlertTriangle, TrendingUp,
  Settings, MessageSquare, GitBranch, BarChart3, CheckCircle,
  XCircle, Clock, DollarSign, Cpu, Target, ArrowRight
} from 'lucide-react';

export default function CompetitorsRagPage() {
  const { projectId } = useProject();
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [threatFilter, setThreatFilter] = useState('');

  // 创建表单
  const [createForm, setCreateForm] = useState({
    name: '',
    model_or_line: '',
    threat_level: 'medium',
    official_website: '',
    company_name: '',
    core_products: '',
  });

  // 问答状态
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [answering, setAnswering] = useState(false);
  const [qaHistory, setQaHistory] = useState([]);

  // 对比分析
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [comparisonResult, setComparisonResult] = useState(null);

  // 迭代建议
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestionDialog, setShowSuggestionDialog] = useState(false);
  const [newSuggestion, setNewSuggestion] = useState({
    title: '',
    description: '',
    suggestion_type: 'feature',
    priority: 'medium',
    impact_analysis: '',
    implementation_effort: 'medium',
  });

  useEffect(() => {
    loadCompetitors();
  }, [projectId, threatFilter]);

  const getToken = () => localStorage.getItem('token');

  const loadCompetitors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);
      if (threatFilter) params.append('threat_level', threatFilter);

      const res = await api.get(`/api/competitors-rag?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setCompetitors(res.data.data);
    } catch (error) {
      console.error('加载竞品列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompetitorDetail = async (competitorId) => {
    try {
      const res = await api.get(`/api/competitors-rag/${competitorId}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setSelectedCompetitor(res.data);
      setShowDetailDialog(true);
      setActiveTab('info');
    } catch (error) {
      console.error('加载竞品详情失败:', error);
    }
  };

  const handleCreateCompetitor = async () => {
    try {
      const data = { ...createForm };
      if (projectId) data.project_id = projectId;

      await api.post('/api/competitors-rag', data, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setShowCreateDialog(false);
      setCreateForm({
        name: '',
        model_or_line: '',
        threat_level: 'medium',
        official_website: '',
        company_name: '',
        core_products: '',
      });
      loadCompetitors();
    } catch (error) {
      console.error('创建竞品失败:', error);
      alert('创建竞品失败');
    }
  };

  const handleDeleteCompetitor = async (competitorId) => {
    if (!confirm('确定要删除这个竞品吗？')) return;
    try {
      await api.delete(`/api/competitors-rag/${competitorId}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      loadCompetitors();
    } catch (error) {
      console.error('删除竞品失败:', error);
      alert('删除竞品失败');
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || answering) return;
    setAnswering(true);
    setAnswer(null);

    try {
      const res = await api.post(`/api/competitors-rag/${selectedCompetitor.id}/qa`,
        { question: question.trim() },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setAnswer(res.data.answer);
      setQuestion('');
      loadQaHistory(selectedCompetitor.id);
    } catch (error) {
      console.error('问答失败:', error);
      setAnswer('抱歉，问答服务暂时不可用，请稍后重试。');
    } finally {
      setAnswering(false);
    }
  };

  const loadQaHistory = async (competitorId) => {
    try {
      const res = await api.get(`/api/competitors-rag/${competitorId}/qa-history`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setQaHistory(res.data);
    } catch (error) {
      console.error('加载问答历史失败:', error);
    }
  };

  const loadSuggestions = async (competitorId) => {
    try {
      const res = await api.get(`/api/competitors-rag/${competitorId}/suggestions`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setSuggestions(res.data);
    } catch (error) {
      console.error('加载迭代建议失败:', error);
    }
  };

  const handleAutoAnalyze = async () => {
    if (!selectedCompetitor) return;
    try {
      const res = await api.post(`/api/competitors-rag/${selectedCompetitor.id}/auto-analyze`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      alert(res.data.message);
      loadSuggestions(selectedCompetitor.id);
    } catch (error) {
      console.error('自动分析失败:', error);
      alert('自动分析失败');
    }
  };

  const handleAddSuggestion = async () => {
    try {
      await api.post(`/api/competitors-rag/${selectedCompetitor.id}/suggestions`, newSuggestion, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setShowSuggestionDialog(false);
      setNewSuggestion({
        title: '',
        description: '',
        suggestion_type: 'feature',
        priority: 'medium',
        impact_analysis: '',
        implementation_effort: 'medium',
      });
      loadSuggestions(selectedCompetitor.id);
    } catch (error) {
      console.error('添加建议失败:', error);
      alert('添加建议失败');
    }
  };

  const handleConvertToTask = async (suggestionId) => {
    if (!confirm('确定要将此建议转为任务吗？')) return;
    try {
      await api.post(`/api/competitors-rag/${selectedCompetitor.id}/suggestions/${suggestionId}/convert-to-task`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      alert('已成功转为任务');
      loadSuggestions(selectedCompetitor.id);
    } catch (error) {
      console.error('转换失败:', error);
      alert('转换失败');
    }
  };

  const handleCompare = async () => {
    if (selectedForCompare.length < 2) {
      alert('请至少选择2个竞品进行对比');
      return;
    }
    try {
      const res = await api.post('/api/competitors-rag/compare', {
        project_id: projectId,
        competitor_ids: selectedForCompare,
        our_product_name: '我方产品',
      }, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setComparisonResult(res.data);
    } catch (error) {
      console.error('对比分析失败:', error);
      alert('对比分析失败');
    }
  };

  const getThreatBadge = (level) => {
    const levelMap = {
      low: { label: '低威胁', className: 'bg-green-100 text-green-700' },
      medium: { label: '中威胁', className: 'bg-yellow-100 text-yellow-700' },
      high: { label: '高威胁', className: 'bg-red-100 text-red-700' },
    };
    const config = levelMap[level] || levelMap.medium;
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>{config.label}</span>;
  };

  const getDynamicTypeLabel = (type) => {
    const typeMap = {
      new_product: '新品发布',
      product_update: '产品更新',
      patent: '专利信息',
      price_change: '价格变动',
      market_action: '市场动作',
      partnership: '合作伙伴',
      acquisition: '收购并购',
      exhibition: '展会信息',
      award: '获奖荣誉',
      news: '新闻动态',
      other: '其他',
    };
    return typeMap[type] || type;
  };

  const getSuggestionTypeLabel = (type) => {
    const typeMap = {
      feature: '功能特性',
      performance: '性能提升',
      pricing: '价格策略',
      marketing: '市场推广',
      partnership: '合作机会',
      other: '其他',
    };
    return typeMap[type] || type;
  };

  const getPriorityBadge = (priority) => {
    const priorityMap = {
      low: { label: '低', className: 'bg-slate-100 text-slate-700' },
      medium: { label: '中', className: 'bg-blue-100 text-blue-700' },
      high: { label: '高', className: 'bg-orange-100 text-orange-700' },
      critical: { label: '紧急', className: 'bg-red-100 text-red-700' },
    };
    const config = priorityMap[priority] || priorityMap.medium;
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>{config.label}</span>;
  };

  const getSuggestionStatusBadge = (status) => {
    const statusMap = {
      pending: { label: '待处理', className: 'bg-slate-100 text-slate-700' },
      reviewed: { label: '已审阅', className: 'bg-blue-100 text-blue-700' },
      approved: { label: '已批准', className: 'bg-green-100 text-green-700' },
      rejected: { label: '已拒绝', className: 'bg-red-100 text-red-700' },
      implemented: { label: '已实施', className: 'bg-purple-100 text-purple-700' },
    };
    const config = statusMap[status] || statusMap.pending;
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>{config.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">竞品动态跟踪与分析</h1>
          <p className="text-slate-500 mt-1">
            基于RAG的竞品管理，支持智能分析、参数对比、迭代建议
          </p>
        </div>
        <div className="flex items-center gap-2">
          {compareMode && selectedForCompare.length >= 2 && (
            <button
              onClick={handleCompare}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <BarChart3 className="w-4 h-4" />
              生成对比报告 ({selectedForCompare.length})
            </button>
          )}
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              setSelectedForCompare([]);
              setComparisonResult(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg ${
              compareMode ? 'bg-blue-100 text-blue-700' : 'border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {compareMode ? '取消对比' : '对比模式'}
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            <Plus className="w-4 h-4" />
            添加竞品
          </button>
        </div>
      </div>

      {/* 威胁等级筛选 */}
      <div className="flex gap-2">
        {['', 'low', 'medium', 'high'].map((level) => (
          <button
            key={level}
            onClick={() => setThreatFilter(level)}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              threatFilter === level ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {level === '' ? '全部' : level === 'low' ? '低威胁' : level === 'medium' ? '中威胁' : '高威胁'}
          </button>
        ))}
      </div>

      {/* 对比结果弹窗 */}
      {comparisonResult && (
        <div className="rounded-lg border bg-blue-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">竞品对比分析报告</h3>
            <button
              onClick={() => setComparisonResult(null)}
              className="text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-white p-4 rounded-lg border">
              {comparisonResult.analysis_summary}
            </pre>
          </div>
        </div>
      )}

      {/* 竞品列表 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : competitors.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <Building className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">暂无竞品数据</p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="mt-4 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            添加第一个竞品
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {competitors.map((competitor) => (
            <div key={competitor.id} className="rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {compareMode && (
                    <input
                      type="checkbox"
                      checked={selectedForCompare.includes(competitor.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedForCompare([...selectedForCompare, competitor.id]);
                        } else {
                          setSelectedForCompare(selectedForCompare.filter(id => id !== competitor.id));
                        }
                      }}
                      className="mt-1 w-4 h-4 rounded border-slate-300"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{competitor.name}</h3>
                      {getThreatBadge(competitor.threat_level)}
                      {competitor.product_count > 0 && (
                        <span className="text-xs text-slate-500">{competitor.product_count} 款产品</span>
                      )}
                      {competitor.dynamics_count > 0 && (
                        <span className="text-xs text-blue-600">{competitor.dynamics_count} 条动态</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                      {competitor.company_name && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {competitor.company_name}
                        </span>
                      )}
                      {competitor.official_website && (
                        <a
                          href={competitor.official_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Globe className="w-3 h-3" />
                          官网
                        </a>
                      )}
                      {competitor.latest_dynamic_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          最新动态: {competitor.latest_dynamic_date}
                        </span>
                      )}
                    </div>
                    {competitor.key_features && (
                      <p className="text-sm text-slate-600 mt-2 line-clamp-2">{competitor.key_features}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadCompetitorDetail(competitor.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    <Eye className="w-4 h-4" />
                    详情
                  </button>
                  <button
                    onClick={() => handleDeleteCompetitor(competitor.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建竞品弹窗 */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">添加竞品</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">竞品名称 *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="如：ABB、发那科"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">型号/系列</label>
                <input
                  type="text"
                  value={createForm.model_or_line}
                  onChange={(e) => setCreateForm({ ...createForm, model_or_line: e.target.value })}
                  placeholder="如：IRB系列"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">威胁等级</label>
                <select
                  value={createForm.threat_level}
                  onChange={(e) => setCreateForm({ ...createForm, threat_level: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="low">低威胁</option>
                  <option value="medium">中威胁</option>
                  <option value="high">高威胁</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">公司名称</label>
                <input
                  type="text"
                  value={createForm.company_name}
                  onChange={(e) => setCreateForm({ ...createForm, company_name: e.target.value })}
                  placeholder="公司全称"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">官网地址</label>
                <input
                  type="url"
                  value={createForm.official_website}
                  onChange={(e) => setCreateForm({ ...createForm, official_website: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">核心产品</label>
                <textarea
                  value={createForm.core_products}
                  onChange={(e) => setCreateForm({ ...createForm, core_products: e.target.value })}
                  placeholder="主要产品线描述"
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateCompetitor}
                disabled={!createForm.name}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 竞品详情弹窗 */}
      {showDetailDialog && selectedCompetitor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 my-8">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedCompetitor.name}</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedCompetitor.company_name || '公司信息未知'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getThreatBadge(selectedCompetitor.threat_level)}
                  <button
                    onClick={() => setShowDetailDialog(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* Tab导航 */}
            <div className="border-b">
              <div className="flex gap-1 px-6">
                {[
                  { key: 'info', label: '基本信息' },
                  { key: 'parameters', label: `产品参数 (${selectedCompetitor.parameters?.length || 0})` },
                  { key: 'dynamics', label: `动态信息 (${selectedCompetitor.dynamics?.length || 0})` },
                  { key: 'suggestions', label: '迭代建议' },
                  { key: 'qa', label: '智能问答' },
                  { key: 'crawler', label: '爬虫配置' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      if (tab.key === 'qa') loadQaHistory(selectedCompetitor.id);
                      if (tab.key === 'suggestions') loadSuggestions(selectedCompetitor.id);
                    }}
                    className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                      activeTab === tab.key
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab内容 */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* 基本信息 Tab */}
              {activeTab === 'info' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500">型号/系列</p>
                      <p className="font-medium mt-1">{selectedCompetitor.model_or_line || '未知'}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500">价格定位</p>
                      <p className="font-medium mt-1">{selectedCompetitor.price_position || '未知'}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500">威胁等级</p>
                      <p className="mt-1">{getThreatBadge(selectedCompetitor.threat_level)}</p>
                    </div>
                  </div>

                  {selectedCompetitor.official_website && (
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500 mb-2">官网</p>
                      <a
                        href={selectedCompetitor.official_website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {selectedCompetitor.official_website}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {selectedCompetitor.key_features && (
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500 mb-2">关键特性</p>
                      <p className="text-sm">{selectedCompetitor.key_features}</p>
                    </div>
                  )}

                  {selectedCompetitor.gap_analysis && (
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500 mb-2">差距分析</p>
                      <p className="text-sm">{selectedCompetitor.gap_analysis}</p>
                    </div>
                  )}

                  {selectedCompetitor.core_products && (
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500 mb-2">核心产品</p>
                      <p className="text-sm">{selectedCompetitor.core_products}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 产品参数 Tab */}
              {activeTab === 'parameters' && (
                <div className="space-y-4">
                  {selectedCompetitor.parameters?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-slate-50">
                            <th className="text-left p-3 font-medium">产品名称</th>
                            <th className="text-left p-3 font-medium">负载(kg)</th>
                            <th className="text-left p-3 font-medium">臂展(mm)</th>
                            <th className="text-left p-3 font-medium">精度(mm)</th>
                            <th className="text-left p-3 font-medium">防护等级</th>
                            <th className="text-left p-3 font-medium">价格</th>
                            <th className="text-left p-3 font-medium">上市时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCompetitor.parameters.map((p) => (
                            <tr key={p.id} className="border-b hover:bg-slate-50">
                              <td className="p-3 font-medium">{p.product_name}</td>
                              <td className="p-3">{p.payload_kg || '-'}</td>
                              <td className="p-3">{p.reach_mm || '-'}</td>
                              <td className="p-3">{p.repeat_accuracy_mm || '-'}</td>
                              <td className="p-3">{p.protection_rating || '-'}</td>
                              <td className="p-3">
                                {p.list_price ? `${p.list_price} ${p.currency || 'CNY'}` : '-'}
                              </td>
                              <td className="p-3">{p.launch_date || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">暂无产品参数</p>
                  )}
                </div>
              )}

              {/* 动态信息 Tab */}
              {activeTab === 'dynamics' && (
                <div className="space-y-3">
                  {selectedCompetitor.dynamics?.length > 0 ? (
                    selectedCompetitor.dynamics.map((d) => (
                      <div key={d.id} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                              {getDynamicTypeLabel(d.dynamic_type)}
                            </span>
                            <h4 className="font-medium">{d.title}</h4>
                          </div>
                          <span className="text-xs text-slate-500">{d.publish_date || '日期未知'}</span>
                        </div>
                        {d.summary && <p className="text-sm text-slate-600">{d.summary}</p>}
                        {d.source_url && (
                          <a
                            href={d.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline mt-2 inline-flex items-center gap-1"
                          >
                            查看来源 <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 text-center py-8">暂无动态信息</p>
                  )}
                </div>
              )}

              {/* 迭代建议 Tab */}
              {activeTab === 'suggestions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">迭代建议</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAutoAnalyze}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Zap className="w-4 h-4" />
                        AI自动分析
                      </button>
                      <button
                        onClick={() => setShowSuggestionDialog(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
                      >
                        <Plus className="w-4 h-4" />
                        手动添加
                      </button>
                    </div>
                  </div>

                  {suggestions.length > 0 ? (
                    <div className="space-y-3">
                      {suggestions.map((s) => (
                        <div key={s.id} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                                {getSuggestionTypeLabel(s.suggestion_type)}
                              </span>
                              {getPriorityBadge(s.priority)}
                              {getSuggestionStatusBadge(s.status)}
                            </div>
                            <span className="text-xs text-slate-500">
                              {new Date(s.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="font-medium mb-1">{s.title}</h4>
                          <p className="text-sm text-slate-600">{s.description}</p>
                          {s.impact_analysis && (
                            <p className="text-sm text-slate-500 mt-2">
                              <span className="font-medium">影响分析：</span>{s.impact_analysis}
                            </p>
                          )}
                          {s.status === 'pending' && (
                            <button
                              onClick={() => handleConvertToTask(s.id)}
                              className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
                            >
                              <ArrowRight className="w-4 h-4" />
                              转为任务
                            </button>
                          )}
                          {s.task_id && (
                            <span className="mt-3 inline-flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="w-3 h-3" />
                              已关联任务 #{s.task_id}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">
                      暂无迭代建议，点击"AI自动分析"或"手动添加"
                    </p>
                  )}
                </div>
              )}

              {/* 智能问答 Tab */}
              {activeTab === 'qa' && (
                <div className="space-y-6">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                      placeholder="输入问题，例如：这个竞品的最新产品重复定位精度是多少？"
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleAskQuestion}
                      disabled={answering || !question.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {answering ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      提问
                    </button>
                  </div>

                  {answer && (
                    <div className="rounded-lg border bg-blue-50 p-4">
                      <p className="text-sm whitespace-pre-wrap">{answer}</p>
                    </div>
                  )}

                  {qaHistory.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">历史问答</h4>
                      <div className="space-y-3">
                        {qaHistory.slice(0, 10).map((item) => (
                          <div key={item.id} className="rounded-lg border p-3">
                            <p className="text-sm font-medium">{item.question}</p>
                            <p className="text-sm text-slate-600 mt-1">{item.answer}</p>
                            <p className="text-xs text-slate-400 mt-2">
                              {new Date(item.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 爬虫配置 Tab */}
              {activeTab === 'crawler' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">
                    配置爬虫自动抓取竞品官网、新闻媒体、专利平台等信息。
                  </p>
                  {selectedCompetitor.crawler_configs?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedCompetitor.crawler_configs.map((config) => (
                        <div key={config.id} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{config.name}</h4>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              config.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {config.is_active ? '启用' : '停用'}
                            </span>
                          </div>
                          <div className="text-sm text-slate-500">
                            <p>类型: {config.source_type}</p>
                            <p>频率: {config.crawl_frequency}</p>
                            <p>地址: {config.source_url}</p>
                            {config.last_crawl_at && (
                              <p>上次抓取: {config.last_crawl_at}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">暂无爬虫配置</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 添加迭代建议弹窗 */}
      {showSuggestionDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">添加迭代建议</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">标题 *</label>
                <input
                  type="text"
                  value={newSuggestion.title}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">描述 *</label>
                <textarea
                  value={newSuggestion.description}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">类型</label>
                  <select
                    value={newSuggestion.suggestion_type}
                    onChange={(e) => setNewSuggestion({ ...newSuggestion, suggestion_type: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="feature">功能特性</option>
                    <option value="performance">性能提升</option>
                    <option value="pricing">价格策略</option>
                    <option value="marketing">市场推广</option>
                    <option value="partnership">合作机会</option>
                    <option value="other">其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">优先级</label>
                  <select
                    value={newSuggestion.priority}
                    onChange={(e) => setNewSuggestion({ ...newSuggestion, priority: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="critical">紧急</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">影响分析</label>
                <textarea
                  value={newSuggestion.impact_analysis}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, impact_analysis: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">实施难度</label>
                <select
                  value={newSuggestion.implementation_effort}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, implementation_effort: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowSuggestionDialog(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleAddSuggestion}
                disabled={!newSuggestion.title || !newSuggestion.description}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
