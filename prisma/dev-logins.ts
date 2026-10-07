/**
 * DEV ONLY — `npm run db:dev-logins`
 * Re-applies the simple development logins from .env to the accounts that already exist (no data is deleted):
 *   • every account's password  → SEED_DEMO_PASSWORD (admin: SEED_ADMIN_PASSWORD)
 *   • username SEED_ADMIN_USERNAME  → the Super Admin
 *   • username SEED_DEMO_USERNAME   → demo trainer "Aarav" and demo client "Priya"  (usernames are unique per role)
 * Refuses to run in production.
 */
import path from 'node:path';
import dotenv from 'dotenv';
import { hash } from '@node-rs/argon2';
import { prisma } from '@gym/database';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to set development logins in production.');
  const adminPw = process.env.SEED_ADMIN_PASSWORD;
  const demoPw = process.env.SEED_DEMO_PASSWORD;
  if (!adminPw || !demoPw) throw new Error('Set SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD in .env first.');
  const adminName = process.env.SEED_ADMIN_USERNAME?.trim().toLowerCase() || null;
  const demoName = process.env.SEED_DEMO_USERNAME?.trim().toLowerCase() || null;

  const [adminHash, demoHash] = await Promise.all([hash(adminPw), hash(demoPw)]);
  const users = await prisma.user.findMany({ include: { role: true } });
  let n = 0;
  for (const u of users) {
    const isAdmin = u.role.name === 'SUPER_ADMIN';
    const username =
      isAdmin ? adminName
      : u.email === 'aarav.trainer@gym.local' || u.email === 'priya.sharma@gym.local' ? demoName
      : u.username;
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: isAdmin ? adminHash : demoHash, username, failedLogins: 0, lockedUntil: null },
    });
    n++;
  }
  // Old sessions and reset links belonged to the old passwords.
  await prisma.refreshToken.updateMany({ where: { revokedAt: null }, data: { revokedAt: new Date() } });
  await prisma.passwordResetToken.deleteMany({});
  console.log(`✓ updated ${n} accounts (sessions signed out)`);
  console.log(`  username ${demoName ?? '(none)'}: Super Admin · trainer Aarav · client Priya — pick the role on the login page`);
  console.log('  every other account signs in with its email and the same demo password');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
