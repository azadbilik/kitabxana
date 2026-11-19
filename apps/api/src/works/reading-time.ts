import type { Prisma } from '@prisma/client';

/**
 * Reading-time bands for the works list, in minutes. Reading speed is the site's
 * (apps/web/lib/reading-time.ts): verse 120 words a minute, everything else 180. Edges sit
 * on half minutes, as the site rounds: a card that says «5 dəq» is in the first band,
 * «6 dəq» in the second, «1 saat» in the last.
 */
export const READING_BANDS = {
  short: [0, 5.5],
  medium: [5.5, 15.5],
  long: [15.5, 59.5],
  book: [59.5, Infinity],
} as const;

export type ReadingBand = keyof typeof READING_BANDS;

const VERSE_WPM = 120;
const PROSE_WPM = 180;

const words = ([from, to]: readonly [number, number], wpm: number): Prisma.IntFilter => ({
  gte: Math.ceil(from * wpm),
  ...(Number.isFinite(to) && { lt: Math.ceil(to * wpm) }),
});

/** Works whose reading time falls in the band; a work without text (0 words) in none */
export function inReadingBand(band: ReadingBand): Prisma.WorkWhereInput {
  const range = READING_BANDS[band];
  return {
    wordCount: { gt: 0 },
    OR: [
      { genre: 'POEM', wordCount: words(range, VERSE_WPM) },
      { genre: { not: 'POEM' }, wordCount: words(range, PROSE_WPM) },
    ],
  };
}
