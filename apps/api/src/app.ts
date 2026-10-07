import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { prisma } from '@gym/database';
import { env, isTest } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error';
import { globalLimiter, originGuard } from './middleware/security';
import { authRouter } from './routes/auth.routes';
import { adminRouter } from './routes/dashboards.routes';
import { clientsRouter, staffPasswordRouter, trainersRouter } from './routes/people.routes';
import { assetsRouter, exercisesRouter } from './routes/exercises.routes';
import { bodyAnalysisRouter, dietLogsRouter, dietsRouter, foodsRouter, mealsRouter, nutritionRouter } from './routes/nutrition.routes';
import { analyticsRouter, attendanceRouter, habitsRouter, membershipsRouter, messagesRouter, notificationsRouter, paymentsRouter, progressRouter, reportsRouter, subscriptionsRouter } from './routes/ops.routes';
import { usersRouter } from './routes/users.routes';
import { sessionsRouter, setsRouter, workoutsRouter } from './routes/workouts.routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind the Next.js rewrite / a load balancer
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.WEB_URL, credentials: true }));
  if (!isTest) app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store'); // API responses are per-user; never cache them
    next();
  });
  app.use(globalLimiter);
  app.use(originGuard);

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: 'up', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/users', staffPasswordRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/trainers', trainersRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/exercises', exercisesRouter);
  app.use('/api/assets', assetsRouter);
  app.use('/api/workouts', workoutsRouter);
  app.use('/api/workout-sessions', sessionsRouter);
  app.use('/api/workout-sets', setsRouter);
  app.use('/api/foods', foodsRouter);
  app.use('/api/diets', dietsRouter);
  app.use('/api/diet-logs', dietLogsRouter);
  app.use('/api/meals', mealsRouter);
  app.use('/api/nutrition', nutritionRouter);
  app.use('/api/body-analysis', bodyAnalysisRouter);
  app.use('/api/progress', progressRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/habits', habitsRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/memberships', membershipsRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/reports', reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
