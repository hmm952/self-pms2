/**
 * 竞品分析页面 - 前端本地模式
 * 
 * 说明：
 * - 使用前端内置模拟数据
 * - 不依赖后端API
 */
import { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { mockCompetitors } from '../mockData.js';

const threatConfig = {
  low: { label: '低', color: 'bg-green-100 text-green-700' },
  medium: { label: '中', color: 'bg-yellow-100 text-yellow-700' },
  high: { label: '高', color: 'bg-red-100 text-red-700' },
};

export default function CompetitorsPage() {
  const { projectId, currentProject } = useProject();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    name: '',
    model_or_line: '',
    price_position: '',
    threat_level: 'medium',
    key_features: '',
    gap_analysis: '',
  });
  const [msg, setMsg] = useState('');
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);

  // 从模拟数据加载竞品
  useEffect(() => {
    if (!projectId) {
      setItems([]);
      return;
    }
    const projectCompetitors = mockCompetitors.filter(c => c.project_id === projectId);
    setItems(projectCompetitors);
  }, [projectId]);

  // 创建竞品（本地模式）
  const onSubmit = (e) => {
    e.preventDefault();
    setMsg('');
    if (!projectId) return;
    
    const newId = Math.max(...items.map(c => c.id), 0) + 1;
    const newCompetitor = {
      id: newId,
      project_id: projectId,
      name: form.name,
      model_or_line: form.model_or_line || null,
      price_position: form.price_position || null,
      threat_level: form.threat_level,
      key_features: form.key_features || null,
      gap_analysis: form.gap_analysis || null,
      created_at: new Date().toISOString(),
    };
    
    setItems([...items, newCompetitor]);
    setForm({
      name: '',
      model_or_line: '',
      price_position: '',
      threat_level: 'medium',
      key_features: '',
      gap_analysis: '',
    });
  };

  // 统计数据
  const stats = {
    total: items.length,
    high: items.filter(c => c.threat_level === 'high').length,
    medium: items.filter(c => c.threat_level === 'medium').length,
    low: items.filter(c => c.threat_level === 'low').length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">竞品分析</h1>
        <p className="mt-1 text-sm text-slate-600">
          {currentProject?.name || '请选择项目'} · 对标机型、价格带与能力差距
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
              <div className="mt-1 text-xs text-slate-500">竞品总数</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-red-600">{stats.high}</div>
              <div className="mt-1 text-xs text-slate-500">高威胁</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-yellow-600">{stats.medium}</div>
              <div className="mt-1 text-xs text-slate-500">中威胁</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-green-600">{stats.low}</div>
              <div className="mt-1 text-xs text-slate-500">低威胁</div>
            </div>
          </div>

          {/* 竞品卡片列表 */}
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
              暂无竞品记录，点击下方表单添加
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {items.map((c) => (
                <div
                  key={c.id}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md"
                  onClick={() => setSelectedCompetitor(c)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">{c.name}</h3>
                      {c.model_or_line && (
                        <p className="mt-0.5 text-xs text-slate-500">{c.model_or_line}</p>
                      )}
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${threatConfig[c.threat_level]?.color}`}>
                      威胁: {threatConfig[c.threat_level]?.label}
                    </span>
                  </div>
                  
                  {c.price_position && (
                    <div className="mt-2 text-sm text-slate-600">
                      价格定位: {c.price_position}
                    </div>
                  )}
                  
                  {c.key_features && (
                    <div className="mt-2 text-sm text-slate-600 line-clamp-2">
                      {c.key_features}
                    </div>
                  )}
                  
                  {c.gap_analysis && (
                    <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-500 line-clamp-2">
                      差距分析: {c.gap_analysis}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 新建竞品表单 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">添加竞品</h2>
            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">竞品名称 *</label>
                  <input
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如：竞品A"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">型号/产品线</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.model_or_line}
                    onChange={(e) => setForm({ ...form, model_or_line: e.target.value })}
                    placeholder="如：XX系列"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">价格定位</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.price_position}
                    onChange={(e) => setForm({ ...form, price_position: e.target.value })}
                    placeholder="如：中高端"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">威胁等级</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.threat_level}
                    onChange={(e) => setForm({ ...form, threat_level: e.target.value })}
                  >
                    {Object.entries(threatConfig).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700">关键特性</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  value={form.key_features}
                  onChange={(e) => setForm({ ...form, key_features: e.target.value })}
                  placeholder="竞品的主要功能和特点..."
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700">差距分析</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  value={form.gap_analysis}
                  onChange={(e) => setForm({ ...form, gap_analysis: e.target.value })}
                  placeholder="我方产品与竞品的差距..."
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  添加竞品
                </button>
              </div>
            </form>
            {msg && (
              <div className="mt-2 text-sm text-red-600">{msg}</div>
            )}
          </div>
        </>
      )}

      {/* 竞品详情弹窗 */}
      {selectedCompetitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedCompetitor(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{selectedCompetitor.name}</h2>
              <button onClick={() => setSelectedCompetitor(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="mt-4 space-y-3">
              {selectedCompetitor.model_or_line && (
                <div>
                  <span className="text-xs text-slate-500">型号/产品线</span>
                  <p className="text-sm text-slate-900">{selectedCompetitor.model_or_line}</p>
                </div>
              )}
              
              {selectedCompetitor.price_position && (
                <div>
                  <span className="text-xs text-slate-500">价格定位</span>
                  <p className="text-sm text-slate-900">{selectedCompetitor.price_position}</p>
                </div>
              )}
              
              <div>
                <span className="text-xs text-slate-500">威胁等级</span>
                <p className="mt-1">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${threatConfig[selectedCompetitor.threat_level]?.color}`}>
                    {threatConfig[selectedCompetitor.threat_level]?.label}
                  </span>
                </p>
              </div>
              
              {selectedCompetitor.key_features && (
                <div>
                  <span className="text-xs text-slate-500">关键特性</span>
                  <p className="mt-1 text-sm text-slate-900">{selectedCompetitor.key_features}</p>
                </div>
              )}
              
              {selectedCompetitor.gap_analysis && (
                <div>
                  <span className="text-xs text-slate-500">差距分析</span>
                  <p className="mt-1 text-sm text-slate-900">{selectedCompetitor.gap_analysis}</p>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('确定要删除这个竞品吗？')) {
                    setItems(items.filter(c => c.id !== selectedCompetitor.id));
                    setSelectedCompetitor(null);
                  }
                }}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                删除
              </button>
              <button
                type="button"
                onClick={() => setSelectedCompetitor(null)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
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
