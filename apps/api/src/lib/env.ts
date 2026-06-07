import 'dotenv/config';
import { z } from 'zod';

/**
 * 启动时校验环境变量。
 * 缺关键配置时立即 fail-fast,不要带着弱配置跑。
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().optional(),
  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 chars'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  ACCOUNT_ENC_KEY: z.string().min(1, 'ACCOUNT_ENC_KEY is required'),
  PUBLIC_BASE_URL: z.string().url().optional(),
  PAY_MODE: z.enum(['mock', 'real']).default('mock'),
  // 微信支付 V3(原生)
  WECHAT_PAY_MCHID: z.string().optional(),
  WECHAT_PAY_APPID: z.string().optional(),
  WECHAT_PAY_SERIAL_NO: z.string().optional(),
  WECHAT_PAY_PRIVATE_KEY: z.string().optional(), // PEM
  WECHAT_PAY_NOTIFY_URL: z.string().url().optional(),
  WECHAT_PAY_API_V3_KEY: z.string().optional(), // 32 字节,回调解密用
  RUNNER_CONCURRENCY: z.coerce.number().int().positive().default(2),

  // 微信扫码登录(开放平台 / 公众号 OAuth)
  WECHAT_OPEN_APPID: z.string().optional(),
  WECHAT_OPEN_SECRET: z.string().optional(),
  WECHAT_OPEN_REDIRECT: z.string().url().optional(),
  // SMTP(邮箱验证码生产发送)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[env] invalid configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production') {
  if (parsed.data.JWT_SECRET === 'dev-only-change-me' ||
      parsed.data.JWT_SECRET.length < 32) {
    console.error('[env] FATAL: JWT_SECRET is weak in production');
    process.exit(1);
  }
  if (parsed.data.COOKIE_SECRET === 'dev-cookie-secret' ||
      parsed.data.COOKIE_SECRET.length < 32) {
    console.error('[env] FATAL: COOKIE_SECRET is weak in production');
    process.exit(1);
  }
  if (parsed.data.CORS_ORIGIN === '*') {
    console.error('[env] FATAL: CORS_ORIGIN=* is not allowed in production');
    process.exit(1);
  }
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
