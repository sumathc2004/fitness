import { prisma } from '@gym/database';
import type { AuditLogItem, Paginated } from '@gym/types';

export async function listAuditLogs(page: number, pageSize: number, action?: string): Promise<Paginated<AuditLogItem>> {
  const where = action ? { action } : {};
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { firstName: true, lastName: true, email: true } } },
    }),
  ]);
  return {
    total,
    page,
    pageSize,
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actorName: r.actor ? `${r.actor.firstName} ${r.actor.lastName}` : null,
      actorEmail: r.actor?.email ?? null,
      ip: r.ip,
      at: r.createdAt.toISOString(),
    })),
  };
}
