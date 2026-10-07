import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

// Share the monorepo-root .env with the web app (server-side values like ACCESS_TOKEN_SECRET stay server-only).
const here = path.dirname(fileURLToPath(import.meta.url));
// forceReload=true: Next has already loaded (and cached) apps/web's own env; without it this call is a silent no-op.
nextEnv.loadEnvConfig(path.resolve(here, '../..'), process.env.NODE_ENV !== 'production', console, true);

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@gym/config', '@gym/types'],
  // The browser only ever talks to the web origin; /api/* is proxied to the Express API.
  // This keeps auth cookies first-party (no CORS, no third-party-cookie problems).
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
    ];
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
