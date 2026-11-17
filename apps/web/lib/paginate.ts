/**
 * Splits a long prose text into reading pages, LitRes-style: a page is about PAGE_WORDS words,
 * broken only between top-level blocks (paragraphs, headings, rules, quotes), never inside one.
 * A heading starts a new page once the current one is half full, so chapters and acts open a
 * page; a short last page is folded into the one before it.
 */

export const PAGE_WORDS = 1200;
// Texts under this many words are read on one page
const MIN_WORDS = PAGE_WORDS * 1.5;

const VOID = new Set(['hr', 'br', 'img', 'wbr']);
const TAG = /<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g;

/** Top-level blocks of rendered HTML, each as its own HTML string */
function blocks(html: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let m: RegExpExecArray | null;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(html))) {
    const [, closing, name, selfClosing] = m;
    const tag = name.toLowerCase();
    if (closing) depth = Math.max(0, depth - 1);
    else if (!selfClosing && !VOID.has(tag)) depth++;
    if (depth === 0) {
      const end = TAG.lastIndex;
      const block = html.slice(start, end).trim();
      if (block) out.push(block);
      start = end;
    }
  }
  const rest = html.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

const wordsIn = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const isHeading = (block: string) => /^<h[2-4][\s>]/i.test(block);

export interface Paged {
  /** HTML of each page; one page for a short text */
  pages: string[];
  /** Words in the whole text */
  words: number;
}

export function paginate(html: string, pageWords = PAGE_WORDS): Paged {
  const all = blocks(html);
  const counts = all.map(wordsIn);
  const words = counts.reduce((a, b) => a + b, 0);
  if (words < MIN_WORDS) return { pages: [html], words };

  const pages: { html: string[]; words: number }[] = [{ html: [], words: 0 }];
  all.forEach((block, i) => {
    let page = pages.at(-1)!;
    const full = page.words >= pageWords;
    const chapterBreak = isHeading(block) && page.words >= pageWords / 2;
    // Never leave a heading alone at the foot of a page
    const trailingHeading = page.html.length > 0 && isHeading(page.html.at(-1)!);
    if (page.html.length && (full || chapterBreak) && !trailingHeading) {
      page = { html: [], words: 0 };
      pages.push(page);
    }
    page.html.push(block);
    page.words += counts[i];
  });
  const last = pages.at(-1)!;
  if (pages.length > 1 && last.words < pageWords * 0.3) {
    const prev = pages[pages.length - 2];
    prev.html.push(...last.html);
    prev.words += last.words;
    pages.pop();
  }
  return { pages: pages.map((p) => p.html.join('\n')), words };
}
