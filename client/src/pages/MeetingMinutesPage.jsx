import { useState, useEffect } from 'react';
import api from '../api/client.js';
import { useProject } from '../context/ProjectContext.jsx';
import { 
  FileText, Upload, RefreshCw, CheckCircle, XCircle, Clock, Plus,
  Trash2, Eye, Archive, AlertTriangle, Lightbulb, ClipboardList, GitBranch
} from 'lucide-react';

export default function MeetingMinutesPage() {
  const { projectId } = useProject();
  const [minutes, setMinutes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMinute, setSelectedMinute] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [parseResultFilter, setParseResultFilter] = useState('all');

  // 创建表单
  const [createForm, setCreateForm] = useState({
    project_id: '',
    title: '',
    meeting_date: '',
    meeting_type: 'regular',
    location: '',
    host_id: '',
    participants: '',
    raw_content: '',
  });

  // 分页
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  useEffect(() => {
    loadMinutes();
    loadProjects();
    loadUsers();
  }, [activeTab, projectId]);

  const loadMinutes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: pagination.page,
        pageSize: pagination.pageSize,
      });
      if (activeTab !== 'all') {
        params.append('status', activeTab);
      }
      if (projectId) {
        params.append('project_id', projectId);
      }
      const res = await api.get(`/api/meeting-minutes?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMinutes(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('加载会议纪要失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await api.get('/api/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(res.data.data || res.data);
    } catch (error) {
      console.error('加载项目失败:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await api.get('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.data || res.data);
    } catch (error) {
      console.error('加载用户失败:', error);
    }
  };

  const handleCreate = async () => {
    try {
      const token = localStorage.getItem('token');
      const data = { ...createForm };
      if (projectId) data.project_id = projectId;
      
      await api.post('/api/meeting-minutes', data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowCreateDialog(false);
      setCreateForm({
        project_id: '',
        title: '',
        meeting_date: '',
        meeting_type: 'regular',
        location: '',
        host_id: '',
        participants: '',
        raw_content: '',
      });
      loadMinutes();
    } catch (error) {
      console.error('创建会议纪要失败:', error);
      alert('创建失败');
    }
  };

  const handleParse = async (minuteId) => {
    try {
      const token = localStorage.getItem('token');
      await api.post(`/api/meeting-minutes/${minuteId}/parse`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('解析任务已启动，请稍后刷新查看结果');
      loadMinutes();
    } catch (error) {
      console.error('触发解析失败:', error);
      alert('触发解析失败');
    }
  };

  const handleViewDetail = async (minuteId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await api.get(`/api/meeting-minutes/${minuteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedMinute(res.data);
      setShowDetailDialog(true);
    } catch (error) {
      console.error('获取详情失败:', error);
    }
  };

  const handleDelete = async (minuteId) => {
    if (!confirm('确定要删除这条会议纪要吗？')) return;
    try {
      const token = localStorage.getItem('token');
      await api.delete(`/api/meeting-minutes/${minuteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadMinutes();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  const handleSyncResult = async (resultId, syncTo) => {
    try {
      const token = localStorage.getItem('token');
      await api.post(`/api/meeting-minutes/${selectedMinute.id}/parse-results/${resultId}/sync`, 
        { sync_to: syncTo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const res = await api.get(`/api/meeting-minutes/${selectedMinute.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedMinute(res.data);
      alert('同步成功');
    } catch (error) {
      console.error('同步失败:', error);
      alert('同步失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleArchive = async (minuteId) => {
    try {
      const token = localStorage.getItem('token');
      await api.post(`/api/knowledge/archive/${minuteId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('已归档到知识库');
    } catch (error) {
      console.error('归档失败:', error);
      alert('归档失败');
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: '待解析', className: 'bg-slate-100 text-slate-700' },
      parsing: { label: '解析中', className: 'bg-blue-100 text-blue-700' },
      parsed: { label: '已解析', className: 'bg-green-100 text-green-700' },
      failed: { label: '解析失败', className: 'bg-red-100 text-red-700' },
    };
    const config = statusMap[status] || statusMap.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
        {status === 'parsing' && <RefreshCw className="w-3 h-3 animate-spin" />}
        {config.label}
      </span>
    );
  };

  const getMeetingTypeLabel = (type) => {
    const labels = {
      regular: '常规会议',
      review: '评审会议',
      decision: '决策会议',
      brainstorm: '头脑风暴',
      other: '其他',
    };
    return labels[type] || type;
  };

  const getResultTypeIcon = (type) => {
    const icons = {
      todo: { icon: ClipboardList, color: 'text-blue-500', label: '待办' },
      change: { icon: GitBranch, color: 'text-orange-500', label: '变更' },
      risk: { icon: AlertTriangle, color: 'text-red-500', label: '风险' },
      decision: { icon: Lightbulb, color: 'text-green-500', label: '决策' },
    };
    return icons[type] || icons.todo;
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

  const filteredParseResults = selectedMinute?.parse_results?.filter(r => 
    parseResultFilter === 'all' || r.result_type === parseResultFilter
  ) || [];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">会议纪要管理</h1>
          <p className="text-slate-500 mt-1">
            上传或粘贴会议纪要，AI自动解析待办、变更、风险和决策
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" />
          新建会议纪要
        </button>
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-2">
        {['all', 'pending', 'parsing', 'parsed', 'failed'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              activeTab === tab
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab === 'all' ? '全部' : 
             tab === 'pending' ? '待解析' :
             tab === 'parsing' ? '解析中' :
             tab === 'parsed' ? '已解析' : '解析失败'}
          </button>
        ))}
      </div>

      {/* 会议纪要列表 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : minutes.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">暂无会议纪要</p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="mt-4 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            创建第一个会议纪要
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {minutes.map((minute) => (
            <div key={minute.id} className="rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium">{minute.title}</h3>
                    {getStatusBadge(minute.parse_status)}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                    {minute.project_name && (
                      <span>项目: {minute.project_name}</span>
                    )}
                    {minute.meeting_date && (
                      <span>日期: {minute.meeting_date}</span>
                    )}
                    <span>类型: {getMeetingTypeLabel(minute.meeting_type)}</span>
                    {minute.host_name && (
                      <span>主持人: {minute.host_name}</span>
                    )}
                  </div>
                  
                  {minute.parse_status === 'parsed' && (
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <span className="text-slate-500">解析结果:</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-medium">{minute.parse_result_count} 项</span>
                      {minute.pending_count > 0 && (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">{minute.pending_count} 待处理</span>
                      )}
                      {minute.synced_count > 0 && (
                        <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">{minute.synced_count} 已同步</span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewDetail(minute.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    <Eye className="w-4 h-4" />
                    详情
                  </button>
                  {minute.parse_status === 'pending' && minute.raw_content && (
                    <button
                      onClick={() => handleParse(minute.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      解析
                    </button>
                  )}
                  {minute.parse_status === 'parsed' && (
                    <button
                      onClick={() => handleArchive(minute.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
                    >
                      <Archive className="w-4 h-4" />
                      归档
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(minute.id)}
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

      {/* 创建会议纪要弹窗 */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">新建会议纪要</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">关联项目</label>
                  <select
                    value={createForm.project_id}
                    onChange={(e) => setCreateForm({ ...createForm, project_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">选择项目（可选）</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">会议类型</label>
                  <select
                    value={createForm.meeting_type}
                    onChange={(e) => setCreateForm({ ...createForm, meeting_type: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="regular">常规会议</option>
                    <option value="review">评审会议</option>
                    <option value="decision">决策会议</option>
                    <option value="brainstorm">头脑风暴</option>
                    <option value="other">其他</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">标题 *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="输入会议纪要标题"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">会议日期</label>
                  <input
                    type="date"
                    value={createForm.meeting_date}
                    onChange={(e) => setCreateForm({ ...createForm, meeting_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">会议地点</label>
                  <input
                    type="text"
                    value={createForm.location}
                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                    placeholder="会议室/线上会议"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">主持人</label>
                  <select
                    value={createForm.host_id}
                    onChange={(e) => setCreateForm({ ...createForm, host_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">选择主持人</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">参会人员</label>
                  <input
                    type="text"
                    value={createForm.participants}
                    onChange={(e) => setCreateForm({ ...createForm, participants: e.target.value })}
                    placeholder="用逗号分隔多人"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">会议内容 *</label>
                <textarea
                  value={createForm.raw_content}
                  onChange={(e) => setCreateForm({ ...createForm, raw_content: e.target.value })}
                  placeholder="粘贴会议纪要内容，AI将自动解析待办、变更、风险和决策..."
                  rows={10}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none"
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
                onClick={handleCreate}
                disabled={!createForm.title || !createForm.raw_content}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                创建并解析
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {showDetailDialog && selectedMinute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {selectedMinute.title}
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">项目</span>
                  <p className="font-medium">{selectedMinute.project_name || '未关联'}</p>
                </div>
                <div>
                  <span className="text-slate-500">日期</span>
                  <p className="font-medium">{selectedMinute.meeting_date || '未设置'}</p>
                </div>
                <div>
                  <span className="text-slate-500">主持人</span>
                  <p className="font-medium">{selectedMinute.host_name || '未设置'}</p>
                </div>
                <div>
                  <span className="text-slate-500">状态</span>
                  <p>{getStatusBadge(selectedMinute.parse_status)}</p>
                </div>
              </div>

              {/* 解析结果 */}
              {selectedMinute.parse_status === 'parsed' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">解析结果</h3>
                    <select
                      value={parseResultFilter}
                      onChange={(e) => setParseResultFilter(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                    >
                      <option value="all">全部</option>
                      <option value="todo">待办</option>
                      <option value="change">变更</option>
                      <option value="risk">风险</option>
                      <option value="decision">决策</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    {filteredParseResults.map((result) => {
                      const typeConfig = getResultTypeIcon(result.result_type);
                      const TypeIcon = typeConfig.icon;
                      return (
                        <div key={result.id} className="rounded-lg border p-4">
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 ${typeConfig.color}`}>
                              <TypeIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-medium">{typeConfig.label}</span>
                                {result.priority && getPriorityBadge(result.priority)}
                                {result.status === 'synced' && (
                                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">已同步</span>
                                )}
                              </div>
                              <p className="text-sm mb-2">{result.content}</p>
                              <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                                {result.responsible_person && (
                                  <span>负责人: {result.responsible_person}</span>
                                )}
                                {result.due_date && (
                                  <span>截止: {result.due_date}</span>
                                )}
                                {result.impact_level && (
                                  <span>影响程度: {result.impact_level}</span>
                                )}
                                {result.decision && (
                                  <span>决策: {result.decision}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {result.status !== 'synced' && (
                                <>
                                  {result.result_type === 'todo' && (
                                    <button
                                      onClick={() => handleSyncResult(result.id, 'task')}
                                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                                    >
                                      同步到任务
                                    </button>
                                  )}
                                  {result.result_type === 'risk' && (
                                    <button
                                      onClick={() => handleSyncResult(result.id, 'risk')}
                                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                                    >
                                      同步到风险
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 原始内容 */}
              <div>
                <h3 className="font-medium mb-2">原始内容</h3>
                <div className="bg-slate-50 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto border">
                  {selectedMinute.raw_content}
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setShowDetailDialog(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
