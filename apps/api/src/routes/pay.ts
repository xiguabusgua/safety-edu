import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { BadRequest, NotFound, Conflict, Forbidden } from '../lib/errors';
import {
  createWechatNativeOrder,
  decryptWechatResource,
  parseWechatNotifyBody,
  verifyWechatSignature,
} from '../lib/wechatPay';
import { payLimiter } from '../lib/rateLimit';
import { env } from '../lib/env';
import { isWechatNotifyIp } from '../lib/wechatPayIps';

const router = Router();

const createPaySchema = z.object({
  taskId: z.string().min(1),
  channel: z.enum(['wechat_native', 'mock']).default('wechat_native'),
});

/**
 * mock 模式判定(必须严格):
 *  1) MCHID 和 APPID 要么都配要么都不配(XOR 不一致 → 强制 mock 防误判)
 *  2) 显式 PAY_MODE=mock 也走 mock
 *  这样避免"配了 MCHID 忘了配 APPID(或反向)"导致拿半套配置去签真请求。
 */
const _mchidMissing = !env.WECHAT_PAY_MCHID;
const _appidMissing = !env.WECHAT_PAY_APPID;
const isMockMode = _mchidMissing !== _appidMissing ? true : (process.env.PAY_MODE === 'mock');

/**
 * dev 模式假支付回调的本地/内网 IP 白名单。
 *  - 127.0.0.1 / ::1 / ::ffff:127.0.0.1
 *  - 10.x.x.x / 192.168.x.x / 172.16-31.x.x(局域网)
 * 防 dev 误暴露到公网时被外部触发假"已支付"。
 */
function isLocalRequest(req: import('express').Request): boolean {
  const ip = (req.ip || req.socket?.remoteAddress || '').toString();
  const clean = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
  const m = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(clean);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/**
 * POST /api/pay/create
 * 创建支付订单。
 * - 没配 WECHAT_PAY_MCHID 时:dev 模式,codeUrl 走 /api/pay/mock 本地假支付页
 * - 配了 MCHID: 走真微信 V3 native(codeUrl 是 weixin:// 协议)
 */
router.post('/create', payLimiter, async (req, res) => {
  const parsed = createPaySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequest(
      '参数错误:' + parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }

  const { taskId } = parsed.data;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFound('任务不存在');
  if (task.userId && task.userId !== req.userId) {
    throw new Forbidden('无权操作该任务');
  }
  if (task.status !== 'awaiting_payment') {
    throw new Conflict('任务状态不允许支付');
  }

  const subject = `安全教育 - ${task.platform}`;
  const order = await createWechatNativeOrder({
    outTradeNo: task.id,
    totalAmount: task.amount,
    subject,
    // dev 模式:用请求 host 拼 mock URL(避免 PUBLIC_BASE_URL 写死后端口漂移)
    baseUrlOverride: isMockMode
      ? `${req.protocol}://${req.headers.host}`
      : undefined,
  });

  res.json({
    taskId: task.id,
    channel: isMockMode ? 'mock' : 'wechat_native',
    payUrl: order.codeUrl,
    qrCode: order.codeUrl,
    amount: task.amount,
    amountYuan: (task.amount / 100).toFixed(2),
  });
});

/**
 * POST /api/pay/notify-wechat
 * 微信支付 V3 异步通知(完整验签 + 解密 + 幂等)
 * 微信回调官方 IP 段:见 lib/wechatPayIps.ts(如有更新同步到该文件)
 */
router.post('/notify-wechat', payLimiter, async (req, res) => {
  // IP 白名单(必须先于验签,防止伪造通知消耗 CPU/触发 DB 写)
  if (!isWechatNotifyIp(req.ip)) {
    console.warn(`[pay/wechat] notify from non-wechat ip: ${req.ip}`);
    return res.status(403).json({ code: 'IP_NOT_ALLOWED' });
  }
  const headers = req.headers as Record<string, string | string[] | undefined>;
  const rawBody = req.rawBody;
  if (!rawBody) {
    return res.status(400).json({ code: 'PARAM_ERROR', message: 'body 缺失' });
  }

  const sigOk = await verifyWechatSignature(headers, rawBody);
  if (!sigOk) {
    console.warn('[pay/wechat] signature verify failed');
    // 验签失败仍返 200 + 业务错误码,避免微信无限重试
    return res.json({ code: 'SIGN_INVALID', message: '签名验证失败' });
  }

  const envelope = parseWechatNotifyBody(rawBody);
  if (!envelope || !envelope.resource) {
    return res.status(400).json({ code: 'PARAM_ERROR', message: 'body 格式错误' });
  }

  let plain: string;
  try {
    plain = decryptWechatResource(envelope.resource);
  } catch (err) {
    console.error('[pay/wechat] decrypt error:', err);
    return res.json({ code: 'DECRYPT_ERROR', message: '解密失败' });
  }

  let decrypted: {
    out_trade_no: string;
    transaction_id?: string;
    trade_state: string;
    success_time?: string;
  };
  try {
    decrypted = JSON.parse(plain);
  } catch (err) {
    console.error('[pay/wechat] parse decrypted error:', err);
    return res.json({ code: 'PARSE_ERROR', message: '明文 JSON 解析失败' });
  }

  if (decrypted.trade_state !== 'SUCCESS') {
    return res.json({ code: 'SUCCESS', message: '收到(非 SUCCESS)' });
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      const t = await tx.task.findUnique({ where: { id: decrypted.out_trade_no } });
      if (!t) return;
      // 幂等:已支付的任务不再处理
      if (t.status !== 'awaiting_payment') return;
      await tx.task.update({
        where: { id: decrypted.out_trade_no },
        data: {
          status: 'pending',
          paidAt: new Date(),
          payTradeNo: decrypted.transaction_id,
          payChannel: 'wechat',
        },
      });
      console.log(`[pay/wechat] task ${decrypted.out_trade_no} paid (${decrypted.transaction_id})`);
    });
  } catch (err) {
    console.error('[pay/wechat] tx error:', err);
    return res.json({ code: 'ERROR', message: '处理失败' });
  }

  res.json({ code: 'SUCCESS', message: '成功' });
});

/**
 * POST /api/pay/mock-callback
 * dev only:dev 模式下假支付页的"我已支付"按钮触发。
 * 生产环境(NODE_ENV=production)直接 404,防滥用。
 */
router.post('/mock-callback', payLimiter, async (req, res) => {
  if (env.NODE_ENV === 'production') {
    throw new NotFound('not found');
  }
  // dev 模式也只接受本地/内网调用,防误暴露到公网时被外部触发假"已支付"
  if (!isLocalRequest(req)) {
    console.warn(`[pay/mock-callback] rejected non-local ip: ${req.ip}`);
    return res.status(403).json({ code: 'IP_NOT_ALLOWED' });
  }
  const { out_trade_no } = req.body || {};
  if (!out_trade_no) {
    throw new BadRequest('缺少 out_trade_no');
  }
  const tradeNo = 'MOCK-WX-' + Date.now();
  await prisma.$transaction(async (tx: any) => {
    const t = await tx.task.findUnique({ where: { id: out_trade_no } });
    if (!t) return;
    if (t.status !== 'awaiting_payment') return;
    await tx.task.update({
      where: { id: out_trade_no },
      data: {
        status: 'pending',
        paidAt: new Date(),
        payTradeNo: tradeNo,
        payChannel: 'wechat',
      },
    });
    console.log(`[pay/wechat-mock] task ${out_trade_no} paid (${tradeNo})`);
  });
  res.json({ ok: true });
});

/**
 * GET /api/pay/mock
 * dev only:假支付页(当 WECHAT_PAY_MCHID 没配时,createWechatNativeOrder 返的 codeUrl 跳这里)
 */
router.get('/mock', payLimiter, async (req, res) => {
  const outTradeNo = String(req.query.out_trade_no || '');
  if (!outTradeNo) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send('<h1>missing out_trade_no</h1>');
  }
  const task = await prisma.task.findUnique({
    where: { id: outTradeNo },
    select: { id: true, status: true, amount: true, platform: true },
  });
  if (!task) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send('<h1>task not found</h1>');
  }
  const amountYuan = (task.amount / 100).toFixed(2);
  const isPaid = task.status !== 'awaiting_payment';

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mock 支付 - safety edu</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
      background: #F7F6F3;
      color: #111;
      margin: 0;
      padding: 40px 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      max-width: 420px;
      width: 100%;
      background: #fff;
      border: 1px solid #D9D6CF;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    h1 { font-size: 18px; margin: 0 0 4px; font-weight: 600; }
    .sub { font-size: 12px; color: #787774; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #EFEEEA; font-size: 14px; }
    .row:last-of-type { border-bottom: none; }
    .label { color: #787774; }
    .value { font-family: 'SF Mono', monospace; }
    .amount { font-size: 32px; font-weight: 600; margin: 24px 0; text-align: center; letter-spacing: -0.03em; }
    .btn {
      display: block;
      width: 100%;
      padding: 14px;
      background: #07C160;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { background: #06A050; }
    .btn:active { transform: scale(0.98); }
    .btn:disabled { background: #787774; cursor: not-allowed; }
    .btn-paid { background: #346538; }
    .meta { font-size: 10px; color: #787774; text-align: center; margin-top: 16px; letter-spacing: 0.1em; text-transform: uppercase; }
    .badge { display: inline-block; padding: 2px 8px; background: #EDF3EC; color: #346538; border-radius: 9999px; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Mock Wechat Pay · dev only</span>
    <h1>支付订单</h1>
    <p class="sub">仅 dev 模式可见,生产环境会跳微信支付真实页面。</p>
    <div class="row">
      <span class="label">渠道</span>
      <span class="value">微信支付(native)</span>
    </div>
    <div class="row">
      <span class="label">订单号</span>
      <span class="value" style="font-size:11px">${task.id}</span>
    </div>
    <div class="amount">¥${amountYuan}</div>
    <button id="pay-btn" class="btn ${isPaid ? 'btn-paid' : ''}" ${isPaid ? 'disabled' : ''}>
      ${isPaid ? '✓ 已支付' : '我已支付(模拟)'}
    </button>
    <p class="meta">POST /api/pay/mock-callback</p>
  </div>
  <script>
    const btn = document.getElementById('pay-btn');
    if (btn && !btn.disabled) {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = '处理中...';
        try {
          const r = await fetch('/api/pay/mock-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ out_trade_no: ${JSON.stringify(outTradeNo)} }),
          });
          if (r.ok) {
            btn.className = 'btn btn-paid';
            btn.textContent = '✓ 已支付 · 跳转中';
            setTimeout(() => {
              window.location.href = '/task/${outTradeNo}';
            }, 800);
          } else {
            btn.textContent = '失败,重试';
            btn.disabled = false;
          }
        } catch (e) {
          btn.textContent = '网络错误';
          btn.disabled = false;
        }
      });
    }
  </script>
</body>
</html>`);
});

/**
 * GET /api/pay/status/:taskId
 * 前端轮询支付状态(兜底用,SSE 失败时用这个)
 */
router.get('/status/:taskId', async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.taskId },
    select: { status: true, paidAt: true },
  });
  if (!task) throw new NotFound('任务不存在');
  res.json(task);
});

export default router;
