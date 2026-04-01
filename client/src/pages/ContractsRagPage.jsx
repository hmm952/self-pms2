import { useState, useEffect } from 'react';
import api from '../api/client.js';
import { useProject } from '../context/ProjectContext.jsx';
import {
  FileText, Upload, RefreshCw, Plus, Eye, Trash2, DollarSign,
  Clock, CheckCircle, XCircle, AlertTriangle, Calendar,
  MessageSquare, Edit, GitBranch, Download, Send
} from 'lucide-react';

export default function ContractsRagPage() {
  const { projectId } = useProject();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [statusFilter, setStatusFilter] = useState('');

  // 创建表单
  const [createForm, setCreateForm] = useState({
    title: '',
    counterparty: '',
    contract_type: 'procurement',
    amount: '',
    currency: 'CNY',
    effective_date: '',
    expiry_date: '',
  });

  // 问答状态
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [answering, setAnswering] = useState(false);
  const [qaHistory, setQaHistory] = useState([]);

  // 分页
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  useEffect(() => {
    loadContracts();
  }, [projectId, statusFilter]);

  const getToken = () => localStorage.getItem('token');

  const loadContracts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        pageSize: pagination.pageSize,
      });
      if (projectId) params.append('project_id', projectId);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/api/contracts-rag?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setContracts(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('加载合同列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContractDetail = async (contractId) => {
    try {
      const res = await api.get(`/api/contracts-rag/${contractId}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setSelectedContract(res.data);
      setShowDetailDialog(true);
      setActiveTab('info');
    } catch (error) {
      console.error('加载合同详情失败:', error);
    }
  };

  const handleCreateContract = async () => {
    try {
      const data = { ...createForm };
      if (projectId) data.project_id = projectId;
      if (data.amount) data.amount = parseFloat(data.amount);

      await api.post('/api/contracts', data, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setShowCreateDialog(false);
      setCreateForm({
        title: '',
        counterparty: '',
        contract_type: 'procurement',
        amount: '',
        currency: 'CNY',
        effective_date: '',
        expiry_date: '',
      });
      loadContracts();
    } catch (error) {
      console.error('创建合同失败:', error);
      alert('创建合同失败');
    }
  };

  const handleDeleteContract = async (contractId) => {
    if (!confirm('确定要删除这个合同吗？')) return;
    try {
      await api.delete(`/api/contracts/${contractId}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      loadContracts();
    } catch (error) {
      console.error('删除合同失败:', error);
      alert('删除合同失败');
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || answering) return;
    setAnswering(true);
    setAnswer(null);

    try {
      const res = await api.post(`/api/contracts-rag/${selectedContract.id}/qa`, 
        { question: question.trim() },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setAnswer(res.data.answer);
      setQuestion('');
      // 刷新问答历史
      loadQaHistory(selectedContract.id);
    } catch (error) {
      console.error('问答失败:', error);
      setAnswer('抱歉，问答服务暂时不可用，请稍后重试。');
    } finally {
      setAnswering(false);
    }
  };

  const loadQaHistory = async (contractId) => {
    try {
      const res = await api.get(`/api/contracts-rag/${contractId}/qa-history`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setQaHistory(res.data);
    } catch (error) {
      console.error('加载问答历史失败:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      draft: { label: '草稿', className: 'bg-slate-100 text-slate-700' },
      negotiating: { label: '谈判中', className: 'bg-blue-100 text-blue-700' },
      signed: { label: '已签订', className: 'bg-green-100 text-green-700' },
      executing: { label: '执行中', className: 'bg-yellow-100 text-yellow-700' },
      closed: { label: '已结束', className: 'bg-gray-100 text-gray-700' },
      terminated: { label: '已终止', className: 'bg-red-100 text-red-700' },
    };
    const config = statusMap[status] || statusMap.draft;
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>{config.label}</span>;
  };

  const getPaymentStatusBadge = (status) => {
    const statusMap = {
      pending: { label: '待支付', className: 'bg-slate-100 text-slate-700' },
      due_soon: { label: '即将到期', className: 'bg-yellow-100 text-yellow-700' },
      overdue: { label: '已逾期', className: 'bg-red-100 text-red-700' },
      paid: { label: '已支付', className: 'bg-green-100 text-green-700' },
      partial: { label: '部分支付', className: 'bg-orange-100 text-orange-700' },
    };
    const config = statusMap[status] || statusMap.pending;
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>{config.label}</span>;
  };

  const getAcceptanceStatusBadge = (status) => {
    const statusMap = {
      pending: { label: '待验收', className: 'bg-slate-100 text-slate-700' },
      submitted: { label: '已提交', className: 'bg-blue-100 text-blue-700' },
      accepted: { label: '已验收', className: 'bg-green-100 text-green-700' },
      rejected: { label: '验收不通过', className: 'bg-red-100 text-red-700' },
    };
    const config = statusMap[status] || statusMap.pending;
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>{config.label}</span>;
  };

  const getChangeStatusBadge = (status) => {
    const statusMap = {
      draft: { label: '草稿', className: 'bg-slate-100 text-slate-700' },
      submitted: { label: '待审批', className: 'bg-yellow-100 text-yellow-700' },
      approved: { label: '已批准', className: 'bg-green-100 text-green-700' },
      rejected: { label: '已拒绝', className: 'bg-red-100 text-red-700' },
    };
    const config = statusMap[status] || statusMap.draft;
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>{config.label}</span>;
  };

  // 计算付款节点统计
  const getPaymentStats = () => {
    if (!selectedContract?.payment_nodes) return { total: 0, paid: 0, overdue: 0 };
    const nodes = selectedContract.payment_nodes;
    return {
      total: nodes.length,
      paid: nodes.filter(n => n.status === 'paid').length,
      overdue: nodes.filter(n => n.status === 'overdue').length,
    };
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">合同全生命周期管理</h1>
          <p className="text-slate-500 mt-1">
            基于RAG的合同管理，支持智能解析、付款跟踪、交付验收、变更管理
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" />
          新建合同
        </button>
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-2">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-4 py-2 text-sm font-medium rounded-lg ${
            statusFilter === '' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 hover:bg-slate-50'
          }`}
        >
          全部
        </button>
        {['draft', 'signed', 'executing', 'closed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              statusFilter === s ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s === 'draft' ? '草稿' : s === 'signed' ? '已签订' : s === 'executing' ? '执行中' : '已结束'}
          </button>
        ))}
      </div>

      {/* 合同列表 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : contracts.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">暂无合同</p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="mt-4 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            创建第一个合同
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {contracts.map((contract) => (
            <div key={contract.id} className="rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium">{contract.title}</h3>
                    {getStatusBadge(contract.status)}
                    {contract.overdue_count > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        {contract.overdue_count}项逾期
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                    <span>合作方: {contract.counterparty}</span>
                    <span className="font-medium text-slate-900">
                      金额: {contract.amount?.toLocaleString()} {contract.currency}
                    </span>
                    {contract.effective_date && (
                      <span>生效: {contract.effective_date}</span>
                    )}
                    {contract.expiry_date && (
                      <span>到期: {contract.expiry_date}</span>
                    )}
                    <span>版本: V{contract.current_version || 1}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadContractDetail(contract.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    <Eye className="w-4 h-4" />
                    详情
                  </button>
                  <button
                    onClick={() => handleDeleteContract(contract.id)}
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

      {/* 创建合同弹窗 */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">新建合同</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">合同名称 *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="输入合同名称"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">合作方 *</label>
                <input
                  type="text"
                  value={createForm.counterparty}
                  onChange={(e) => setCreateForm({ ...createForm, counterparty: e.target.value })}
                  placeholder="合作方名称"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">合同金额</label>
                  <input
                    type="number"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                    placeholder="金额"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">币种</label>
                  <select
                    value={createForm.currency}
                    onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="CNY">人民币 (CNY)</option>
                    <option value="USD">美元 (USD)</option>
                    <option value="EUR">欧元 (EUR)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">生效日期</label>
                  <input
                    type="date"
                    value={createForm.effective_date}
                    onChange={(e) => setCreateForm({ ...createForm, effective_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">到期日期</label>
                  <input
                    type="date"
                    value={createForm.expiry_date}
                    onChange={(e) => setCreateForm({ ...createForm, expiry_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
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
                onClick={handleCreateContract}
                disabled={!createForm.title || !createForm.counterparty}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 合同详情弹窗 */}
      {showDetailDialog && selectedContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 my-8">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedContract.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">{selectedContract.counterparty}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedContract.status)}
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
                  { key: 'payment', label: `付款节点 (${getPaymentStats().total})` },
                  { key: 'delivery', label: '交付要求' },
                  { key: 'changes', label: '变更记录' },
                  { key: 'qa', label: '智能问答' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      if (tab.key === 'qa') loadQaHistory(selectedContract.id);
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
                  {/* 核心信息 */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500">合同金额</p>
                      <p className="text-xl font-semibold mt-1">
                        {selectedContract.amount?.toLocaleString()} {selectedContract.currency}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500">生效日期</p>
                      <p className="text-lg font-medium mt-1">{selectedContract.effective_date || '未设置'}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500">到期日期</p>
                      <p className="text-lg font-medium mt-1">{selectedContract.expiry_date || '未设置'}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500">当前版本</p>
                      <p className="text-lg font-medium mt-1">V{selectedContract.documents?.[0]?.version || 1}</p>
                    </div>
                  </div>

                  {/* 解析结果 */}
                  {selectedContract.parse_result && (
                    <div className="space-y-4">
                      <h3 className="font-medium">AI解析关键条款</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-slate-500 mb-2">付款条款</p>
                          <p className="text-sm">{selectedContract.parse_result.payment_terms || '未提取'}</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-slate-500 mb-2">交付条款</p>
                          <p className="text-sm">{selectedContract.parse_result.delivery_terms || '未提取'}</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-slate-500 mb-2">违约责任</p>
                          <p className="text-sm">{selectedContract.parse_result.breach_liability || '未提取'}</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-slate-500 mb-2">保密条款</p>
                          <p className="text-sm">{selectedContract.parse_result.confidentiality_clause || '未提取'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 文档版本 */}
                  <div>
                    <h3 className="font-medium mb-3">文档版本</h3>
                    {selectedContract.documents?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedContract.documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="font-medium text-sm">{doc.file_name}</p>
                                <p className="text-xs text-slate-500">
                                  V{doc.version} · 上传于 {new Date(doc.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {doc.is_current && (
                                <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">当前版本</span>
                              )}
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                doc.parse_status === 'parsed' ? 'bg-green-100 text-green-700' :
                                doc.parse_status === 'parsing' ? 'bg-blue-100 text-blue-700' :
                                doc.parse_status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {doc.parse_status === 'parsed' ? '已解析' :
                                 doc.parse_status === 'parsing' ? '解析中' :
                                 doc.parse_status === 'failed' ? '解析失败' : '待解析'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">暂无文档</p>
                    )}
                  </div>
                </div>
              )}

              {/* 付款节点 Tab */}
              {activeTab === 'payment' && (
                <div className="space-y-4">
                  {/* 统计概览 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-2xl font-semibold">{getPaymentStats().total}</p>
                      <p className="text-xs text-slate-500">总节点</p>
                    </div>
                    <div className="rounded-lg border p-4 text-center bg-green-50">
                      <p className="text-2xl font-semibold text-green-700">{getPaymentStats().paid}</p>
                      <p className="text-xs text-green-600">已支付</p>
                    </div>
                    <div className="rounded-lg border p-4 text-center bg-red-50">
                      <p className="text-2xl font-semibold text-red-700">{getPaymentStats().overdue}</p>
                      <p className="text-xs text-red-600">已逾期</p>
                    </div>
                  </div>

                  {/* 时间线 */}
                  {selectedContract.payment_nodes?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedContract.payment_nodes.map((node, idx) => (
                        <div key={node.id} className="relative pl-8">
                          {/* 时间线 */}
                          {idx < selectedContract.payment_nodes.length - 1 && (
                            <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-slate-200" style={{ height: 'calc(100% + 1rem)' }} />
                          )}
                          <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center ${
                            node.status === 'paid' ? 'bg-green-500' :
                            node.status === 'overdue' ? 'bg-red-500' :
                            node.status === 'due_soon' ? 'bg-yellow-500' : 'bg-slate-300'
                          }`}>
                            {node.status === 'paid' ? (
                              <CheckCircle className="w-4 h-4 text-white" />
                            ) : node.status === 'overdue' ? (
                              <AlertTriangle className="w-4 h-4 text-white" />
                            ) : (
                              <DollarSign className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <div className="rounded-lg border p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{node.node_name}</h4>
                              {getPaymentStatusBadge(node.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-500">
                              <span className="font-medium text-slate-900">
                                {node.planned_amount?.toLocaleString()} {node.currency}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {node.planned_date}
                              </span>
                              {node.milestone_name && (
                                <span className="text-blue-600">关联里程碑: {node.milestone_name}</span>
                              )}
                            </div>
                            {node.node_description && (
                              <p className="text-sm text-slate-600 mt-2">{node.node_description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">暂无付款节点</p>
                  )}
                </div>
              )}

              {/* 交付要求 Tab */}
              {activeTab === 'delivery' && (
                <div className="space-y-4">
                  {selectedContract.delivery_requirements?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedContract.delivery_requirements.map((req) => (
                        <div key={req.id} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{req.requirement_name}</h4>
                            {getAcceptanceStatusBadge(req.acceptance_status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            <span>类型: {req.deliverable_type || '未指定'}</span>
                            {req.planned_date && (
                              <span>计划: {req.planned_date}</span>
                            )}
                            {req.task_title && (
                              <span className="text-blue-600">关联任务: {req.task_title}</span>
                            )}
                          </div>
                          {req.acceptance_criteria && (
                            <p className="text-sm text-slate-600 mt-2">
                              <span className="font-medium">验收标准: </span>{req.acceptance_criteria}
                            </p>
                          )}
                          {req.verification_notes && (
                            <p className="text-sm text-slate-600 mt-1">
                              <span className="font-medium">校验备注: </span>{req.verification_notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">暂无交付要求</p>
                  )}
                </div>
              )}

              {/* 变更记录 Tab */}
              {activeTab === 'changes' && (
                <div className="space-y-4">
                  {selectedContract.changes?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedContract.changes.map((change) => (
                        <div key={change.id} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <GitBranch className="w-4 h-4 text-slate-400" />
                              <span className="text-xs text-slate-500">{change.change_number}</span>
                              <h4 className="font-medium">{change.change_title}</h4>
                            </div>
                            {getChangeStatusBadge(change.status)}
                          </div>
                          <p className="text-sm text-slate-600 mb-2">{change.change_description}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>类型: {change.change_type}</span>
                            {change.old_value && change.new_value && (
                              <span>{change.old_value} → {change.new_value}</span>
                            )}
                            {change.impact_amount && (
                              <span>影响金额: {change.impact_amount}</span>
                            )}
                            <span>创建于 {new Date(change.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">暂无变更记录</p>
                  )}
                </div>
              )}

              {/* 智能问答 Tab */}
              {activeTab === 'qa' && (
                <div className="space-y-6">
                  {/* 问答输入 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                      placeholder="输入问题，例如：这个合同里延迟交付的违约金是多少？"
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

                  {/* 回答 */}
                  {answer && (
                    <div className="rounded-lg border bg-blue-50 p-4">
                      <p className="text-sm whitespace-pre-wrap">{answer}</p>
                    </div>
                  )}

                  {/* 历史问答 */}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
