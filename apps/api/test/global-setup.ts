import { execSync } from 'node:child_process';
import path from 'node:path';

/** Runs once before the suite: make sure the *test* database has the current schema. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'mysql://gym:gym_dev_password@localhost:3307/gym_platform_test';
  const root = path.resolve(__dirname, '../../..');
  execSync('npx prisma migrate deploy', { cwd: root, stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } });
}
