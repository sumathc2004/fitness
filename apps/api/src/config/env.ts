import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load the monorepo-root .env (apps/api/src/config → ../../../../.env). Real environment variables always win.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  API_PORT: z.coerce.number().int().default(4000),
  WEB_URL: z.string().url().default('http://localhost:3100'),
  ACCESS_TOKEN_SECRET: z.string().min(32, 'ACCESS_TOKEN_SECRET must be at least 32 characters'),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().positive().default(30),
  PASSWORD_RESET_TTL_MIN: z.coerce.number().positive().default(30),
  COOKIE_SECURE: bool.default('false'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('Gym Platform <no-reply@gym.local>'),
  DEVICE_API_KEY: z.string().optional().default(''),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  // Fail fast with a readable message — never start with a half-configured security setup.
  throw new Error(`Invalid environment configuration:\n${lines}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
