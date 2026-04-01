/**
 * KPI考核页面 - 前端本地模式
 * 
 * 说明：
 * - 使用前端内置模拟数据
 * - 不依赖后端API
 */
import { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { mockKpiRecords, mockUsers } from '../mockData.js';

export default function KpiPage() {
  const { projectId, currentProject } = useProject();
  const [items, setItems] = useState([]);
  const [users] = useState(mockUsers);
  const now = new Date();
  const [form, setForm] = useState({
    metric_name: '',
    metric_unit: '',
    period_year: now.getFullYear(),
    period_month: now.getMonth() + 1,
    target_value: '',
    actual_value: '',
    score: '',
  });
  const [msg, setMsg] = useState('');

  // 从模拟数据加载KPI记录
  useEffect(() => {
    if (!projectId) {
      setItems([]);
      return;
    }
    const projectKpi = mockKpiRecords
      .filter(k => k.project_id === projectId)
      .map(k => {
        const user = mockUsers.find(u => u.id === k.user_id);
        return {
          ...k,
          user_name: user?.full_name || user?.username || null,
        };
      });
    setItems(projectKpi);
  }, [projectId]);

  // 创建KPI记录（本地模式）
  const onSubmit = (e) => {
    e.preventDefault();
    setMsg('');
    if (!projectId) return;
    
    const newId = Math.max(...items.map(k => k.id), 0) + 1;
    const newKpi = {
      id: newId,
      project_id: projectId,
      user_id: 1,
      user_name: '张三',
      metric_name: form.metric_name,
      metric_unit: form.metric_unit || null,
      period_year: Number(form.period_year),
      period_month: Number(form.period_month),
      target_value: form.target_value === '' ? null : Number(form.target_value),
      actual_value: form.actual_value === '' ? null : Number(form.actual_value),
      score: form.score === '' ? null : Number(form.score),
      created_at: new Date().toISOString(),
    };
    
    setItems([...items, newKpi]);
    setForm((f) => ({
      ...f,
      metric_name: '',
      metric_unit: '',
      target_value: '',
      actual_value: '',
      score: '',
    }));
  };

  // 按月份分组
  const itemsByMonth = items.reduce((acc, item) => {
    const key = `${item.period_year}-${String(item.period_month).padStart(2, '0')}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // 计算统计数据
  const stats = {
    total: items.length,
    avgScore: items.length > 0 
      ? (items.reduce((sum, k) => sum + (k.score || 0), 0) / items.length).toFixed(1)
      : 0,
    aboveTarget: items.filter(k => k.actual_value >= k.target_value).length,
    belowTarget: items.filter(k => k.actual_value < k.target_value).length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">人力与 KPI</h1>
        <p className="mt-1 text-sm text-slate-600">
          {currentProject?.name || '请选择项目'} · 按项目维度记录指标达成
        </p>
      </div>

      {!projectId ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          请先选择项目。
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-brand-600">{stats.total}</div>
              <div className="mt-1 text-xs text-slate-500">KPI记录</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-green-600">{stats.avgScore}</div>
              <div className="mt-1 text-xs text-slate-500">平均得分</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-blue-600">{stats.aboveTarget}</div>
              <div className="mt-1 text-xs text-slate-500">达标</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-red-600">{stats.belowTarget}</div>
              <div className="mt-1 text-xs text-slate-500">未达标</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">指标</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">人员</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">周期</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">目标/实际</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">得分</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      暂无 KPI 记录
                    </td>
                  </tr>
                ) : (
                  items.map((k) => (
                    <tr key={k.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {k.metric_name}
                        {k.metric_unit && (
                          <span className="ml-1 text-xs text-slate-500">({k.metric_unit})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{k.user_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {k.period_year}/{String(k.period_month).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="font-medium">{k.target_value ?? '—'}</span>
                        <span className="mx-1">/</span>
                        <span className={k.actual_value >= k.target_value ? 'text-green-600 font-medium' : 'text-red-600'}>
                          {k.actual_value ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${k.score >= 80 ? 'text-green-600' : k.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {k.score ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('确定要删除这条KPI记录吗？')) {
                              setItems(items.filter(item => item.id !== k.id));
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

          {/* 新建KPI表单 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">新建 KPI 记录</h2>
            <form onSubmit={onSubmit} className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">指标名称 *</label>
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.metric_name}
                  onChange={(e) => setForm({ ...form, metric_name: e.target.value })}
                  placeholder="如：代码质量评分"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">计量单位</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.metric_unit}
                  onChange={(e) => setForm({ ...form, metric_unit: e.target.value })}
                  placeholder="如：分、件、小时"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">周期（年月）</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.period_year}
                    onChange={(e) => setForm({ ...form, period_year: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    min="1"
                    max="12"
                    className="w-16 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.period_month}
                    onChange={(e) => setForm({ ...form, period_month: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">目标值</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.target_value}
                  onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                  placeholder="目标值"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">实际值</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.actual_value}
                  onChange={(e) => setForm({ ...form, actual_value: e.target.value })}
                  placeholder="实际值"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">得分</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.score}
                  onChange={(e) => setForm({ ...form, score: e.target.value })}
                  placeholder="0-100"
                />
              </div>
              <div className="col-span-3 flex justify-end gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  创建记录
                </button>
              </div>
            </form>
            {msg && (
              <div className="mt-2 text-sm text-red-600">{msg}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
