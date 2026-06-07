import { PrismaClient } from '@prisma/client';

/**
 * 共享 Prisma 客户端。
 * 整个进程只一个实例,避免连接池浪费。
 * dev 时用 globalThis 缓存防止 HMR 重复 new。
 */
declare global {
  // eslint-disable-next-line no-var
  var __PRISMA__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__PRISMA__ ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? ['warn', 'error']
        : ['query', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__PRISMA__ = prisma;
}
