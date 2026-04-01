/**
 * 数据服务层 - 前端本地模式
 * 
 * 说明：
 * - 提供统一的数据访问接口，模拟后端API响应
 * - 所有数据来自内置的mockData.js
 * - 用于部署到静态托管平台（如Vercel）
 */

import {
  mockProjects,
  mockTasks,
  mockReviews,
  mockContracts,
  mockKpiRecords,
  mockCompetitors,
  mockMilestones,
  mockTimeLogs,
  mockMeetingMinutes,
  mockKnowledgeDocuments,
  mockApiConfigs,
  mockIntegrationsStatus,
  mockUsers,
  mockWorkloadData,
  getProjectData,
} from './mockData.js';

// 模拟API延迟（毫秒）
const MOCK_DELAY = 50;

/**
 * 模拟异步响应
 */
async function mockResponse(data, delay = MOCK_DELAY) {
  await new Promise(resolve => setTimeout(resolve, delay));
  return { data };
}

/**
 * 数据服务对象
 * 提供与后端API相同接口的数据访问方法
 */
export const dataService = {
  // ==================== 项目相关 ====================
  
  /**
   * 获取项目列表
   */
  async getProjects() {
    return mockResponse([...mockProjects]);
  },

  /**
   * 获取单个项目
   */
  async getProject(id) {
    const project = mockProjects.find(p => p.id === id);
    return mockResponse(project || null);
  },

  // ==================== 任务相关 ====================
  
  /**
   * 获取任务列表
   */
  async getTasks(projectId) {
    if (!projectId) {
      return mockResponse([]);
    }
    const tasks = mockTasks.filter(t => t.project_id === projectId);
    return mockResponse(tasks);
  },

  /**
   * 获取单个任务
   */
  async getTask(id) {
    const task = mockTasks.find(t => t.id === id);
    return mockResponse(task || null);
  },

  // ==================== 评审相关 ====================
  
  /**
   * 获取评审列表
   */
  async getReviews(projectId) {
    if (!projectId) {
      return mockResponse([]);
    }
    const reviews = mockReviews.filter(r => r.project_id === projectId);
    return mockResponse(reviews);
  },

  /**
   * 获取单个评审
   */
  async getReview(id) {
    const review = mockReviews.find(r => r.id === id);
    return mockResponse(review || null);
  },

  // ==================== 合同相关 ====================
  
  /**
   * 获取合同列表
   */
  async getContracts(projectId) {
    if (!projectId) {
      return mockResponse([]);
    }
    const contracts = mockContracts.filter(c => c.project_id === projectId);
    return mockResponse(contracts);
  },

  /**
   * 获取单个合同
   */
  async getContract(id) {
    const contract = mockContracts.find(c => c.id === id);
    return mockResponse(contract || null);
  },

  // ==================== KPI相关 ====================
  
  /**
   * 获取KPI记录列表
   */
  async getKpiRecords(projectId) {
    if (!projectId) {
      return mockResponse([]);
    }
    const records = mockKpiRecords.filter(k => k.project_id === projectId);
    return mockResponse(records);
  },

  // ==================== 竞品相关 ====================
  
  /**
   * 获取竞品列表
   */
  async getCompetitors(projectId) {
    if (!projectId) {
      return mockResponse([]);
    }
    const competitors = mockCompetitors.filter(c => c.project_id === projectId);
    return mockResponse(competitors);
  },

  /**
   * 获取单个竞品
   */
  async getCompetitor(id) {
    const competitor = mockCompetitors.find(c => c.id === id);
    return mockResponse(competitor || null);
  },

  // ==================== 里程碑相关 ====================
  
  /**
   * 获取里程碑列表
   */
  async getMilestones(projectId) {
    if (!projectId) {
      return mockResponse([]);
    }
    const milestones = mockMilestones.filter(m => m.project_id === projectId);
    return mockResponse(milestones);
  },

  // ==================== 工时相关 ====================
  
  /**
   * 获取工时记录列表
   */
  async getTimeLogs(projectId) {
    if (!projectId) {
      return mockResponse([]);
    }
    const logs = mockTimeLogs.filter(t => t.project_id === projectId);
    return mockResponse(logs);
  },

  // ==================== 会议纪要相关 ====================
  
  /**
   * 获取会议纪要列表
   */
  async getMeetingMinutes(projectId) {
    if (!projectId) {
      return mockResponse([]);
    }
    const minutes = mockMeetingMinutes.filter(m => m.project_id === projectId);
    return mockResponse(minutes);
  },

  // ==================== 知识库相关 ====================
  
  /**
   * 获取知识库文档列表
   */
  async getKnowledgeDocuments(projectId) {
    if (!projectId) {
      return mockResponse([]);
    }
    const docs = mockKnowledgeDocuments.filter(d => d.project_id === projectId);
    return mockResponse(docs);
  },

  // ==================== API配置相关 ====================
  
  /**
   * 获取API配置列表
   */
  async getApiConfigs() {
    return mockResponse([...mockApiConfigs]);
  },

  /**
   * 获取单个API配置
   */
  async getApiConfig(id) {
    const config = mockApiConfigs.find(c => c.id === id);
    return mockResponse(config || null);
  },

  // ==================== 集成状态 ====================
  
  /**
   * 获取集成状态
   */
  async getIntegrationsStatus() {
    return mockResponse(mockIntegrationsStatus);
  },

  // ==================== 用户相关 ====================
  
  /**
   * 获取用户列表
   */
  async getUsers() {
    return mockResponse([...mockUsers]);
  },

  /**
   * 获取单个用户
   */
  async getUser(id) {
    const user = mockUsers.find(u => u.id === id);
    return mockResponse(user || null);
  },

  // ==================== 人力负载 ====================
  
  /**
   * 获取人力负载数据
   */
  async getWorkloadData(projectId) {
    return mockResponse(mockWorkloadData);
  },

  // ==================== 项目总览统计 ====================
  
  /**
   * 获取项目统计数据
   */
  async getProjectStats(projectId) {
    if (!projectId) {
      return mockResponse(null);
    }
    
    const { tasks, reviews, contracts, kpiRecords, competitors } = getProjectData(projectId);
    
    return mockResponse({
      tasksTotal: tasks.length,
      tasksDone: tasks.filter(t => t.status === 'done').length,
      reviews: reviews.length,
      contracts: contracts.length,
      kpi: kpiRecords.length,
      competitors: competitors.length,
    });
  },
};

export default dataService;
