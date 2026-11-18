import { foldAz } from '../common/utils/slug';

/**
 * Search highlighting. Meilisearch only highlights the field that matched, and queries typed
 * without Azerbaijani letters match the hidden *Plain copies, so highlights are built here:
 * a word is marked when Meilisearch reported a match inside it (which covers typo matches),
 * or when it matches the query ignoring Azerbaijani letters.
 *
 * Everything here is one pass over the text it is given. Long texts (a chapter, a whole
 * poem cycle) are not tokenised whole: the excerpt is cut from a window around the place
 * where Meilisearch's matches are densest.
 */

const WORD = /[\p{L}\p{N}]+/gu;
const WORD_AT = /[\p{L}\p{N}]+/uy;
const SNIPPET_WORDS = 30;
/** Texts up to this many characters are tokenised whole */
const SCAN_LIMIT = 8_000;
/** For longer ones, the characters kept before and after the densest match */
const WINDOW_BEFORE = 700;
const WINDOW_AFTER = 1_500;
/** Matches this close together (in characters) count as one place when choosing the window */
const NEAR = 220;
const MAX_STARTS = 5_000;

const normalize = (text: string) => foldAz(text).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escaped text with line breaks shown as " / ", for one-line snippets. */
const flatHtml = (text: string) => escapeHtml(text.replace(/\s*\n\s*/g, ' / ').replace(/\s+/g, ' '));

export interface Terms {
  whole: string[];
  /** Like Meilisearch, only the last query word matches as a prefix (still being typed) */
  prefix: string | null;
}

/** Query words in comparable form. */
export function queryTerms(query: string): Terms {
  const list = normalize(query).match(WORD) ?? [];
  return { whole: list.slice(0, -1), prefix: list.at(-1) ?? null };
}

/**
 * Character offsets of Meilisearch's `_matchesPosition` entries in `text`, ascending.
 * Meilisearch reports `start` in UTF-8 bytes. For a *Plain field (`plain: true`) the bytes are
 * counted in the folded text; folding maps each character to one character, so the offset also
 * fits the original.
 */
export function matchStarts(text: string, positions: { start: number }[] | undefined, plain = false): number[] {
  if (!positions?.length) return [];
  const bytes = Buffer.from(plain ? foldAz(text) : text, 'utf8');
  const sorted = positions.map((p) => p.start).sort((a, b) => a - b);
  const out: number[] = [];
  let byte = 0;
  let chars = 0;
  // Each stretch of bytes is decoded once, so many matches in a long text stay linear
  for (const start of sorted) {
    const at = Math.min(start, bytes.length);
    chars += bytes.toString('utf8', byte, at).length;
    byte = at;
    out.push(chars);
  }
  return out;
}

interface Word {
  start: number;
  end: number;
  match: boolean;
}

const ascending = (starts: number[]) => [...starts].sort((a, b) => a - b);

/** The words of `text`; `starts` (ascending) are offsets in the full text `text` was cut from at `base` */
function words(text: string, terms: Terms, starts: number[], base = 0): Word[] {
  const list: Word[] = [];
  let next = 0;
  for (const m of text.matchAll(WORD)) {
    const start = m.index!;
    const end = start + m[0].length;
    while (next < starts.length && starts[next] - base < start) next++;
    let match = next < starts.length && starts[next] - base < end;
    if (!match) {
      const word = normalize(m[0]);
      match = terms.whole.includes(word) || (terms.prefix !== null && word.startsWith(terms.prefix));
    }
    list.push({ start, end, match });
  }
  return list;
}

/** HTML for text[from, to) with matched words wrapped in <mark>. */
function render(text: string, list: Word[], from: number, to: number, toHtml: (s: string) => string) {
  let html = '';
  let pos = from;
  for (const w of list) {
    if (w.start < from || w.end > to || !w.match) continue;
    html += `${toHtml(text.slice(pos, w.start))}<mark>${escapeHtml(text.slice(w.start, w.end))}</mark>`;
    pos = w.end;
  }
  return html + toHtml(text.slice(pos, to));
}

export function highlight(text: string, terms: Terms, starts: number[] = []): string {
  return render(text, words(text, terms, ascending(starts)), 0, text.length, escapeHtml);
}

/**
 * Index of the first place where the most different keys fall within `reach` of each other.
 * `at[i]` is where item i sits (ascending), `key(i)` what it is.
 */
function densest(at: number[], reach: number, key: (i: number) => string): { index: number; score: number } {
  const counts = new Map<string, number>();
  const keys = at.map((_, i) => key(i));
  let best = { index: 0, score: 0 };
  let right = 0;
  for (let left = 0; left < at.length; left++) {
    while (right < at.length && at[right] < at[left] + reach) {
      counts.set(keys[right], (counts.get(keys[right]) ?? 0) + 1);
      right++;
    }
    if (counts.size > best.score) best = { index: left, score: counts.size };
    const n = counts.get(keys[left])! - 1;
    if (n) counts.set(keys[left], n);
    else counts.delete(keys[left]);
  }
  return best;
}

/** The part of a long text worth tokenising: around its densest matches, cut at white space */
function window(text: string, starts: number[]): { from: number; to: number } {
  if (text.length <= SCAN_LIMIT) return { from: 0, to: text.length };
  let anchor = 0;
  if (starts.length) {
    const list = starts.slice(0, MAX_STARTS);
    const wordAt = (i: number) => {
      WORD_AT.lastIndex = list[i];
      return normalize(WORD_AT.exec(text)?.[0] ?? '');
    };
    anchor = list[densest(list, NEAR, wordAt).index];
  }
  let from = Math.max(0, anchor - WINDOW_BEFORE);
  let to = Math.min(text.length, anchor + WINDOW_AFTER);
  if (from > 0) {
    const space = text.slice(from, anchor).search(/\s/);
    from = space < 0 ? anchor : from + space + 1;
  }
  if (to < text.length) {
    const space = text.lastIndexOf(' ', to);
    if (space > anchor) to = space;
  }
  return { from, to };
}

/**
 * A short one-line excerpt around the best match: where the most different query words fall
 * together, the earliest such place on a tie, so a phrase deep in a long translation beats a
 * lone "the" near its top. Returns null when the text has no match, so the caller can try
 * another field.
 */
export function snippet(text: string, terms: Terms, starts: number[] = []): string | null {
  return excerpt(text, terms, starts)?.html ?? null;
}

/** The snippet with its score, the number of different query words it shows, to compare fields */
export function excerpt(text: string, terms: Terms, starts: number[] = []): { html: string; score: number } | null {
  const sorted = ascending(starts);
  const cut = window(text, sorted);
  const part = cut.from === 0 && cut.to === text.length ? text : text.slice(cut.from, cut.to);
  const list = words(part, terms, sorted, cut.from);
  const matched = list.flatMap((w, i) => (w.match ? [i] : []));
  if (!matched.length) return null;
  const reach = SNIPPET_WORDS - Math.floor(SNIPPET_WORDS / 3);
  const place = densest(matched, reach, (i) => normalize(part.slice(list[matched[i]].start, list[matched[i]].end)));
  const first = matched[place.index];

  const startIdx = Math.max(0, first - Math.floor(SNIPPET_WORDS / 3));
  const endIdx = Math.min(list.length, startIdx + SNIPPET_WORDS) - 1;
  const from = startIdx === 0 ? 0 : list[startIdx].start;
  const to = endIdx === list.length - 1 ? part.length : list[endIdx].end;

  const html = render(part, list, from, to, flatHtml).trim();
  const before = cut.from + from > 0;
  const after = cut.to < text.length || to < part.trimEnd().length;
  return { html: `${before ? '…' : ''}${html}${after ? '…' : ''}`, score: place.score };
}

/** The opening words, for hits that matched only on title or author. */
export function opening(text: string): string {
  let count = 0;
  let end = 0;
  for (const m of text.matchAll(WORD)) {
    if (++count > SNIPPET_WORDS) return `${flatHtml(text.slice(0, end).trim())}…`;
    end = m.index! + m[0].length;
  }
  return flatHtml(text.trim());
}
