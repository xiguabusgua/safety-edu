import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { BadRequest } from '../lib/errors';
import { safeJson } from '../lib/safeJson';

const router = Router();

router.get('/', async (req, res) => {
  const platform = req.query.platform as string | undefined;
  const q = ((req.query.q as string) || '').trim();
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(50, Number(req.query.pageSize ?? 20));

  if (!platform || !['weban', 'jiangsu'].includes(platform)) {
    throw new BadRequest('platform 必须是 weban 或 jiangsu');
  }

  const where: Record<string, unknown> = { platform };
  if (q) {
    where.questionText = { contains: q };
  }

  const [rows, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: { hitCount: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.question.count({ where }),
  ]);

  const questions = rows.map((r) => ({
    ...r,
    options: safeJson(r.options),
  }));

  res.json({
    questions,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

router.get('/stats', async (_req, res) => {
  const byPlatform = await prisma.question.groupBy({
    by: ['platform'],
    _count: { _all: true },
  });
  res.json({ byPlatform });
});

export default router;
