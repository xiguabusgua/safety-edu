import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { BadRequest, NotFound } from '../lib/errors';
import { sendEmailCode, verifyEmailCode } from '../lib/emailCode';
import {
  createQrLogin,
  getQrStatusPublic,
  handleWechatCallback,
  mockConfirm,
} from '../lib/wechatQrLogin';
import { authLimiter } from '../lib/rateLimit';
import { env } from '../lib/env';

const router = Router();

const emailSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
});

const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

/**
 * POST /api/auth/email-code
 * 发邮箱验证码
 * dev 模式返 { devCode: '123456' } 用于演示
 */
router.post('/email-code', authLimiter, async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequest('邮箱格式不正确');
  }
  const r = await sendEmailCode(parsed.data.email);
  if ('error' in r) {
    if (r.error === 'cooldown') {
      throw new BadRequest(`请 ${Math.ceil(r.retryAfterMs / 1000)} 秒后再试`);
    }
    if (r.error === 'locked') {
      throw new BadRequest(
        `尝试次数过多,锁定 ${Math.ceil(r.retryAfterMs / 60000)} 分钟后重试`,
      );
    }
  }
  res.json(r);
});

/**
 * POST /api/auth/email-verify
 * 验证邮箱验证码 → 把 user.email 绑到当前 deviceId
 */
router.post('/email-verify', authLimiter, async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequest('参数错误');
  }
  const r = verifyEmailCode(parsed.data.email, parsed.data.code);
  if (!r.ok) {
    throw new BadRequest(r.reason ?? '验证失败');
  }

  // 绑 email 到当前 user
  const userId = req.userId;
  if (!userId) {
    throw new NotFound('用户身份未识别(请先访问任意页面)');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { email: parsed.data.email, emailVerifiedAt: new Date() },
  });

  res.json({ ok: true, email: parsed.data.email });
});

/**
 * POST /api/auth/wechat-qr
 * 生成微信扫码登录的 sceneId + qrUrl
 */
router.post('/wechat-qr', authLimiter, async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    throw new NotFound('用户身份未识别');
  }
  const deviceId = req.deviceId!;
  const { sceneId, qrUrl, mock } = createQrLogin(deviceId);
  res.json({ sceneId, qrUrl, mock });
});

/**
 * GET /api/auth/wechat-qr/:sceneId
 * 查扫码状态(前端轮询)
 * status: pending / scanned / confirmed / expired
 * 安全:只返给 sceneId 创建者(同 deviceId)openid
 */
router.get('/wechat-qr/:sceneId', authLimiter, async (req, res) => {
  const deviceId = req.deviceId!;
  const e = getQrStatusPublic(req.params.sceneId, deviceId);
  if (!e) return res.json({ status: 'expired' });
  res.json(e);
});

/**
 * POST /api/auth/wechat-callback
 * 微信回调(扫码成功,微信会重定向到 redirect_uri?code=xxx&state=sceneId)
 * 生产:用 code 换 openid,绑到 user
 * dev:不需要这个端点(走 mock-confirm)
 */
router.post('/wechat-callback', authLimiter, async (req, res) => {
  const schema = z.object({
    sceneId: z.string().min(8),
    code: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequest('参数错误');
  }
  const deviceId = req.deviceId!;
  const r = await handleWechatCallback(parsed.data.sceneId, parsed.data.code, deviceId);
  if (!r) {
    throw new BadRequest('回调处理失败(scene 不存在/已处理/非本人)');
  }
  res.json({ ok: true, openid: r.openid });
});

/**
 * POST /api/auth/wechat-mock-confirm
 * dev 模式:用户点"我已扫码"按钮调用,直接 confirm
 * 生产环境 404
 */
router.post('/wechat-mock-confirm', async (req, res) => {
  if (env.NODE_ENV === 'production') {
    throw new NotFound('not found');
  }
  const schema = z.object({ sceneId: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequest('参数错误');
  }
  const deviceId = req.deviceId!;
  const ok = await mockConfirm(parsed.data.sceneId, deviceId);
  if (!ok) throw new BadRequest('scene 不存在、已处理或非本人');
  res.json({ ok: true });
});

export default router;
