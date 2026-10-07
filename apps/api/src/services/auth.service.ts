import type { Request } from 'express';
import { AUTH, type RoleName } from '@gym/config';
import { Prisma, prisma } from '@gym/database';
import type { AuthUser } from '@gym/types';
import { env } from '../config/env';
import { dummyVerify, hashPassword, randomToken, sha256, verifyPassword } from '../lib/crypto';
import { AppError, badRequest, forbidden, unauthorized } from '../lib/errors';
import { mailer } from '../lib/mailer';
import { signAccessToken } from '../lib/tokens';
import { audit } from './audit.service';

export const userInclude = {
  role: { select: { name: true } },
  trainer: { select: { id: true } },
  client: { select: { id: true } },
} satisfies Prisma.UserInclude;

export type DbUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export function toAuthUser(u: DbUser): AuthUser {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    role: u.role.name,
    status: u.status,
    trainerId: u.trainer?.id ?? null,
    clientId: u.client?.id ?? null,
  };
}

interface Ctx {
  ip?: string | null;
  userAgent?: string | null;
}
export const ctxOf = (req: Request): Ctx => ({ ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 250) });

const addMs = (ms: number) => new Date(Date.now() + ms);

async function issueSession(user: DbUser, ctx: Ctx, familyId?: string) {
  const refresh = randomToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refresh),
      familyId: familyId ?? randomToken(12),
      expiresAt: addMs(env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    },
  });
  const access = await signAccessToken({ sub: user.id, role: user.role.name, tid: user.trainer?.id ?? null, cid: user.client?.id ?? null });
  return { access, refresh };
}

// ───────────────────────── login
export async function login(identifier: string, password: string, role: RoleName | undefined, req: Request) {
  const ctx = ctxOf(req);
  let user: DbUser | null;
  if (identifier.includes('@')) {
    user = await prisma.user.findUnique({ where: { email: identifier }, include: userInclude });
  } else {
    if (!role) throw badRequest('Choose the role you are signing in as', { role: ['Select a role'] });
    user = await prisma.user.findFirst({ where: { username: identifier, role: { name: role } }, include: userInclude });
  }
  // Right credentials through the wrong door look exactly like wrong credentials.
  if (user && role && user.role.name !== role) user = null;

  if (!user || user.deletedAt) {
    await dummyVerify(password); // same timing whether or not the account exists
    await audit(req, { action: 'LOGIN_FAILED', entityType: 'User', after: { identifier, reason: 'unknown_account' } });
    throw unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new AppError(429, 'ACCOUNT_LOCKED', `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    const failed = user.failedLogins + 1;
    const lock = failed >= AUTH.maxFailedLogins;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? addMs(AUTH.lockMinutes * 60_000) : null },
    });
    await audit(req, { actorUserId: user.id, action: lock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED', entityType: 'User', entityId: user.id });
    throw unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'ACTIVE') {
    throw forbidden('This account is not active. Please contact your gym.');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
  const tokens = await issueSession(user, ctx);
  await audit(req, { actorUserId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id });
  return { user: toAuthUser(user), tokens };
}

// ───────────────────────── refresh (rotation + reuse detection)
const RACE_GRACE_MS = 10_000;

export async function refresh(rawToken: string | undefined, req: Request) {
  if (!rawToken) throw unauthorized('No session', 'INVALID_REFRESH');
  const ctx = ctxOf(req);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) }, include: { user: { include: userInclude } } });
  if (!record) throw unauthorized('Invalid session', 'INVALID_REFRESH');

  if (record.revokedAt) {
    // A token that was rotated away (replacedBy set) and is presented again is either two tabs refreshing at the
    // same moment (normal, within the grace window) or a leaked token (burn the whole family and record it).
    // Tokens revoked by logout / a family burn / a password change are simply dead — no new security event.
    if (record.replacedBy) {
      if (Date.now() - record.revokedAt.getTime() < RACE_GRACE_MS) throw new AppError(409, 'REFRESH_RACE', 'Session was just refreshed — retry');
      await prisma.refreshToken.updateMany({ where: { familyId: record.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      await audit(req, { actorUserId: record.userId, action: 'REFRESH_TOKEN_REUSE', entityType: 'User', entityId: record.userId });
    }
    throw unauthorized('Session is no longer valid', 'INVALID_REFRESH');
  }
  if (record.expiresAt < new Date()) throw unauthorized('Session expired', 'INVALID_REFRESH');
  const user = record.user;
  if (user.deletedAt || user.status !== 'ACTIVE') throw unauthorized('Account is not active', 'ACCOUNT_INACTIVE');

  const next = randomToken();
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(next),
        familyId: record.familyId,
        expiresAt: addMs(env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });
    // Conditional update: only one concurrent request can win the rotation.
    const won = await tx.refreshToken.updateMany({ where: { id: record.id, revokedAt: null }, data: { revokedAt: new Date(), replacedBy: row.id } });
    if (won.count === 0) throw new AppError(409, 'REFRESH_RACE', 'Session was just refreshed — retry');
    return row;
  });
  void created;
  const access = await signAccessToken({ sub: user.id, role: user.role.name, tid: user.trainer?.id ?? null, cid: user.client?.id ?? null });
  return { user: toAuthUser(user), tokens: { access, refresh: next } };
}

// ───────────────────────── logout
export async function logout(rawToken: string | undefined, req: Request) {
  if (!rawToken) return;
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
  if (!record) return;
  await prisma.refreshToken.updateMany({ where: { familyId: record.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(req, { actorUserId: record.userId, action: 'LOGOUT', entityType: 'User', entityId: record.userId });
}

// ───────────────────────── password reset
export async function forgotPassword(email: string, req: Request) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always behave identically to the caller so the endpoint can't be used to discover accounts.
  if (!user || user.deletedAt || user.status !== 'ACTIVE') return;

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  const raw = randomToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(raw), expiresAt: addMs(env.PASSWORD_RESET_TTL_MIN * 60_000) },
  });
  const link = `${env.WEB_URL.replace(/\/$/, '')}/auth/reset-password?token=${raw}`;
  await mailer.send({
    to: user.email,
    subject: 'Reset your password',
    text: `Hi ${user.firstName},\n\nUse this link to choose a new password (valid for ${env.PASSWORD_RESET_TTL_MIN} minutes):\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
  });
  await audit(req, { actorUserId: user.id, action: 'PASSWORD_RESET_REQUESTED', entityType: 'User', entityId: user.id });
}

export async function resetPassword(rawToken: string, password: string, req: Request) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or has expired. Request a new one.');
  }
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash, failedLogins: 0, lockedUntil: null } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit(req, { actorUserId: record.userId, action: 'PASSWORD_RESET', entityType: 'User', entityId: record.userId });
}

export async function changePassword(userId: string, current: string, next: string, req: Request) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  if (!user) throw unauthorized();
  if (!(await verifyPassword(user.passwordHash, current))) {
    throw new AppError(400, 'WRONG_PASSWORD', 'Your current password is incorrect', { currentPassword: ['Incorrect password'] });
  }
  if (current === next) throw new AppError(400, 'SAME_PASSWORD', 'Choose a password different from your current one', { newPassword: ['Must be different'] });
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit(req, { actorUserId: userId, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: userId });
  // Sign the current device back in; every other device must log in again.
  return { user: toAuthUser(user), tokens: await issueSession(user, ctxOf(req)) };
}
