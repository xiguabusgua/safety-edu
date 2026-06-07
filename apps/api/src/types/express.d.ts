/**
 * Express Request 扩展 — 中间件注入的字段
 * - deviceId: deviceIdMiddleware 注入(每个请求都有)
 * - userId: deviceIdMiddleware 注入(查/建 user 后填入)
 * - id: requestIdMiddleware 注入(UUID v4)
 * - rawBody: JSON body 中间件保留的原始请求体(微信验签用)
 * - user: deviceIdMiddleware 注入的完整 User 对象
 * - admin: requireAdmin middleware 注入的管理员对象
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      deviceId?: string;
      userId?: string;
      id?: string;
      rawBody?: string;
      user?: {
        id: string;
        deviceId: string;
        firstSeen: Date;
        lastSeen: Date;
        taskCount: number;
        [key: string]: unknown;
      };
      admin?: {
        id: string;
        username: string;
        role: string;
      };
    }
  }
}

export {};
