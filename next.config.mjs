import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        { key: 'X-DNS-Prefetch-Control', value: 'off' },
      ] },
      // Middleware skips /api (its matcher excludes it), so API responses — including error paths
      // that never reach a route's per-response headers — get explicit non-caching here (API8).
      { source: '/api/:path*', headers: [
        { key: 'Cache-Control', value: 'private, no-store' },
        { key: 'Pragma', value: 'no-cache' },
      ] },
    ];
  },
  outputFileTracingRoot: projectRoot,
  outputFileTracingIncludes: {
    '/*': ['./seed/generated/**/*'],
  },
};
export default nextConfig;
