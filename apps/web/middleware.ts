import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { locales, defaultLocale, localePath, splitLocale } from './lib/i18n';
import { checkFacetPath, legacyRedirect, WORK_FACET_PATTERN } from './lib/facets';

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
const WORK_FACET = new RegExp(`^${WORK_FACET_PATTERN}$`);

// Resolver answers per slug: the current slug, or null when there is no such work.
// Renames are rare, so a few minutes of staleness only delays a new redirect.
const RESOLVE_TTL_MS = 5 * 60_000;
const RESOLVE_CACHE_MAX = 5_000;
const resolved = new Map<string, { current: string | null; expires: number }>();

async function currentSlug(slug: string): Promise<string | null | undefined> {
  const hit = resolved.get(slug);
  if (hit && hit.expires > Date.now()) return hit.current;

  const res = await fetch(`${API_URL}/works/resolve/${encodeURIComponent(slug)}`, {
    signal: AbortSignal.timeout(1_500),
  }).catch(() => null);
  // API down or slow: let the page handle it (it has its own redirect fallback)
  if (!res || (!res.ok && res.status !== 404)) return undefined;
  const current = res.ok ? ((await res.json()) as { slug: string }).slug : null;

  if (resolved.size >= RESOLVE_CACHE_MAX) resolved.delete(resolved.keys().next().value!);
  resolved.set(slug, { current, expires: Date.now() + RESOLVE_TTL_MS });
  return current;
}

/**
 * Old work URLs get a real 308 here. The page has its own redirect fallback, but by then
 * the loading boundary has already sent a 200, which crawlers don't treat as a move.
 * Every work slug is checked: renamed ones can look exactly like current ones.
 */
async function redirectLegacyWork(req: NextRequest) {
  const { locale, path } = splitLocale(req.nextUrl.pathname);
  const match = path.match(/^\/works\/([^/]+)$/);
  if (!match) return null;
  const [, encoded] = match;
  const slug = decodeURIComponent(encoded);
  if (WORK_FACET.test(slug)) return null; // a filter path, not a work

  const current = await currentSlug(slug);
  // No such work: a real 404 here, since the page streams a 200 before it can say so
  if (current === null) return NextResponse.rewrite(new URL(`/${locale}/_not-found`, req.url));
  if (!current || current === slug) return null;

  const target = new URL(localePath(locale, `/works/${encodeURIComponent(current)}`), process.env.SITE_URL ?? req.url);
  target.search = req.nextUrl.search; // keep ?tr=<id>
  return NextResponse.redirect(target, 308);
}

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
 * authors get a real 404. Both are decided here because the page streams a 200 first.
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
  const target = new URL(path.slice(defaultLocale.length + 1) || '/', process.env.SITE_URL ?? req.url);
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
    (await redirectLegacyWork(req)) ??
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
