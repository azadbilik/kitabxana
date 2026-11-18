import type { TreeAuthor } from '@/lib/canon';
import { notFound, permanentRedirect } from 'next/navigation';
import { localePath } from '@/lib/i18n';

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// Server-side rendering talks to the API over the internal network (API_URL, read at
// runtime); the browser uses the public URL, which may be relative like `/api`.
const API_URL =
  typeof window === 'undefined' ? process.env.API_URL ?? PUBLIC_API_URL : PUBLIC_API_URL;

/** Link to an EPUB/TXT download (the browser fetches it straight from the public API) */
export function downloadUrl(path: string, format: 'epub' | 'txt') {
  return `${PUBLIC_API_URL}${path}/download?format=${format}`;
}

/** A scanned source book (PDF) served by the API, see ScansService */
export interface Scan {
  key: string;
  bytes: number;
  /** PDF page the work starts on */
  page?: number;
  /** Just the pages of this work or collection (1-based, inclusive), with an estimated size */
  range?: { from: number; to: number; bytes: number };
}

/** Link to a scanned book: opened in the browser's PDF viewer (at a page), or saved — whole or a run of pages */
export function scanUrl(
  key: string,
  { page, download, range }: { page?: number; download?: boolean; range?: { from: number; to: number } } = {},
) {
  const url = `${PUBLIC_API_URL}/scans/${encodeURIComponent(key)}.pdf`;
  const query = [range && `pages=${range.from}-${range.to}`, download && 'download=1'].filter(Boolean).join('&');
  if (query) return `${url}?${query}`;
  return page ? `${url}#page=${page}` : url;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** `.catch()` handler for detail pages: a missing entity renders the 404 page instead of a 500. */
export function notFoundOn404(err: unknown): never {
  if (err instanceof ApiError && err.status === 404) notFound();
  throw err;
}

interface FetchOptions extends RequestInit {
  token?: string;
}

async function fetcher<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...init } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...init.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message ?? `API error: ${res.status}`, res.status);
  }

  return res.json();
}

const MINUTE = 60_000;
const SHARED_MAX = 300;
const shared = new Map<string, { value: Promise<unknown>; expires: number; last?: unknown }>();

/**
 * Answers that are the same for every reader (shelves, lists, counts) are kept in the
 * server's memory for a few minutes, so a page render doesn't ask the API for them again.
 * Pages are dynamic, which switches Next's own fetch cache off. If a refresh fails, the
 * last good answer is served. The browser always fetches.
 */
function sharedGet<T>(path: string, ttlMs: number): Promise<T> {
  if (typeof window !== 'undefined') return fetcher<T>(path);
  const now = Date.now();
  const hit = shared.get(path);
  if (hit && hit.expires > now) return hit.value as Promise<T>;

  const last = hit?.last;
  const entry: { value: Promise<unknown>; expires: number; last?: unknown } = { value: Promise.resolve(), expires: now + ttlMs, last };
  entry.value = fetcher<T>(path).then(
    (v) => {
      entry.last = v;
      return v;
    },
    (err) => {
      // Retry soon, and meanwhile keep serving what we had
      entry.expires = Date.now() + 15_000;
      if (last !== undefined && !(err instanceof ApiError && err.status === 404)) return last as T;
      shared.delete(path);
      throw err;
    },
  );
  shared.delete(path);
  if (shared.size >= SHARED_MAX) shared.delete(shared.keys().next().value!);
  shared.set(path, entry);
  return entry.value as Promise<T>;
}

/**
 * Work for a reading page. A renamed work's old slug permanently redirects to the
 * new URL; an unknown slug renders the 404 page.
 */
export async function getWorkOrRedirect(slug: string, locale: string, suffix = '') {
  try {
    return await api.getWork(slug);
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) throw err;
    const current = await api.resolveWork(slug).catch(() => null);
    if (current && current.slug !== slug) {
      permanentRedirect(localePath(locale, `/works/${encodeURIComponent(current.slug)}${suffix}`));
    }
    notFound();
  }
}

export const api = {
  // Authors
  getAuthors: (params?: URLSearchParams) =>
    sharedGet<any>(`/authors${params ? `?${params}` : ''}`, 5 * MINUTE),
  getAuthor: (slug: string) => fetcher(`/authors/${slug}`),
  /** The author page's own data: profile, books with counts, the first works outside any book */
  getAuthorPage: (slug: string) => fetcher<AuthorPage>(`/authors/${slug}?view=page`),
  /** Name, dates and portrait only */
  getAuthorBrief: (slug: string) => fetcher<AuthorBrief>(`/authors/${slug}?view=brief`),
  /** Poet of the week, picked so everything shown is in the reader's language */
  /** Every published author with a work count, for the literature tree */
  getAuthorTree: () => sharedGet<TreeAuthor[]>('/authors/tree', 10 * MINUTE),
  getFeaturedAuthor: (locale: string) => sharedGet<any>(`/authors/featured?lang=${locale}`, 10 * MINUTE),

  // Collections (the site's "books")
  /** With a locale, each work carries its first line and the opening comes translated where it can */
  getCollection: (slug: string, locale?: string) =>
    fetcher(`/collections/${slug}${locale && ['az', 'ru', 'en'].includes(locale) ? `?incipit=${locale}` : ''}`),
  getCollections: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
    return sharedGet<{ data: BookSummary[]; meta: PageMeta }>(`/collections${qs.size ? `?${qs}` : ''}`, 5 * MINUTE);
  },

  // Works
  getWorks: (params?: URLSearchParams) =>
    fetcher(`/works${params ? `?${params}` : ''}`),
  getWork: (slug: string) => fetcher(`/works/${slug}`),
  getRandomWork: (locale: string) => fetcher<{ slug: string }>(`/works/random?lang=${locale}`, { cache: 'no-store' }),
  getCatalog: () => sharedGet<Catalog>('/works/catalog', 10 * MINUTE),
  getPoemOfTheDay: (locale: string) => sharedGet<PoemOfTheDay>(`/works/daily?lang=${locale}`, 5 * MINUTE),
  resolveWork: (slug: string) => fetcher<{ slug: string }>(`/works/resolve/${slug}`),
  getMoreByAuthor: (slug: string, locale: string) =>
    fetcher<MoreWork[]>(`/works/${slug}/more?locale=${locale}`),
  getOtherPoets: (slug: string, locale: string) =>
    fetcher<{ theme: TagRef | null; works: OtherWork[] }>(`/works/${slug}/others?locale=${locale}`),
  getWorkNav: (slug: string) =>
    fetcher<{ prev: NavItem | null; next: NavItem | null }>(`/works/${slug}/nav`),

  // Tags
  getTags: () => sharedGet<TagSummary[]>('/tags', 10 * MINUTE),
  getTag: (slug: string) => fetcher<TagDetail>(`/tags/${slug}`),

  // Translations
  getTranslations: (workId: string) => fetcher(`/translations/work/${workId}`),

  // Search
  search: (params: URLSearchParams) => fetcher<SearchResult>(`/search?${params}`),
  /** Authors and books matching by name or title, for the groups above the works */
  searchGroups: (q: string) => fetcher<SearchGroups>(`/search/groups?${new URLSearchParams({ q })}`),

  // Blog
  getBlogPosts: (params?: URLSearchParams) =>
    fetcher(`/blog${params ? `?${params}` : ''}`),
  getBlogPost: (slug: string) => fetcher(`/blog/${slug}`),

  // Public submissions (anonymous "Contribute" form)
  submitPublic: (data: PublicSubmission) =>
    fetcher<{ ok: true }>('/submissions/public', { method: 'POST', body: JSON.stringify(data) }),

  // Sitemap
  getSitemap: () =>
    sharedGet<SitemapEntries>('/sitemap', 30 * MINUTE),

  // Auth
  /** Which sign-in methods the server can complete; the same for every reader, so cacheable */
  getAuthProviders: () =>
    sharedGet<{ google: boolean; email: boolean }>('/auth/providers', 5 * MINUTE),
  login: (data: { email: string; password: string }) =>
    fetcher('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
};

export interface SearchHit {
  id: string;
  slug: string;
  titleAz: string;
  titleRu: string | null;
  titleEn: string | null;
  authorNameAz: string;
  authorNameRu: string | null;
  authorNameEn?: string | null;
  authorSlug: string;
  genre: string | null;
  form: string | null;
  year: number | null;
  lang: string;
  /** HTML with <mark> around the matched words */
  _formatted?: { titleAz?: string; authorNameAz?: string; body?: string | null };
}

export interface SearchFacets {
  authors: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null; count: number }[];
  genre: Record<string, number>;
  lang: Record<string, number>;
  /** Works with a translation; null while the index can't filter on it (before a reindex) */
  translated: number | null;
}

export interface SearchResult {
  hits: SearchHit[];
  estimatedTotalHits: number;
  /** Only when asked for with `facets=1`; absent from an older API */
  facets?: SearchFacets;
}

export interface SearchGroups {
  authors: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null; type: string; period: string | null }[];
  books: {
    id: string;
    slug: string;
    titleAz: string;
    titleRu: string | null;
    titleEn: string | null;
    titleFa: string | null;
    genre: string;
    author: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null };
  }[];
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** A collection as a shelf item: what a generated cover and its caption need */
export interface BookSummary {
  id: string;
  slug: string;
  titleAz: string;
  titleRu: string | null;
  titleEn: string | null;
  titleFa: string | null;
  genre: string;
  year: number | null;
  yearApprox: boolean;
  originalLang: string;
  createdAt: string;
  workCount: number;
  author: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null };
}

export interface AuthorBrief {
  slug: string;
  nameAz: string;
  nameRu: string | null;
  nameEn: string | null;
  bornYear: number | null;
  diedYear: number | null;
  type: string;
  period: string | null;
  portraitUrl: string | null;
}

/** A work as lists outside a book show it */
export interface WorkRef {
  id: string;
  slug: string;
  titleAz: string;
  titleRu: string | null;
  titleEn: string | null;
  genre: string;
  form: string | null;
  year: number | null;
  yearApprox: boolean;
  originalLang: string;
}

/** GET /authors/:slug?view=page */
export interface AuthorPage extends AuthorBrief {
  id: string;
  bornYearApprox: boolean;
  diedYearApprox: boolean;
  bornPlace: string | null;
  diedPlace: string | null;
  writingLangs: string[];
  /** Rendered HTML */
  bioAz: string | null;
  bioRu: string | null;
  bioEn: string | null;
  bioSources: unknown;
  portraitSource: string | null;
  portraitCredit: string | null;
  wikidataId: string | null;
  /** Books that hold at least one published work */
  collections: (Omit<BookSummary, 'author' | 'createdAt'>)[];
  /** The first works that belong to no book (at most 30); `standaloneCount` is how many there are */
  works: WorkRef[];
  standaloneCount: number;
  /** All published works, in books or not */
  worksCount: number;
  /** The first few; the rest load from /authors/:slug/artworks when the reader asks */
  artworks: unknown[];
  artworksCount: number;
}

/** Published counts behind the homepage catalog */
export interface Catalog {
  works: number;
  forms: Partial<Record<string, number>>;
  genres: Partial<Record<string, number>>;
  authors: Partial<Record<string, number>>;
}

export type TagKind = 'THEME' | 'MOOD' | 'AUDIENCE' | 'ERA';

export interface TagRef {
  slug: string;
  kind: TagKind;
  nameAz: string;
  nameRu: string | null;
  nameEn: string | null;
}

export interface TagSummary extends TagRef {
  works: number;
}

export interface TagDetail extends TagSummary {
  authors: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null; works: number }[];
}

export interface MoreWork {
  slug: string;
  titleAz: string;
  titleRu: string | null;
  titleEn: string | null;
  genre: string;
  form: string | null;
  year: number | null;
  incipit: { lines: string[]; lang: string };
}

export interface OtherWork extends MoreWork {
  author: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null };
}

interface NavItem {
  slug: string;
  titleAz: string;
  titleRu: string | null;
  titleEn?: string | null;
}

export interface PoemOfTheDay {
  slug: string;
  titleAz: string;
  titleRu: string | null;
  titleEn: string | null;
  form: string | null;
  year: number | null;
  date: string;
  /** The UI language it was picked for; its title and opening lines are in it */
  lang: 'az' | 'ru' | 'en';
  excerpt: string[];
  author: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null };
}

interface SitemapEntry {
  slug: string;
  updatedAt: string;
}

interface SitemapEntries {
  /** `works`: the author has published works (absent from an older API: assume so) */
  authors: (SitemapEntry & { works?: boolean })[];
  collections: SitemapEntry[];
  /** `locales`: where the page has text in that language (absent from an older API: all) */
  works: (SitemapEntry & { locales?: string[] })[];
  blog: SitemapEntry[];
}

export interface PublicSubmission {
  type: 'WORK' | 'TRANSLATION' | 'AUTHOR';
  payload: Record<string, unknown>;
  contactName: string;
  contactEmail: string;
  sourceNote?: string;
  /** Honeypot */
  website?: string;
}
