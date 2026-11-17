import type { Metadata } from 'next';
import { locales, defaultLocale, localePath } from './i18n';

export const SITE_NAME = 'Kitabxana.az';
// Server-only and read at runtime, so one image works for any domain.
export const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

const ogLocales: Record<string, string> = { az: 'az_AZ', ru: 'ru_RU', en: 'en_US' };

/**
 * Canonical + hreflang links for a locale-less path such as `/works/foo`. `listed` limits
 * hreflang to the locales with text of their own (see workLocales); all by default.
 */
export function alternates(locale: string, path = '', listed: readonly string[] = locales): Metadata['alternates'] {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(listed.map((l) => [l, localePath(l, path)])),
      'x-default': localePath(defaultLocale, path),
    },
  };
}

interface PageMeta {
  locale: string;
  path: string;
  title?: string;
  description?: string;
  type?: 'website' | 'article' | 'profile';
  /** Skip the "%s | Kitabxana.az" template (home page). */
  absoluteTitle?: boolean;
  /**
   * Share images. Defaults to the locale's site card, because setting openGraph
   * here drops the parent's file-based image. Pass `false` for routes with their
   * own opengraph-image file, otherwise this would override it.
   */
  images?: string[] | false;
  /** Locales to list in hreflang; all when absent */
  hreflang?: readonly string[];
  /** Keep the page out of the index but let crawlers follow its links */
  noindex?: boolean;
}

export function pageMetadata({
  locale, path, title, description, type = 'website', absoluteTitle, images, hreflang, noindex,
}: PageMeta): Metadata {
  return {
    ...(title && { title: absoluteTitle ? { absolute: title } : title }),
    description,
    ...(noindex && { robots: { index: false, follow: true } }),
    alternates: alternates(locale, path, hreflang),
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: ogLocales[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => ogLocales[l]),
      url: localePath(locale, path),
      title,
      description,
      ...(images !== false && {
        images: images ?? [{ url: `/${locale}/opengraph-image`, width: 1200, height: 630, alt: SITE_NAME }],
      }),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

const PAGE_WORD: Record<string, [letter: string, page: string]> = {
  az: ['hərfi', 'səhifə'],
  ru: ['буква', 'страница'],
  en: ['letter', 'page'],
};

/**
 * A list page's title or description with its letter filter and page number, so that
 * "Şairlər", "Şairlər — A hərfi" and "Şairlər — səhifə 2" don't share one title.
 */
export function listingLabel(
  base: string,
  locale: string,
  { letter, page }: { letter?: string; page?: string | number },
): string {
  const [letterWord, pageWord] = PAGE_WORD[locale] ?? PAGE_WORD.az;
  const n = Number(page) || 1;
  return [
    base,
    letter && (locale === 'az' ? `${letter} ${letterWord}` : `${letterWord} ${letter}`),
    n > 1 && `${pageWord} ${n}`,
  ].filter(Boolean).join(' — ');
}

/** Room for a page's own title: search results cut at ~70 characters and the layout adds " | Kitabxana.az" */
const TITLE_BUDGET = 70 - ' | Kitabxana.az'.length;

/**
 * A title whose `main` part is cut at a word (with "…") so that `main + tail` fits search results.
 * The tail (number, page, author) is kept whole; the page's heading is unaffected.
 */
export function fitTitle(main: string, tail = '', max = TITLE_BUDGET): string {
  const room = Math.max(max - tail.length, 24);
  if (main.length <= room) return main + tail;
  const cut = main.slice(0, room - 1);
  const atWord = cut.lastIndexOf(' ') > room * 0.5 ? cut.slice(0, cut.lastIndexOf(' ')) : cut;
  return `${atWord.replace(/[\s,.;:—–-]+$/, '')}…${tail}`;
}

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/** Lines of plain text from markdown or HTML, with markup and blank lines dropped. */
export function plainLines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .replace(/<\/(p|div|h\d|li)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => entities[e])
    .replace(/[#*_>`]/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Short description: poems keep their line breaks as " / ", prose is joined with spaces. */
export function excerpt(text: string | null | undefined, { poem = false, max = 160 } = {}): string | undefined {
  const joined = plainLines(text).join(poem ? ' / ' : ' ');
  if (!joined) return undefined;
  if (joined.length <= max) return joined;
  const cut = joined.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : max).replace(/[\s/,.;:]+$/, '')}…`;
}

export function yearRange(from?: number | null, to?: number | null): string | undefined {
  if (!from && !to) return undefined;
  return [from ?? '?', to ?? '?'].join('–');
}

// ── Structured data (schema.org JSON-LD) ──────────────────────

/** BCP 47 tags for the work languages */
export const LANGUAGE_TAGS: Record<string, string> = {
  AZ_LATIN: 'az',
  AZ_ARABIC: 'az-Arab',
  AZ_CYRILLIC: 'az-Cyrl',
  FA: 'fa',
  AR: 'ar',
  RU: 'ru',
  EN: 'en',
  TR: 'tr',
};

/** A BreadcrumbList; the last crumb is the page itself and needs no URL */
export function breadcrumbLd(crumbs: { name: string; path?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.path && { item: `${SITE_URL}${c.path}` }),
    })),
  };
}

/** Links that identify an author elsewhere: their Wikidata item */
export function sameAs(author: { wikidataId?: string | null }): string[] | undefined {
  return author.wikidataId ? [`https://www.wikidata.org/wiki/${author.wikidataId}`] : undefined;
}

/** The site itself, the publisher of every page */
export const publisherLd = { '@type': 'Organization', name: SITE_NAME, url: SITE_URL };
