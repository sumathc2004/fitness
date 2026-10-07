import type { Request } from 'express';
import { prisma } from '@gym/database';
import { forbidden, notFound } from '../lib/errors';

/**
 * Ownership rules used by every client-scoped endpoint (Phase 2 onward):
 *  • SUPER_ADMIN → any client
 *  • TRAINER     → only clients currently assigned to them
 *  • CLIENT      → only themselves
 * Returns normally when allowed, throws 403/404 otherwise.
 */
export async function assertCanAccessClient(req: Request, clientId: string): Promise<void> {
  const auth = req.auth;
  if (!auth) throw forbidden();
  if (auth.role === 'SUPER_ADMIN') {
    const exists = await prisma.client.count({ where: { id: clientId } });
    if (!exists) throw notFound('Client not found');
    return;
  }
  if (auth.role === 'CLIENT') {
    if (auth.clientId !== clientId) throw forbidden();
    return;
  }
  if (!auth.trainerId) throw forbidden();
  const link = await prisma.trainerClient.count({ where: { trainerId: auth.trainerId, clientId, endedAt: null } });
  // 404 (not 403) so trainers can't probe which client ids exist outside their roster.
  if (!link) throw notFound('Client not found');
}

/** Client ids visible to the caller (null = unrestricted, i.e. Super Admin). */
export async function visibleClientIds(req: Request): Promise<string[] | null> {
  const auth = req.auth;
  if (!auth) throw forbidden();
  if (auth.role === 'SUPER_ADMIN') return null;
  if (auth.role === 'CLIENT') return auth.clientId ? [auth.clientId] : [];
  if (!auth.trainerId) return [];
  const links = await prisma.trainerClient.findMany({ where: { trainerId: auth.trainerId, endedAt: null }, select: { clientId: true } });
  return links.map((l) => l.clientId);
}
