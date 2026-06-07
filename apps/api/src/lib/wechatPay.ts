/**
 * 微信支付 V3 native(扫码支付)封装。
 *
 * 走法:
 * - dev: 没配 WECHAT_PAY_MCHID 时,返 mock code_url(weixin:// 前缀,前端会用 qrserver 渲染)
 * - 生产: 需要商户号 + 商户 API 证书私钥 + API v3 密钥(回调解密用)
 *
 * 文档: https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pay/transactions/chapter3_2.shtml
 */
import crypto from 'crypto';
import { env } from './env';

const WECHAT_API = 'https://api.mch.weixin.qq.com/v3';

export interface WechatNativeOrder {
  codeUrl: string; // 二维码内容,前端用 qrserver 渲染
}

/**
 * 拿私钥。env 里的私钥是 PEM 格式(包含 BEGIN/END 行)。
 * .env 里的多行字符串经常被压成 \\n 字面量,这里统一还原成真换行,
 * 否则 crypto.createSign().sign() 会抛 "ASN1_OBJECT_ID" / "no start line" 错。
 */
function getPrivateKey(): string {
  if (!env.WECHAT_PAY_PRIVATE_KEY) {
    throw new Error('WECHAT_PAY_PRIVATE_KEY not set');
  }
  return env.WECHAT_PAY_PRIVATE_KEY.replace(/\\n/g, '\n');
}

/**
 * 计算 V3 签名 + 拼 Authorization header
 */
function signRequest(
  method: string,
  urlPath: string,
  body: string,
): { authorization: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(message, 'utf8');
  const signature = signer.sign(getPrivateKey(), 'base64');

  const authorization =
    `WECHATPAY2-SHA256-RSA2048 ` +
    `mchid="${env.WECHAT_PAY_MCHID}",` +
    `nonce_str="${nonceStr}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${env.WECHAT_PAY_SERIAL_NO}",` +
    `signature="${signature}"`;

  return { authorization };
}

interface CreateParams {
  outTradeNo: string;
  totalAmount: number; // 分
  subject: string;
  /** dev 模式:覆盖 baseUrl(让 mock URL 跟随请求 host,避免端口写死) */
  baseUrlOverride?: string;
}

/**
 * dev 模式 codeUrl: 返本地假支付页 URL(让前端能跳到 /api/pay/mock 走完整 mock 流程)
 * 生产模式 codeUrl: 微信 native 协议 weixin://... (前端用 qrserver 渲染)
 */
function buildMockCodeUrl(outTradeNo: string, baseUrlOverride?: string): string {
  const base = baseUrlOverride || env.PUBLIC_BASE_URL || `http://localhost:${env.PORT}`;
  return `${base}/api/pay/mock?out_trade_no=${encodeURIComponent(outTradeNo)}`;
}

/**
 * 下单:native(扫码)支付
 * POST /pay/transactions/native
 */
export async function createWechatNativeOrder(
  p: CreateParams,
): Promise<WechatNativeOrder> {
  // dev 兜底:没配 MCHID 时返本地 mock 页 codeUrl
  if (!env.WECHAT_PAY_MCHID || !env.WECHAT_PAY_APPID) {
    return {
      codeUrl: buildMockCodeUrl(p.outTradeNo, p.baseUrlOverride),
    };
  }

  const urlPath = '/pay/transactions/native';
  const body = JSON.stringify({
    appid: env.WECHAT_PAY_APPID,
    mchid: env.WECHAT_PAY_MCHID,
    description: p.subject,
    out_trade_no: p.outTradeNo,
    notify_url: env.WECHAT_PAY_NOTIFY_URL,
    amount: { total: p.totalAmount, currency: 'CNY' },
  });

  const { authorization } = signRequest('POST', urlPath, body);

  const r = await fetch(WECHAT_API + urlPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
      'User-Agent': 'safety-edu-api/1.0',
      Accept: 'application/json',
    },
    body,
  });

  if (!r.ok) {
    const errBody = await r.text();
    throw new Error(
      `微信支付下单失败: HTTP ${r.status} ${errBody.slice(0, 200)}`,
    );
  }

  const data = (await r.json()) as { code_url?: string; message?: string };
  if (!data.code_url) {
    throw new Error(
      `微信支付未返 code_url: ${data.message ?? JSON.stringify(data)}`,
    );
  }

  return { codeUrl: data.code_url };
}

/**
 * AES-256-GCM 解密(微信回调 v3 资源)
 * 文档: https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pay/transactions/chapter5_2.shtml
 *
 * 资源格式: {
 *   algorithm: 'AEAD_AES_256_GCM',
 *   ciphertext: '...',
 *   associated_data: '...',
 *   nonce: '...',
 * }
 */
export function decryptWechatResource(resource: {
  ciphertext: string;
  associated_data: string;
  nonce: string;
}): string {
  const key = env.WECHAT_PAY_API_V3_KEY;
  if (!key) throw new Error('WECHAT_PAY_API_V3_KEY not set');

  // API v3 密钥必须是 ≥32 字节
  const keyBuf = Buffer.from(key, 'utf8');
  if (keyBuf.length < 32) {
    throw new Error(
      `WECHAT_PAY_API_V3_KEY must be ≥32 bytes (got ${keyBuf.length})`,
    );
  }
  const key32 = keyBuf.subarray(0, 32);

  const ciphertextBuf = Buffer.from(resource.ciphertext, 'base64');
  // GCM:最后 16 字节是 auth tag
  const data = ciphertextBuf.subarray(0, ciphertextBuf.length - 16);
  const authTag = ciphertextBuf.subarray(ciphertextBuf.length - 16);

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key32,
    resource.nonce,
  );
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));

  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString('utf8');
}

/**
 * 解析微信回调 body(JSON)
 * 注意:微信 v3 回调是 AES 加密的 resource,需要先用 decryptWechatResource 解出明文
 * 这层只负责解析,不解密(解密在调用方做)
 */
export function parseWechatNotifyBody(body: string): {
  id?: string;
  create_time?: string;
  event_type?: string;
  resource_type?: string;
  resource?: {
    algorithm: string;
    ciphertext: string;
    associated_data: string;
    nonce: string;
  };
  summary?: string;
} | null {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/**
 * 验签(转发到 wechatCert,完整 RSA 验签 + 平台证书缓存)
 * 见 lib/wechatCert.ts
 */
export { verifyWechatV3Signature as verifyWechatSignature } from './wechatCert';
