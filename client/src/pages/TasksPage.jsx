/**
 * 任务管理页面 - 前端本地模式
 * 
 * 说明：
 * - 使用前端内置模拟数据
 * - 不依赖后端API
 * - 支持看板和列表两种视图
 */
import { useEffect, useState, useMemo } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import {
  mockTasks,
  mockUsers,
  mockMilestones,
} from '../mockData.js';

const statusConfig = {
  todo: { label: '待办', color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  in_progress: { label: '进行中', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  blocked: { label: '阻塞', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  done: { label: '完成', color: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
};

const priorityConfig = {
  low: { label: '低', color: 'text-slate-500' },
  medium: { label: '中', color: 'text-blue-600' },
  high: { label: '高', color: 'text-orange-600' },
  critical: { label: '紧急', color: 'text-red-600' },
};

export default function TasksPage() {
  const { projectId, currentProject } = useProject();
  const [tasks, setTasks] = useState([]);
  const [users] = useState(mockUsers);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'
  const [msg, setMsg] = useState('');

  // 筛选状态
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assignee_id: '',
    overdue: false,
  });

  // 新建任务表单
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignee_id: '',
    due_date: '',
  });

  // 选中的任务ID
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // 从模拟数据加载任务
  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      return;
    }
    // 筛选当前项目的任务，并添加关联数据
    const projectTasks = mockTasks
      .filter(t => t.project_id === projectId)
      .map(task => {
        const milestone = mockMilestones.find(m => m.id === task.milestone_id);
        const assignee = mockUsers.find(u => u.id === task.assignee_id);
        return {
          ...task,
          milestone_name: milestone?.name || null,
          assignee_name: assignee?.full_name || assignee?.username || null,
        };
      });
    setTasks(projectTasks);
  }, [projectId]);

  // 创建任务（本地模式）
  const handleCreateTask = (e) => {
    e.preventDefault();
    setMsg('');
    if (!projectId) return;
    
    // 生成新的任务ID
    const newId = Math.max(...tasks.map(t => t.id), 0) + 1;
    const milestone = mockMilestones.find(m => m.id === Number(createForm.milestone_id));
    const assignee = mockUsers.find(u => u.id === Number(createForm.assignee_id));
    
    const newTask = {
      id: newId,
      project_id: projectId,
      title: createForm.title,
      description: createForm.description,
      status: createForm.status,
      priority: createForm.priority,
      assignee_id: createForm.assignee_id ? Number(createForm.assignee_id) : null,
      assignee_name: assignee?.full_name || assignee?.username || null,
      milestone_id: createForm.milestone_id ? Number(createForm.milestone_id) : null,
      milestone_name: milestone?.name || null,
      due_date: createForm.due_date || null,
      progress: 0,
      created_at: new Date().toISOString(),
    };
    
    setTasks([...tasks, newTask]);
    setCreateForm({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      assignee_id: '',
      due_date: '',
    });
    setShowCreateForm(false);
  };

  // 更新任务状态
  const handleStatusChange = (taskId, newStatus) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, status: newStatus } : task
    ));
  };

  // 删除任务
  const handleDeleteTask = (id) => {
    if (!window.confirm('确定要删除这个任务吗？')) return;
    setTasks(tasks.filter(t => t.id !== id));
    setSelectedTaskId(null);
  };

  // 按状态分组（看板视图）
  const tasksByStatus = useMemo(() => {
    const grouped = { todo: [], in_progress: [], blocked: [], done: [] };
    tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });
    return grouped;
  }, [tasks]);

  // 检查是否逾期
  const isOverdue = (task) => {
    return task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
  };

  // 清空筛选
  const clearFilters = () => {
    setFilters({ status: '', priority: '', assignee_id: '', overdue: false });
  };

  // 筛选后的任务列表（列表视图用）
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.status && task.status !== filters.status) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.assignee_id && task.assignee_id !== Number(filters.assignee_id)) return false;
      if (filters.overdue && !isOverdue(task)) return false;
      return true;
    });
  }, [tasks, filters]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">任务管理</h1>
          <p className="mt-1 text-sm text-slate-600">
            {currentProject?.name || '请选择项目'} · 共 {tasks.length} 个任务
            {filters.overdue && ` · ${tasks.filter(isOverdue).length} 个逾期`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 视图切换 */}
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              看板
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              列表
            </button>
          </div>
          {/* 新建按钮 */}
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + 新建任务
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {msg}
        </div>
      )}

      {!projectId ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          请先选择项目
        </div>
      ) : (
        <>
          {/* 筛选栏 */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <span className="text-sm font-medium text-slate-700">筛选：</span>
            
            <select
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">全部状态</option>
              {Object.entries(statusConfig).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <select
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              value={filters.priority}
              onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
            >
              <option value="">全部优先级</option>
              {Object.entries(priorityConfig).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <select
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              value={filters.assignee_id}
              onChange={(e) => setFilters((f) => ({ ...f, assignee_id: e.target.value }))}
            >
              <option value="">全部责任人</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.overdue}
                onChange={(e) => setFilters((f) => ({ ...f, overdue: e.target.checked }))}
                className="rounded border-slate-300"
              />
              <span className="text-slate-700">仅显示逾期</span>
            </label>

            {(filters.status || filters.priority || filters.assignee_id || filters.overdue) && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-brand-600 hover:underline"
              >
                清空筛选
              </button>
            )}
          </div>

          {/* 看板视图 */}
          {viewMode === 'kanban' && (
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(statusConfig).map(([status, config]) => (
                <div key={status} className="flex flex-col">
                  {/* 列标题 */}
                  <div className="mb-2 flex items-center justify-between rounded-lg bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
                      <span className="text-sm font-semibold text-slate-700">{config.label}</span>
                      <span className="text-xs text-slate-400">
                        {tasksByStatus[status].length}
                      </span>
                    </div>
                  </div>

                  {/* 任务列表 */}
                  <div className="flex-1 space-y-2 rounded-lg bg-slate-100/50 p-2">
                    {tasksByStatus[status].length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-400">暂无任务</div>
                    ) : (
                      tasksByStatus[status].map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          isOverdue={isOverdue(task)}
                          onClick={() => setSelectedTaskId(task.id)}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDeleteTask}
                          priorityConfig={priorityConfig}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 列表视图 */}
          {viewMode === 'list' && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">任务</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">状态</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">优先级</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">责任人</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">截止日期</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">进度</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        暂无任务
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => (
                      <tr
                        key={task.id}
                        className={`cursor-pointer hover:bg-slate-50/80 ${
                          isOverdue(task) ? 'bg-red-50/30' : ''
                        }`}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{task.title}</div>
                          {task.milestone_name && (
                            <div className="mt-0.5 text-xs text-slate-500">
                              {task.milestone_name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig[task.status].color}`}>
                            {statusConfig[task.status].label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${priorityConfig[task.priority].color}`}>
                            {priorityConfig[task.priority].label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {task.assignee_name || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={isOverdue(task) ? 'text-red-600 font-medium' : 'text-slate-600'}>
                            {task.due_date || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full bg-brand-600"
                                style={{ width: `${task.progress || 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">{task.progress || 0}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }}
                            className="text-xs text-red-600 hover:underline"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 新建任务弹窗 */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">新建任务</h2>
            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">任务标题 *</label>
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="输入任务标题"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">描述</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="输入任务描述"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">状态</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={createForm.status}
                    onChange={(e) => setCreateForm((f) => ({ ...f, status: e.target.value }))}
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
                    value={createForm.priority}
                    onChange={(e) => setCreateForm((f) => ({ ...f, priority: e.target.value }))}
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
                    value={createForm.assignee_id}
                    onChange={(e) => setCreateForm((f) => ({ ...f, assignee_id: e.target.value }))}
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
                    value={createForm.due_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, due_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 任务详情弹窗 */}
      {selectedTaskId && (
        <TaskDetailModal
          task={tasks.find(t => t.id === selectedTaskId)}
          users={users}
          statusConfig={statusConfig}
          priorityConfig={priorityConfig}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={(updatedTask) => {
            setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
          }}
          onDeleted={() => {
            setSelectedTaskId(null);
            handleDeleteTask(selectedTaskId);
          }}
        />
      )}
    </div>
  );
}

// 任务卡片组件
function TaskCard({ task, isOverdue, onClick, onStatusChange, onDelete, priorityConfig }) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`group relative cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${
        isOverdue ? 'border-red-200' : 'border-slate-200'
      }`}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* 标题与优先级 */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-900 line-clamp-2">{task.title}</h3>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${priorityConfig[task.priority].color} bg-slate-100`}>
          {priorityConfig[task.priority].label}
        </span>
      </div>

      {/* 里程碑 */}
      {task.milestone_name && (
        <div className="mt-1 text-xs text-slate-500">{task.milestone_name}</div>
      )}

      {/* 进度条 */}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-brand-600 transition-all"
            style={{ width: `${task.progress || 0}%` }}
          />
        </div>
        <span className="text-xs text-slate-400">{task.progress || 0}%</span>
      </div>

      {/* 底部信息 */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 责任人 */}
          {task.assignee_name ? (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700">
              {task.assignee_name.charAt(0).toUpperCase()}
            </div>
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-400">
              ?
            </div>
          )}
        </div>

        {/* 截止日期 */}
        <div className="flex items-center gap-1 text-xs">
          {task.due_date && (
            <span className={isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'}>
              {task.due_date}
            </span>
          )}
        </div>
      </div>

      {/* 快速操作按钮 */}
      {showActions && (
        <div className="absolute right-2 top-2 flex gap-1">
          {task.status !== 'done' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(task.id, 'done');
              }}
              className="rounded bg-green-500 px-2 py-1 text-xs text-white hover:bg-green-600"
            >
              完成
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
          >
            删除
          </button>
        </div>
      )}
    </div>
  );
}

// 任务详情弹窗组件
function TaskDetailModal({ task, users, statusConfig, priorityConfig, onClose, onUpdated, onDeleted }) {
  const [form, setForm] = useState({ ...task });
  
  if (!task) return null;

  const handleSave = () => {
    const assignee = users.find(u => u.id === Number(form.assignee_id));
    onUpdated({
      ...form,
      assignee_name: assignee?.full_name || assignee?.username || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">任务详情</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">任务标题</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700">描述</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">状态</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
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
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {Object.entries(priorityConfig).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700">进度</label>
              <input
                type="number"
                min="0"
                max="100"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.progress || 0}
                onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">责任人</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.assignee_id || ''}
                onChange={(e) => setForm({ ...form, assignee_id: e.target.value ? Number(e.target.value) : null })}
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
                value={form.due_date || ''}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('确定要删除这个任务吗？')) {
                onDeleted();
              }
            }}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            删除任务
          </button>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
