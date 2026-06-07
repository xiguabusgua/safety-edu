import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';

/**
 * Cookie 命名:
 *   生产用 `__Host-safety_uid`,强制 secure + path=/,浏览器保证不会被子域写入,
 *   防子域 XSS 偷/伪造设备 id;
 *   本地开发用普通 `safety_uid`,因为 __Host- 在 http://localhost(非 HTTPS)下会被浏览器拒收。
 */
const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-safety_uid' : 'safety_uid';
const TTL_SECONDS = 2 * 365 * 24 * 3600; // 2 年

function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || '';
}

/**
 * 自动识别匿名用户：
 * - 首次访问 → 种 HttpOnly cookie，DB 落 User 表
 * - 已有 cookie → 命中 User，更新 lastSeen
 * - 跳过静态资源/管理后台
 */
export async function deviceIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // 跳过 SSE 流（cookie 已经处理过）和管理后台
  if (req.path.startsWith('/api/stream') || req.path.startsWith('/api/admin')) {
    return next();
  }

  let uid = req.cookies?.[COOKIE_NAME] as string | undefined;
  let isNew = false;

  if (!uid || uid.length < 16) {
    uid = crypto.randomBytes(18).toString('base64url');
    isNew = true;
    // __Host- 前缀强制 secure: true + path: '/' + 不带 domain;
    // 非生产走普通 cookie 时按 NODE_ENV 决定 secure,但 path 始终为 /。
    res.cookie(COOKIE_NAME, uid, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: TTL_SECONDS * 1000,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  const ip = extractClientIp(req);

  // upsert User
  try {
    const user = await prisma.user.upsert({
      where: { deviceId: uid },
      create: {
        deviceId: uid,
        ipFirst: ip,
        ipLast: ip,
      },
      update: {
        lastSeen: new Date(),
        ...(isNew ? {} : { ipLast: ip }),
      },
    });
    req.deviceId = uid;
    req.userId = user.id;
    req.user = user;
  } catch (err) {
    // DB 故障不阻塞请求
    console.error('[deviceId] upsert error:', err);
  }

  next();
}
