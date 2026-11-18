import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { locales, defaultLocale, localePath, splitLocale } from './lib/i18n';
import { checkFacetPath, legacyRedirect } from './lib/facets';

const intl = createMiddleware({
  locales,
  defaultLocale,
  // Azerbaijani pages have no prefix (/works/foo); Russian and English do (/ru/works/foo)
  localePrefix: 'as-needed',
  // `/` is always Azerbaijani: a redirect by browser language would vary one cached URL
  localeDetection: false,
  // Pages set their own hreflang tags; the header version used http:// and a different x-default
  alternateLinks: false,
});

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const RESOLVE_TTL_MS = 5 * 60_000;
const RESOLVE_CACHE_MAX = 5_000;

// Whether an author has published works, for muellif-<slug> filter paths
const authorsSeen = new Map<string, { exists: boolean; expires: number }>();

async function authorHasWorks(slug: string): Promise<boolean | undefined> {
  const hit = authorsSeen.get(slug);
  if (hit && hit.expires > Date.now()) return hit.exists;
  const res = await fetch(`${API_URL}/works?authorSlug=${encodeURIComponent(slug)}&limit=1`, {
    signal: AbortSignal.timeout(1_500),
  }).catch(() => null);
  if (!res?.ok) return undefined; // API down: let the page decide
  const exists = ((await res.json()) as { meta: { total: number } }).meta.total > 0;
  if (authorsSeen.size >= RESOLVE_CACHE_MAX) authorsSeen.delete(authorsSeen.keys().next().value!);
  authorsSeen.set(slug, { exists, expires: Date.now() + RESOLVE_TTL_MS });
  return exists;
}

/**
 * Filter paths in the wrong order get a 308 to the canonical one; unknown values and
 * authors get a 404 before the page is rendered.
 */
async function checkFilterPath(req: NextRequest) {
  const check = checkFacetPath(req.nextUrl.pathname);
  if (!check || check.kind === 'ok' && !check.author) return null;
  if (check.kind === 'redirect') {
    const target = new URL(check.to, process.env.SITE_URL ?? req.url);
    target.search = req.nextUrl.search;
    return NextResponse.redirect(target, 308);
  }
  if (check.kind === 'ok' && (await authorHasWorks(check.author!)) !== false) return null;
  // No route lives here, so Next renders its 404 page with a 404 status
  return NextResponse.rewrite(new URL(`/${check.locale}/_not-found`, req.url));
}

/** Old query-string filter URLs (and raw ?f=) get a 308 to their readable path */
function redirectLegacyFilters(req: NextRequest) {
  const target = legacyRedirect(req.nextUrl.pathname, req.nextUrl.searchParams);
  if (!target) return null;
  return NextResponse.redirect(new URL(target, process.env.SITE_URL ?? req.url), 308);
}

/**
 * Azerbaijani URLs used to carry /az: they get a permanent redirect to the same path
 * without it.
 */
function dropDefaultPrefix(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path !== `/${defaultLocale}` && !path.startsWith(`/${defaultLocale}/`)) return null;
  // Set as a pathname, never parsed as a URL: /az//host must not become a redirect to another site
  const target = new URL('/', process.env.SITE_URL ?? req.url);
  target.pathname = path.slice(defaultLocale.length + 1).replace(/^\/+/, '/') || '/';
  target.search = req.nextUrl.search;
  return NextResponse.redirect(target, 308);
}

const SHARE_IMAGE = /\/(opengraph|twitter)-image[^/]*$/;

export default async function middleware(req: NextRequest) {
  // Share images keep their prefix: Next writes og:image URLs with the internal /az segment
  if (SHARE_IMAGE.test(req.nextUrl.pathname) && splitLocale(req.nextUrl.pathname).path !== req.nextUrl.pathname) {
    return NextResponse.next();
  }
  return (
    dropDefaultPrefix(req) ??
    redirectLegacyFilters(req) ??
    (await checkFilterPath(req)) ??
    withoutLocaleCookie(req, intl(req))
  );
}

/**
 * Pages are cached at Cloudflare, which won't store a response that sets a cookie, and
 * next-intl may set NEXT_LOCALE. The locale is in every URL, so the cookie is never needed.
 */
function withoutLocaleCookie(_req: NextRequest, res: NextResponse) {
  res.headers.delete('set-cookie');
  res.headers.delete('x-middleware-set-cookie');
  return res;
}

export const config = {
  // Node runtime so API_URL and SITE_URL are read at runtime, not inlined at build
  runtime: 'nodejs',
  matcher: [
    // Match all paths except /admin, /api, /_next, /static and files with an
    // extension (sitemap.xml, robots.txt, favicons). Slugs never contain dots.
    '/((?!admin|api|_next|static|.*\\..*).*)',
  ],
};
