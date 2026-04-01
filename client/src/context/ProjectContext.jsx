/**
 * 项目上下文 - 前端本地模式
 * 
 * 说明：
 * - 使用前端内置的模拟数据
 * - 不依赖后端API，适用于部署到静态托管平台
 * - 登录状态保存在localStorage，刷新不会丢失
 */
import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { mockProjects } from '../mockData.js';

// localStorage 存储键名
const STORAGE_KEY = 'robot-pms:projectId';

// 创建项目上下文
const ProjectContext = createContext(null);

/**
 * 项目提供者组件
 * 管理项目列表和当前选中项目
 */
export function ProjectProvider({ children }) {
  const { token } = useAuth();
  
  // 项目列表状态 - 使用内置模拟数据
  const [projects, setProjects] = useState(mockProjects);
  
  // 当前选中的项目ID - 从localStorage恢复
  const [projectId, setProjectIdState] = useState(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      const id = Number(savedId);
      // 检查保存的项目ID是否在有效项目列表中
      if (mockProjects.some(p => p.id === id)) {
        return id;
      }
    }
    // 默认选中第一个项目
    if (mockProjects.length > 0) {
      return mockProjects[0].id;
    }
    return null;
  });
  
  // 加载状态
  const [loading, setLoading] = useState(false);

  /**
   * 刷新项目列表（模拟）
   * 在本地模式下，直接使用内置数据
   */
  const refreshProjects = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // 模拟加载延迟
      await new Promise(resolve => setTimeout(resolve, 50));
      // 使用内置模拟数据
      setProjects(mockProjects);
      
      // 确保当前选中的项目有效
      setProjectIdState((current) => {
        if (current && mockProjects.some((p) => p.id === current)) {
          return current;
        }
        if (mockProjects.length) {
          const first = mockProjects[0].id;
          localStorage.setItem(STORAGE_KEY, String(first));
          return first;
        }
        localStorage.removeItem(STORAGE_KEY);
        return null;
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  /**
   * 初始化时加载项目
   */
  useEffect(() => {
    if (token) {
      refreshProjects();
    } else {
      setProjects([]);
      setProjectIdState(null);
    }
  }, [token, refreshProjects]);

  /**
   * 设置当前项目ID
   * 同时保存到localStorage
   */
  const setProjectId = useCallback((id) => {
    setProjectIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, String(id));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  /**
   * 获取当前项目对象
   */
  const currentProject = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId],
  );

  /**
   * 构建上下文值
   */
  const value = useMemo(
    () => ({
      projects,           // 项目列表
      projectId,          // 当前项目ID
      currentProject,     // 当前项目对象
      setProjectId,       // 设置当前项目
      refreshProjects,    // 刷新项目列表
      loading,            // 加载状态
    }),
    [projects, projectId, currentProject, setProjectId, refreshProjects, loading],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

/**
 * 使用项目上下文的Hook
 * @returns {object} - 项目上下文值
 * @throws {Error} - 在ProjectProvider外使用时抛出错误
 */
export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return ctx;
}
