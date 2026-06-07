/**
 * 微信支付 V3 平台证书管理 + 回调验签
 *
 * 流程:
 *  1. 启动时(懒加载)从 GET /v3/certificates 拉平台证书列表
 *  2. 缓存到内存,默认 12h 过期
 *  3. 验签: 用 Wechatpay-Serial 头匹配对应证书的 RSA 公钥,验签 base64 签名
 *
 * 也可以直接从文件读证书(避免每次启动都调 API):
 *   WECHAT_PAY_PLATFORM_CERT_PATH=/path/to/apiclient_cert.pem
 *
 * dev 兜底: 没配 API_V3_KEY 时不做验签(让 dev 能用 mock 流程)
 */
import crypto from 'crypto';
import fs from 'fs';
import { env } from './env';

const WECHAT_API = 'https://api.mch.weixin.qq.com/v3';
const CERT_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h

interface CertEntry {
  serialNo: string;
  publicKey: crypto.KeyObject;
  expiresAt: number; // 平台证书自身有效期(epoch ms)
}

let certCache: CertEntry | null = null;
let certFetchedAt = 0;

function getPrivateKey(): string {
  if (!env.WECHAT_PAY_PRIVATE_KEY) {
    throw new Error('WECHAT_PAY_PRIVATE_KEY not set');
  }
  return env.WECHAT_PAY_PRIVATE_KEY.replace(/\\n/g, '\n');
}

function sign(method: string, urlPath: string, body: string): { authorization: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(message, 'utf8');
  const signature = signer.sign(getPrivateKey(), 'base64');
  return {
    authorization:
      `WECHATPAY2-SHA256-RSA2048 ` +
      `mchid="${env.WECHAT_PAY_MCHID}",` +
      `nonce_str="${nonceStr}",` +
      `timestamp="${timestamp}",` +
      `serial_no="${env.WECHAT_PAY_SERIAL_NO}",` +
      `signature="${signature}"`,
  };
}

/**
 * 拉平台证书列表,缓存当前 mchid 对应 serialNo 的那一张
 */
async function fetchAndCacheCert(): Promise<CertEntry> {
  if (!env.WECHAT_PAY_MCHID || !env.WECHAT_PAY_PRIVATE_KEY || !env.WECHAT_PAY_SERIAL_NO) {
    throw new Error('WECHAT_PAY_MCHID / PRIVATE_KEY / SERIAL_NO not set');
  }
  const urlPath = '/certificates';
  const { authorization } = sign('GET', urlPath, '');
  const r = await fetch(WECHAT_API + urlPath, {
    method: 'GET',
    headers: { Authorization: authorization, 'User-Agent': 'safety-edu-api/1.0' },
  });
  if (!r.ok) {
    throw new Error(`GET /certificates failed: HTTP ${r.status}`);
  }
  const data = (await r.json()) as {
    data: Array<{ serial_no: string; effective_time: string; expire_time: string; encrypt_certificate: { ciphertext: string; associated_data: string; nonce: string } }>;
  };
  // 找跟 merchant serial_no 匹配的那张
  // 微信返回的 encrypt_certificate.ciphertext 是 base64(AES-256-GCM(证书明文))
  const target = data.data.find((c) => c.serial_no === env.WECHAT_PAY_SERIAL_NO);
  if (!target) {
    throw new Error(
      `merchant cert serial ${env.WECHAT_PAY_SERIAL_NO} not in /certificates response`,
    );
  }
  const plain = decryptCert(target.encrypt_certificate);
  const publicKey = crypto.createPublicKey(plain);
  certCache = {
    serialNo: target.serial_no,
    publicKey,
    expiresAt: Date.parse(target.expire_time),
  };
  certFetchedAt = Date.now();
  return certCache;
}

/**
 * 用 API_V3_KEY 解密平台证书密文(AES-256-GCM)
 */
function decryptCert(enc: { ciphertext: string; associated_data: string; nonce: string }): string {
  const key = env.WECHAT_PAY_API_V3_KEY;
  if (!key) throw new Error('WECHAT_PAY_API_V3_KEY not set');
  const keyBuf = Buffer.from(key, 'utf8');
  if (keyBuf.length < 32) {
    throw new Error('WECHAT_PAY_API_V3_KEY must be ≥32 bytes');
  }
  const key32 = keyBuf.subarray(0, 32);
  const ct = Buffer.from(enc.ciphertext, 'base64');
  const data = ct.subarray(0, ct.length - 16);
  const tag = ct.subarray(ct.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key32, enc.nonce);
  decipher.setAuthTag(tag);
  decipher.setAAD(Buffer.from(enc.associated_data, 'utf8'));
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * 拿当前 merchant 的平台证书(优先 env 直读,其次内存缓存,最后 fetch)
 */
export async function getPlatformCert(): Promise<CertEntry> {
  // 1. 优先从文件读(env 指定路径)
  const certPath = process.env.WECHAT_PAY_PLATFORM_CERT_PATH;
  if (certPath) {
    const pem = fs.readFileSync(certPath, 'utf8');
    return {
      serialNo: env.WECHAT_PAY_SERIAL_NO ?? 'file',
      publicKey: crypto.createPublicKey(pem),
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    };
  }
  // 2. 内存缓存
  if (certCache && Date.now() - certFetchedAt < CERT_CACHE_TTL_MS) {
    return certCache;
  }
  // 3. 重新拉
  return fetchAndCacheCert();
}

/**
 * 验签微信 V3 回调
 *  - headers 应包含: Wechatpay-Signature / Wechatpay-Timestamp / Wechatpay-Nonce / Wechatpay-Serial
 *  - body 是字符串原文(必须用原始 body,不能 JSON.stringify 转一遍)
 *
 * 验签串: timestamp + "\n" + nonce + "\n" + body + "\n"
 * 验签算法: RSA-SHA256(公钥是 Wechatpay-Serial 头对应的平台证书公钥)
 */
export async function verifyWechatV3Signature(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
): Promise<boolean> {
  // 兜底:dev 模式没配 API_V3_KEY 直接信任
  if (!env.WECHAT_PAY_API_V3_KEY) {
    return true;
  }
  const sig = headerStr(headers, 'wechatpay-signature');
  const ts = headerStr(headers, 'wechatpay-timestamp');
  const nonce = headerStr(headers, 'wechatpay-nonce');
  const serial = headerStr(headers, 'wechatpay-serial');
  if (!sig || !ts || !nonce || !serial) {
    return false;
  }
  // 时间戳 ±5min 防 replay
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
    return false;
  }
  // 找证书
  let cert: CertEntry;
  try {
    cert = await getPlatformCert();
  } catch (e) {
    console.error('[wechatCert] failed to get platform cert:', e);
    return false;
  }
  // 验签串
  const message = `${ts}\n${nonce}\n${rawBody}\n`;
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(message, 'utf8');
  try {
    return verifier.verify(cert.publicKey, sig, 'base64');
  } catch (e) {
    console.error('[wechatCert] verify threw:', e);
    return false;
  }
}

function headerStr(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const v = headers[name];
  if (Array.isArray(v)) return v[0];
  return v;
}

/** 测试用:清缓存(测试时可强制重拉) */
export function _clearCertCache() {
  certCache = null;
  certFetchedAt = 0;
}
