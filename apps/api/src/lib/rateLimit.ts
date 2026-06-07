import rateLimit, { type Options } from 'express-rate-limit';

const base: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  limit: Number(process.env.RATE_LIMIT_DEFAULT ?? 60),
  message: {
    error: {
      code: 'too_many_requests',
      message: '请求过于频繁,请稍后再试',
    },
  },
};

export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_LOGIN ?? 10),
});

export const payLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PAY ?? 5),
});

export const taskLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_TASK ?? 10),
});

export const generalLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_GLOBAL ?? 120),
});
