import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

const STARTED_AT = Date.now();
const VERSION = process.env.npm_package_version ?? '0.1.0';

router.get('/', async (_req, res) => {
  const start = Date.now();
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const dbLatencyMs = Date.now() - start;

  const status = dbOk ? 'ok' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    ts: Date.now(),
    uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000),
    version: VERSION,
    checks: {
      db: { ok: dbOk, latencyMs: dbLatencyMs },
    },
  });
});

export default router;
