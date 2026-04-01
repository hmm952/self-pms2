import { useEffect, useState, useCallback } from 'react';
import api from '../api/client.js';
import { useProject } from '../context/ProjectContext.jsx';

export default function KpiV2Page() {
  const { projectId, currentProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // 当前期间
  const now = new Date();
  const [period, setPeriod] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  // 数据
  const [metrics, setMetrics] = useState([]);
  const [dashboard, setDashboard] = useState({ metrics: [], ranking: [], trend: { months: [], data: [] }, summary: {} });
  const [snapshots, setSnapshots] = useState([]);
  const [reports, setReports] = useState([]);

  // 视图模式
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'metrics' | 'snapshots' | 'reports'

  // 加载指标库
  const loadMetrics = useCallback(async () => {
    try {
      const { data } = await api.get('/api/kpi-v2/metrics');
      setMetrics(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 加载仪表盘
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = { periodYear: period.year, periodMonth: period.month };
      if (projectId) params.projectId = projectId;

      const { data } = await api.get('/api/kpi-v2/dashboard', { params });
      setDashboard(data);
    } finally {
      setLoading(false);
    }
  }, [projectId, period]);

  // 加载快照
  const loadSnapshots = useCallback(async () => {
    try {
      const params = { periodYear: period.year, periodMonth: period.month };
      if (projectId) params.projectId = projectId;

      const { data } = await api.get('/api/kpi-v2/snapshots', { params });
      setSnapshots(data);
    } catch (err) {
      console.error(err);
    }
  }, [projectId, period]);

  // 加载报告
  const loadReports = useCallback(async () => {
    try {
      const params = {};
      if (projectId) params.projectId = projectId;

      const { data } = await api.get('/api/kpi-v2/reports', { params });
      setReports(data);
    } catch (err) {
      console.error(err);
    }
  }, [projectId]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadDashboard();
    loadSnapshots();
  }, [loadDashboard, loadSnapshots]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // 执行核算
  const handleCalculate = async () => {
    if (!window.confirm(`确认核算 ${period.year}年${period.month}月 的KPI数据？`)) return;
    setMsg('');
    setLoading(true);
    try {
      const payload = { periodYear: period.year, periodMonth: period.month };
      if (projectId) payload.projectId = projectId;

      const { data } = await api.post('/api/kpi-v2/calculate', payload);
      setMsg(`核算完成，共计算 ${data.results_count} 条记录`);
      loadDashboard();
      loadSnapshots();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 生成报告
  const handleGenerateReport = async () => {
    if (!window.confirm(`确认生成 ${period.year}年${period.month}月 的KPI考核报告？`)) return;
    setMsg('');
    try {
      const payload = { periodYear: period.year, periodMonth: period.month };
      if (projectId) payload.projectId = projectId;

      const { data } = await api.post('/api/kpi-v2/reports', payload);
      setMsg(`报告生成成功，平均得分：${data.report.total_score}分`);
      loadReports();
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 导出报告
  const handleExportReport = async (reportId) => {
    try {
      const report = reports.find((r) => r.id === reportId);
      if (!report) return;

      // 生成文本报告
      let content = `KPI 考核报告\n${'='.repeat(50)}\n\n`;
      content += `项目: ${report.project_name || '全部项目'}\n`;
      content += `期间: ${report.period_year}年${report.period_month}月\n`;
      content += `类型: ${report.report_type === 'monthly' ? '月度报告' : report.report_type}\n`;
      content += `总分: ${report.total_score || '-'}分\n`;
      content += `生成时间: ${report.generated_at}\n\n`;
      content += `摘要:\n${report.summary || '暂无'}\n`;

      // 下载
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `KPI报告_${report.period_year}年${report.period_month}月.txt`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">KPI 自动核算</h1>
          <p className="mt-1 text-sm text-slate-600">
            {currentProject?.name || '全部项目'} · {period.year}年{period.month}月
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            value={period.year}
            onChange={(e) => setPeriod((p) => ({ ...p, year: Number(e.target.value) }))}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            value={period.month}
            onChange={(e) => setPeriod((p) => ({ ...p, month: Number(e.target.value) }))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCalculate}
            disabled={loading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-brand-300"
          >
            {loading ? '核算中...' : '一键核算'}
          </button>
          <button
            type="button"
            onClick={handleGenerateReport}
            className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
          >
            生成报告
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          {msg}
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex border-b border-slate-200">
        {[
          { key: 'dashboard', label: '仪表盘' },
          { key: 'metrics', label: '指标库' },
          { key: 'snapshots', label: '核算记录' },
          { key: 'reports', label: '考核报告' },
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

      {/* 仪表盘 */}
      {activeTab === 'dashboard' && (
        <>
          {/* 汇总卡片 */}
          <div className="grid grid-cols-4 gap-4">
            <SummaryCard
              label="指标数量"
              value={dashboard.summary.total_metrics || metrics.length}
            />
            <SummaryCard
              label="平均得分"
              value={dashboard.summary.avg_score?.toFixed(1) || '-'}
              suffix="分"
              color="brand"
            />
            <SummaryCard
              label="达标指标"
              value={dashboard.summary.achieved_count || 0}
              suffix={`/ ${dashboard.summary.total_metrics || metrics.length}`}
              color="green"
            />
            <SummaryCard
              label="核算期间"
              value={`${period.year}-${String(period.month).padStart(2, '0')}`}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* 指标完成情况 */}
            <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-700">指标完成情况</h3>
              <div className="mt-4 space-y-3">
                {dashboard.metrics.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    暂无数据，请先执行核算
                  </div>
                ) : (
                  dashboard.metrics.map((m) => (
                    <div key={m.id} className="flex items-center gap-4">
                      <div className="w-32 text-sm text-slate-700">{m.name}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>实际: {m.avg_actual?.toFixed(1) || '-'}{m.unit}</span>
                          <span>目标: {m.target_value}{m.unit}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full transition-all ${
                              (m.avg_score || 0) >= 100
                                ? 'bg-green-500'
                                : (m.avg_score || 0) >= 80
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, m.avg_score || 0)}%` }}
                          />
                        </div>
                      </div>
                      <div className={`w-16 text-right text-sm font-medium ${
                        (m.avg_score || 0) >= 100 ? 'text-green-600' : (m.avg_score || 0) >= 80 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {m.avg_score?.toFixed(0) || '-'}%
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 趋势图 */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-700">得分趋势</h3>
              <div className="mt-4">
                <div className="flex h-40 items-end gap-2">
                  {dashboard.trend.data.map((value, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-brand-400"
                        style={{ height: `${Math.min(100, value)}%` }}
                      />
                      <span className="text-xs text-slate-500">{dashboard.trend.months[i]?.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 排名 */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700">KPI 排名</h3>
            <div className="mt-4 grid grid-cols-5 gap-4">
              {dashboard.ranking.length === 0 ? (
                <div className="col-span-5 py-8 text-center text-sm text-slate-500">
                  暂无排名数据
                </div>
              ) : (
                dashboard.ranking.map((r, i) => (
                  <div key={r.user_id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-yellow-400 text-yellow-900' :
                        i === 1 ? 'bg-slate-300 text-slate-700' :
                        i === 2 ? 'bg-orange-300 text-orange-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="text-sm font-medium text-slate-900">{r.user_name}</div>
                    </div>
                    <div className="mt-2 text-center">
                      <div className="text-2xl font-semibold text-brand-600">{r.weighted_score?.toFixed(1)}</div>
                      <div className="text-xs text-slate-500">加权得分</div>
                    </div>
                    <div className="mt-1 text-center text-xs text-slate-500">
                      {r.metric_count} 个指标
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* 指标库 */}
      {activeTab === 'metrics' && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-sm font-semibold text-slate-700">KPI 指标库</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">指标名称</th>
                  <th className="px-4 py-3 text-left font-medium">代码</th>
                  <th className="px-4 py-3 text-center font-medium">类别</th>
                  <th className="px-4 py-3 text-center font-medium">权重</th>
                  <th className="px-4 py-3 text-center font-medium">目标值</th>
                  <th className="px-4 py-3 text-center font-medium">计算方式</th>
                  <th className="px-4 py-3 text-left font-medium">公式</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      暂无指标
                    </td>
                  </tr>
                ) : (
                  metrics.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{m.name}</div>
                        <div className="text-xs text-slate-500">{m.description}</div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{m.code}</code>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                          m.category === 'project' ? 'bg-blue-100 text-blue-700' :
                          m.category === 'personal' ? 'bg-green-100 text-green-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {m.category === 'project' ? '项目' : m.category === 'personal' ? '个人' : m.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{m.weight}%</td>
                      <td className="px-4 py-3 text-center">{m.target_value}{m.unit}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded px-2 py-0.5 text-xs ${
                          m.calculation_method === 'manual' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'
                        }`}>
                          {m.calculation_method === 'manual' ? '手动' : '自动'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{m.formula || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 核算记录 */}
      {activeTab === 'snapshots' && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-sm font-semibold text-slate-700">核算记录 · {period.year}年{period.month}月</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">成员</th>
                  <th className="px-4 py-3 text-left font-medium">指标</th>
                  <th className="px-4 py-3 text-center font-medium">目标值</th>
                  <th className="px-4 py-3 text-center font-medium">实际值</th>
                  <th className="px-4 py-3 text-center font-medium">得分</th>
                  <th className="px-4 py-3 text-center font-medium">权重</th>
                  <th className="px-4 py-3 text-center font-medium">核算时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshots.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      暂无核算记录，请先执行核算
                    </td>
                  </tr>
                ) : (
                  snapshots.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900">{s.user_name || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{s.metric_name}</div>
                        <div className="text-xs text-slate-500">{s.category}</div>
                      </td>
                      <td className="px-4 py-3 text-center">{s.target_value}{s.unit}</td>
                      <td className="px-4 py-3 text-center font-medium">{s.actual_value?.toFixed(1) || '-'}{s.unit}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${
                          (s.score || 0) >= 100 ? 'text-green-600' :
                          (s.score || 0) >= 80 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {s.score?.toFixed(0) || '-'}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{s.weight}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">{s.calculated_at}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 考核报告 */}
      {activeTab === 'reports' && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-sm font-semibold text-slate-700">考核报告</span>
          </div>
          <div className="divide-y divide-slate-100">
            {reports.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                暂无报告，请先生成
              </div>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {r.period_year}年{r.period_month}月 KPI报告
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${
                        r.status === 'published' ? 'bg-green-100 text-green-700' :
                        r.status === 'draft' ? 'bg-slate-100 text-slate-600' :
                        'bg-slate-50 text-slate-500'
                      }`}>
                        {r.status === 'published' ? '已发布' : r.status === 'draft' ? '草稿' : r.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {r.project_name || '全部项目'} · 总分 {r.total_score}分 · {r.generated_at}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-lg font-semibold text-brand-600">{r.total_score}</div>
                      <div className="text-xs text-slate-500">分</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExportReport(r.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      导出
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 汇总卡片
function SummaryCard({ label, value, suffix = '', color = 'slate' }) {
  const colorMap = {
    brand: 'text-brand-600',
    slate: 'text-slate-700',
    green: 'text-green-600',
    red: 'text-red-600',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
      <div className={`text-2xl font-semibold ${colorMap[color]}`}>
        {value}
        <span className="text-sm font-normal">{suffix}</span>
      </div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}
