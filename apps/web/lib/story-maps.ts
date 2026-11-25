/**
 * Azad Bilik's story maps (azadbilik.org/xeriteler/<story>) follow a poem stop by stop, each stop
 * with the chapters it happens in. A chapter page links to its stop when a map has one.
 */
const BASE = 'https://azadbilik.org/xeriteler/';
const STORIES = ['iskender', 'xosrov-sirin'];
const TTL_MS = 6 * 60 * 60_000;

type Names = { az?: string; ru?: string; en?: string };
interface Stop { id: string; name: Names; chapters: string[] }
interface Route { meta: { title: Names }; stops: Stop[] }
interface OnMap { story: string; stop: string; place: Names; title: Names }

let cache: { at: number; byChapter: Map<string, OnMap> } | null = null;

async function stopsByChapter(): Promise<Map<string, OnMap> | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.byChapter;
  try {
    const routes = await Promise.all(STORIES.map(async (story) => {
      const res = await fetch(`${BASE}${story}/route.json`, { signal: AbortSignal.timeout(2_000), cache: 'no-store' });
      if (!res.ok) throw new Error(`${story}: HTTP ${res.status}`);
      return [story, (await res.json()) as Route] as const;
    }));
    const byChapter = new Map<string, OnMap>();
    // A chapter on several stops (a battle told over a camp and its aftermath) links to the first
    for (const [story, route] of routes)
      for (const s of route.stops)
        for (const c of s.chapters)
          if (!byChapter.has(c)) byChapter.set(c, { story, stop: s.id, place: s.name, title: route.meta.title });
    cache = { at: Date.now(), byChapter };
    return byChapter;
  } catch {
    // The maps being down never breaks a chapter page: keep the last copy, or no link
    return cache?.byChapter ?? null;
  }
}

const pick = (n: Names, locale: string) => (locale === 'ru' ? n.ru : locale === 'en' ? n.en : n.az) ?? n.az ?? '';

/** The story map at this chapter's stop, in the reader's language; null when no map has the chapter */
export async function storyMapStop(slug: string, locale: string): Promise<{ href: string; place: string; story: string } | null> {
  const m = (await stopsByChapter())?.get(slug);
  if (!m) return null;
  return {
    href: `${BASE}${m.story}/${locale === 'az' ? '' : `?lang=${locale}`}#${m.stop}`,
    place: pick(m.place, locale),
    story: pick(m.title, locale),
  };
}
