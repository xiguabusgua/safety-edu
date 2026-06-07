import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * 每个请求分配一个 UUID v4。
 * 加到 res header (X-Request-Id),后续日志 / 错误响应都带上。
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(incoming)
      ? incoming
      : randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
