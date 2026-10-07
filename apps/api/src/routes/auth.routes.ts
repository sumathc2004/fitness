import { Router } from 'express';
import { AUTH } from '@gym/config';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, resetPasswordSchema } from '@gym/types';
import type { ChangePasswordInput, ForgotPasswordInput, LoginInput, ResetPasswordInput } from '@gym/types';
import { clearAuthCookies, setAuthCookies } from '../lib/cookies';
import { AppError } from '../lib/errors';
import { authenticate } from '../middleware/auth';
import { forgotLimiter, loginLimiter } from '../middleware/security';
import { validate } from '../middleware/validate';
import * as auth from '../services/auth.service';
import { getAuthUser } from '../services/user.service';

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { identifier, password, role } = req.body as LoginInput;
  const { user, tokens } = await auth.login(identifier, password, role, req);
  setAuthCookies(res, tokens);
  res.json({ user });
});

authRouter.post('/refresh', async (req, res) => {
  try {
    const { user, tokens } = await auth.refresh(req.cookies?.[AUTH.refreshCookie], req);
    setAuthCookies(res, tokens);
    res.json({ user });
  } catch (err) {
    // A concurrent refresh already rotated the cookie — keep the (new) cookies the browser now holds.
    if (!(err instanceof AppError && err.code === 'REFRESH_RACE')) clearAuthCookies(res);
    throw err;
  }
});

authRouter.post('/logout', async (req, res) => {
  await auth.logout(req.cookies?.[AUTH.refreshCookie], req);
  clearAuthCookies(res);
  res.json({ ok: true });
});

authRouter.post('/forgot-password', forgotLimiter, validate(forgotPasswordSchema), async (req, res) => {
  await auth.forgotPassword((req.body as ForgotPasswordInput).email, req);
  res.json({ ok: true, message: 'If an account exists for that email, a reset link is on its way.' });
});

authRouter.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  const { token, password } = req.body as ResetPasswordInput;
  await auth.resetPassword(token, password, req);
  clearAuthCookies(res);
  res.json({ ok: true });
});

authRouter.get('/me', authenticate, async (req, res) => {
  res.json({ user: await getAuthUser(req.auth!.userId) });
});

authRouter.post('/change-password', authenticate, validate(changePasswordSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;
  const { user, tokens } = await auth.changePassword(req.auth!.userId, currentPassword, newPassword, req);
  setAuthCookies(res, tokens);
  res.json({ user });
});
