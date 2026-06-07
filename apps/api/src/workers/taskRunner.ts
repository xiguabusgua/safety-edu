/**
 * TaskRunner
 * 独立进程，PM2 跑一个。
 * 轮询 tasks WHERE status='pending' AND paidAt IS NOT NULL
 * 取出后 fork Python 子进程执行，回写状态 + 推事件。
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { PythonJob, type PyEvent } from '../lib/pyBridge';
import { eventBus } from '../lib/eventBus';
import { decryptAccount } from '../lib/crypto';

const CONCURRENCY = Number(process.env.RUNNER_CONCURRENCY ?? 2);
const POLL_INTERVAL_MS = 2000;
const TASK_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟

const activeJobs = new Map<string, PythonJob>();

async function tick() {
  // 当前在跑的
  if (activeJobs.size >= CONCURRENCY) return;

  // 找一个待执行的：status=pending 且 paidAt 不为空
  const task = await prisma.task.findFirst({
    where: {
      status: 'pending',
      paidAt: { not: null },
    },
    orderBy: { paidAt: 'asc' },
  });
  if (!task) return;

  // 标记为 running(乐观锁:只在 status=pending 时才更新,避免多 runner 抢同一任务)
  const updated = await prisma.task.updateMany({
    where: { id: task.id, status: 'pending' },
    data: { status: 'running', startedAt: new Date() },
  });
  if (updated.count === 0) {
    // 已经被别的 runner 抢走,放弃
    return;
  }

  // 推"开始"事件
  emitEvent(task.id, { event: 'phase', phase: 'login' });

  // 拿凭据
  const creds = decryptAccount({
    cipher: task.credsCipher,
    iv: task.credsIv,
    tag: task.credsTag,
  });

  // options 可能是 String(JSON) - parse
  let opts: any = {};
  if (task.options) {
    try {
      opts = typeof task.options === 'string' ? JSON.parse(task.options) : task.options;
    } catch {
      opts = {};
    }
  }

  // 预加载题库(Node 端查 Prisma,避免 Python worker 直连 SQLite/MySQL)
  const questions = await prisma.question.findMany({
    where: { platform: task.platform },
    select: { questionText: true, answer: true },
  });
  const questionMap: Record<string, string> = {};
  for (const q of questions) {
    questionMap[q.questionText] = q.answer;
  }

  const payload = {
    task_id: task.id,
    platform: task.platform,
    credentials: creds,
    options: opts,
    question_map: questionMap,
  };

  // 启动 Python 子进程
  const job = new PythonJob(task.id, payload);
  activeJobs.set(task.id, job);

  // 事件回流
  job.on('event', async (evt: PyEvent) => {
    // 1. 推 SSE
    emitEvent(task.id, evt);

    // 2. 写 DB 事件日志
    await prisma.taskEvent
      .create({
        data: {
          taskId: task.id,
          event: evt.event,
          payload: JSON.stringify(evt),
        },
      })
      .catch(() => null);

    // 3. 更新 progressJson
    if (evt.event === 'progress') {
      await prisma.task.update({
        where: { id: task.id },
        data: { progressJson: JSON.stringify(evt) },
      });
    }

    // 4. 终态
    if (evt.event === 'done') {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'done',
          finishedAt: new Date(),
          result: JSON.stringify(evt.result ?? null),
          progressJson: null,
        },
      });
      cleanup(task.id);
    } else if (evt.event === 'error') {
      const fatal = evt.code !== 'captcha_blocked';
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMsg: evt.msg,
        },
      });
      cleanup(task.id);
    }
  });

  job.on('exit', async (code) => {
    // 兜底：如果 exit 时没收到 done/error
    const t = await prisma.task.findUnique({ where: { id: task.id } });
    if (t && (t.status === 'running')) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: code === 0 ? 'done' : 'failed',
          finishedAt: new Date(),
          errorMsg: code === 0 ? null : `python 异常退出 (code=${code})`,
        },
      });
    }
    cleanup(task.id);
  });

  job.start();
}

function cleanup(taskId: string) {
  const job = activeJobs.get(taskId);
  if (job) {
    job.kill();
    activeJobs.delete(taskId);
  }
}

function emitEvent(taskId: string, payload: any) {
  eventBus.emitTo(`task:${taskId}`, payload);
}

// 主循环
console.log(`[runner] starting with concurrency=${CONCURRENCY}`);

setInterval(() => {
  tick().catch((err) => console.error('[runner] tick error:', err));
}, POLL_INTERVAL_MS);

// 超时监控(批量 findMany 避免 N+1)
setInterval(async () => {
  if (activeJobs.size === 0) return;
  const now = Date.now();
  const taskIds = Array.from(activeJobs.keys());
  try {
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds }, status: 'running' },
      select: { id: true, startedAt: true },
    });
    const startedMap = new Map<string, Date | null>(tasks.map((t: any) => [t.id, t.startedAt as Date | null]));
    for (const [taskId, job] of activeJobs) {
      const startedAt = startedMap.get(taskId) as Date | null | undefined;
      const start = startedAt ? (startedAt as Date).getTime() : now;
      if (now - start > TASK_TIMEOUT_MS) {
        console.warn(`[runner] task ${taskId} timeout, killing`);
        job.kill();
        emitEvent(taskId, { event: 'error', code: 'timeout', msg: '任务超时' });
        await prisma.task.update({
          where: { id: taskId },
          data: { status: 'failed', finishedAt: new Date(), errorMsg: 'timeout' },
        });
        activeJobs.delete(taskId);
      }
    }
  } catch (err) {
    console.error('[runner] timeout monitor error:', err);
  }
}, 30 * 1000);

const shutdown = async () => {
  for (const [, job] of activeJobs) job.kill();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
