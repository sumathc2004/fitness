import { defineConfig } from 'tsup';

// dist/server.js — long-running Node server (`npm start`), dist/vercel.js — serverless handler used by the web app on Vercel.
// The workspace packages ship TypeScript source, so they're bundled in; everything else (Prisma, native modules) stays external.
export default defineConfig({
  entry: { server: 'src/server.ts', vercel: 'src/vercel.ts' },
  format: ['cjs'],
  target: 'node20',
  clean: true,
  noExternal: ['@gym/config', '@gym/types', '@gym/database'],
  external: ['@prisma/client', '.prisma/client'],
});
