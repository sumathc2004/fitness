import { SignJWT, jwtVerify } from 'jose';
import type { RoleName } from '@gym/config';
import { env } from '../config/env';

export interface AccessClaims {
  sub: string;
  role: RoleName;
  tid: string | null;
  cid: string | null;
}

const accessKey = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ role: claims.role, tid: claims.tid, cid: claims.cid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer('gym-platform')
    .setAudience('gym-platform-web')
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MIN}m`)
    .sign(accessKey);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessKey, { issuer: 'gym-platform', audience: 'gym-platform-web', algorithms: ['HS256'] });
    if (!payload.sub || typeof payload.role !== 'string') return null;
    return {
      sub: payload.sub,
      role: payload.role as RoleName,
      tid: (payload.tid as string | null) ?? null,
      cid: (payload.cid as string | null) ?? null,
    };
  } catch {
    return null;
  }
}
