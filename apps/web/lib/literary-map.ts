/**
 * Azad Bilik's literary map (azadbilik.org/xerite) places kitabxana's authors where they were
 * born and died. An author page links to their spot on it when the map has them.
 */
const MAP_URL = 'https://azadbilik.org/xerite/';
const TTL_MS = 6 * 60 * 60_000;

interface Place { az?: string; en?: string; ru?: string }
interface MapAuthor { slug: string; birth: Place | null; death: Place | null }

let cache: { at: number; bySlug: Map<string, MapAuthor> } | null = null;

async function mapAuthors(): Promise<Map<string, MapAuthor> | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.bySlug;
  try {
    const res = await fetch(`${MAP_URL}data/authors.json`, { signal: AbortSignal.timeout(2_000), cache: 'no-store' });
    if (!res.ok) return cache?.bySlug ?? null;
    const list = (await res.json()) as MapAuthor[];
    cache = { at: Date.now(), bySlug: new Map(list.map((a) => [a.slug, a])) };
    return cache.bySlug;
  } catch {
    // The map being down never breaks an author page: keep the last copy, or no link
    return cache?.bySlug ?? null;
  }
}

/** The map link and the place it opens on, in the reader's language; null when the map lacks the author */
export async function literaryMapPlace(slug: string, locale: string): Promise<{ href: string; place: string } | null> {
  const a = (await mapAuthors())?.get(slug);
  const p = a?.birth ?? a?.death;
  if (!p) return null;
  const place = (locale === 'ru' ? p.ru : locale === 'en' ? p.en : p.az) ?? p.az ?? p.en ?? p.ru;
  if (!place) return null;
  return { href: `${MAP_URL}?author=${encodeURIComponent(slug)}`, place };
}
