/**
 * JWT 鉴权与用户角色中间件
 * 
 * 安全说明：
 * - JWT_SECRET 必须通过环境变量配置，不允许使用硬编码默认值
 * - 生产环境必须设置 JWT_SECRET 环境变量
 * - 开发环境如果未设置，会使用临时密钥并输出警告
 */
import jwt from 'jsonwebtoken';

/**
 * 获取 JWT 密钥
 * 生产环境必须设置环境变量 JWT_SECRET
 * 开发环境如未设置会生成临时密钥（仅用于开发调试）
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  
  if (secret) {
    return secret;
  }
  
  // 开发环境警告：未配置 JWT_SECRET
  console.warn(
    '\n⚠️  [安全警告] JWT_SECRET 环境变量未设置！\n' +
    '   开发环境正在使用临时密钥，请勿在生产环境使用！\n' +
    '   请在 .env 文件中设置 JWT_SECRET（推荐使用 32 位以上随机字符串）\n' +
    '   生成方法: openssl rand -base64 32\n'
  );
  
  // 开发环境使用临时密钥（仅用于开发调试）
  // 注意：每次重启服务会生成新的密钥，导致之前的 token 失效
  const devSecret = 'dev-temp-secret-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  return devSecret;
}

// 获取 JWT 密钥（模块加载时初始化）
const JWT_SECRET = getJwtSecret();

/**
 * 解析 Authorization: Bearer <token>
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: '未登录或令牌缺失' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: '令牌无效或已过期' });
  }
}

/**
 * 仅管理员
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: '需要管理员权限' });
  }
  next();
}

export { JWT_SECRET };
