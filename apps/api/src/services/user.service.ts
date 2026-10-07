import { prisma } from '@gym/database';
import type { UpdateProfileInput } from '@gym/types';
import { notFound } from '../lib/errors';
import { toAuthUser, userInclude } from './auth.service';

export async function getAuthUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  if (!user) throw notFound('User not found');
  return toAuthUser(user);
}

export async function updateOwnProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { firstName: input.firstName, lastName: input.lastName, phone: input.phone ?? null },
    include: userInclude,
  });
  return toAuthUser(user);
}
