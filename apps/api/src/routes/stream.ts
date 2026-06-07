import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { NotFound } from '../lib/errors';
import { eventBus } from '../lib/eventBus';

const router = Router();

/**
 * GET /api/stream/:taskId
 * Server-Sent Events:推送任务进度
 */
router.get('/:taskId', async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.taskId },
    select: { id: true, status: true, progressJson: true, result: true, errorMsg: true },
  });
  if (!task) throw new NotFound('任务不存在');

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  // 把 request id 也带到 SSE header,前端调试用
  if (req.id) res.setHeader('X-Request-Id', req.id);
  res.flushHeaders();

  // 1. 立刻推一次当前状态
  writeEvent(res, {
    event: task.status === 'awaiting_payment' ? 'awaiting_payment' : task.status === 'pending' ? 'log' : 'phase',
    msg: task.status,
  });

  // 2. 推历史日志(最多 200 条)
  const events = await prisma.taskEvent.findMany({
    where: { taskId: task.id },
    orderBy: { id: 'asc' },
    take: 200,
  });
  for (const e of events) {
    writeEvent(res, e.payload as unknown as Record<string, unknown>);
  }

  // 3. 订阅实时事件
  const onEvent = (payload: Record<string, unknown>) => writeEvent(res, payload);
  eventBus.on(`task:${task.id}`, onEvent);

  // 4. 心跳
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15000);

  // 5. 收尾
  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off(`task:${task.id}`, onEvent);
    res.end();
  });
});

function writeEvent(res: import('express').Response, payload: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export default router;
