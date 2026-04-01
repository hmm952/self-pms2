import { useEffect, useState, useRef } from 'react';
import api from '../api/client.js';

export default function ReviewDetailModal({
  reviewId,
  templates,
  users,
  phaseConfig,
  statusConfig,
  severityConfig,
  onClose,
  onUpdated,
}) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [msg, setMsg] = useState('');

  // 编辑模式
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  // 新增
  const [newExpertId, setNewExpertId] = useState('');
  const [newExpertRole, setNewExpertRole] = useState('expert');
  const [newScore, setNewScore] = useState({ category: '', score: 85, comment: '' });
  const [newIssue, setNewIssue] = useState({ category: '', severity: 'major', description: '', assigned_to: '', due_date: '' });

  // 文件上传
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // 加载详情
  useEffect(() => {
    loadReview();
  }, [reviewId]);

  const loadReview = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/reviews/${reviewId}`);
      setReview(data);
      setEditForm({
        title: data.title,
        phase: data.phase,
        template_id: data.template_id || '',
        milestone_id: data.milestone_id || '',
        review_date: data.review_date || '',
        location: data.location || '',
        agenda: data.agenda || '',
        conclusion: data.conclusion || '',
      });
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 更新基本信息
  const handleUpdate = async () => {
    try {
      await api.put(`/api/reviews/${reviewId}`, editForm);
      setIsEditing(false);
      loadReview();
      onUpdated?.();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 提交评审
  const handleSubmit = async () => {
    if (!window.confirm('确认提交评审申请？')) return;
    try {
      await api.post(`/api/reviews/${reviewId}/submit`);
      loadReview();
      onUpdated?.();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 开始评审
  const handleStart = async () => {
    if (!window.confirm('确认开始评审？')) return;
    try {
      await api.post(`/api/reviews/${reviewId}/start`);
      loadReview();
      onUpdated?.();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 完成评审
  const handleComplete = async (result, conclusion) => {
    try {
      await api.post(`/api/reviews/${reviewId}/complete`, { result, conclusion });
      loadReview();
      onUpdated?.();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 删除评审
  const handleDelete = async () => {
    if (!window.confirm('确认删除此评审？')) return;
    try {
      await api.delete(`/api/reviews/${reviewId}`);
      onClose();
      onUpdated?.();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 添加专家
  const handleAddExpert = async () => {
    if (!newExpertId) return;
    try {
      await api.post(`/api/reviews/${reviewId}/experts`, {
        user_id: Number(newExpertId),
        role: newExpertRole,
      });
      setNewExpertId('');
      setNewExpertRole('expert');
      loadReview();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 移除专家
  const handleRemoveExpert = async (expertId) => {
    if (!window.confirm('确认移除此专家？')) return;
    try {
      await api.delete(`/api/reviews/${reviewId}/experts/${expertId}`);
      loadReview();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 提交打分
  const handleSubmitScores = async (scores) => {
    try {
      await api.post(`/api/reviews/${reviewId}/scores`, { scores });
      loadReview();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 添加问题
  const handleAddIssue = async () => {
    if (!newIssue.category || !newIssue.description) return;
    try {
      await api.post(`/api/reviews/${reviewId}/issues`, {
        ...newIssue,
        assigned_to: newIssue.assigned_to || null,
        due_date: newIssue.due_date || null,
      });
      setNewIssue({ category: '', severity: 'major', description: '', assigned_to: '', due_date: '' });
      loadReview();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 将问题转为任务
  const handleCreateTask = async (issueId) => {
    try {
      await api.post(`/api/reviews/${reviewId}/issues/${issueId}/create-task`, {});
      loadReview();
      onUpdated?.();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 上传附件
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result.split(',')[1];
          await api.post(`/api/reviews/${reviewId}/attachments`, {
            fileName: file.name,
            fileContent: base64,
            contentType: file.type,
            fileSize: file.size,
          });
          loadReview();
        } catch (err) {
          setMsg(err.message);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setMsg(err.message);
      setUploading(false);
    }
  };

  // 下载附件
  const handleDownload = async (url, fileName) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(blobUrl);
  };

  // 删除附件
  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('确认删除此附件？')) return;
    try {
      await api.delete(`/api/reviews/${reviewId}/attachments/${attachmentId}`);
      loadReview();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 导出报告
  const handleExportReport = async () => {
    try {
      const { data: report } = await api.get(`/api/reviews/${reviewId}/report`);
      
      // 生成简单的文本报告（实际项目中可以使用 PDF 生成库）
      let content = `评审报告\n${'='.repeat(50)}\n\n`;
      content += `评审标题: ${report.review.title}\n`;
      content += `项目: ${report.review.project_name}\n`;
      content += `阶段: ${phaseConfig[report.review.phase]?.label || report.review.phase}\n`;
      content += `状态: ${statusConfig[report.review.status]?.label || report.review.status}\n`;
      content += `评审日期: ${report.review.review_date || '待定'}\n`;
      content += `总分: ${report.review.total_score || '-'}\n\n`;
      
      content += `评审结论:\n${report.review.conclusion || '暂无'}\n\n`;
      
      if (report.scores.length > 0) {
        content += `评分明细:\n`;
        content += '-'.repeat(30) + '\n';
        for (const s of report.scores) {
          content += `${s.category}: ${s.avg_score.toFixed(1)}分 (${s.count}位专家)\n`;
        }
        content += '\n';
      }
      
      if (report.issues.length > 0) {
        content += `问题清单 (${report.issuesSummary.total}项):\n`;
        content += '-'.repeat(30) + '\n';
        for (const i of report.issues) {
          content += `[${severityConfig[i.severity]?.label || i.severity}] ${i.description}\n`;
          content += `  状态: ${i.status}\n`;
        }
        content += '\n';
      }
      
      content += `生成时间: ${report.generatedAt}\n`;
      
      // 下载文本文件
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `评审报告_${report.review.title}.txt`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  if (!review) {
    return null;
  }

  const template = templates.find((t) => t.id === review.template_id);
  const scoringCriteria = template?.scoring_criteria || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
        {/* 头部 */}
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${phaseConfig[review.phase]?.color || 'bg-slate-100 text-slate-600'}`}>
                {phaseConfig[review.phase]?.label || review.phase}
              </span>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusConfig[review.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                {statusConfig[review.status]?.label || review.status}
              </span>
              {review.total_score !== null && review.total_score !== undefined && (
                <span className="rounded bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {review.total_score}分
                </span>
              )}
            </div>
            {isEditing ? (
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-lg font-semibold"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              />
            ) : (
              <h2 className="mt-2 text-lg font-semibold text-slate-900">{review.title}</h2>
            )}
            <p className="mt-1 text-sm text-slate-500">
              {review.project_name} · 创建于 {formatDate(review.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {review.status === 'draft' && (
              <>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  提交申请
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  删除
                </button>
              </>
            )}
            {review.status === 'scheduled' && (
              <button
                type="button"
                onClick={handleStart}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                开始评审
              </button>
            )}
            {review.status === 'in_progress' && (
              <CompleteReviewButton onComplete={handleComplete} />
            )}
            <button
              type="button"
              onClick={handleExportReport}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              导出报告
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              关闭
            </button>
          </div>
        </div>

        {msg && (
          <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {msg}
          </div>
        )}

        {/* Tab 切换 */}
        <div className="flex border-b border-slate-200 px-4">
          {[
            { key: 'details', label: '详情' },
            { key: 'experts', label: `专家 (${review.experts?.length || 0})` },
            { key: 'scores', label: '打分' },
            { key: 'issues', label: `问题 (${review.issues?.length || 0})` },
            { key: 'attachments', label: `附件 (${review.attachments?.length || 0})` },
            { key: 'history', label: '流程' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 详情 Tab */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">评审阶段</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editForm.phase}
                        onChange={(e) => setEditForm((f) => ({ ...f, phase: e.target.value }))}
                      >
                        {Object.entries(phaseConfig).map(([key, { label }]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">评审日期</label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editForm.review_date}
                        onChange={(e) => setEditForm((f) => ({ ...f, review_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">评审地点</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={editForm.location}
                      onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">评审议程</label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      rows={3}
                      value={editForm.agenda}
                      onChange={(e) => setEditForm((f) => ({ ...f, agenda: e.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdate}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white"
                    >
                      保存
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-sm text-brand-600 hover:underline"
                  >
                    编辑基本信息
                  </button>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem label="评审日期" value={review.review_date || '待定'} />
                    <InfoItem label="评审地点" value={review.location || '待定'} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem label="申请人" value={review.applicant_name || '—'} />
                    <InfoItem label="关联里程碑" value={review.milestone_name || '未关联'} />
                  </div>
                  <InfoItem label="评审议程" value={review.agenda || '暂无'} />
                  <InfoItem label="评审结论" value={review.conclusion || '暂无'} />

                  {/* 流程进度 */}
                  <div className="mt-4 rounded-lg border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700">流程进度</h3>
                    <div className="mt-3 flex items-center">
                      {['draft', 'scheduled', 'in_progress', 'passed'].map((s, i) => (
                        <div key={s} className="flex items-center">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                            review.status === s ? 'bg-brand-600 text-white' :
                            ['passed', 'conditional', 'rejected'].includes(review.status) && i < 3 ? 'bg-green-500 text-white' :
                            ['scheduled', 'in_progress'].includes(review.status) && i < 2 ? 'bg-brand-600 text-white' :
                            'bg-slate-200 text-slate-500'
                          }`}>
                            {i + 1}
                          </div>
                          <span className="ml-2 text-xs text-slate-600">{statusConfig[s]?.label}</span>
                          {i < 3 && <div className="mx-4 h-0.5 w-8 bg-slate-200" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 专家 Tab */}
          {activeTab === 'experts' && (
            <div className="space-y-4">
              {/* 添加专家 */}
              {['draft', 'scheduled'].includes(review.status) && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-3">
                  <select
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                    value={newExpertId}
                    onChange={(e) => setNewExpertId(e.target.value)}
                  >
                    <option value="">选择专家</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                    value={newExpertRole}
                    onChange={(e) => setNewExpertRole(e.target.value)}
                  >
                    <option value="lead">主任评审</option>
                    <option value="expert">评审专家</option>
                    <option value="observer">观察员</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddExpert}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    添加
                  </button>
                </div>
              )}

              {/* 专家列表 */}
              <div className="space-y-2">
                {review.experts?.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">暂无评审专家</div>
                ) : (
                  review.experts?.map((expert) => (
                    <div key={expert.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
                          {(expert.full_name || expert.username || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{expert.full_name || expert.username}</p>
                          <p className="text-xs text-slate-500">
                            {expert.role === 'lead' ? '主任评审' : expert.role === 'expert' ? '评审专家' : '观察员'}
                            · {expert.invite_status === 'accepted' ? '已接受' : expert.invite_status === 'declined' ? '已拒绝' : '待确认'}
                          </p>
                        </div>
                      </div>
                      {['draft', 'scheduled'].includes(review.status) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveExpert(expert.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          移除
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 打分 Tab */}
          {activeTab === 'scores' && (
            <ScorePanel
              review={review}
              scoringCriteria={scoringCriteria}
              onSubmitScores={handleSubmitScores}
            />
          )}

          {/* 问题 Tab */}
          {activeTab === 'issues' && (
            <div className="space-y-4">
              {/* 添加问题 */}
              {review.status === 'in_progress' && (
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="问题分类"
                      value={newIssue.category}
                      onChange={(e) => setNewIssue((i) => ({ ...i, category: e.target.value }))}
                    />
                    <select
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={newIssue.severity}
                      onChange={(e) => setNewIssue((i) => ({ ...i, severity: e.target.value }))}
                    >
                      {Object.entries(severityConfig).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={newIssue.assigned_to}
                      onChange={(e) => setNewIssue((i) => ({ ...i, assigned_to: e.target.value }))}
                    >
                      <option value="">指派给</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="问题描述"
                    value={newIssue.description}
                    onChange={(e) => setNewIssue((i) => ({ ...i, description: e.target.value }))}
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <input
                      type="date"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={newIssue.due_date}
                      onChange={(e) => setNewIssue((i) => ({ ...i, due_date: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={handleAddIssue}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                    >
                      添加问题
                    </button>
                  </div>
                </div>
              )}

              {/* 问题列表 */}
              <div className="space-y-2">
                {review.issues?.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">暂无问题</div>
                ) : (
                  review.issues?.map((issue) => (
                    <div key={issue.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`rounded px-2 py-0.5 text-xs font-medium ${severityConfig[issue.severity]?.color || 'bg-slate-100 text-slate-600'}`}>
                              {severityConfig[issue.severity]?.label || issue.severity}
                            </span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {issue.category}
                            </span>
                            <span className={`rounded px-2 py-0.5 text-xs ${
                              issue.status === 'open' ? 'bg-red-100 text-red-700' :
                              issue.status === 'resolved' ? 'bg-green-100 text-green-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {issue.status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-900">{issue.description}</p>
                          <div className="mt-1 text-xs text-slate-500">
                            {issue.assigned_name && `负责人: ${issue.assigned_name}`}
                            {issue.due_date && ` · 截止: ${issue.due_date}`}
                            {issue.task_id && ` · 关联任务 #${issue.task_id}`}
                          </div>
                        </div>
                        {!issue.task_id && ['open', 'acknowledged'].includes(issue.status) && (
                          <button
                            type="button"
                            onClick={() => handleCreateTask(issue.id)}
                            className="rounded-lg border border-brand-200 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                          >
                            转为任务
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 附件 Tab */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {uploading ? '上传中...' : '+ 上传附件'}
              </button>

              <div className="space-y-2">
                {review.attachments?.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">暂无附件</div>
                ) : (
                  review.attachments?.map((att) => (
                    <div key={att.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          📄
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{att.file_name}</p>
                          <p className="text-xs text-slate-500">
                            {att.uploader_name} · {formatDate(att.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {att.url && (
                          <button
                            type="button"
                            onClick={() => handleDownload(att.url, att.file_name)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            下载
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 流程日志 Tab */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {review.workflowLog?.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">暂无流程记录</div>
              ) : (
                review.workflowLog?.map((log, index) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500">
                      {index + 1}
                    </div>
                    <div className="flex-1 rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-900">
                          {log.action === 'create' && '创建评审'}
                          {log.action === 'submit' && '提交申请'}
                          {log.action === 'start' && '开始评审'}
                          {log.action === 'complete' && '完成评审'}
                        </span>
                        <span className="text-xs text-slate-500">{formatDateTime(log.created_at)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {log.operator_name}
                        {log.from_status && log.to_status && ` · ${statusConfig[log.from_status]?.label || log.from_status} → ${statusConfig[log.to_status]?.label || log.to_status}`}
                      </p>
                      {log.comment && <p className="mt-1 text-sm text-slate-700">{log.comment}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 信息项组件
function InfoItem({ label, value }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-500">{label}</label>
      <p className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

// 完成评审按钮
function CompleteReviewButton({ onComplete }) {
  const [showModal, setShowModal] = useState(false);
  const [result, setResult] = useState('passed');
  const [conclusion, setConclusion] = useState('');

  const handleSubmit = () => {
    onComplete(result, conclusion);
    setShowModal(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        完成评审
      </button>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">完成评审</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">评审结果</label>
                <div className="mt-2 flex gap-2">
                  {[
                    { value: 'passed', label: '通过', color: 'bg-green-50 border-green-500 text-green-700' },
                    { value: 'conditional', label: '有条件通过', color: 'bg-orange-50 border-orange-500 text-orange-700' },
                    { value: 'rejected', label: '不通过', color: 'bg-red-50 border-red-500 text-red-700' },
                  ].map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setResult(r.value)}
                      className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
                        result === r.value ? r.color : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">评审结论</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  value={conclusion}
                  onChange={(e) => setConclusion(e.target.value)}
                  placeholder="填写评审结论..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  确认提交
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 打分面板
function ScorePanel({ review, scoringCriteria, onSubmitScores }) {
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});

  useEffect(() => {
    // 初始化打分
    const initialScores = {};
    const initialComments = {};
    scoringCriteria.forEach((c) => {
      initialScores[c.category] = 80;
      initialComments[c.category] = '';
    });
    setScores(initialScores);
    setComments(initialComments);
  }, [scoringCriteria]);

  const handleSubmit = () => {
    const scoreList = Object.entries(scores).map(([category, score]) => ({
      category,
      score: Number(score),
      comment: comments[category] || null,
    }));
    onSubmitScores(scoreList);
  };

  // 计算平均分
  const avgScores = {};
  if (review.scores?.length > 0) {
    review.scores.forEach((s) => {
      if (!avgScores[s.category]) {
        avgScores[s.category] = { sum: 0, count: 0 };
      }
      avgScores[s.category].sum += s.score;
      avgScores[s.category].count += 1;
    });
  }

  return (
    <div className="space-y-4">
      {/* 已有打分 */}
      {review.scores?.length > 0 && (
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-sm font-semibold text-slate-700">打分汇总</span>
          </div>
          <div className="divide-y divide-slate-100">
            {Object.entries(avgScores).map(([category, { sum, count }]) => (
              <div key={category} className="flex items-center justify-between px-4 py-2">
                <span className="text-sm text-slate-700">{category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-slate-900">
                    {(sum / count).toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-500">({count}位专家)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 提交打分 */}
      {review.status === 'in_progress' && scoringCriteria.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">提交打分</h3>
          <div className="mt-3 space-y-3">
            {scoringCriteria.map((c) => (
              <div key={c.category} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-900">{c.category}</span>
                    <span className="ml-2 text-xs text-slate-500">权重 {c.weight}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scores[c.category] || 80}
                      onChange={(e) => setScores((s) => ({ ...s, [c.category]: e.target.value }))}
                      className="w-24"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scores[c.category] || 80}
                      onChange={(e) => setScores((s) => ({ ...s, [c.category]: e.target.value }))}
                      className="w-16 rounded border border-slate-200 px-2 py-1 text-sm text-center"
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">{c.description}</p>
                <input
                  className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                  placeholder="备注（可选）"
                  value={comments[c.category] || ''}
                  onChange={(e) => setComments((c) => ({ ...c, [c.category]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            提交打分
          </button>
        </div>
      )}

      {scoringCriteria.length === 0 && review.status === 'in_progress' && (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          未选择评审模板，无法打分
        </div>
      )}
    </div>
  );
}
