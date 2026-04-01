/**
 * 邮件 SMTP 发送占位
 * 建议使用 nodemailer（需自行 npm install nodemailer 后加入依赖）
 * 当前仅提供配置检测，避免在未安装邮件库时阻塞启动。
 */
import { getSmtpConfig } from '../config/integrations.js';

/**
 * @returns {{ configured: boolean, hint: string }}
 */
export function getMailStatus() {
  const c = getSmtpConfig();
  if (c.enabled && c.from) {
    return {
      configured: true,
      hint: 'SMTP 已配置。安装 nodemailer 后在 sendMail 中创建 transporter 即可发信。',
    };
  }
  return {
    configured: false,
    hint: '请在 server/.env 中配置 SMTP_HOST、SMTP_USER、SMTP_PASS、SMTP_FROM。',
  };
}

/**
 * 发送邮件占位
 * @param {{ to: string, subject: string, text: string, html?: string }} _opts
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function sendMail(_opts) {
  const c = getSmtpConfig();
  if (!c.enabled) {
    return { ok: false, message: 'SMTP 未配置' };
  }
  // TODO: import nodemailer from 'nodemailer'; 并创建 transporter.sendMail(...)
  return {
    ok: false,
    message:
      '占位：已检测到 SMTP 配置。请安装 nodemailer 并实现 mailService.sendMail。',
  };
}
