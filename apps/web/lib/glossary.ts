/**
 * The dictionary behind a tapped word: «Klassik Azərbaycan ədəbiyyatında işlənən ərəb və fars
 * sözləri lüğəti» (Bakı, 2005), asked of the API one word at a time. Answers are the same for
 * everyone, so the request carries no cookie and the edge may keep it.
 */

export interface GlossMatch {
  head: string;
  senses: { origin: string; text: string }[];
  phrase?: { text: string; gloss: string };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const asked = new Map<string, Promise<GlossMatch[]>>();

export function lookupWord(word: string): Promise<GlossMatch[]> {
  const key = word.toLocaleLowerCase('az');
  let answer = asked.get(key);
  if (!answer) {
    answer = fetch(`${API}/glossary?w=${encodeURIComponent(key)}`, { credentials: 'omit' })
      .then((res) => (res.ok ? res.json() : { matches: [] }))
      .then((body: { matches?: GlossMatch[] }) => body.matches ?? [])
      .catch(() => {
        // Offline or the API is away: ask again next time
        asked.delete(key);
        return [];
      });
    asked.set(key, answer);
  }
  return answer;
}

const WORD_CHAR = /[\p{L}\p{M}’'ʼ‘-]/u;

/** The word under a point of the page, as a range over its letters; null on blank space */
export function wordAt(x: number, y: number): { word: string; range: Range } | null {
  let node: Node | null = null;
  let offset = 0;
  const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) [node, offset] = [pos.offsetNode, pos.offset];
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (r) [node, offset] = [r.startContainer, r.startOffset];
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent ?? '';
  let from = offset;
  let to = offset;
  while (from > 0 && WORD_CHAR.test(text[from - 1])) from--;
  while (to < text.length && WORD_CHAR.test(text[to])) to++;
  // Hyphens and apostrophes belong to a word only inside it
  while (from < to && /[’'ʼ‘-]/.test(text[from])) from++;
  while (to > from && /[-‘]/.test(text[to - 1])) to--;
  if (to - from < 2) return null;
  const range = document.createRange();
  range.setStart(node, from);
  range.setEnd(node, to);
  // The caret snaps to the nearest letter: a tap in the margin beside a line is not a tap on its last word
  const hit = [...range.getClientRects()].some((r) => x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2);
  return hit ? { word: text.slice(from, to), range } : null;
}
