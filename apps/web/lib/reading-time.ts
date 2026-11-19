/**
 * Reading time from a work's word count (`Work.wordCount`, kept by the database).
 * Silent reading of literary prose runs a little under the usual 200–250 words a minute;
 * verse is read slower, line by line.
 */
const WORDS_PER_MINUTE: Record<string, number> = { POEM: 120 };
const PROSE_WORDS_PER_MINUTE = 180;

/** Minutes to read `words` of a work of this genre, unrounded (so a book's parts can be summed) */
export function readingMinutes(words: number | null | undefined, genre?: string | null): number {
  if (!words || words < 0) return 0;
  return words / (WORDS_PER_MINUTE[genre ?? ''] ?? PROSE_WORDS_PER_MINUTE);
}

export type ReadingTime = { minutes: number } | { hours: number; minutes: number } | { hours: number };

/**
 * A reading time as readers think of it: at least a minute; whole minutes under an hour;
 * hours and minutes to the nearest five up to ten hours; whole hours beyond.
 * Nothing for a text with no words.
 */
export function roundReadingTime(minutes: number): ReadingTime | null {
  if (!(minutes > 0)) return null;
  const whole = Math.max(1, Math.round(minutes));
  if (whole < 60) return { minutes: whole };
  if (whole >= 600) return { hours: Math.round(whole / 60) };
  let hours = Math.floor(whole / 60);
  let rest = Math.round((whole % 60) / 5) * 5;
  if (rest === 60) {
    hours += 1;
    rest = 0;
  }
  return rest ? { hours, minutes: rest } : { hours };
}

type Translate = (key: string, values: Record<string, number>) => string;

/**
 * The reading time in words, from the `reading` messages: time_min, time_h, time_hm.
 * `t` is next-intl's translator for the `reading` namespace.
 */
export function formatReadingTime(t: Translate, minutes: number): string | null {
  const time = roundReadingTime(minutes);
  if (!time) return null;
  if (!('hours' in time)) return t('time_min', { n: time.minutes });
  return 'minutes' in time ? t('time_hm', { h: time.hours, m: time.minutes }) : t('time_h', { h: time.hours });
}
