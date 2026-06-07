import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Environment validation is handled by src/lib/env.ts at import time.
// Import that module in your app entry point to trigger validation on startup.

const nextConfig: NextConfig = {
  output: "standalone",

  // Pin workspace root to this directory; otherwise Next 16 picks the parent
  // repo (which also has a package-lock.json) and fails to resolve tailwindcss
  // when the dev server runs under Playwright.
  turbopack: {
    root: path.join(__dirname),
  },

  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/v1/:path*`,
      },
      {
        source: '/health',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/health`,
      },
      {
        source: '/health/live',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/health/live`,
      },
      {
        source: '/health/ready',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/health/ready`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
