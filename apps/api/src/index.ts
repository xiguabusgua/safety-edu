import './lib/env'; // 必须先 import,启动时 fail-fast
import 'express-async-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './lib/env';
import { prisma } from './lib/prisma';

import tasksRouter from './routes/tasks';
import payRouter from './routes/pay';
import streamRouter from './routes/stream';
import adminRouter from './routes/admin';
import questionsRouter from './routes/questions';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import healthRouter from './routes/health';
import { deviceIdMiddleware } from './middleware/deviceId';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandler, notFoundHandler } from './lib/errors';
import { generalLimiter } from './lib/rateLimit';

const app = express();

app.set('trust proxy', 1);
app.use(requestIdMiddleware);
app.use(helmet());
app.use(generalLimiter); // 全局兜底,先于路由

// CORS 严格化:不传 origin 时默认拒绝,只放白名单
const allowedOrigins = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : [];
app.use(
  cors({
    origin: (origin, cb) => {
      // 同源请求(无 origin header)或白名单内放行
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

app.use(compression());

// 全局 JSON + raw body 捕获(供微信 V3 验签 + 支付宝验签用)
app.use(
  express.json({
    limit: '256kb',
    verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
      // 保留 raw body 给验签用
      req.rawBody = buf.toString('utf8');
    },
  }),
);
app.use(cookieParser(env.COOKIE_SECRET));

// 用户识别中间件(在 routes 之前,让所有路由都能拿到 deviceId / userId)
app.use(deviceIdMiddleware);

// ====== 生产模式:Express 直接 serve 前端 dist (无需额外 nginx location / serve 进程) ======
if (env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(distPath, { maxAge: '1y', immutable: true }));
  // SPA fallback:所有非 /api 路径返回 index.html
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use('/api/health', healthRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/pay', payRouter);
app.use('/api/stream', streamRouter);
app.use('/api/admin', adminRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/auth', authRouter);
app.use('/api', usersRouter); // /api/me, /api/my-tasks

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[api] listening on :${env.PORT} (env=${env.NODE_ENV})`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
