import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * 登录页面组件
 * 
 * 说明：
 * - 使用前端本地验证，不调用后端API
 * - 固定账号：user / 123456 或 admin / admin123
 * - 保留原有UI样式和交互逻辑
 */
export default function LoginPage() {
  const { login, token, loading } = useAuth();
  const nav = useNavigate();

  // 表单状态
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 如果已登录，直接跳转到首页
  if (!loading && token) return <Navigate to="/" replace />;

  /**
   * 表单提交处理函数
   * 调用本地验证的login方法进行登录
   */
  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      // 调用本地验证的登录方法（不调用后端API）
      await login(username, password);
      // 登录成功，跳转到首页
      nav('/', { replace: true });
    } catch (err) {
      // 登录失败，显示错误信息
      setError(err.message || '登录失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-white">机器人产品线 PMS</h1>
          <p className="mt-2 text-sm text-slate-400">
            制造企业级项目协同 · 登录后继续
          </p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={onSubmit} className="space-y-4">
          {/* 用户名输入框 */}
          <div>
            <label className="block text-xs font-medium text-slate-400">用户名</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="请输入用户名"
            />
          </div>

          {/* 密码输入框 */}
          <div>
            <label className="block text-xs font-medium text-slate-400">密码</label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="请输入密码"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? '登录中…' : '登录'}
          </button>
        </form>

        {/* 登录提示信息 */}
        <p className="mt-6 text-center text-xs text-slate-500">
          演示账号：<span className="text-slate-400">user / 123456</span>
        </p>
      </div>
    </div>
  );
}
