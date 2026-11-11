import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

// Share the monorepo-root .env with the web app (server-side values like ACCESS_TOKEN_SECRET stay server-only).
const here = path.dirname(fileURLToPath(import.meta.url));
// forceReload=true: Next has already loaded (and cached) apps/web's own env; without it this call is a silent no-op.
nextEnv.loadEnvConfig(path.resolve(here, '../..'), process.env.NODE_ENV !== 'production', console, true);

// API_URL set (local dev: the Express server on :4000) → /api/* is proxied to it.
// API_URL unset (Vercel) → /api/* is served by the embedded Express app in src/pages/api/[...path].ts.
const API_URL = process.env.API_URL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@gym/config', '@gym/types'],
  // The API bundle (apps/api/dist/vercel.js) and its native / file-reading dependencies are loaded at runtime, not bundled.
  serverExternalPackages: ['@gym/api', '@prisma/client', '@node-rs/argon2', 'pdfkit', 'pino', 'pino-http', 'socket.io'],
  // Trace runtime files from the monorepo root (node_modules is hoisted there); pdfkit reads its font metrics from disk.
  outputFileTracingRoot: path.resolve(here, '../..'),
  outputFileTracingIncludes: { '/api/[...path]': ['../../node_modules/pdfkit/js/data/**/*'] },
  // The browser only ever talks to the web origin, which keeps auth cookies first-party (no CORS, no third-party-cookie problems).
  async rewrites() {
    // beforeFiles: the proxy must win over the embedded /api route when an external API is configured.
    return { beforeFiles: API_URL ? [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }] : [] };
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
