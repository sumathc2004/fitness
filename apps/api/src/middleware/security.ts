import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env';
import { forbidden, tooMany } from '../lib/errors';

const allowedOrigins = new Set([env.WEB_URL.replace(/\/$/, '')]);

/**
 * CSRF defence in depth (cookies are already SameSite=Lax): browsers always send Origin on cross-site
 * state-changing requests, so reject any whose Origin isn't our web app.
 */
export const originGuard: RequestHandler = (req, _res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin.replace(/\/$/, ''))) throw forbidden('Cross-origin request blocked');
  next();
};

const make = (windowMs: number, limit: number, key?: (req: any) => string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTest,
    keyGenerator: key ?? ((req) => req.ip ?? 'unknown'),
    handler: (_req, _res, next) => next(tooMany()),
  });

export const globalLimiter = make(60_000, 600);
export const loginLimiter = make(15 * 60_000, 20, (req) => `${req.ip}|${String(req.body?.identifier ?? '').toLowerCase()}`);
export const forgotLimiter = make(60 * 60_000, 8);
