import type { Request } from 'express';
import { Prisma, prisma } from '@gym/database';
import type { ActivityType } from '@gym/database';
import { logger } from '../lib/logger';

type Json = Prisma.InputJsonValue;

interface AuditInput {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Json;
  after?: Json;
}

/** Records an important security / admin event. Never throws — auditing must not break the request. */
export async function audit(req: Request | null, input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? req?.auth?.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: input.before,
        after: input.after,
        ip: req?.ip ?? null,
        userAgent: req?.get('user-agent')?.slice(0, 250) ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, action: input.action }, 'Failed to write audit log');
  }
}

interface ActivityInput {
  actorUserId?: string | null;
  clientId?: string | null;
  type: ActivityType;
  entityType?: string;
  entityId?: string;
  metadata?: Json;
}

/** Appends a client-activity event (feeds the trainer/admin activity feed and the attention engine). */
export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        clientId: input.clientId ?? null,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  } catch (err) {
    logger.error({ err, type: input.type }, 'Failed to write activity log');
  }
}
