import { useEffect, useState, useRef } from 'react';
import api from '../api/client.js';

export default function TaskDetailModal({
  taskId,
  users,
  statusConfig,
  priorityConfig,
  onClose,
  onUpdated,
  onDeleted,
}) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details'); // details | comments | attachments | reminders
  const [msg, setMsg] = useState('');

  // 编辑表单
  const [editForm, setEditForm] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  // 新备注
  const [newComment, setNewComment] = useState('');

  // 文件上传
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // 新提醒
  const [newReminder, setNewReminder] = useState({ reminder_type: 'before_due', reminder_time: '' });
  const [showReminderForm, setShowReminderForm] = useState(false);

  // 加载任务详情
  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/tasks/${taskId}`);
      setTask(data);
      setEditForm({
        title: data.title,
        description: data.description || '',
        status: data.status,
        priority: data.priority,
        assignee_id: data.assignee_id || '',
        due_date: data.due_date || '',
        progress: data.progress || 0,
        start_date: data.start_date || '',
        end_date: data.end_date || '',
      });
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 更新任务
  const handleUpdate = async () => {
    try {
      await api.put(`/api/tasks/${taskId}`, {
        ...editForm,
        assignee_id: editForm.assignee_id || null,
        due_date: editForm.due_date || null,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
      });
      setIsEditing(false);
      loadTask();
      onUpdated?.();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 删除任务
  const handleDelete = async () => {
    if (!window.confirm('确定要删除这个任务吗？')) return;
    try {
      await api.delete(`/api/tasks/${taskId}`);
      onDeleted?.();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 添加备注
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api.post(`/api/tasks/${taskId}/comments`, { content: newComment });
      setNewComment('');
      loadTask();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 删除备注
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('删除这条备注？')) return;
    try {
      await api.delete(`/api/tasks/${taskId}/comments/${commentId}`);
      loadTask();
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
      // 读取文件为 base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result.split(',')[1];
          await api.post(`/api/tasks/${taskId}/attachments`, {
            fileName: file.name,
            fileContent: base64,
            contentType: file.type,
            fileSize: file.size,
          });
          loadTask();
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

  // 删除附件
  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('删除这个附件？')) return;
    try {
      await api.delete(`/api/tasks/${taskId}/attachments/${attachmentId}`);
      loadTask();
    } catch (err) {
      setMsg(err.message);
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

  // 添加提醒
  const handleAddReminder = async () => {
    if (!newReminder.reminder_time) return;
    try {
      await api.post(`/api/tasks/${taskId}/reminders`, newReminder);
      setShowReminderForm(false);
      setNewReminder({ reminder_type: 'before_due', reminder_time: '' });
      loadTask();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 删除提醒
  const handleDeleteReminder = async (reminderId) => {
    if (!window.confirm('删除这个提醒？')) return;
    try {
      await api.delete(`/api/tasks/${taskId}/reminders/${reminderId}`);
      loadTask();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 格式化日期
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 检查是否逾期
  const isOverdue = task?.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  if (!task) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
        {/* 头部 */}
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig[task.status].color}`}>
                {statusConfig[task.status].label}
              </span>
              <span className={`text-xs font-medium ${priorityConfig[task.priority].color}`}>
                {priorityConfig[task.priority].label}优先级
              </span>
              {isOverdue && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  已逾期
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
              <h2 className="mt-2 text-lg font-semibold text-slate-900">{task.title}</h2>
            )}
            <p className="mt-1 text-sm text-slate-500">
              {task.project_name} · 创建于 {formatDate(task.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  保存
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  编辑
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
            { key: 'comments', label: `备注 (${task.comments?.length || 0})` },
            { key: 'attachments', label: `附件 (${task.attachments?.length || 0})` },
            { key: 'reminders', label: `提醒 (${task.reminders?.length || 0})` },
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
                  <div>
                    <label className="text-sm font-medium text-slate-700">描述</label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      rows={3}
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="输入任务描述"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">状态</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editForm.status}
                        onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                      >
                        {Object.entries(statusConfig).map(([key, { label }]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">优先级</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editForm.priority}
                        onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                      >
                        {Object.entries(priorityConfig).map(([key, { label }]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">责任人</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editForm.assignee_id}
                        onChange={(e) => setEditForm((f) => ({ ...f, assignee_id: e.target.value }))}
                      >
                        <option value="">未分配</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">截止日期</label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editForm.due_date}
                        onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">开始日期</label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editForm.start_date}
                        onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">结束日期</label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editForm.end_date}
                        onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">进度: {editForm.progress}%</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      className="mt-1 w-full"
                      value={editForm.progress}
                      onChange={(e) => setEditForm((f) => ({ ...f, progress: Number(e.target.value) }))}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-500">描述</label>
                    <p className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">
                      {task.description || '暂无描述'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-500">责任人</label>
                      <p className="mt-1 text-sm text-slate-900">
                        {task.assignee_full_name || task.assignee_name || '未分配'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-500">报告人</label>
                      <p className="mt-1 text-sm text-slate-900">
                        {task.reporter_full_name || task.reporter_name || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-500">截止日期</label>
                      <p className={`mt-1 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-900'}`}>
                        {task.due_date || '未设置'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-500">里程碑</label>
                      <p className="mt-1 text-sm text-slate-900">
                        {task.milestone_name || '未关联'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-500">开始日期</label>
                      <p className="mt-1 text-sm text-slate-900">{task.start_date || '未设置'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-500">结束日期</label>
                      <p className="mt-1 text-sm text-slate-900">{task.end_date || '未设置'}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-500">进度</label>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-brand-600 transition-all"
                          style={{ width: `${task.progress || 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{task.progress || 0}%</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-500">更新时间</label>
                    <p className="mt-1 text-sm text-slate-900">{formatDate(task.updated_at)}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 备注 Tab */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              {/* 添加备注 */}
              <div className="rounded-lg border border-slate-200 p-3">
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="添加备注..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300"
                  >
                    发送
                  </button>
                </div>
              </div>

              {/* 备注列表 */}
              <div className="space-y-3">
                {task.comments?.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">暂无备注</div>
                ) : (
                  task.comments?.map((comment) => (
                    <div key={comment.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
                            {(comment.full_name || comment.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-slate-900">
                              {comment.full_name || comment.username}
                            </span>
                            <span className="ml-2 text-xs text-slate-400">
                              {formatDate(comment.created_at)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          删除
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 附件 Tab */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              {/* 上传按钮 */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100"
                >
                  {uploading ? '上传中...' : '+ 上传附件'}
                </button>
              </div>

              {/* 附件列表 */}
              <div className="space-y-2">
                {task.attachments?.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">暂无附件</div>
                ) : (
                  task.attachments?.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          📄
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{att.file_name}</p>
                          <p className="text-xs text-slate-500">
                            {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : ''}
                            · {att.username} · {formatDate(att.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {att.url && (
                          <button
                            type="button"
                            onClick={() => handleDownload(att.url, att.file_name)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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

          {/* 提醒 Tab */}
          {activeTab === 'reminders' && (
            <div className="space-y-4">
              {/* 添加提醒按钮 */}
              {!showReminderForm ? (
                <button
                  type="button"
                  onClick={() => setShowReminderForm(true)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  + 添加提醒
                </button>
              ) : (
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500">提醒类型</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={newReminder.reminder_type}
                        onChange={(e) => setNewReminder((r) => ({ ...r, reminder_type: e.target.value }))}
                      >
                        <option value="before_due">到期前提醒</option>
                        <option value="due_date">到期时提醒</option>
                        <option value="overdue">逾期提醒</option>
                        <option value="custom">自定义时间</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">提醒时间</label>
                      <input
                        type="datetime-local"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={newReminder.reminder_time}
                        onChange={(e) => setNewReminder((r) => ({ ...r, reminder_time: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReminderForm(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleAddReminder}
                      disabled={!newReminder.reminder_time}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300"
                    >
                      添加
                    </button>
                  </div>
                </div>
              )}

              {/* 提醒列表 */}
              <div className="space-y-2">
                {task.reminders?.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">暂无提醒</div>
                ) : (
                  task.reminders?.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          reminder.is_sent ? 'bg-slate-100 text-slate-400' : 'bg-brand-100 text-brand-600'
                        }`}>
                          {reminder.is_sent ? '✓' : '⏰'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {reminder.reminder_type === 'before_due' && '到期前提醒'}
                            {reminder.reminder_type === 'due_date' && '到期时提醒'}
                            {reminder.reminder_type === 'overdue' && '逾期提醒'}
                            {reminder.reminder_type === 'custom' && '自定义提醒'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(reminder.reminder_time)}
                            {reminder.is_sent && ` · 已发送于 ${formatDate(reminder.sent_at)}`}
                          </p>
                        </div>
                      </div>
                      {!reminder.is_sent && (
                        <button
                          type="button"
                          onClick={() => handleDeleteReminder(reminder.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
