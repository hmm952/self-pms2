/**
 * 系统设置页面 - 前端本地模式
 * 
 * 说明：
 * - 展示系统配置信息
 * - 不依赖后端API
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { mockIntegrationsStatus, mockApiConfigs } from '../mockData.js';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">系统设置</h1>
        <p className="mt-1 text-sm text-slate-600">个人资料与系统配置</p>
      </div>

      {/* Tab切换 */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'profile'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          个人资料
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'integrations'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          集成配置
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'api'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          API密钥
        </button>
      </div>

      {/* 个人资料 */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">账户信息</h2>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl font-semibold text-brand-700">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <div className="font-semibold text-slate-900">{user?.full_name || user?.username || '用户'}</div>
                <div className="text-sm text-slate-500">{user?.email || 'user@example.com'}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">用户名</label>
                <input
                  disabled
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  value={user?.username || ''}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">角色</label>
                <input
                  disabled
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  value={user?.role === 'admin' ? '管理员' : '普通用户'}
                />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <button
                onClick={logout}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                退出登录
              </button>
            </div>
          </div>

          {/* 说明 */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            <strong>说明：</strong>当前为演示模式，用户信息来自前端内置模拟数据。在真实环境中，用户信息存储在后端数据库中，支持修改。
          </div>
        </div>
      )}

      {/* 集成配置 */}
      {activeTab === 'integrations' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">服务名称</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">状态</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">科大讯飞 RAG</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      mockIntegrationsStatus.iflytekRag?.configured 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {mockIntegrationsStatus.iflytekRag?.configured ? '已配置' : '未配置'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{mockIntegrationsStatus.iflytekRag?.hint}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">SMTP 邮件</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      mockIntegrationsStatus.smtp?.configured 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {mockIntegrationsStatus.smtp?.configured ? '已配置' : '未配置'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{mockIntegrationsStatus.smtp?.hint}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">对象存储 (S3)</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      mockIntegrationsStatus.s3?.configured 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {mockIntegrationsStatus.s3?.configured ? '已配置' : '未配置'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{mockIntegrationsStatus.s3?.hint}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 说明 */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <strong>说明：</strong>集成配置需要在后端环境变量中进行设置。当前为演示模式，显示模拟状态。
          </div>
        </div>
      )}

      {/* API密钥 */}
      {activeTab === 'api' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">密钥名称</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">前缀</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">创建时间</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockApiConfigs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      暂无API密钥
                    </td>
                  </tr>
                ) : (
                  mockApiConfigs.map((config) => (
                    <tr key={config.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{config.name}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{config.key_prefix}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(config.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          config.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {config.is_active ? '启用' : '禁用'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 说明 */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <strong>说明：</strong>API密钥用于外部系统访问本系统的接口。当前为演示模式，显示模拟数据。
          </div>
        </div>
      )}
    </div>
  );
}
