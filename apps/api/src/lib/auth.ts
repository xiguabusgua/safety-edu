import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { env } from './env';
import { prisma } from './prisma';
import { Unauthorized } from './errors';

export interface AdminPayload {
  id: string;
  username: string;
  role: string;
}

export function signAdminToken(payload: AdminPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AdminPayload;
  } catch {
    return null;
  }
}

/** Express middleware: 验证 Bearer token */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    throw new Unauthorized('未授权');
  }
  const token = auth.slice(7);
  const payload = verifyAdminToken(token);
  if (!payload) {
    throw new Unauthorized('token 无效');
  }
  // 二次校验:账号是否仍然存在
  const admin = await prisma.admin.findUnique({ where: { id: payload.id } });
  if (!admin) {
    throw new Unauthorized('账号已失效');
  }
  req.admin = admin;
  next();
}
