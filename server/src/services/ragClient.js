/**
 * 科大讯飞 RAG API 对接占位
 * 后续在此封装 HTTP 请求（如 fetch/axios），与贵司实际文档路径、鉴权头保持一致即可。
 */
import { getIflytekRagConfig } from '../config/integrations.js';

/**
 * 检查 RAG 是否已配置（供管理台或健康检查展示）
 * @returns {{ configured: boolean, hint: string }}
 */
export function getRagStatus() {
  const c = getIflytekRagConfig();
  if (c.enabled) {
    return { configured: true, hint: 'RAG 基础 URL 与 API Key 已配置，可实现具体检索/问答接口。' };
  }
  return {
    configured: false,
    hint: '请在 server/.env 中配置 IFLYTEK_RAG_BASE_URL 与 IFLYTEK_RAG_API_KEY，并在本文件中实现调用逻辑。',
 };
}

/**
 * 示例：向知识库发起检索（占位实现，返回未配置说明）
 * @param {{ query: string, topK?: number }} _params
 * @returns {Promise<{ ok: boolean, items?: Array<{ title: string, snippet: string }>, message?: string }>}
 */
export async function queryKnowledgeBase(_params) {
  const c = getIflytekRagConfig();
  if (!c.enabled) {
    return {
      ok: false,
      message: 'RAG 未配置：请设置环境变量并实现 ragClient.queryKnowledgeBase。',
    };
  }
  // TODO: 使用 c.baseUrl / c.apiKey 调用科大讯飞 RAG 接口
  return {
    ok: true,
    items: [],
    message: '占位：已检测到配置，请接入真实 HTTP 请求与响应解析。',
  };
}
