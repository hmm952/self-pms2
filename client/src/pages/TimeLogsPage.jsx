/**
 * 工时填报页面 - 前端本地模式
 * 
 * 说明：
 * - 使用前端内置模拟数据
 * - 不依赖后端API
 */
import { useEffect, useState, useMemo } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { mockTimeLogs, mockUsers, mockTasks } from '../mockData.js';

const workTypeConfig = {
  development: { label: '开发', color: 'bg-blue-100 text-blue-700' },
  meeting: { label: '会议', color: 'bg-purple-100 text-purple-700' },
  review: { label: '评审', color: 'bg-orange-100 text-orange-700' },
  testing: { label: '测试', color: 'bg-green-100 text-green-700' },
  documentation: { label: '文档', color: 'bg-cyan-100 text-cyan-700' },
  other: { label: '其他', color: 'bg-slate-100 text-slate-700' },
};

const statusConfig = {
  draft: { label: '草稿', color: 'bg-slate-100 text-slate-600' },
  submitted: { label: '已提交', color: 'bg-blue-50 text-blue-700' },
  approved: { label: '已审批', color: 'bg-green-50 text-green-700' },
  rejected: { label: '已驳回', color: 'bg-red-50 text-red-700' },
};

// 获取周一
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

// 获取周日
function getSunday(d) {
  const monday = getMonday(d);
  return new Date(monday.setDate(monday.getDate() + 6));
}

export default function TimeLogsPage() {
  const { projectId, currentProject } = useProject();
  const { user } = useAuth();
  const [timeLogs, setTimeLogs] = useState([]);
  const [msg, setMsg] = useState('');

  // 筛选条件
  const [filters, setFilters] = useState({
    startDate: getMonday(new Date()).toISOString().split('T')[0],
    endDate: getSunday(new Date()).toISOString().split('T')[0],
    userId: '',
  });

  // 填报表单
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    hours: 8,
    work_type: 'development',
    task_id: '',
    description: '',
  });

  // 从模拟数据加载工时
  useEffect(() => {
    if (!projectId) {
      setTimeLogs([]);
      return;
    }
    
    // 筛选当前项目的工时记录并添加关联信息
    const projectTimeLogs = mockTimeLogs
      .filter(t => t.project_id === projectId)
      .map(log => {
        const task = mockTasks.find(t => t.id === log.task_id);
        const user = mockUsers.find(u => u.id === log.user_id);
        return {
          ...log,
          task_title: task?.title || null,
          user_name: user?.full_name || user?.username || null,
        };
      });
    setTimeLogs(projectTimeLogs);
  }, [projectId]);

  // 计算周视图
  const weekDays = useMemo(() => {
    const start = new Date(filters.startDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLogs = timeLogs.filter((t) => t.work_date === dateStr);
      const totalHours = dayLogs.reduce((sum, t) => sum + t.hours, 0);
      days.push({
        date: dateStr,
        dayName: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()],
        isToday: dateStr === new Date().toISOString().split('T')[0],
        logs: dayLogs,
        totalHours,
      });
    }
    return days;
  }, [timeLogs, filters.startDate]);

  // 提交工时
  const handleSubmit = (e) => {
    e.preventDefault();
    setMsg('');
    
    const newId = Math.max(...timeLogs.map(t => t.id), 0) + 1;
    const task = mockTasks.find(t => t.id === Number(formData.task_id));
    
    const newLog = {
      id: newId,
      project_id: projectId,
      user_id: 1,
      user_name: user?.full_name || '张三',
      work_date: formData.work_date,
      hours: Number(formData.hours),
      work_type: formData.work_type,
      task_id: formData.task_id ? Number(formData.task_id) : null,
      task_title: task?.title || null,
      description: formData.description || null,
      status: 'draft',
      created_at: new Date().toISOString(),
    };
    
    setTimeLogs([...timeLogs, newLog]);
    setShowForm(false);
    setFormData({
      work_date: new Date().toISOString().split('T')[0],
      hours: 8,
      work_type: 'development',
      task_id: '',
      description: '',
    });
  };

  // 统计数据
  const stats = {
    totalHours: timeLogs.reduce((sum, t) => sum + t.hours, 0),
    totalLogs: timeLogs.length,
    avgHours: timeLogs.length > 0 
      ? (timeLogs.reduce((sum, t) => sum + t.hours, 0) / 7).toFixed(1)
      : 0,
  };

  // 当前项目的任务
  const projectTasks = mockTasks.filter(t => t.project_id === projectId);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">工时填报</h1>
          <p className="mt-1 text-sm text-slate-600">
            {currentProject?.name || '请选择项目'} · 本周工时: {stats.totalHours}小时
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + 填报工时
        </button>
      </div>

      {!projectId ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          请先选择项目
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-brand-600">{stats.totalHours}</div>
              <div className="mt-1 text-xs text-slate-500">本周总工时</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-green-600">{stats.avgHours}</div>
              <div className="mt-1 text-xs text-slate-500">日均工时</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-slate-600">{stats.totalLogs}</div>
              <div className="mt-1 text-xs text-slate-500">填报记录</div>
            </div>
          </div>

          {/* 筛选栏 */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <span className="text-sm font-medium text-slate-700">日期范围：</span>
            <input
              type="date"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
            <span className="text-slate-400">~</span>
            <input
              type="date"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>

          {/* 周视图 */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 divide-x divide-slate-200">
              {weekDays.map((day) => (
                <div key={day.date} className={`p-2 ${day.isToday ? 'bg-brand-50' : ''}`}>
                  <div className="text-center mb-2">
                    <div className="text-xs text-slate-500">{day.dayName}</div>
                    <div className={`text-sm font-medium ${day.isToday ? 'text-brand-600' : 'text-slate-900'}`}>
                      {day.date.split('-')[2]}
                    </div>
                    <div className="text-xs font-medium text-slate-600 mt-1">
                      {day.totalHours}h
                    </div>
                  </div>
                  <div className="space-y-1">
                    {day.logs.slice(0, 3).map((log) => (
                      <div
                        key={log.id}
                        className={`rounded px-1.5 py-0.5 text-xs truncate ${workTypeConfig[log.work_type]?.color || 'bg-slate-100'}`}
                        title={`${log.description || log.work_type} - ${log.hours}小时`}
                      >
                        {log.hours}h {workTypeConfig[log.work_type]?.label || log.work_type}
                      </div>
                    ))}
                    {day.logs.length > 3 && (
                      <div className="text-xs text-slate-400 text-center">
                        +{day.logs.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 工时列表 */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">日期</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">类型</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">时长</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">关联任务</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">描述</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">状态</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      暂无工时记录
                    </td>
                  </tr>
                ) : (
                  timeLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 text-slate-900">{log.work_date}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${workTypeConfig[log.work_type]?.color || 'bg-slate-100'}`}>
                          {workTypeConfig[log.work_type]?.label || log.work_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{log.hours}h</td>
                      <td className="px-4 py-3 text-slate-600">{log.task_title || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{log.description || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig[log.status]?.color || 'bg-slate-100'}`}>
                          {statusConfig[log.status]?.label || log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('确定要删除这条工时记录吗？')) {
                              setTimeLogs(timeLogs.filter(t => t.id !== log.id));
                            }
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
        </>
      )}

      {/* 填报工时弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">填报工时</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">工作日期</label>
                  <input
                    type="date"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={formData.work_date}
                    onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">工作时长（小时）</label>
                  <input
                    type="number"
                    required
                    min="0.5"
                    max="24"
                    step="0.5"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700">工作类型</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={formData.work_type}
                  onChange={(e) => setFormData({ ...formData, work_type: e.target.value })}
                >
                  {Object.entries(workTypeConfig).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700">关联任务</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={formData.task_id}
                  onChange={(e) => setFormData({ ...formData, task_id: e.target.value })}
                >
                  <option value="">不关联</option>
                  {projectTasks.map((task) => (
                    <option key={task.id} value={task.id}>{task.title}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700">工作描述</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="描述工作内容..."
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  提交
                </button>
              </div>
            </form>
            {msg && <div className="mt-2 text-sm text-red-600">{msg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
