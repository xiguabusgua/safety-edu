import crypto from 'crypto';
import { z } from 'zod';
import { env } from './env';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_LEN = 32;

function getKey(): Buffer {
  const raw = env.ACCOUNT_ENC_KEY;
  // 严格:只接受 64-char hex 或 44-char base64(标准 AES-256 key 编码)。
  // 不再做 sha256 兜底派生,免得"短字符串"被静默接受成 32 字节,导致线上/线下用不同 key 加密的密文互不可解。
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  if (raw.length === 44) return Buffer.from(raw, 'base64');
  throw new Error('ACCOUNT_ENC_KEY must be 64-char hex or 44-char base64');
}

const key = getKey();
if (key.length !== KEY_LEN) {
  throw new Error(`ACCOUNT_ENC_KEY must be ${KEY_LEN} bytes (got ${key.length})`);
}

export interface Encrypted {
  cipher: string; // base64
  iv: string; // base64
  tag: string; // base64
}

export function encryptAccount(plain: Record<string, unknown>): Encrypted {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { cipher: ct.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64') };
}

export function decryptAccount(enc: Encrypted): Record<string, unknown> {
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(enc.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(enc.cipher, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(pt.toString('utf8'));
}

export const weibanCredsSchema = z.object({
  school: z.string().min(1).max(100),
  userId: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const jiangsuCredsSchema = z.object({
  userId: z.string().regex(/^\d+$/, 'userid 必须是纯数字'),
  school: z.string().max(100).optional(),
});

export type WeibanCreds = z.infer<typeof weibanCredsSchema>;
export type JiangsuCreds = z.infer<typeof jiangsuCredsSchema>;
