/**
 * 认证上下文 - 前端本地验证版本
 * 
 * 说明：
 * - 本版本采用前端本地验证，不调用任何后端接口
 * - 适用于部署到静态托管平台（如Vercel）时解决API 404问题
 * - 登录状态保存在localStorage，刷新页面不会退出登录
 * 
 * 固定账号信息：
 * - 用户名: user
 * - 密码: 123456
 */
import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';

// ============================================
// 固定账号配置（可根据需要修改）
// ============================================
const FIXED_ACCOUNTS = [
  {
    username: 'user',
    password: '123456',
    role: 'user',
    full_name: '用户',
    email: 'user@example.com',
  },
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    full_name: '管理员',
    email: 'admin@example.com',
  },
];

// localStorage 存储键名
const STORAGE_KEY = 'pms_auth_token';
const USER_STORAGE_KEY = 'pms_auth_user';

// 创建认证上下文
const AuthContext = createContext(null);

/**
 * 认证提供者组件
 * 提供登录、登出、用户状态管理功能
 */
export function AuthProvider({ children }) {
  // 用户状态 - 初始化时从localStorage恢复
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(USER_STORAGE_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // Token状态 - 初始化时从localStorage恢复
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  
  // 加载状态 - 用于控制页面加载时的等待效果
  const [loading, setLoading] = useState(false);

  /**
   * 登出函数
   * 清除localStorage中的登录状态，重置用户和token
   */
  const logout = useCallback(() => {
    // 清除localStorage中的认证信息
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    // 重置状态
    setToken(null);
    setUser(null);
  }, []);

  /**
   * 登录函数（前端本地验证）
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise<object>} - 返回用户信息
   * @throws {Error} - 用户名或密码错误时抛出异常
   */
  const login = useCallback(async (username, password) => {
    // 模拟网络延迟，提供更好的用户体验
    await new Promise(resolve => setTimeout(resolve, 300));

    // 验证账号密码 - 在固定账号列表中查找匹配项
    const account = FIXED_ACCOUNTS.find(
      acc => acc.username === username && acc.password === password
    );

    if (!account) {
      throw new Error('用户名或密码错误');
    }

    // 生成简单的本地token（格式：local_时间戳_随机字符串）
    const localToken = `local_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // 构建用户信息对象（不包含密码）
    const userInfo = {
      id: account.username === 'admin' ? 1 : 2,
      username: account.username,
      role: account.role,
      full_name: account.full_name,
      email: account.email,
    };

    // 保存到localStorage（持久化登录状态）
    localStorage.setItem(STORAGE_KEY, localToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userInfo));

    // 更新状态
    setToken(localToken);
    setUser(userInfo);

    return userInfo;
  }, []);

  /**
   * 初始化时验证登录状态
   * 如果localStorage中有token和用户信息，则恢复登录状态
   */
  useEffect(() => {
    // 检查localStorage中是否有有效的登录信息
    const savedToken = localStorage.getItem(STORAGE_KEY);
    const savedUser = localStorage.getItem(USER_STORAGE_KEY);

    if (savedToken && savedUser) {
      try {
        const userInfo = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(userInfo);
      } catch {
        // 解析失败，清除无效数据
        logout();
      }
    }
    
    setLoading(false);
  }, [logout]);

  /**
   * 构建上下文值
   * 包含用户信息、token、加载状态、登录登出方法等
   */
  const value = useMemo(
    () => ({
      user,           // 当前登录用户信息
      token,          // 登录token
      loading,        // 加载状态
      login,          // 登录方法
      logout,         // 登出方法
      isAdmin: user?.role === 'admin',  // 是否为管理员
    }),
    [user, token, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 使用认证上下文的Hook
 * @returns {object} - 认证上下文值
 * @throws {Error} - 在AuthProvider外使用时抛出错误
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
