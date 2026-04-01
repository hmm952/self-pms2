import { useState, useEffect } from 'react';
import api from '../api/client.js';
import { useProject } from '../context/ProjectContext.jsx';
import {
  RefreshCw, Plus, Eye, Trash2, Send, Settings, Mail, FileText,
  Bell, History, CheckCircle, XCircle, Clock, AlertTriangle,
  Webhook, TestTube, Copy, Edit, ExternalLink, HelpCircle
} from 'lucide-react';

export default function NotificationsPage() {
  const { projectId } = useProject();
  const [activeTab, setActiveTab] = useState('email-config');
  const [loading, setLoading] = useState(false);

  // 邮件配置
  const [emailConfigs, setEmailConfigs] = useState([]);
  const [showEmailConfigDialog, setShowEmailConfigDialog] = useState(false);
  const [editingEmailConfig, setEditingEmailConfig] = useState(null);
  const [emailConfigForm, setEmailConfigForm] = useState({
    config_name: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: true,
    smtp_user: '',
    smtp_pass: '',
    from_email: '',
    from_name: 'Robot PMS',
    is_default: false,
  });
  const [testingEmail, setTestingEmail] = useState(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');

  // 模板管理
  const [templates, setTemplates] = useState([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    template_name: '',
    template_type: 'task_urge',
    category: 'general',
    subject: '',
    body_text: '',
    body_html: '',
    supported_variables: '',
    description: '',
  });
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewVariables, setPreviewVariables] = useState({});

  // 触发规则
  const [rules, setRules] = useState([]);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    rule_name: '',
    rule_type: 'task_overdue',
    source_module: 'task',
    trigger_condition: { days_overdue: 1 },
    template_id: null,
    email_config_id: null,
    recipients: [],
    cc_recipients: [],
    is_active: true,
    priority: 5,
  });
  const [recipientInput, setRecipientInput] = useState('');

  // 发送记录
  const [logs, setLogs] = useState([]);
  const [logPagination, setLogPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [logFilter, setLogFilter] = useState({ status: '', notification_type: '' });
  const [selectedLog, setSelectedLog] = useState(null);

  // Webhook配置
  const [webhooks, setWebhooks] = useState([]);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [webhookForm, setWebhookForm] = useState({
    config_name: '',
    webhook_type: 'wechat',
    webhook_url: '',
    secret: '',
  });

  useEffect(() => {
    loadTabData();
  }, [activeTab, projectId]);

  const getToken = () => localStorage.getItem('token');

  const loadTabData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'email-config':
          await loadEmailConfigs();
          break;
        case 'templates':
          await loadTemplates();
          break;
        case 'rules':
          await loadRules();
          break;
        case 'logs':
          await loadLogs();
          break;
        case 'webhooks':
          await loadWebhooks();
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  // ==================== 邮件配置 ====================

  const loadEmailConfigs = async () => {
    try {
      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);
      const res = await api.get(`/api/notifications/email-configs?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setEmailConfigs(res.data);
    } catch (error) {
      console.error('加载邮件配置失败:', error);
    }
  };

  const handleSaveEmailConfig = async () => {
    try {
      const data = { ...emailConfigForm, project_id: projectId };
      if (editingEmailConfig) {
        await api.put(`/api/notifications/email-configs/${editingEmailConfig.id}`, data, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
      } else {
        await api.post('/api/notifications/email-configs', data, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
      }
      setShowEmailConfigDialog(false);
      resetEmailConfigForm();
      loadEmailConfigs();
    } catch (error) {
      console.error('保存邮件配置失败:', error);
      alert('保存失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleTestEmailConfig = async (configId) => {
    if (!testEmailAddress) {
      alert('请输入测试邮箱地址');
      return;
    }
    setTestingEmail(configId);
    try {
      const res = await api.post(`/api/notifications/email-configs/${configId}/test`, 
        { test_email: testEmailAddress },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      alert(res.data.message);
    } catch (error) {
      alert('测试失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setTestingEmail(null);
    }
  };

  const handleDeleteEmailConfig = async (id) => {
    if (!confirm('确定要删除这个邮件配置吗？')) return;
    try {
      await api.delete(`/api/notifications/email-configs/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      loadEmailConfigs();
    } catch (error) {
      alert('删除失败');
    }
  };

  const resetEmailConfigForm = () => {
    setEmailConfigForm({
      config_name: '',
      smtp_host: '',
      smtp_port: 587,
      smtp_secure: true,
      smtp_user: '',
      smtp_pass: '',
      from_email: '',
      from_name: 'Robot PMS',
      is_default: false,
    });
    setEditingEmailConfig(null);
  };

  // ==================== 模板管理 ====================

  const loadTemplates = async () => {
    try {
      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);
      const res = await api.get(`/api/notifications/templates?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setTemplates(res.data);
    } catch (error) {
      console.error('加载模板失败:', error);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      const data = { ...templateForm, project_id: projectId };
      if (editingTemplate) {
        await api.put(`/api/notifications/templates/${editingTemplate.id}`, data, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
      } else {
        await api.post('/api/notifications/templates', data, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
      }
      setShowTemplateDialog(false);
      resetTemplateForm();
      loadTemplates();
    } catch (error) {
      alert('保存失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('确定要删除这个模板吗？')) return;
    try {
      await api.delete(`/api/notifications/templates/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      loadTemplates();
    } catch (error) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handlePreviewTemplate = async (templateId) => {
    try {
      const res = await api.post('/api/notifications/preview', 
        { template_id: templateId, variables: previewVariables },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setPreviewTemplate(res.data);
    } catch (error) {
      alert('预览失败');
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      template_name: '',
      template_type: 'task_urge',
      category: 'general',
      subject: '',
      body_text: '',
      body_html: '',
      supported_variables: '',
      description: '',
    });
    setEditingTemplate(null);
  };

  // ==================== 触发规则 ====================

  const loadRules = async () => {
    try {
      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);
      const res = await api.get(`/api/notifications/rules?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setRules(res.data);
    } catch (error) {
      console.error('加载规则失败:', error);
    }
  };

  const handleSaveRule = async () => {
    try {
      const data = {
        ...ruleForm,
        project_id: projectId,
        trigger_condition: ruleForm.trigger_condition,
        recipients: ruleForm.recipients,
        cc_recipients: ruleForm.cc_recipients,
      };
      if (editingRule) {
        await api.put(`/api/notifications/rules/${editingRule.id}`, data, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
      } else {
        await api.post('/api/notifications/rules', data, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
      }
      setShowRuleDialog(false);
      resetRuleForm();
      loadRules();
    } catch (error) {
      alert('保存失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteRule = async (id) => {
    if (!confirm('确定要删除这个规则吗？')) return;
    try {
      await api.delete(`/api/notifications/rules/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      loadRules();
    } catch (error) {
      alert('删除失败');
    }
  };

  const addRecipient = () => {
    if (recipientInput && !ruleForm.recipients.includes(recipientInput)) {
      setRuleForm({ ...ruleForm, recipients: [...ruleForm.recipients, recipientInput] });
      setRecipientInput('');
    }
  };

  const removeRecipient = (email) => {
    setRuleForm({ ...ruleForm, recipients: ruleForm.recipients.filter(r => r !== email) });
  };

  const resetRuleForm = () => {
    setRuleForm({
      rule_name: '',
      rule_type: 'task_overdue',
      source_module: 'task',
      trigger_condition: { days_overdue: 1 },
      template_id: null,
      email_config_id: null,
      recipients: [],
      cc_recipients: [],
      is_active: true,
      priority: 5,
    });
    setEditingRule(null);
  };

  // ==================== 发送记录 ====================

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams();
      params.append('page', logPagination.page);
      params.append('pageSize', logPagination.pageSize);
      if (projectId) params.append('project_id', projectId);
      if (logFilter.status) params.append('status', logFilter.status);
      if (logFilter.notification_type) params.append('notification_type', logFilter.notification_type);

      const res = await api.get(`/api/notifications/logs?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setLogs(res.data.data);
      setLogPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('加载记录失败:', error);
    }
  };

  // ==================== Webhook ====================

  const loadWebhooks = async () => {
    try {
      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);
      const res = await api.get(`/api/notifications/webhooks?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setWebhooks(res.data);
    } catch (error) {
      console.error('加载Webhook失败:', error);
    }
  };

  const handleSaveWebhook = async () => {
    try {
      const data = { ...webhookForm, project_id: projectId };
      await api.post('/api/notifications/webhooks', data, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setShowWebhookDialog(false);
      resetWebhookForm();
      loadWebhooks();
    } catch (error) {
      alert('保存失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleTestWebhook = async (id) => {
    try {
      const res = await api.post(`/api/notifications/webhooks/${id}/test`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      alert(res.data.success ? '测试成功' : '测试失败: ' + res.data.response);
    } catch (error) {
      alert('测试失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteWebhook = async (id) => {
    if (!confirm('确定要删除这个Webhook配置吗？')) return;
    try {
      await api.delete(`/api/notifications/webhooks/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      loadWebhooks();
    } catch (error) {
      alert('删除失败');
    }
  };

  const resetWebhookForm = () => {
    setWebhookForm({
      config_name: '',
      webhook_type: 'wechat',
      webhook_url: '',
      secret: '',
    });
  };

  // 辅助函数
  const getTemplateTypeLabel = (type) => {
    const map = {
      task_urge: '生产催办',
      test_urge: '测试催改',
      review_remind: '评审提醒',
      payment_remind: '付款提醒',
      milestone_warn: '里程碑预警',
      overdue_warn: '逾期预警',
      custom: '自定义',
    };
    return map[type] || type;
  };

  const getRuleTypeLabel = (type) => {
    const map = {
      task_overdue: '任务逾期',
      task_due_soon: '任务即将到期',
      review_due: '评审即将进行',
      payment_due: '付款节点到期',
      milestone_due: '里程碑到期',
      manual: '手动触发',
    };
    return map[type] || type;
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: { label: '待发送', className: 'bg-slate-100 text-slate-700', icon: Clock },
      sending: { label: '发送中', className: 'bg-blue-100 text-blue-700', icon: RefreshCw },
      sent: { label: '已发送', className: 'bg-green-100 text-green-700', icon: CheckCircle },
      failed: { label: '发送失败', className: 'bg-red-100 text-red-700', icon: XCircle },
      bounced: { label: '已退回', className: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
    };
    const config = map[status] || map.pending;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">场景化自动通知</h1>
          <p className="text-slate-500 mt-1">
            邮件自动发送、模板管理、触发规则、发送记录追踪
          </p>
        </div>
        <button
          onClick={loadTabData}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* Tab导航 */}
      <div className="border-b">
        <div className="flex gap-1">
          {[
            { key: 'email-config', label: '邮箱配置', icon: Mail },
            { key: 'templates', label: '模板管理', icon: FileText },
            { key: 'rules', label: '触发规则', icon: Bell },
            { key: 'logs', label: '发送记录', icon: History },
            { key: 'webhooks', label: 'Webhook', icon: Webhook },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* 邮箱配置 */}
          {activeTab === 'email-config' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-500">
                  配置SMTP邮箱服务器，支持QQ邮箱、163邮箱、企业邮箱等
                </div>
                <button
                  onClick={() => {
                    resetEmailConfigForm();
                    setShowEmailConfigDialog(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                  <Plus className="w-4 h-4" />
                  添加配置
                </button>
              </div>

              {emailConfigs.length === 0 ? (
                <div className="rounded-lg border bg-white p-12 text-center">
                  <Mail className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">暂无邮件配置</p>
                  <button
                    onClick={() => setShowEmailConfigDialog(true)}
                    className="mt-4 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    添加第一个配置
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {emailConfigs.map((config) => (
                    <div key={config.id} className="rounded-lg border bg-white p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{config.config_name}</h3>
                            {config.is_default && (
                              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">默认</span>
                            )}
                            {config.is_active ? (
                              <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">已启用</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">已停用</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-1">
                            {config.smtp_host}:{config.smtp_port} · {config.smtp_user}
                          </p>
                          <p className="text-sm text-slate-500">发件人: {config.from_email}</p>
                          {config.last_test_at && (
                            <p className="text-xs text-slate-400 mt-1">
                              上次测试: {config.last_test_at} ({config.last_test_status === 'success' ? '成功' : '失败'})
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="email"
                            placeholder="测试邮箱"
                            className="w-40 px-2 py-1 text-xs border rounded"
                            onChange={(e) => setTestEmailAddress(e.target.value)}
                          />
                          <button
                            onClick={() => handleTestEmailConfig(config.id)}
                            disabled={testingEmail === config.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
                          >
                            {testingEmail === config.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <TestTube className="w-3 h-3" />
                            )}
                            测试
                          </button>
                          <button
                            onClick={() => {
                              setEditingEmailConfig(config);
                              setEmailConfigForm({
                                config_name: config.config_name,
                                smtp_host: config.smtp_host,
                                smtp_port: config.smtp_port,
                                smtp_secure: config.smtp_secure === 1,
                                smtp_user: config.smtp_user,
                                smtp_pass: '******',
                                from_email: config.from_email,
                                from_name: config.from_name,
                                is_default: config.is_default === 1,
                              });
                              setShowEmailConfigDialog(true);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmailConfig(config.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 配置说明 */}
              <div className="rounded-lg bg-slate-50 p-4">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  常见邮箱配置说明
                </h4>
                <div className="grid grid-cols-3 gap-4 text-xs text-slate-600">
                  <div>
                    <p className="font-medium">QQ邮箱</p>
                    <p>SMTP服务器: smtp.qq.com</p>
                    <p>端口: 465 (SSL) / 587</p>
                    <p>密码: 授权码（非QQ密码）</p>
                  </div>
                  <div>
                    <p className="font-medium">163邮箱</p>
                    <p>SMTP服务器: smtp.163.com</p>
                    <p>端口: 465 (SSL) / 25</p>
                    <p>密码: 授权码</p>
                  </div>
                  <div>
                    <p className="font-medium">企业邮箱</p>
                    <p>请联系IT管理员获取</p>
                    <p>SMTP服务器和端口</p>
                    <p>通常需要开启SSL</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 模板管理 */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-500">
                  管理通知模板，支持变量填充
                </div>
                <button
                  onClick={() => {
                    resetTemplateForm();
                    setShowTemplateDialog(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                  <Plus className="w-4 h-4" />
                  新建模板
                </button>
              </div>

              {templates.length === 0 ? (
                <div className="rounded-lg border bg-white p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">暂无模板</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {templates.map((template) => (
                    <div key={template.id} className="rounded-lg border bg-white p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{template.template_name}</h3>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                              {getTemplateTypeLabel(template.template_type)}
                            </span>
                            {template.is_builtin && (
                              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium">内置</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-1">主题: {template.subject}</p>
                          {template.description && (
                            <p className="text-xs text-slate-400 mt-1">{template.description}</p>
                          )}
                          {template.supported_variables && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {template.supported_variables.split(',').map((v, i) => (
                                <span key={i} className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-xs">
                                  {`{${v.trim()}}`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setPreviewTemplate(null);
                              setPreviewVariables({});
                              handlePreviewTemplate(template.id);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
                          >
                            <Eye className="w-3 h-3" />
                            预览
                          </button>
                          {!template.is_builtin && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingTemplate(template);
                                  setTemplateForm({
                                    template_name: template.template_name,
                                    template_type: template.template_type,
                                    category: template.category,
                                    subject: template.subject,
                                    body_text: template.body_text || '',
                                    body_html: template.body_html || '',
                                    supported_variables: template.supported_variables || '',
                                    description: template.description || '',
                                  });
                                  setShowTemplateDialog(true);
                                }}
                                className="p-1.5 hover:bg-slate-100 rounded"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 触发规则 */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-500">
                  设置自动触发规则，系统自动发送通知
                </div>
                <button
                  onClick={() => {
                    resetRuleForm();
                    setShowRuleDialog(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                  <Plus className="w-4 h-4" />
                  新建规则
                </button>
              </div>

              {rules.length === 0 ? (
                <div className="rounded-lg border bg-white p-12 text-center">
                  <Bell className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">暂无触发规则</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {rules.map((rule) => (
                    <div key={rule.id} className="rounded-lg border bg-white p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{rule.rule_name}</h3>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                              {getRuleTypeLabel(rule.rule_type)}
                            </span>
                            {rule.is_active ? (
                              <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">已启用</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">已停用</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-1">
                            模板: {rule.template_name || '未指定'} · 
                            邮件配置: {rule.email_config_name || '默认'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            收件人: {JSON.parse(rule.recipients || '[]').join(', ') || '未设置'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingRule(rule);
                              const parsedRecipients = JSON.parse(rule.recipients || '[]');
                              setRuleForm({
                                rule_name: rule.rule_name,
                                rule_type: rule.rule_type,
                                source_module: rule.source_module,
                                trigger_condition: JSON.parse(rule.trigger_condition || '{}'),
                                template_id: rule.template_id,
                                email_config_id: rule.email_config_id,
                                recipients: parsedRecipients,
                                cc_recipients: JSON.parse(rule.cc_recipients || '[]'),
                                is_active: rule.is_active === 1,
                                priority: rule.priority,
                              });
                              setShowRuleDialog(true);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 发送记录 */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <select
                  value={logFilter.status}
                  onChange={(e) => setLogFilter({ ...logFilter, status: e.target.value })}
                  className="px-3 py-2 text-sm border rounded-lg"
                >
                  <option value="">全部状态</option>
                  <option value="pending">待发送</option>
                  <option value="sending">发送中</option>
                  <option value="sent">已发送</option>
                  <option value="failed">发送失败</option>
                </select>
                <select
                  value={logFilter.notification_type}
                  onChange={(e) => setLogFilter({ ...logFilter, notification_type: e.target.value })}
                  className="px-3 py-2 text-sm border rounded-lg"
                >
                  <option value="">全部类型</option>
                  <option value="email">邮件</option>
                  <option value="wechat">企业微信</option>
                  <option value="dingtalk">钉钉</option>
                </select>
              </div>

              {logs.length === 0 ? (
                <div className="rounded-lg border bg-white p-12 text-center">
                  <History className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">暂无发送记录</p>
                </div>
              ) : (
                <div className="rounded-lg border bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left p-3 font-medium">主题</th>
                        <th className="text-left p-3 font-medium">收件人</th>
                        <th className="text-left p-3 font-medium">状态</th>
                        <th className="text-left p-3 font-medium">发送时间</th>
                        <th className="text-left p-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-slate-50">
                          <td className="p-3">{log.subject}</td>
                          <td className="p-3 text-slate-500">
                            {JSON.parse(log.recipients || '[]').slice(0, 2).join(', ')}
                            {JSON.parse(log.recipients || '[]').length > 2 && '...'}
                          </td>
                          <td className="p-3">{getStatusBadge(log.status)}</td>
                          <td className="p-3 text-slate-500">
                            {log.sent_at ? new Date(log.sent_at).toLocaleString('zh-CN') : '-'}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="text-blue-600 hover:underline text-xs"
                            >
                              查看详情
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Webhook配置 */}
          {activeTab === 'webhooks' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-500">
                  配置企业微信、钉钉、飞书等Webhook通知
                </div>
                <button
                  onClick={() => {
                    resetWebhookForm();
                    setShowWebhookDialog(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                  <Plus className="w-4 h-4" />
                  添加Webhook
                </button>
              </div>

              {webhooks.length === 0 ? (
                <div className="rounded-lg border bg-white p-12 text-center">
                  <Webhook className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">暂无Webhook配置</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="rounded-lg border bg-white p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{webhook.config_name}</h3>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                              {webhook.webhook_type === 'wechat' ? '企业微信' : 
                               webhook.webhook_type === 'dingtalk' ? '钉钉' :
                               webhook.webhook_type === 'feishu' ? '飞书' : webhook.webhook_type}
                            </span>
                            {webhook.is_active ? (
                              <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">已启用</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">已停用</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-1 truncate max-w-lg">{webhook.webhook_url}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestWebhook(webhook.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
                          >
                            <TestTube className="w-3 h-3" />
                            测试
                          </button>
                          <button
                            onClick={() => handleDeleteWebhook(webhook.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 邮件配置弹窗 */}
      {showEmailConfigDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">
                {editingEmailConfig ? '编辑邮件配置' : '添加邮件配置'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">配置名称 *</label>
                <input
                  type="text"
                  value={emailConfigForm.config_name}
                  onChange={(e) => setEmailConfigForm({ ...emailConfigForm, config_name: e.target.value })}
                  placeholder="如：公司邮箱"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">SMTP服务器 *</label>
                  <input
                    type="text"
                    value={emailConfigForm.smtp_host}
                    onChange={(e) => setEmailConfigForm({ ...emailConfigForm, smtp_host: e.target.value })}
                    placeholder="smtp.example.com"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">端口</label>
                  <input
                    type="number"
                    value={emailConfigForm.smtp_port}
                    onChange={(e) => setEmailConfigForm({ ...emailConfigForm, smtp_port: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="smtp_secure"
                  checked={emailConfigForm.smtp_secure}
                  onChange={(e) => setEmailConfigForm({ ...emailConfigForm, smtp_secure: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="smtp_secure" className="text-sm">启用SSL/TLS加密</label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">邮箱账号 *</label>
                <input
                  type="text"
                  value={emailConfigForm.smtp_user}
                  onChange={(e) => setEmailConfigForm({ ...emailConfigForm, smtp_user: e.target.value })}
                  placeholder="your@email.com"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  授权码/密码 *
                  <span className="text-xs text-slate-400 ml-2">(QQ/163邮箱请使用授权码)</span>
                </label>
                <input
                  type="password"
                  value={emailConfigForm.smtp_pass === '******' ? '' : emailConfigForm.smtp_pass}
                  onChange={(e) => setEmailConfigForm({ ...emailConfigForm, smtp_pass: e.target.value })}
                  placeholder="授权码或密码"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">发件邮箱 *</label>
                <input
                  type="email"
                  value={emailConfigForm.from_email}
                  onChange={(e) => setEmailConfigForm({ ...emailConfigForm, from_email: e.target.value })}
                  placeholder="noreply@example.com"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">发件人名称</label>
                <input
                  type="text"
                  value={emailConfigForm.from_name}
                  onChange={(e) => setEmailConfigForm({ ...emailConfigForm, from_name: e.target.value })}
                  placeholder="Robot PMS"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={emailConfigForm.is_default}
                  onChange={(e) => setEmailConfigForm({ ...emailConfigForm, is_default: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_default" className="text-sm">设为默认配置</label>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEmailConfigDialog(false);
                  resetEmailConfigForm();
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveEmailConfig}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 模板弹窗 */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">
                {editingTemplate ? '编辑模板' : '新建模板'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">模板名称 *</label>
                  <input
                    type="text"
                    value={templateForm.template_name}
                    onChange={(e) => setTemplateForm({ ...templateForm, template_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">模板类型</label>
                  <select
                    value={templateForm.template_type}
                    onChange={(e) => setTemplateForm({ ...templateForm, template_type: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="task_urge">生产催办</option>
                    <option value="test_urge">测试催改</option>
                    <option value="review_remind">评审提醒</option>
                    <option value="payment_remind">付款提醒</option>
                    <option value="milestone_warn">里程碑预警</option>
                    <option value="overdue_warn">逾期预警</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">邮件主题 *</label>
                <input
                  type="text"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  placeholder="使用 {变量名} 填充动态内容"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">支持变量</label>
                <input
                  type="text"
                  value={templateForm.supported_variables}
                  onChange={(e) => setTemplateForm({ ...templateForm, supported_variables: e.target.value })}
                  placeholder="project_name, task_title, assignee_name（逗号分隔）"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">正文（纯文本）</label>
                <textarea
                  value={templateForm.body_text}
                  onChange={(e) => setTemplateForm({ ...templateForm, body_text: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">正文（HTML）</label>
                <textarea
                  value={templateForm.body_html}
                  onChange={(e) => setTemplateForm({ ...templateForm, body_html: e.target.value })}
                  rows={6}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <textarea
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowTemplateDialog(false);
                  resetTemplateForm();
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 规则弹窗 */}
      {showRuleDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">
                {editingRule ? '编辑规则' : '新建规则'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">规则名称 *</label>
                <input
                  type="text"
                  value={ruleForm.rule_name}
                  onChange={(e) => setRuleForm({ ...ruleForm, rule_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">触发类型</label>
                  <select
                    value={ruleForm.rule_type}
                    onChange={(e) => setRuleForm({ ...ruleForm, rule_type: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="task_overdue">任务逾期</option>
                    <option value="task_due_soon">任务即将到期</option>
                    <option value="review_due">评审即将进行</option>
                    <option value="payment_due">付款节点到期</option>
                    <option value="milestone_due">里程碑到期</option>
                    <option value="manual">手动触发</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">来源模块</label>
                  <select
                    value={ruleForm.source_module}
                    onChange={(e) => setRuleForm({ ...ruleForm, source_module: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="task">任务管理</option>
                    <option value="review">评审管理</option>
                    <option value="contract">合同管理</option>
                    <option value="milestone">里程碑</option>
                  </select>
                </div>
              </div>
              {['task_overdue', 'task_due_soon', 'review_due', 'payment_due', 'milestone_due'].includes(ruleForm.rule_type) && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {ruleForm.rule_type === 'task_overdue' ? '逾期天数' : '提前天数'}
                  </label>
                  <input
                    type="number"
                    value={ruleForm.rule_type === 'task_overdue' ? 
                      (ruleForm.trigger_condition.days_overdue || 1) : 
                      (ruleForm.trigger_condition.days_before || 3)}
                    onChange={(e) => setRuleForm({
                      ...ruleForm,
                      trigger_condition: ruleForm.rule_type === 'task_overdue' ?
                        { days_overdue: parseInt(e.target.value) } :
                        { days_before: parseInt(e.target.value) }
                    })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">收件人 *</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    placeholder="输入邮箱地址"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={addRecipient}
                    className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    添加
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {ruleForm.recipients.map((email, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-xs">
                      {email}
                      <button onClick={() => removeRecipient(email)} className="hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">通知模板</label>
                <select
                  value={ruleForm.template_id || ''}
                  onChange={(e) => setRuleForm({ ...ruleForm, template_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">选择模板</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.template_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rule_active"
                  checked={ruleForm.is_active}
                  onChange={(e) => setRuleForm({ ...ruleForm, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="rule_active" className="text-sm">启用规则</label>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRuleDialog(false);
                  resetRuleForm();
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveRule}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook弹窗 */}
      {showWebhookDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">添加Webhook</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">配置名称 *</label>
                <input
                  type="text"
                  value={webhookForm.config_name}
                  onChange={(e) => setWebhookForm({ ...webhookForm, config_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">类型</label>
                <select
                  value={webhookForm.webhook_type}
                  onChange={(e) => setWebhookForm({ ...webhookForm, webhook_type: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="wechat">企业微信</option>
                  <option value="dingtalk">钉钉</option>
                  <option value="feishu">飞书</option>
                  <option value="slack">Slack</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Webhook URL *</label>
                <input
                  type="url"
                  value={webhookForm.webhook_url}
                  onChange={(e) => setWebhookForm({ ...webhookForm, webhook_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">密钥（可选）</label>
                <input
                  type="password"
                  value={webhookForm.secret}
                  onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowWebhookDialog(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveWebhook}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 发送记录详情弹窗 */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">发送详情</h2>
              <button onClick={() => setSelectedLog(null)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">状态</p>
                  <p className="mt-1">{getStatusBadge(selectedLog.status)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">发送时间</p>
                  <p className="mt-1">{selectedLog.sent_at ? new Date(selectedLog.sent_at).toLocaleString('zh-CN') : '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">主题</p>
                <p className="mt-1 font-medium">{selectedLog.subject}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">收件人</p>
                <p className="mt-1">{JSON.parse(selectedLog.recipients || '[]').join(', ')}</p>
              </div>
              {selectedLog.cc_recipients && (
                <div>
                  <p className="text-xs text-slate-500">抄送</p>
                  <p className="mt-1">{JSON.parse(selectedLog.cc_recipients || '[]').join(', ')}</p>
                </div>
              )}
              {selectedLog.error_message && (
                <div>
                  <p className="text-xs text-slate-500">错误信息</p>
                  <p className="mt-1 text-red-600">{selectedLog.error_message}</p>
                </div>
              )}
              {selectedLog.body_html && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">邮件内容</p>
                  <div 
                    className="border rounded-lg p-4 bg-slate-50 max-h-64 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: selectedLog.body_html }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
