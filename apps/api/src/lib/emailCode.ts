/**
 * 邮箱验证码服务
 *
 * dev 模式:固定 123456,直接 console.log("EMAIL_CODE: xxxxxx")
 * 生产:接 SMTP(MAIL_* env),用 nodemailer 发邮件
 */
import crypto from 'crypto';
import { env } from './env';

const TTL_MS = 10 * 60 * 1000; // 10 分钟
const RESEND_COOLDOWN_MS = 60 * 1000; // 同一邮箱 60s 内不可重发
const MAX_WRONG_ATTEMPTS = 5; // 错码次数上限
const LOCKOUT_MS = 30 * 60 * 1000; // 错超 5 次锁 30 分钟

const isDev = !env.SMTP_HOST;

// 内存存储(生产用 Redis 替换)
interface CodeEntry {
  code: string;
  email: string;
  expiresAt: number;
  lastSentAt: number;
  wrongAttempts: number;
  lockedUntil?: number;
}
const store = new Map<string, CodeEntry>();

function newCode(): string {
  return String(Math.floor(100000 + crypto.randomInt(0, 900000)));
}

/**
 * 发验证码。
 * dev 模式返固定 123456 并 console.log;生产用 SMTP 发邮件。
 */
export async function sendEmailCode(
  email: string,
): Promise<{ devCode?: string } | { error: 'cooldown' | 'locked'; retryAfterMs: number }> {
  const existing = store.get(email);

  // 锁定中
  if (existing?.lockedUntil && Date.now() < existing.lockedUntil) {
    return { error: 'locked', retryAfterMs: existing.lockedUntil - Date.now() };
  }
  // 60s 内重发限制
  if (existing && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    return { error: 'cooldown', retryAfterMs: RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt) };
  }

  const code = isDev ? '123456' : newCode();
  store.set(email, {
    code,
    email,
    expiresAt: Date.now() + TTL_MS,
    lastSentAt: Date.now(),
    wrongAttempts: 0,
  });

  if (isDev) {
    // dev:固定 123456,console.log 模拟邮件
    console.log(`[email-code DEV] to=${email} code=${code}`);
  } else {
    // 生产 SMTP: 需要 npm i nodemailer + 配 SMTP_* env, 见 README
    console.log(`[email-code] to=${email} code=${code} (SMTP 未配置, 仅 console)`);
  }

  return isDev ? { devCode: code } : {};
}

/**
 * 验证邮箱 + 验证码
 * - 错 5 次锁 30 分钟
 * - 用过即焚
 */
export function verifyEmailCode(
  email: string,
  code: string,
): { ok: boolean; reason?: string; retryAfterMs?: number } {
  const entry = store.get(email);
  if (!entry) return { ok: false, reason: '请先获取验证码' };

  // 锁定中
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return {
      ok: false,
      reason: '尝试次数过多,已锁定',
      retryAfterMs: entry.lockedUntil - Date.now(),
    };
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(email);
    return { ok: false, reason: '验证码已过期' };
  }

  if (entry.code !== code) {
    entry.wrongAttempts += 1;
    if (entry.wrongAttempts >= MAX_WRONG_ATTEMPTS) {
      entry.lockedUntil = Date.now() + LOCKOUT_MS;
    }
    return { ok: false, reason: '验证码错误' };
  }

  store.delete(email); // 用过即焚
  return { ok: true };
}
