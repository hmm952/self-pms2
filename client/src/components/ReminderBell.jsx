import { useEffect, useState, useRef } from 'react';
import api from '../api/client.js';

const statusConfig = {
  todo: { label: '待办', color: 'bg-slate-100 text-slate-700' },
  in_progress: { label: '进行中', color: 'bg-blue-50 text-blue-700' },
  blocked: { label: '阻塞', color: 'bg-red-50 text-red-700' },
  done: { label: '完成', color: 'bg-green-50 text-green-700' },
};

export default function ReminderBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ reminders: [], overdue: [], upcoming: [] });
  const dropdownRef = useRef(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 加载提醒数据
  const loadReminders = async () => {
    setLoading(true);
    try {
      const { data: result } = await api.post('/api/reminders/check');
      setData(result);
    } catch {
      // 忽略错误
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReminders();
    }
  }, [isOpen]);

  // 定时刷新（每5分钟）
  useEffect(() => {
    const interval = setInterval(loadReminders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const total = data.reminders.length + data.overdue.length + data.upcoming.length;
  const urgentCount = data.reminders.length + data.overdue.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 铃铛按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {urgentCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
            {urgentCount > 9 ? '9+' : urgentCount}
          </span>
        )}
        {total > 0 && urgentCount === 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="font-semibold text-slate-900">提醒与预警</h3>
            <button
              type="button"
              onClick={loadReminders}
              className="text-xs text-brand-600 hover:underline"
            >
              刷新
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-500">加载中...</div>
            ) : total === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">暂无提醒</div>
            ) : (
              <>
                {/* 逾期任务 */}
                {data.overdue.length > 0 && (
                  <div className="border-b border-slate-100">
                    <div className="flex items-center gap-2 bg-red-50 px-4 py-2">
                      <span className="text-sm font-semibold text-red-700">
                        逾期任务 ({data.overdue.length})
                      </span>
                    </div>
                    {data.overdue.map((task) => (
                      <TaskItem key={task.id} task={task} type="overdue" />
                    ))}
                  </div>
                )}

                {/* 即将到期 */}
                {data.upcoming.length > 0 && (
                  <div className="border-b border-slate-100">
                    <div className="flex items-center gap-2 bg-orange-50 px-4 py-2">
                      <span className="text-sm font-semibold text-orange-700">
                        即将到期 ({data.upcoming.length})
                      </span>
                    </div>
                    {data.upcoming.map((task) => (
                      <TaskItem key={task.id} task={task} type="upcoming" />
                    ))}
                  </div>
                )}

                {/* 提醒 */}
                {data.reminders.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 bg-brand-50 px-4 py-2">
                      <span className="text-sm font-semibold text-brand-700">
                        待处理提醒 ({data.reminders.length})
                      </span>
                    </div>
                    {data.reminders.map((reminder) => (
                      <ReminderItem key={reminder.id} reminder={reminder} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 任务项组件
function TaskItem({ task, type }) {
  const isOverdue = type === 'overdue';

  return (
    <div className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 ${isOverdue ? 'bg-red-50/30' : ''}`}>
      <div className={`mt-0.5 h-2 w-2 rounded-full ${isOverdue ? 'bg-red-500' : 'bg-orange-500'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <span>{task.project_name}</span>
          <span>·</span>
          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
            截止: {task.due_date}
          </span>
        </div>
        {task.assignee_name && (
          <div className="mt-1 text-xs text-slate-500">负责人: {task.assignee_name}</div>
        )}
      </div>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${statusConfig[task.status]?.color || 'bg-slate-100 text-slate-600'}`}>
        {statusConfig[task.status]?.label || task.status}
      </span>
    </div>
  );
}

// 提醒项组件
function ReminderItem({ reminder }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
      <div className="mt-0.5 h-2 w-2 rounded-full bg-brand-500" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{reminder.task_title}</p>
        <div className="mt-1 text-xs text-slate-500">
          {reminder.reminder_type === 'before_due' && '到期前提醒'}
          {reminder.reminder_type === 'due_date' && '到期时提醒'}
          {reminder.reminder_type === 'overdue' && '逾期提醒'}
          {reminder.reminder_type === 'custom' && '自定义提醒'}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          提醒时间: {new Date(reminder.reminder_time).toLocaleString('zh-CN')}
        </div>
      </div>
    </div>
  );
}
