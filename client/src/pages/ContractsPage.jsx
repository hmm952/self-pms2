/**
 * 合同管理页面 - 前端本地模式
 * 
 * 说明：
 * - 使用前端内置模拟数据
 * - 不依赖后端API
 */
import { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { mockContracts } from '../mockData.js';

function formatAmount(c, amount) {
  if (amount == null) return '—';
  const cur = c || 'CNY';
  return `${amount.toLocaleString('zh-CN')} ${cur}`;
}

const statusConfig = {
  draft: { label: '草稿', color: 'bg-slate-100 text-slate-600' },
  pending: { label: '待签署', color: 'bg-yellow-100 text-yellow-700' },
  signed: { label: '已签署', color: 'bg-green-100 text-green-700' },
  completed: { label: '已完成', color: 'bg-blue-100 text-blue-700' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-600' },
};

export default function ContractsPage() {
  const { projectId, currentProject } = useProject();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    title: '',
    counterparty: '',
    amount: '',
    currency: 'CNY',
    status: 'draft',
  });
  const [msg, setMsg] = useState('');

  // 从模拟数据加载合同
  useEffect(() => {
    if (!projectId) {
      setItems([]);
      return;
    }
    const projectContracts = mockContracts.filter(c => c.project_id === projectId);
    setItems(projectContracts);
  }, [projectId]);

  // 创建合同（本地模式）
  const onSubmit = (e) => {
    e.preventDefault();
    setMsg('');
    if (!projectId) return;
    
    const newId = Math.max(...items.map(c => c.id), 0) + 1;
    const newContract = {
      id: newId,
      project_id: projectId,
      title: form.title,
      counterparty: form.counterparty,
      amount: form.amount === '' ? null : Number(form.amount),
      currency: form.currency,
      status: form.status,
      created_at: new Date().toISOString(),
    };
    
    setItems([...items, newContract]);
    setForm({ title: '', counterparty: '', amount: '', currency: 'CNY', status: 'draft' });
  };

  // 统计数据
  const stats = {
    total: items.length,
    totalAmount: items.reduce((sum, c) => sum + (c.amount || 0), 0),
    signed: items.filter(c => c.status === 'signed' || c.status === 'completed').length,
    pending: items.filter(c => c.status === 'pending').length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">合同管理</h1>
        <p className="mt-1 text-sm text-slate-600">
          {currentProject?.name || '请选择项目'} · 外协、采购与框架协议台账
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
              <div className="mt-1 text-xs text-slate-500">合同总数</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-green-600">{stats.signed}</div>
              <div className="mt-1 text-xs text-slate-500">已签署</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-yellow-600">{stats.pending}</div>
              <div className="mt-1 text-xs text-slate-500">待签署</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-2xl font-semibold text-slate-600">
                ¥{stats.totalAmount.toLocaleString('zh-CN')}
              </div>
              <div className="mt-1 text-xs text-slate-500">总金额</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">合同名称</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">对方主体</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">金额</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">状态</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      暂无合同
                    </td>
                  </tr>
                ) : (
                  items.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">{c.title}</td>
                      <td className="px-4 py-3 text-slate-600">{c.counterparty}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatAmount(c.currency, c.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig[c.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                          {statusConfig[c.status]?.label || c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('确定要删除这个合同吗？')) {
                              setItems(items.filter(item => item.id !== c.id));
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

          {/* 新建合同表单 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">新建合同</h2>
            <form onSubmit={onSubmit} className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">合同名称 *</label>
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="如：外协加工协议"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">对方主体 *</label>
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.counterparty}
                  onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
                  placeholder="合作方名称"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">金额</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="合同金额"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">币种</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                >
                  <option value="CNY">CNY (人民币)</option>
                  <option value="USD">USD (美元)</option>
                  <option value="EUR">EUR (欧元)</option>
                </select>
              </div>
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
              <div className="col-span-2 flex justify-end gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  创建合同
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
