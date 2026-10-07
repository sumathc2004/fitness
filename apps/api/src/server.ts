import { createServer } from 'node:http';
import { prisma } from '@gym/database';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { initRealtime } from './lib/realtime';
import { startScheduler } from './services/jobs.service';

const app = createApp();
const server = createServer(app);
initRealtime(server);
startScheduler();

server.listen(env.API_PORT, () => {
  logger.info(`API listening on http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
