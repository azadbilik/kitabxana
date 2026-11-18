import { paginate } from '@/lib/paginate';

export interface ProseSection {
  id: string;
  text: string;
  /** The reading page (1-based) the heading is on */
  page: number;
}

export interface ProsePages {
  /** HTML of each reading page, headings anchored; one entry for a short text */
  pages: string[];
  words: number;
  /** Headings inside the text (acts, scenes, numbered parts) */
  sections: ProseSection[];
}

// A long novel chapter is a few hundred KB of HTML; this keeps the busiest texts, not all
const MAX_ENTRIES = 150;
const cache = new Map<string, ProsePages>();

/**
 * A prose text split into reading pages, with its headings anchored for the contents list.
 * Splitting walks the whole text, so the result is kept per work and revision: turning a
 * page costs a lookup, not another pass over the novel.
 */
export function prosePages(work: { id: string; updatedAt: string }, html: string): ProsePages {
  const key = `${work.id}:${work.updatedAt}:${html.length}`;
  const hit = cache.get(key);
  if (hit) {
    // Re-insert, so the map's order is least recently used first
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const found: { id: string; text: string }[] = [];
  const anchored = html.replace(/<h([2-4])>([\s\S]*?)<\/h\1>/g, (_m, level, inner) => {
    const id = `section-${found.length + 1}`;
    found.push({ id, text: inner.replace(/<[^>]+>/g, '').trim() });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  const { pages, words } = paginate(anchored);
  let from = 0;
  const sections = found.map((section) => {
    // Headings come in order, so each search starts on the page of the one before
    const at = pages.findIndex((page, i) => i >= from && page.includes(`id="${section.id}"`));
    from = Math.max(from, at);
    return { ...section, page: at + 1 || 1 };
  });

  const result = { pages, words, sections };
  cache.set(key, result);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return result;
}
