import type { Request } from 'express';
import { prisma } from '@gym/database';
import { emitToUser } from '../lib/realtime';
import { forbidden, notFound } from '../lib/errors';
import { logActivity } from './audit.service';
import { notify } from './notification.service';

const key = (a: string, b: string) => [a, b].sort().join(':');

/** Who the caller may message: a client ↔ their trainer(s); a trainer ↔ their clients; admins ↔ everyone. */
async function allowedUserIds(req: Request): Promise<Set<string>> {
  const a = req.auth!;
  if (a.role === 'SUPER_ADMIN') {
    const all = await prisma.user.findMany({ where: { id: { not: a.userId }, deletedAt: null, status: 'ACTIVE' }, select: { id: true } });
    return new Set(all.map((u) => u.id));
  }
  const ids = new Set<string>();
  const admins = await prisma.user.findMany({ where: { role: { name: 'SUPER_ADMIN' }, deletedAt: null, status: 'ACTIVE' }, select: { id: true } });
  if (a.role === 'TRAINER' && a.trainerId) {
    const links = await prisma.trainerClient.findMany({ where: { trainerId: a.trainerId, endedAt: null }, select: { client: { select: { userId: true } } } });
    links.forEach((l) => ids.add(l.client.userId));
    admins.forEach((u) => ids.add(u.id));
  } else if (a.role === 'CLIENT' && a.clientId) {
    const links = await prisma.trainerClient.findMany({ where: { clientId: a.clientId, endedAt: null }, select: { trainer: { select: { userId: true } } } });
    links.forEach((l) => ids.add(l.trainer.userId));
  }
  return ids;
}

export async function contacts(req: Request) {
  const allowed = [...(await allowedUserIds(req))];
  const users = await prisma.user.findMany({ where: { id: { in: allowed } }, select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } }, orderBy: { firstName: 'asc' } });
  return users.map((u) => ({ userId: u.id, name: `${u.firstName} ${u.lastName}`, role: u.role.name }));
}

export async function conversations(req: Request) {
  const me = req.auth!.userId;
  const msgs = await prisma.message.findMany({ where: { OR: [{ senderId: me }, { recipientId: me }] }, orderBy: { createdAt: 'desc' }, take: 500 });
  const latest = new Map<string, (typeof msgs)[number]>();
  const unread = new Map<string, number>();
  for (const m of msgs) {
    if (!latest.has(m.conversationKey)) latest.set(m.conversationKey, m);
    if (m.recipientId === me && !m.readAt) unread.set(m.conversationKey, (unread.get(m.conversationKey) ?? 0) + 1);
  }
  const otherIds = [...latest.values()].map((m) => (m.senderId === me ? m.recipientId : m.senderId));
  const users = await prisma.user.findMany({ where: { id: { in: otherIds } }, select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return [...latest.values()].map((m) => {
    const otherId = m.senderId === me ? m.recipientId : m.senderId;
    const u = byId.get(otherId);
    return { userId: otherId, name: u ? `${u.firstName} ${u.lastName}` : 'Unknown', role: u?.role.name ?? null, lastMessage: m.body.slice(0, 120), lastAt: m.createdAt.toISOString(), unread: unread.get(m.conversationKey) ?? 0 };
  });
}

const msgDto = (m: { id: string; senderId: string; recipientId: string; body: string; readAt: Date | null; createdAt: Date }) => ({
  id: m.id, senderId: m.senderId, recipientId: m.recipientId, body: m.body, readAt: m.readAt?.toISOString() ?? null, at: m.createdAt.toISOString(),
});

export async function thread(req: Request, otherId: string, before?: string) {
  const me = req.auth!.userId;
  if (!(await allowedUserIds(req)).has(otherId)) throw notFound('Conversation not found');
  const rows = await prisma.message.findMany({
    where: { conversationKey: key(me, otherId), ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: 'desc' }, take: 60,
  });
  const read = await prisma.message.updateMany({ where: { conversationKey: key(me, otherId), recipientId: me, readAt: null }, data: { readAt: new Date() } });
  if (read.count) emitToUser(otherId, 'message:read', { by: me });
  return rows.reverse().map(msgDto);
}

export async function send(req: Request, recipientId: string, body: string) {
  const me = req.auth!.userId;
  if (recipientId === me) throw forbidden('You can’t message yourself');
  if (!(await allowedUserIds(req)).has(recipientId)) throw forbidden('You can only message your trainer, your clients or the gym admin');
  const m = await prisma.message.create({ data: { conversationKey: key(me, recipientId), senderId: me, recipientId, body } });
  const dto = msgDto(m);
  emitToUser(recipientId, 'message:new', dto);
  emitToUser(me, 'message:new', dto);
  const sender = await prisma.user.findUnique({ where: { id: me }, select: { firstName: true, lastName: true, client: { select: { id: true } } } });
  if (sender?.client) await logActivity({ actorUserId: me, clientId: sender.client.id, type: 'MESSAGE_SENT', entityType: 'Message', entityId: m.id });
  // Only create a bell notification if the last message in this thread wasn't already unread (avoid spamming).
  const pending = await prisma.message.count({ where: { conversationKey: m.conversationKey, recipientId, readAt: null } });
  if (pending <= 1) await notify({ userId: recipientId, type: 'TRAINER_MESSAGE', title: `New message from ${sender?.firstName ?? 'someone'}`, body: body.slice(0, 140), data: { fromUserId: me } });
  return dto;
}

export async function unreadCount(req: Request) {
  return prisma.message.count({ where: { recipientId: req.auth!.userId, readAt: null } });
}
