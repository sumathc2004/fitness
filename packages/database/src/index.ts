import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __gymPrisma: PrismaClient | undefined;
}

/**
 * Single PrismaClient per process (survives hot reloads in dev).
 * Connection settings come from DATABASE_URL.
 */
export const prisma: PrismaClient =
  globalThis.__gymPrisma ??
  new PrismaClient({
    log: process.env.PRISMA_LOG === 'query' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalThis.__gymPrisma = prisma;

export * from '@prisma/client';
