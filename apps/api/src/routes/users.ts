import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/me
 * 返回当前匿名用户身份(不暴露 deviceId 原文)
 */
router.get('/me', (req, res) => {
  const user = req.user;
  res.json({
    id: user?.id ?? null,
    isNew: !user,
    firstSeen: user?.firstSeen,
    taskCount: user?.taskCount ?? 0,
  });
});

router.get('/my-tasks', async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.json({ tasks: [] });

  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      platform: true,
      status: true,
      amount: true,
      schoolName: true,
      createdAt: true,
      finishedAt: true,
    },
  });
  res.json({ tasks });
});

export default router;
