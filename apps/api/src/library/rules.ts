/**
 * How a book's status follows the reading of its parts. Pure functions, so the rules are
 * tested on their own (rules.spec.ts) and the service only applies them.
 */
export type BookStatus = 'WANT' | 'READING' | 'DONE';

/** Poem collections (divans, cycles) are dipped into, not read through */
export const isReadThrough = (genre: string) => genre !== 'POEM';

/**
 * A part of a book was opened or advanced. Returns the book's new status, or null to leave
 * it as it is (including leaving it absent).
 * - A prose or drama book goes on the shelf as "reading" the moment a part is opened.
 * - A poem collection does so only if the reader put it on the shelf themselves: reading one
 *   ghazal must not shelve a 300-poem divan.
 * - "Read" stays read; re-reading a finished book doesn't demote it.
 */
export function statusOnPartOpened(current: BookStatus | null, genre: string): BookStatus | null {
  if (current === 'DONE' || current === 'READING') return null;
  if (current === 'WANT') return 'READING';
  return isReadThrough(genre) ? 'READING' : null;
}

/**
 * A part was marked read. A book whose every published part is read becomes read, if the book
 * is on the shelf or is read-through; otherwise nothing changes.
 */
export function statusOnPartDone(current: BookStatus | null, genre: string, doneParts: number, totalParts: number): BookStatus | null {
  if (current === 'DONE') return null;
  const onShelf = current !== null || isReadThrough(genre);
  if (!onShelf) return null;
  if (totalParts > 0 && doneParts >= totalParts) return 'DONE';
  return current === null || current === 'WANT' ? 'READING' : null;
}

/** A text counts as read when the reader reaches its end */
export const FINISHED_AT = 0.98;

/** Progress the server keeps: a fraction, clamped, at 4 decimals */
export const cleanProgress = (p: unknown) => {
  const n = typeof p === 'number' && Number.isFinite(p) ? p : 0;
  return Math.round(Math.min(1, Math.max(0, n)) * 10_000) / 10_000;
};
