import { api } from '@/lib/api';
import { localePath, locales } from '@/lib/i18n';
import { SITE_URL } from '@/lib/seo';
import { AUTHOR_TYPE_SLUGS, authorsPath, FORM_SLUGS, GENRE_SLUGS, worksPath } from '@/lib/facets';

/**
 * The sitemap is split into sections under /sitemaps/<name>.xml, listed by the index at
 * /sitemap.xml. One file may hold at most 50,000 URLs, and each path here becomes one URL
 * per locale, so works go in chunks.
 */
export const WORKS_PER_FILE = 10_000;

interface Entry {
  /** Locale-less path, e.g. `/works/foo` */
  path: string;
  lastModified?: string;
  /** Locales to list; all when absent */
  locales?: readonly string[];
}

const STATIC_PATHS = ['', '/authors', '/collections', '/works', '/tags', '/agac', '/about', '/contribute', '/contact', '/privacy'];

export async function sectionNames(): Promise<string[]> {
  const { works } = await api.getSitemap();
  const chunks = Math.max(1, Math.ceil(works.length / WORKS_PER_FILE));
  return ['pages', 'authors', 'collections', ...Array.from({ length: chunks }, (_, i) => `works-${i + 1}`)];
}

/** The entries of one section, or null when there is no such section */
export async function sectionEntries(name: string): Promise<Entry[] | null> {
  const data = await api.getSitemap();

  if (name === 'pages') {
    const tags = await api.getTags().catch(() => []);
    return [
      ...STATIC_PATHS.map((path) => ({ path })),
      // The blog index is listed once it has something to read
      ...(data.blog.length ? [{ path: '/blog' }] : []),
      ...data.blog.map((b) => ({ path: `/blog/${b.slug}`, lastModified: b.updatedAt })),
      ...tags.filter((t) => t.works > 0).map((t) => ({ path: `/tags/${t.slug}` })),
      // Readable filter pages: each form, genre and author type
      ...Object.keys(FORM_SLUGS)
        .filter((f) => f !== 'OTHER')
        .map((form) => ({ path: worksPath('az', { form }) })),
      ...Object.keys(GENRE_SLUGS).map((genre) => ({ path: worksPath('az', { genre }) })),
      ...Object.keys(AUTHOR_TYPE_SLUGS).map((type) => ({ path: authorsPath('az', { type }) })),
    ];
  }
  if (name === 'authors') {
    return data.authors.flatMap((a) => [
      { path: `/authors/${a.slug}`, lastModified: a.updatedAt },
      // The filtered works page is a 404 for an author with nothing published
      ...(a.works === false ? [] : [{ path: worksPath('az', { author: a.slug }), lastModified: a.updatedAt }]),
    ]);
  }
  if (name === 'collections') {
    return data.collections.map((c) => ({ path: `/collections/${c.slug}`, lastModified: c.updatedAt }));
  }
  const chunk = name.match(/^works-(\d+)$/);
  if (chunk) {
    const start = (Number(chunk[1]) - 1) * WORKS_PER_FILE;
    if (start < 0 || (start >= data.works.length && start > 0)) return null;
    return data.works
      .slice(start, start + WORKS_PER_FILE)
      .map((w) => ({ path: `/works/${w.slug}`, lastModified: w.updatedAt, locales: w.locales }));
  }
  return null;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A path segment-encoded for a URL (slugs are ASCII today, but keep it safe) */
const url = (locale: string, path: string) => esc(`${SITE_URL}${localePath(locale, encodeURI(path))}`);

/** One <url> per listed locale, each listing its hreflang siblings */
export function urlsetXml(entries: Entry[]): string {
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];
  for (const { path, lastModified, locales: listed = locales } of entries) {
    const links = [
      ...listed.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${url(l, path)}"/>`),
      `<xhtml:link rel="alternate" hreflang="x-default" href="${url('az', path)}"/>`,
    ].join('');
    const lastmod = lastModified ? `<lastmod>${new Date(lastModified).toISOString()}</lastmod>` : '';
    for (const l of listed) out.push(`<url><loc>${url(l, path)}</loc>${lastmod}${links}</url>`);
  }
  out.push('</urlset>');
  return out.join('\n');
}

export function indexXml(names: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...names.map((n) => `<sitemap><loc>${esc(`${SITE_URL}/sitemaps/${n}.xml`)}</loc></sitemap>`),
    '</sitemapindex>',
  ].join('\n');
}

export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Let Cloudflare hold it for an hour; crawlers fetch these often
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
