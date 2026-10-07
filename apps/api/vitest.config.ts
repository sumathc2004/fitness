import { defineConfig } from 'vitest/config';

const TEST_DB = process.env.TEST_DATABASE_URL ?? 'mysql://gym:gym_dev_password@localhost:3307/gym_platform_test';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup.ts'],
    fileParallelism: false, // all files share one MySQL test database
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DB,
      ACCESS_TOKEN_SECRET: 'test-access-secret-test-access-secret-0123456789',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret-test-refresh-secret-0123456789',
      WEB_URL: 'http://localhost:3000',
      COOKIE_SECURE: 'false',
      LOG_LEVEL: 'silent',
    },
  },
});
