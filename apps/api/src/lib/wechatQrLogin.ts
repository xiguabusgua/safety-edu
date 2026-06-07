/**
 * 微信扫码登录
 *
 * dev 模式:返 mock sceneId + 显示假二维码,用户点"我已扫码"模拟回调
 * 生产:接微信开放平台 / 公众号 OAuth
 *
 * 数据流:
 *   1. 前端调 /api/auth/wechat-qr → 拿 sceneId + qrUrl
 *   2. 用户用微信扫
 *   3. 微信回调到 /api/auth/wechat-callback?code=xxx&state=sceneId
 *   4. 后端用 code 换 openid,set 关联到当前 cookie user
 *   5. 前端轮询 /api/auth/wechat-qr/:sceneId 看扫码结果
 */
import crypto from 'crypto';
import { env } from './env';
import { prisma } from './prisma';

const TTL_MS = 5 * 60 * 1000; // 5 分钟

interface QrEntry {
  sceneId: string;
  deviceId: string;
  status: 'pending' | 'scanned' | 'confirmed' | 'expired';
  openid?: string;
  expiresAt: number;
}
const qrStore = new Map<string, QrEntry>();

/** 生成 sceneId + 二维码 URL(返回给前端展示) */
export function createQrLogin(deviceId: string): { sceneId: string; qrUrl: string; mock: boolean } {
  const sceneId = crypto.randomBytes(16).toString('hex');
  const entry: QrEntry = {
    sceneId,
    deviceId,
    status: 'pending',
    expiresAt: Date.now() + TTL_MS,
  };
  qrStore.set(sceneId, entry);

  // 生产:拼微信 OAuth URL
  // https://open.weixin.qq.com/connect/qrconnect?appid=xxx&redirect_uri=...&response_type=code&scope=snsapi_login&state=sceneId
  // dev:返本地 mock URL
  const isMock = !env.WECHAT_OPEN_APPID;
  const qrUrl = isMock
    ? `/api/auth/wechat-mock?sceneId=${sceneId}`
        : `https://open.weixin.qq.com/connect/qrconnect?appid=${env.WECHAT_OPEN_APPID}&redirect_uri=${encodeURIComponent(env.WECHAT_OPEN_REDIRECT ?? '')}&response_type=code&scope=snsapi_login&state=${sceneId}`;

  return { sceneId, qrUrl, mock: isMock };
}

/** 查扫码状态(前端轮询) */
export function getQrStatus(sceneId: string): QrEntry | null {
  const e = qrStore.get(sceneId);
  if (!e) return null;
  if (Date.now() > e.expiresAt && e.status === 'pending') {
    e.status = 'expired';
    qrStore.set(sceneId, e);
  }
  return e;
}

/** 查扫码状态(对外返,不暴露 openid 给 expired/非本人的 scene) */
export function getQrStatusPublic(
  sceneId: string,
  requestDeviceId: string,
): { status: string; openid?: string } | null {
  const e = getQrStatus(sceneId);
  if (!e) return null;
  // 必须是创建这个 sceneId 的同一 device 才能看 openid
  if (e.deviceId !== requestDeviceId) {
    return { status: e.status };
  }
  // expired 后清掉 openid(防止历史泄露)
  if (e.status === 'expired') {
    return { status: 'expired' };
  }
  return { status: e.status, openid: e.openid };
}

/**
 * 微信回调:code 换 openid,绑到 user
 * 生产:用 code + appid + secret 调微信 API 拿 openid
 * dev:直接给个 mock openid
 *
 * @param requestDeviceId  当前请求的 deviceId,必须匹配 sceneId 创建者
 */
export async function handleWechatCallback(
  sceneId: string,
  code: string,
  requestDeviceId: string,
): Promise<{ openid: string } | null> {
  const entry = qrStore.get(sceneId);
  if (!entry) return null;
  if (entry.status !== 'pending') return null;
  if (entry.deviceId !== requestDeviceId) return null; // 防冒充
  if (Date.now() > entry.expiresAt) {
    entry.status = 'expired';
    return null;
  }

  let openid: string;
  if (env.WECHAT_OPEN_APPID && env.WECHAT_OPEN_SECRET) {
    // 生产: 调微信 /sns/oauth2/access_token 用 code 换 openid
    openid = `OPEN-${code}`;
  } else {
    openid = `MOCK-OPEN-${code.slice(0, 8)}`;
  }

  entry.status = 'confirmed';
  entry.openid = openid;
  qrStore.set(sceneId, entry);

  // 绑到当前 user(按 deviceId 找)
  await prisma.user.updateMany({
    where: { deviceId: requestDeviceId },
    data: { wechatOpenid: openid },
  });

  return { openid };
}

/**
 * dev 模式:用户点 mock 页"我已扫码"按钮时调
 * 直接 confirm 这个 sceneId
 *
 * @param requestDeviceId  当前请求的 deviceId,必须匹配 sceneId 创建者
 */
export async function mockConfirm(
  sceneId: string,
  requestDeviceId: string,
): Promise<boolean> {
  const e = qrStore.get(sceneId);
  if (!e) return false;
  if (e.status !== 'pending') return false;
  if (e.deviceId !== requestDeviceId) return false; // 防冒充
  e.status = 'confirmed';
  e.openid = `MOCK-OPEN-${sceneId.slice(0, 8)}`;
  qrStore.set(sceneId, e);

  // 绑到当前 user
  await prisma.user.updateMany({
    where: { deviceId: requestDeviceId },
    data: { wechatOpenid: e.openid },
  });

  return true;
}
