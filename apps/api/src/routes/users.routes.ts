import { Router } from 'express';
import { updateProfileSchema } from '@gym/types';
import type { UpdateProfileInput } from '@gym/types';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../services/audit.service';
import { getAuthUser, updateOwnProfile } from '../services/user.service';

export const usersRouter = Router();
usersRouter.use(authenticate);

usersRouter.get('/me', async (req, res) => {
  res.json({ user: await getAuthUser(req.auth!.userId) });
});

usersRouter.patch('/me', validate(updateProfileSchema), async (req, res) => {
  const user = await updateOwnProfile(req.auth!.userId, req.body as UpdateProfileInput);
  await audit(req, { action: 'PROFILE_UPDATED', entityType: 'User', entityId: user.id });
  res.json({ user });
});
