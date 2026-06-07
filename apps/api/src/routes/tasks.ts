import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { BadRequest, NotFound } from '../lib/errors';
import { encryptAccount, weibanCredsSchema, jiangsuCredsSchema } from '../lib/crypto';
import { safeJson } from '../lib/safeJson';
import { pricingForPlatform } from '../lib/pricing';
import { inferProvince } from '../lib/utils/province';

const router = Router();

const notifySchema = z
  .object({
    channel: z.enum(['email', 'wechat']),
    target: z.string().min(1).max(500),
  })
  .optional();

const createSchema = z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('weban'),
    creds: weibanCredsSchema,
    options: z
      .object({
        study: z.boolean().default(true),
        exam: z.boolean().default(true),
        maxExamRounds: z.number().int().min(1).max(5).default(3),
      })
      .optional(),
    notify: notifySchema,
  }),
  z.object({
    platform: z.literal('jiangsu'),
    creds: jiangsuCredsSchema,
    options: z
      .object({
        study: z.boolean().default(true),
        exam: z.boolean().default(true),
      })
      .optional(),
    notify: notifySchema,
  }),
]);

/**
 * POST /api/tasks
 * 创建任务 + 返回 taskId + 应付金额
 * （实际发起支付在 /api/pay/create）
 */
router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequest(
      '参数错误:' + parsed.error.issues.map((i) => i.message).join('; '),
    );
  }

  const { platform, creds, options, notify } = parsed.data;
  const userId = req.userId;

  const schoolName = ('school' in creds ? (creds as Record<string, unknown>).school : null) as string | null;
  const province = inferProvince(platform, schoolName);
  const enc = encryptAccount(creds as Record<string, unknown>);
  const amount = pricingForPlatform(platform);

  // 一个事务:创建 task + 累加 user.taskCount
  // 避免 task 建了但 user 计数没更新的不一致
  const task = await prisma.$transaction(async (tx) => {
    const t = await tx.task.create({
      data: {
        userId: userId ?? null,
        platform,
        status: 'awaiting_payment',
        schoolName,
        province,
        credsCipher: enc.cipher,
        credsIv: enc.iv,
        credsTag: enc.tag,
        amount,
        options: options ? JSON.stringify(options) : null,
        notifyChannel: notify?.channel ?? null,
        notifyTarget: notify?.target ?? null,
      },
      select: { id: true, amount: true, status: true },
    });

    if (userId) {
      await tx.user.update({
        where: { id: userId },
        data: {
          taskCount: { increment: 1 },
          ...(province ? { province } : {}),
          ...(schoolName ? { lastSchool: schoolName } : {}),
        },
      });
    }

    return t;
  });

  res.json({
    taskId: task.id,
    amount: task.amount,
    amountYuan: (task.amount / 100).toFixed(2),
    status: task.status,
  });
});

/**
 * GET /api/tasks/:id
 * 查任务当前状态(不需要鉴权,taskId 即访问令牌)
 */
router.get('/:id', async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      platform: true,
      status: true,
      amount: true,
      schoolName: true,
      province: true,
      createdAt: true,
      paidAt: true,
      startedAt: true,
      finishedAt: true,
      progressJson: true,
      result: true,
      errorMsg: true,
    },
  });
  if (!task) throw new NotFound('任务不存在');

  // SQLite 模式:result / progressJson / options 都是 String(JSON)
  res.json({
    ...task,
    result: task.result ? safeJson(task.result) : null,
    progressJson: task.progressJson ? safeJson(task.progressJson) : null,
  });
});

export default router;
