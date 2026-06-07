import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { BadRequest, Unauthorized, NotFound } from '../lib/errors';
import { signAdminToken, requireAdmin } from '../lib/auth';
import { startOfToday } from '../lib/utils/date';
import { authLimiter } from '../lib/rateLimit';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6).max(100),
});

const TASK_STATUSES = [
  'awaiting_payment',
  'pending',
  'running',
  'done',
  'failed',
  'timeout',
  'refunded', // 退款过滤时用到
] as const;

/**
 * POST /api/admin/login
 */
router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequest('参数错误');

  const { username, password } = parsed.data;
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin) throw new Unauthorized('账号或密码错误');

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) throw new Unauthorized('账号或密码错误');

  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  const token = signAdminToken({ id: admin.id, username: admin.username, role: admin.role });
  res.json({ token, admin: { id: admin.id, username: admin.username, role: admin.role } });
});

/**
 * GET /api/admin/tasks
 * 任务列表(带分页 + 状态过滤)
 */
router.get('/tasks', requireAdmin, async (req, res) => {
  const statusRaw = (req.query.status as string) || undefined;
  const platformRaw = (req.query.platform as string) || undefined;
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Number(req.query.pageSize ?? 50));

  // 白名单过滤 status / platform,防注入
  const status = statusRaw && (TASK_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : undefined;
  const platform =
    platformRaw && ['weban', 'jiangsu'].includes(platformRaw) ? platformRaw : undefined;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (platform) where.platform = platform;

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        userId: true,
        platform: true,
        status: true,
        schoolName: true,
        province: true,
        amount: true,
        createdAt: true,
        paidAt: true,
        finishedAt: true,
        errorMsg: true,
        user: { select: { id: true, deviceId: true, firstSeen: true, lastSeen: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  res.json({
    tasks,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

/**
 * GET /api/admin/stats
 * 顶部统计
 */
router.get('/stats', requireAdmin, async (_req, res) => {
  const [total, todayCount, revenue, failed, byPlatform, byStatus, byProvince, bySchool, uniqueUsers] =
    await Promise.all([
      prisma.task.count(),
      prisma.task.count({ where: { createdAt: { gte: startOfToday() } } }),
      // 收入 = 已支付 - 失败任务
      prisma.task.aggregate({
        _sum: { amount: true },
        where: { paidAt: { not: null }, status: { not: 'failed' } },
      }),
      prisma.task.count({ where: { status: 'failed' } }),
      prisma.task.groupBy({ by: ['platform'], _count: { _all: true }, _sum: { amount: true } }),
      prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.task.groupBy({
        by: ['province'],
        where: { province: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { province: 'desc' } },
        take: 30,
      }),
      prisma.task.groupBy({
        by: ['schoolName'],
        where: { schoolName: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { schoolName: 'desc' } },
        take: 30,
      }),
      prisma.user.count(),
    ]);

  res.json({
    total,
    todayCount,
    revenue: ((revenue._sum.amount ?? 0) / 100).toFixed(2),
    failed,
    uniqueUsers,
    byPlatform: byPlatform.map((b: any) => ({
      platform: b.platform,
      count: b._count._all,
      revenue: ((b._sum.amount ?? 0) / 100).toFixed(2),
    })),
    byStatus: byStatus.map((b: any) => ({ status: b.status, count: b._count._all })),
    byProvince: byProvince.map((b: any) => ({ province: b.province, count: b._count._all })),
    bySchool: bySchool.map((b: any) => ({ school: b.schoolName, count: b._count._all })),
  });
});

/**
 * GET /api/admin/tasks/:id/events
 * 任务详细日志
 */
router.get('/tasks/:id/events', requireAdmin, async (req, res) => {
  const events = await prisma.taskEvent.findMany({
    where: { taskId: req.params.id },
    orderBy: { id: 'asc' },
    take: 500,
  });
  res.json({ events });
});



/**
 * GET /api/admin/questions
 * 题库列表(带搜索 + 分页)
 */
router.get('/questions', requireAdmin, async (req, res) => {
  const platform = (req.query.platform as string) || undefined;
  const q = ((req.query.q as string) || '').trim();
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Number(req.query.pageSize ?? 30));

  const where: Record<string, unknown> = {};
  if (platform && ['weban', 'jiangsu'].includes(platform)) where.platform = platform;
  if (q) where.questionText = { contains: q };

  const [rows, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: [{ platform: 'asc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.question.count({ where }),
  ]);

  res.json({
    questions: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

/**
 * GET /api/admin/questions/stats
 * 题库按平台统计
 */
router.get('/questions/stats', requireAdmin, async (_req, res) => {
  const byPlatform = await prisma.question.groupBy({
    by: ['platform'],
    _count: { _all: true },
  });
  res.json({ byPlatform });
});

/**
 * POST /api/admin/questions/import
 * 批量导入题库(WeBan answer.json 格式)
 * Body: { platform, dryRun?, items: [{questionText, options, answer, questionType?, category?}] }
 * - dryRun=true:只统计不写入
 * - 不传 dryRun:实际写入
 */
router.post('/questions/import', requireAdmin, async (req, res) => {
  const schema = z.object({
    platform: z.enum(['weban', 'jiangsu']),
    dryRun: z.boolean().optional().default(false),
    items: z
      .array(
        z.object({
          questionText: z.string().min(1).max(2000),
          options: z.array(z.string()).max(20).nullable().optional(),
          answer: z.string().min(1).max(500),
          questionType: z.enum(['single', 'multiple', 'judge']).default('single'),
          category: z.string().max(100).optional().nullable(),
        }),
      )
      .min(1)
      .max(5000),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequest(
      '参数错误:' + parsed.error.issues.map((i) => i.message).join('; '),
    );
  }

  const { platform, items, dryRun } = parsed.data;

  if (dryRun) {
    return res.json({
      dryRun: true,
      platform,
      count: items.length,
      sample: items.slice(0, 3),
    });
  }

  // 实际写入:用 createMany 批量(SQLite 支持,Prisma 5 也支持)
  const data = items.map((it) => ({
    platform,
    questionText: it.questionText,
    options: it.options ? JSON.stringify(it.options) : null,
    answer: it.answer,
    questionType: it.questionType,
    category: it.category ?? null,
  }));

  // SQLite 一次 createMany 上限 999,这里 max 5000 所以分批
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH) {
    const slice = data.slice(i, i + BATCH);
    await prisma.question.createMany({ data: slice });
    inserted += slice.length;
  }

  res.json({
    dryRun: false,
    platform,
    submitted: items.length,
    inserted,
  });
});

/**
 * DELETE /api/admin/questions/:id
 * 删除单题
 */
router.delete('/questions/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new BadRequest('id 必须是数字');
  const existing = await prisma.question.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFound('题目不存在');
  await prisma.question.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
