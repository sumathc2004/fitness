import { NextResponse, type NextRequest } from 'next/server';
import { AUTH } from '@gym/config';
import { safeNext } from '@/lib/utils';

/**
 * Server-side session renewal used by the route guard when the short-lived access token has expired
 * but the refresh cookie is still valid. Forwards the API's rotated cookies to the browser, then continues.
 */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get('next'), '/');
  const refresh = req.cookies.get(AUTH.refreshCookie)?.value;
  const toLogin = () => {
    const res = NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(next)}`, req.url));
    res.cookies.delete(AUTH.accessCookie);
    res.cookies.delete(AUTH.refreshCookie);
    return res;
  };
  if (!refresh) return toLogin();

  const api = await fetch(`${process.env.API_URL ?? 'http://localhost:4000'}/api/auth/refresh`, {
    method: 'POST',
    headers: { cookie: `${AUTH.refreshCookie}=${refresh}` },
    cache: 'no-store',
  }).catch(() => null);

  // 409 = a parallel request rotated it a moment ago; the browser may already hold the new cookies.
  if (!api || (!api.ok && api.status !== 409)) return toLogin();

  const res = NextResponse.redirect(new URL(next, req.url));
  for (const c of api.headers.getSetCookie()) res.headers.append('set-cookie', c);
  return res;
}
