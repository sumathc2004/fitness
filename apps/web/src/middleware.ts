import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { AUTH, ROLE_HOME, ROUTE_ROLE, type RoleName } from '@gym/config';

/**
 * First line of defence: routes under /admin, /trainer and /client are only reachable by the matching role.
 * This is a UX guard — the API re-checks every request against the database, so a forged cookie gets nowhere.
 */
async function readRole(token: string | undefined): Promise<RoleName | null> {
  if (!token) return null;
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { issuer: 'gym-platform', audience: 'gym-platform-web', algorithms: ['HS256'] });
    return typeof payload.role === 'string' ? (payload.role as RoleName) : null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const role = await readRole(req.cookies.get(AUTH.accessCookie)?.value);
  const hasRefresh = Boolean(req.cookies.get(AUTH.refreshCookie)?.value);
  const here = encodeURIComponent(pathname + search);

  // Already signed in → skip the login screen.
  if (pathname === '/auth/login') {
    return role ? NextResponse.redirect(new URL(ROLE_HOME[role], req.url)) : NextResponse.next();
  }

  const prefix = Object.keys(ROUTE_ROLE).find((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!prefix) return NextResponse.next();

  if (!role) {
    // Access token missing/expired: if a refresh cookie exists, renew the session first, otherwise sign in.
    return NextResponse.redirect(new URL(hasRefresh ? `/auth/refresh?next=${here}` : `/auth/login?next=${here}`, req.url));
  }
  if (ROUTE_ROLE[prefix] !== role) return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/trainer/:path*', '/client/:path*', '/auth/login'] };
