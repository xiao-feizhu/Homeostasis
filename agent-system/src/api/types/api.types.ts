/**
 * API 类型定义
 *
 * 统一的 API 响应格式和类型
 */

/**
 * API 响应标准格式
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta?: ResponseMeta;
}

/**
 * API 错误信息
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string; // 仅在开发环境显示
}

/**
 * 响应元数据（用于分页等）
 */
export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

/**
 * 分页请求参数
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * API 路由配置
 */
export interface RouteConfig {
  path: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  handler: string;
  middleware?: string[];
  requiresAuth?: boolean;
  validation?: string;
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: ResponseMeta
): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta
  };
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  includeStack = false
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
      ...(includeStack ? { stack: new Error().stack } : {})
    }
  };
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T>(
  result: PaginatedResult<T>
): ApiResponse<T[]> {
  const { items, pagination } = result;

  return {
    success: true,
    data: items,
    error: null,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasNext: pagination.page < pagination.totalPages,
      hasPrev: pagination.page > 1
    }
  };
}
