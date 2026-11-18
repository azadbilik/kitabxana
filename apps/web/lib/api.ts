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
    fetcher(`/authors${params ? `?${params}` : ''}`),
  getAuthor: (slug: string) => fetcher(`/authors/${slug}`),
  /** Poet of the week, picked so everything shown is in the reader's language */
  /** Every published author with a work count, for the literature tree */
  getAuthorTree: () => fetcher<TreeAuthor[]>('/authors/tree', { next: { revalidate: 600 } }),
  getFeaturedAuthor: (locale: string) => fetcher(`/authors/featured?lang=${locale}`),

  // Collections (the site's "books")
  getCollection: (slug: string) => fetcher(`/collections/${slug}`),
  getCollections: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
    return fetcher<{ data: BookSummary[]; meta: PageMeta }>(`/collections${qs.size ? `?${qs}` : ''}`);
  },

  // Works
  getWorks: (params?: URLSearchParams) =>
    fetcher(`/works${params ? `?${params}` : ''}`),
  getWork: (slug: string) => fetcher(`/works/${slug}`),
  getRandomWork: (locale: string) => fetcher<{ slug: string }>(`/works/random?lang=${locale}`, { cache: 'no-store' }),
  getCatalog: () => fetcher<Catalog>('/works/catalog', { next: { revalidate: 600 } }),
  getPoemOfTheDay: (locale: string) => fetcher<PoemOfTheDay>(`/works/daily?lang=${locale}`, { cache: 'no-store' }),
  resolveWork: (slug: string) => fetcher<{ slug: string }>(`/works/resolve/${slug}`),
  getMoreByAuthor: (slug: string, locale: string) =>
    fetcher<MoreWork[]>(`/works/${slug}/more?locale=${locale}`),
  getOtherPoets: (slug: string, locale: string) =>
    fetcher<{ theme: TagRef | null; works: OtherWork[] }>(`/works/${slug}/others?locale=${locale}`),
  getWorkNav: (slug: string) =>
    fetcher<{ prev: NavItem | null; next: NavItem | null }>(`/works/${slug}/nav`),

  // Tags
  getTags: () => fetcher<TagSummary[]>('/tags'),
  getTag: (slug: string) => fetcher<TagDetail>(`/tags/${slug}`),

  // Translations
  getTranslations: (workId: string) => fetcher(`/translations/work/${workId}`),

  // Search
  search: (params: URLSearchParams) => fetcher(`/search?${params}`),

  // Blog
  getBlogPosts: (params?: URLSearchParams) =>
    fetcher(`/blog${params ? `?${params}` : ''}`),
  getBlogPost: (slug: string) => fetcher(`/blog/${slug}`),

  // Public submissions (anonymous "Contribute" form)
  submitPublic: (data: PublicSubmission) =>
    fetcher<{ ok: true }>('/submissions/public', { method: 'POST', body: JSON.stringify(data) }),

  // Sitemap
  getSitemap: () =>
    fetcher<SitemapEntries>('/sitemap', { next: { revalidate: 3600 } }),

  // Auth
  login: (data: { email: string; password: string }) =>
    fetcher('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
};

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
  authors: SitemapEntry[];
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
