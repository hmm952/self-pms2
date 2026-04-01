import { useState, useEffect } from 'react';
import api from '../api/client.js';
import { Settings, Key, Globe, CheckCircle, XCircle, RefreshCw, Save, Eye, EyeOff, TestTube } from 'lucide-react';

export default function ApiConfigsPage() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [showApiKey, setShowApiKey] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await api.get('/api/api-configs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfigs(res.data);
    } catch (error) {
      console.error('加载API配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config) => {
    setEditingConfig({
      ...config,
      api_key: '',
      api_secret: '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      setSaveStatus('saving');
      const token = localStorage.getItem('token');
      await api.put(`/api/api-configs/${editingConfig.id}`, editingConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaveStatus('saved');
      setTimeout(() => {
        setShowDialog(false);
        loadConfigs();
        setSaveStatus(null);
      }, 1000);
    } catch (error) {
      console.error('保存配置失败:', error);
      setSaveStatus('error');
    }
  };

  const handleTest = async (configId) => {
    try {
      setTestingId(configId);
      const token = localStorage.getItem('token');
      const res = await api.post(`/api/api-configs/${configId}/test`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        alert('连接测试成功！');
      } else {
        alert(`连接测试失败: ${res.data.message}`);
      }
    } catch (error) {
      alert('连接测试失败');
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (config) => {
    try {
      const token = localStorage.getItem('token');
      await api.put(`/api/api-configs/${config.id}`, { is_active: !config.is_active }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadConfigs();
    } catch (error) {
      console.error('更新状态失败:', error);
    }
  };

  const getProviderIcon = (provider) => {
    if (provider.includes('xunfei')) {
      return '🤖';
    }
    return '🔌';
  };

  const getProviderLabel = (provider) => {
    const labels = {
      'xunfei_rag': 'RAG知识库',
      'xunfei_llm': '大语言模型',
    };
    return labels[provider] || provider;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API 配置管理</h1>
          <p className="text-slate-500 mt-1">
            配置第三方服务API，包括科大讯飞星火RAG、大语言模型等
          </p>
        </div>
      </div>

      {/* 配置卡片列表 */}
      <div className="grid gap-6 md:grid-cols-2">
        {configs.map((config) => (
          <div key={config.id} className={`rounded-lg border bg-white p-6 shadow-sm ${config.is_active ? '' : 'opacity-60'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{getProviderIcon(config.provider)}</div>
                <div>
                  <h3 className="font-semibold text-lg">{config.name}</h3>
                  <p className="text-sm text-slate-500">{getProviderLabel(config.provider)}</p>
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.is_active}
                  onChange={() => handleToggleActive(config)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">启用</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-slate-500">API Key</span>
                <div className="font-medium">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.key_status === '已配置' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {config.key_status}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-500">状态</span>
                <div className="font-medium">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {config.is_active ? '已启用' : '已禁用'}
                  </span>
                </div>
              </div>
            </div>

            {config.api_url && (
              <div className="text-sm mb-4">
                <span className="text-slate-500">API URL</span>
                <div className="font-mono text-xs mt-1 truncate bg-slate-50 px-2 py-1 rounded border">
                  {config.api_url}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleEdit(config)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <Settings className="w-4 h-4" />
                配置
              </button>
              <button
                onClick={() => handleTest(config.id)}
                disabled={testingId === config.id || config.key_status === '未配置'}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                {testingId === config.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
                测试
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 配置弹窗 */}
      {showDialog && editingConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                配置 {editingConfig.name}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">配置名称</label>
                <input
                  type="text"
                  value={editingConfig.name}
                  onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">API URL</label>
                <input
                  type="text"
                  value={editingConfig.api_url || ''}
                  onChange={(e) => setEditingConfig({ ...editingConfig, api_url: e.target.value })}
                  placeholder="https://api.example.com/v1/endpoint"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey[editingConfig.id] ? 'text' : 'password'}
                    value={editingConfig.api_key || ''}
                    onChange={(e) => setEditingConfig({ ...editingConfig, api_key: e.target.value })}
                    placeholder="输入新的API Key（留空保持不变）"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey({
                      ...showApiKey,
                      [editingConfig.id]: !showApiKey[editingConfig.id]
                    })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                  >
                    {showApiKey[editingConfig.id] ? (
                      <EyeOff className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {editingConfig.provider === 'xunfei_rag' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">App ID</label>
                    <input
                      type="text"
                      value={editingConfig.app_id || ''}
                      onChange={(e) => setEditingConfig({ ...editingConfig, app_id: e.target.value })}
                      placeholder="科大讯飞应用ID"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">API Secret</label>
                    <input
                      type="password"
                      value={editingConfig.api_secret || ''}
                      onChange={(e) => setEditingConfig({ ...editingConfig, api_secret: e.target.value })}
                      placeholder="API Secret"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editingConfig.is_active}
                  onChange={(e) => setEditingConfig({ ...editingConfig, is_active: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="is_active" className="text-sm">启用此配置</label>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saveStatus === 'saving' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : saveStatus === 'saved' ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    已保存
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    保存
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="font-semibold mb-4">使用说明</h3>
        <div className="space-y-4 text-sm text-slate-600">
          <div>
            <h4 className="font-medium text-slate-900 mb-2">科大讯飞星火RAG配置</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>访问科大讯飞开放平台获取 API Key、App ID 和 API Secret</li>
              <li>在上方的配置卡片中填入相应的凭证</li>
              <li>点击"测试"按钮验证连接是否成功</li>
              <li>启用配置后，会议纪要解析和知识库功能将自动使用该API</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
