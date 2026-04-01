/**
 * 人力负载看板页面 - 前端本地模式
 * 
 * 说明：
 * - 使用前端内置模拟数据
 * - 不依赖后端API
 */
import { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { mockWorkloadData, mockUsers } from '../mockData.js';

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

// 负载状态颜色
const getLoadColor = (rate) => {
  if (rate > 100) return 'bg-red-500';
  if (rate > 80) return 'bg-orange-500';
  if (rate > 60) return 'bg-yellow-500';
  if (rate > 40) return 'bg-green-500';
  return 'bg-slate-300';
};

const getLoadTextColor = (rate) => {
  if (rate > 100) return 'text-red-700';
  if (rate > 80) return 'text-orange-700';
  if (rate > 60) return 'text-yellow-700';
  return 'text-green-700';
};

const getLoadLabel = (status) => {
  switch (status) {
    case 'overload': return '超负荷';
    case 'warning': return '预警';
    case 'normal': return '正常';
    default: return '正常';
  }
};

export default function WorkloadPage() {
  const { projectId, currentProject } = useProject();
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'chart'
  const [workloadData, setWorkloadData] = useState({ members: [], summary: {} });

  // 筛选条件
  const [filters, setFilters] = useState({
    startDate: getMonday(new Date()).toISOString().split('T')[0],
    endDate: getSunday(new Date()).toISOString().split('T')[0],
  });

  // 从模拟数据加载负载数据
  useEffect(() => {
    if (!projectId) {
      setWorkloadData({ members: [], summary: {} });
      return;
    }
    setWorkloadData(mockWorkloadData);
  }, [projectId]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">人力负载看板</h1>
          <p className="mt-1 text-sm text-slate-600">
            {currentProject?.name || '请选择项目'} · {filters.startDate} ~ {filters.endDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${viewMode === 'table' ? 'bg-brand-100 text-brand-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            列表视图
          </button>
          <button
            type="button"
            onClick={() => setViewMode('chart')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${viewMode === 'chart' ? 'bg-brand-100 text-brand-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            图表视图
          </button>
        </div>
      </div>

      {!projectId ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          请先选择项目
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-brand-600">
                {workloadData.summary?.totalMembers || 0}
              </div>
              <div className="mt-1 text-xs text-slate-500">团队成员</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-green-600">
                {workloadData.summary?.normalCount || 0}
              </div>
              <div className="mt-1 text-xs text-slate-500">负载正常</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-yellow-600">
                {workloadData.summary?.warningCount || 0}
              </div>
              <div className="mt-1 text-xs text-slate-500">负载预警</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-red-600">
                {workloadData.summary?.overloadCount || 0}
              </div>
              <div className="mt-1 text-xs text-slate-500">超负荷</div>
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

          {/* 列表视图 */}
          {viewMode === 'table' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">成员</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">角色</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">本周工时</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">负载率</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">状态</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">趋势</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workloadData.members.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        暂无负载数据
                      </td>
                    </tr>
                  ) : (
                    workloadData.members.map((member) => (
                      <tr key={member.userId} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
                              {member.userName?.charAt(0) || '?'}
                            </div>
                            <span className="font-medium text-slate-900">{member.userName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{member.role || '成员'}</td>
                        <td className="px-4 py-3 text-slate-900">{member.totalHours}h</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full ${getLoadColor(member.loadRate)}`}
                                style={{ width: `${Math.min(member.loadRate, 100)}%` }}
                              />
                            </div>
                            <span className={`text-sm font-medium ${getLoadTextColor(member.loadRate)}`}>
                              {member.loadRate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            member.status === 'overload' ? 'bg-red-100 text-red-700' :
                            member.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {getLoadLabel(member.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {/* 简化的趋势图 */}
                          <div className="flex items-end gap-0.5 h-6">
                            {member.weeklyHours?.map((h, i) => (
                              <div
                                key={i}
                                className="w-2 bg-brand-200 rounded-t"
                                style={{ height: `${(h / 12) * 100}%` }}
                              />
                            )) || <span className="text-slate-400 text-xs">—</span>}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 图表视图 */}
          {viewMode === 'chart' && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">负载分布图</h2>
              {workloadData.members.length === 0 ? (
                <div className="py-12 text-center text-slate-500">暂无数据</div>
              ) : (
                <div className="space-y-4">
                  {workloadData.members.map((member) => (
                    <div key={member.userId} className="flex items-center gap-4">
                      <div className="w-24 text-sm font-medium text-slate-700 truncate">
                        {member.userName}
                      </div>
                      <div className="flex-1">
                        <div className="h-8 overflow-hidden rounded-lg bg-slate-100 relative">
                          <div
                            className={`h-full transition-all ${getLoadColor(member.loadRate)}`}
                            style={{ width: `${Math.min(member.loadRate, 100)}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                            {member.loadRate}%
                          </span>
                        </div>
                      </div>
                      <div className="w-16 text-right text-sm text-slate-600">
                        {member.totalHours}h
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 提示信息 */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <strong>说明：</strong>负载率 = 本周工时 / 标准工时(40h) × 100%
            <br />
            负载状态：正常(&lt;80%)、预警(80-100%)、超负荷(&gt;100%)
          </div>
        </>
      )}
    </div>
  );
}
