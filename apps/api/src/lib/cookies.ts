import type { CookieOptions, Response } from 'express';
import { AUTH } from '@gym/config';
import { env } from '../config/env';

const base: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  path: '/',
};

export function setAuthCookies(res: Response, tokens: { access: string; refresh: string }) {
  res.cookie(AUTH.accessCookie, tokens.access, { ...base, maxAge: env.ACCESS_TOKEN_TTL_MIN * 60_000 });
  res.cookie(AUTH.refreshCookie, tokens.refresh, { ...base, maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(AUTH.accessCookie, base);
  res.clearCookie(AUTH.refreshCookie, base);
}
