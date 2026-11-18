import type { NextConfig } from 'next';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';
import { AUTHOR_FACET_PATTERN, TAG_FACET_PATTERN, WORK_FACET_PATTERN } from './lib/facets';

const withNextIntl = createNextIntlPlugin();

const LOCALE = ':locale(az|ru|en)';

/** /az/works/a/b/c → /az/works?f=a&f=b&f=c, for 1…n facet segments; the page parses them */
function facetRewrites(base: string, pattern: string, max: number) {
  return Array.from({ length: max }, (_, i) => {
    const names = Array.from({ length: i + 1 }, (_, j) => `f${j}`);
    return {
      source: `/${LOCALE}/${base}/${names.map((n) => `:${n}(${pattern})`).join('/')}`,
      destination: `/:locale/${base}?${names.map((n) => `f=:${n}`).join('&')}`,
    };
  });
}

const dev = process.env.NODE_ENV !== 'production';

// The API is same-origin (/api) in production; a separate origin only in development
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? '').origin;
  } catch {
    return '';
  }
})();

/**
 * Pages are cached at the edge and identical for everyone, so scripts can't carry a
 * per-request nonce: inline scripts stay allowed (theme before paint, JSON-LD, Next's
 * own). The policy still shuts the other doors: no foreign scripts, frames, plugins,
 * form targets or <base>, and fetches only to the site itself.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}${dev ? ' ws:' : ''}`.trim(),
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Self-contained server for the Docker image (see apps/web/Dockerfile)
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Share-image fonts and page copy are read from disk at runtime
  outputFileTracingIncludes: { '/**': ['./assets/fonts/**', './content/**'] },
  transpilePackages: ['@irs-az/shared'],
  // Readable filter URLs (lib/facets.ts), checked before the [slug] routes they would shadow
  async rewrites() {
    return {
      beforeFiles: [
        ...facetRewrites('works', WORK_FACET_PATTERN, 3),
        ...facetRewrites('authors', AUTHOR_FACET_PATTERN, 2),
        { source: `/${LOCALE}/tags/:slug/:f0(${TAG_FACET_PATTERN})`, destination: '/:locale/tags/:slug?f=:f0' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  images: {
    // Museum images never change at an address: fetch each from its source once
    // a month, not once a minute (the default), which is what gets a server rate-limited
    minimumCacheTTL: 60 * 60 * 24 * 31,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      // Museum images in the artwork galleries, resized here instead of loaded at full size
      { protocol: 'https', hostname: 'images.metmuseum.org', pathname: '/CRDImages/**' },
      { protocol: 'https', hostname: 'thedigitalwalters.org', pathname: '/Data/WaltersManuscripts/**' },
      // Wikimedia Commons: originals on upload., the renderings the galleries use on thumb.
      { protocol: 'https', hostname: 'upload.wikimedia.org', pathname: '/wikipedia/commons/**' },
      { protocol: 'https', hostname: 'thumb.wikimedia.org', pathname: '/wikipedia/commons/**' },
    ],
  },
};

export default withNextIntl(nextConfig);
