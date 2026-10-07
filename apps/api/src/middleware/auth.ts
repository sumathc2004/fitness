import type { RequestHandler } from 'express';
import { AUTH, can, type Permission, type RoleName } from '@gym/config';
import { prisma } from '@gym/database';
import { forbidden, unauthorized } from '../lib/errors';
import { verifyAccessToken } from '../lib/tokens';

function readToken(req: Parameters<RequestHandler>[0]): string | undefined {
  const cookie = req.cookies?.[AUTH.accessCookie] as string | undefined;
  if (cookie) return cookie;
  const header = req.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

/**
 * Verifies the access token, then re-reads the user from the database so that suspensions, deletions and role
 * changes take effect immediately instead of when the token expires.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw unauthorized('Authentication required');
  const claims = await verifyAccessToken(token);
  if (!claims) throw unauthorized('Session expired', 'TOKEN_EXPIRED');

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      status: true,
      deletedAt: true,
      role: { select: { name: true } },
      trainer: { select: { id: true } },
      client: { select: { id: true } },
    },
  });
  if (!user || user.deletedAt || user.status !== 'ACTIVE') throw unauthorized('Account is not active', 'ACCOUNT_INACTIVE');

  req.auth = { userId: user.id, role: user.role.name, trainerId: user.trainer?.id ?? null, clientId: user.client?.id ?? null };
  next();
};

export const requireRole =
  (...roles: RoleName[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw unauthorized();
    if (!roles.includes(req.auth.role)) throw forbidden();
    next();
  };

export const requirePermission =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw unauthorized();
    if (!can(req.auth.role, permission)) throw forbidden();
    next();
  };
