import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { AUTH } from '@gym/config';
import { prisma } from '@gym/database';
import { env } from '../config/env';
import { logger } from './logger';
import { verifyAccessToken } from './tokens';

let io: Server | null = null;

function cookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/** Attaches Socket.IO to the HTTP server. Each authenticated user joins a private room `user:<id>`. */
export function initRealtime(http: HttpServer): Server {
  io = new Server(http, { cors: { origin: env.WEB_URL, credentials: true } });
  io.use(async (socket, next) => {
    const token = cookie(socket.handshake.headers.cookie, AUTH.accessCookie);
    const claims = token ? await verifyAccessToken(token) : null;
    if (!claims) return next(new Error('unauthorized'));
    const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: { id: true, status: true, deletedAt: true } });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') return next(new Error('unauthorized'));
    socket.data.userId = user.id;
    next();
  });
  io.on('connection', (socket) => {
    void socket.join(`user:${socket.data.userId as string}`);
    logger.debug({ userId: socket.data.userId }, 'socket connected');
  });
  return io;
}

/** Push an event to every open tab of a user. A no-op when sockets aren't running (tests, scripts). */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}
