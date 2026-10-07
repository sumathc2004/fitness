import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// argon2id with the library defaults (memory-hard; OWASP-recommended family).
export const hashPassword = (plain: string) => hash(plain);

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}

/** URL-safe random token (returned to the user once; only its hash is stored). */
export const randomToken = (bytes = 48) => randomBytes(bytes).toString('base64url');

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// A real argon2 hash of a random string: verifying against it burns the same time as a real check,
// so the login endpoint doesn't reveal whether an email exists.
let dummy: string | undefined;
export async function dummyVerify(plain: string): Promise<void> {
  dummy ??= await hash(randomToken(16));
  await verifyPassword(dummy, plain);
}
