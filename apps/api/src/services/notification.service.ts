import { Prisma, prisma } from '@gym/database';
import type { NotificationType } from '@gym/database';
import { emitToUser } from '../lib/realtime';
import { logger } from '../lib/logger';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Prisma.InputJsonValue;
}

/** Creates an in-app notification and pushes it live. Never throws (notifications must not break the action). */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const n = await prisma.notification.create({ data: { userId: input.userId, type: input.type, title: input.title, body: input.body, data: input.data } });
    emitToUser(input.userId, 'notification:new', { id: n.id, type: n.type, title: n.title, body: n.body, at: n.createdAt.toISOString() });
  } catch (err) {
    logger.error({ err, type: input.type }, 'Failed to create notification');
  }
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
  await Promise.all([...new Set(userIds)].map((userId) => notify({ ...input, userId })));
}

/** The user ids that should hear about a client's events: the client's trainer(s). */
export async function trainerUserIdsOf(clientId: string): Promise<string[]> {
  const links = await prisma.trainerClient.findMany({ where: { clientId, endedAt: null }, select: { trainer: { select: { userId: true } } } });
  return links.map((l) => l.trainer.userId);
}

export async function clientUserIdOf(clientId: string): Promise<string | null> {
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { userId: true } });
  return c?.userId ?? null;
}
