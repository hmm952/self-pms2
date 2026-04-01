/**
 * 评审管理页面 - 前端本地模式
 * 
 * 说明：
 * - 使用前端内置模拟数据
 * - 不依赖后端API
 */
import { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import {
  mockReviews,
  mockUsers,
  mockMilestones,
} from '../mockData.js';

const phaseConfig = {
  evt: { label: 'EVT', color: 'bg-blue-100 text-blue-700', desc: '工程验证' },
  dvt: { label: 'DVT', color: 'bg-purple-100 text-purple-700', desc: '设计验证' },
  pvt: { label: 'PVT', color: 'bg-orange-100 text-orange-700', desc: '制程验证' },
  mp: { label: 'MP', color: 'bg-green-100 text-green-700', desc: '量产导入' },
  other: { label: '其他', color: 'bg-slate-100 text-slate-700', desc: '其他评审' },
};

const statusConfig = {
  draft: { label: '草稿', color: 'bg-slate-100 text-slate-600', progress: 0 },
  scheduled: { label: '已排期', color: 'bg-blue-50 text-blue-700', progress: 25 },
  in_progress: { label: '进行中', color: 'bg-yellow-50 text-yellow-700', progress: 50 },
  passed: { label: '通过', color: 'bg-green-50 text-green-700', progress: 100 },
  conditional: { label: '有条件通过', color: 'bg-orange-50 text-orange-700', progress: 80 },
  rejected: { label: '不通过', color: 'bg-red-50 text-red-700', progress: 100 },
  cancelled: { label: '已取消', color: 'bg-slate-100 text-slate-500', progress: 0 },
};

export default function ReviewsPage() {
  const { projectId, currentProject } = useProject();
  const [reviews, setReviews] = useState([]);
  const [users] = useState(mockUsers);
  const [selectedReview, setSelectedReview] = useState(null);

  // 筛选状态
  const [filters, setFilters] = useState({ phase: '', status: '' });

  // 新建评审表单
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    phase: 'evt',
    milestone_id: '',
    review_date: '',
    location: '',
    agenda: '',
  });
  const [msg, setMsg] = useState('');

  // 从模拟数据加载评审
  useEffect(() => {
    if (!projectId) {
      setReviews([]);
      return;
    }
    // 筛选当前项目的评审
    const projectReviews = mockReviews
      .filter(r => r.project_id === projectId)
      .map(review => {
        const milestone = mockMilestones.find(m => m.id === review.milestone_id);
        return {
          ...review,
          milestone_name: milestone?.name || null,
        };
      });
    setReviews(projectReviews);
  }, [projectId]);

  // 创建评审（本地模式）
  const handleCreate = (e) => {
    e.preventDefault();
    setMsg('');
    
    // 生成新的评审ID
    const newId = Math.max(...reviews.map(r => r.id), 0) + 1;
    const milestone = mockMilestones.find(m => m.id === Number(createForm.milestone_id));
    
    const newReview = {
      id: newId,
      project_id: projectId,
      title: createForm.title,
      phase: createForm.phase,
      milestone_id: createForm.milestone_id ? Number(createForm.milestone_id) : null,
      milestone_name: milestone?.name || null,
      review_date: createForm.review_date || null,
      location: createForm.location || null,
      agenda: createForm.agenda || null,
      status: 'draft',
      total_score: null,
      created_at: new Date().toISOString(),
    };
    
    setReviews([...reviews, newReview]);
    setCreateForm({
      title: '',
      phase: 'evt',
      milestone_id: '',
      review_date: '',
      location: '',
      agenda: '',
    });
    setShowCreateForm(false);
  };

  // 统计数据
  const stats = {
    total: reviews.length,
    draft: reviews.filter((r) => r.status === 'draft').length,
    scheduled: reviews.filter((r) => r.status === 'scheduled').length,
    inProgress: reviews.filter((r) => r.status === 'in_progress').length,
    completed: reviews.filter((r) => ['passed', 'conditional', 'rejected'].includes(r.status)).length,
  };

  // 按阶段分组
  const reviewsByPhase = {
    evt: reviews.filter((r) => r.phase === 'evt'),
    dvt: reviews.filter((r) => r.phase === 'dvt'),
    pvt: reviews.filter((r) => r.phase === 'pvt'),
    mp: reviews.filter((r) => r.phase === 'mp'),
    other: reviews.filter((r) => r.phase === 'other'),
  };

  // 当前项目的里程碑
  const projectMilestones = mockMilestones.filter(m => m.project_id === projectId);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">评审管理</h1>
          <p className="mt-1 text-sm text-slate-600">
            {currentProject?.name || '请选择项目'} · EVT/DVT/PVT/MP 全阶段评审
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + 新建评审
        </button>
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
          {/* 统计卡片 */}
          <div className="grid grid-cols-5 gap-3">
            <StatCard label="全部评审" value={stats.total} />
            <StatCard label="草稿" value={stats.draft} color="slate" />
            <StatCard label="已排期" value={stats.scheduled} color="blue" />
            <StatCard label="进行中" value={stats.inProgress} color="yellow" />
            <StatCard label="已完成" value={stats.completed} color="green" />
          </div>

          {/* 筛选栏 */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <span className="text-sm font-medium text-slate-700">筛选：</span>
            <select
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              value={filters.phase}
              onChange={(e) => setFilters((f) => ({ ...f, phase: e.target.value }))}
            >
              <option value="">全部阶段</option>
              {Object.entries(phaseConfig).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
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
            {(filters.phase || filters.status) && (
              <button
                type="button"
                onClick={() => setFilters({ phase: '', status: '' })}
                className="text-sm text-brand-600 hover:underline"
              >
                清空
              </button>
            )}
          </div>

          {/* 评审列表（按阶段分组） */}
          {reviews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
              暂无评审记录，点击"新建评审"开始创建
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {['evt', 'dvt', 'pvt', 'mp'].map((phase) => (
                <div key={phase} className="rounded-lg border border-slate-200 bg-white">
                  {/* 阶段标题 */}
                  <div className={`flex items-center justify-between border-b border-slate-200 px-4 py-3 ${phaseConfig[phase].color}`}>
                    <div>
                      <span className="font-semibold">{phaseConfig[phase].label}</span>
                      <span className="ml-2 text-xs opacity-75">{phaseConfig[phase].desc}</span>
                    </div>
                    <span className="text-xs">{reviewsByPhase[phase].length}</span>
                  </div>

                  {/* 评审列表 */}
                  <div className="max-h-96 space-y-2 overflow-y-auto p-2">
                    {reviewsByPhase[phase].length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">暂无评审</div>
                    ) : (
                      reviewsByPhase[phase].map((review) => (
                        <ReviewCard
                          key={review.id}
                          review={review}
                          statusConfig={statusConfig}
                          onClick={() => setSelectedReview(review)}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 其他评审 */}
          {reviewsByPhase.other.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
                <span className="font-semibold text-slate-700">其他评审</span>
                <span className="text-xs text-slate-500">{reviewsByPhase.other.length}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 p-2">
                {reviewsByPhase.other.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    statusConfig={statusConfig}
                    onClick={() => setSelectedReview(review)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 新建评审弹窗 */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">新建评审</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">评审标题 *</label>
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="如：EVT 阶段设计评审"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">评审阶段</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={createForm.phase}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phase: e.target.value }))}
                >
                  {Object.entries(phaseConfig).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">关联里程碑</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={createForm.milestone_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, milestone_id: e.target.value }))}
                >
                  <option value="">不关联</option>
                  {projectMilestones.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">评审日期</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={createForm.review_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, review_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">评审地点</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={createForm.location}
                    onChange={(e) => setCreateForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="会议室或线上"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">评审议程</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  value={createForm.agenda}
                  onChange={(e) => setCreateForm((f) => ({ ...f, agenda: e.target.value }))}
                  placeholder="评审议程安排..."
                />
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

      {/* 评审详情弹窗 */}
      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          statusConfig={statusConfig}
          phaseConfig={phaseConfig}
          onClose={() => setSelectedReview(null)}
          onUpdated={(updated) => {
            setReviews(reviews.map(r => r.id === updated.id ? updated : r));
            setSelectedReview(null);
          }}
        />
      )}
    </div>
  );
}

// 统计卡片组件
function StatCard({ label, value, color = 'brand' }) {
  const colorMap = {
    brand: 'text-brand-600',
    slate: 'text-slate-600',
    blue: 'text-blue-600',
    yellow: 'text-yellow-600',
    green: 'text-green-600',
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <div className={`text-2xl font-semibold ${colorMap[color]}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

// 评审卡片组件
function ReviewCard({ review, statusConfig, onClick }) {
  return (
    <div
      className="cursor-pointer rounded-lg border border-slate-100 bg-slate-50 p-3 transition hover:border-brand-200 hover:bg-white hover:shadow-sm"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-900 line-clamp-2">{review.title}</h3>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${statusConfig[review.status]?.color || 'bg-slate-100 text-slate-600'}`}>
          {statusConfig[review.status]?.label || review.status}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <span>{review.review_date || '待定'}</span>
        {review.total_score !== null && review.total_score !== undefined && (
          <>
            <span>·</span>
            <span className="font-medium text-slate-700">{review.total_score}分</span>
          </>
        )}
      </div>
      {/* 进度条 */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full transition-all ${
            review.status === 'passed' ? 'bg-green-500' :
            review.status === 'rejected' ? 'bg-red-500' :
            review.status === 'in_progress' ? 'bg-yellow-500' :
            'bg-slate-400'
          }`}
          style={{ width: `${statusConfig[review.status]?.progress || 0}%` }}
        />
      </div>
    </div>
  );
}

// 评审详情弹窗
function ReviewDetailModal({ review, statusConfig, phaseConfig, onClose, onUpdated }) {
  const [form, setForm] = useState({ ...review });
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">评审详情</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">评审标题</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">评审阶段</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.phase}
                onChange={(e) => setForm({ ...form, phase: e.target.value })}
              >
                {Object.entries(phaseConfig).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700">评审状态</label>
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
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">评审日期</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.review_date || ''}
                onChange={(e) => setForm({ ...form, review_date: e.target.value })}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700">评审地点</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.location || ''}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700">评审议程</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              value={form.agenda || ''}
              onChange={(e) => setForm({ ...form, agenda: e.target.value })}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700">评分</label>
            <input
              type="number"
              min="0"
              max="100"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.total_score || ''}
              onChange={(e) => setForm({ ...form, total_score: e.target.value ? Number(e.target.value) : null })}
              placeholder="输入评分（0-100）"
            />
          </div>
        </div>
        
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onUpdated(form)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
