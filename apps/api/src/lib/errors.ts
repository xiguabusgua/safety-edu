/**
 * 统一错误响应 envelope。
 * 成功响应: { data, meta? }
 * 错误响应: { error: { code, message, details? } }
 */
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class BadRequest extends HttpError {
  constructor(message = '参数错误', details?: unknown) {
    super(400, 'bad_request', message, details);
  }
}
export class Unauthorized extends HttpError {
  constructor(message = '未授权') {
    super(401, 'unauthorized', message);
  }
}
export class Forbidden extends HttpError {
  constructor(message = '禁止访问') {
    super(403, 'forbidden', message);
  }
}
export class NotFound extends HttpError {
  constructor(message = '资源不存在') {
    super(404, 'not_found', message);
  }
}
export class TooManyRequests extends HttpError {
  constructor(message = '请求过于频繁') {
    super(429, 'too_many_requests', message);
  }
}
export class Conflict extends HttpError {
  constructor(message = '状态冲突') {
    super(409, 'conflict', message);
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'not_found', message: '路由不存在' },
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  const requestId = req.id;

  if (err instanceof HttpError) {
    if (err.status >= 500) {
      console.error(`[err] [${requestId ?? '-'}] ${err.code}:`, err);
    }
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
      ...(requestId ? { requestId } : {}),
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'validation_failed',
        message: '参数错误',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      ...(requestId ? { requestId } : {}),
    });
  }

  console.error(`[err] [${requestId ?? '-'}] unhandled:`, err);
  res.status(500).json({
    error: { code: 'internal_error', message: '服务异常,请稍后重试' },
    ...(requestId ? { requestId } : {}),
  });
}
