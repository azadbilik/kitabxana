import { getTranslations } from 'next-intl/server';
import { formatReadingTime, readingMinutes } from '@/lib/reading-time';

interface Props {
  words?: number | null;
  genre?: string | null;
  locale: string;
  /** First in the strip: no separating dot before it */
  first?: boolean;
}

/**
 * The reading time at the end of a work card's meta strip («· 4 dəq»), from the work's
 * stored word count. Nothing for a work without text (or an API too old to send the count).
 */
export async function ReadingTimeMeta({ words, genre, locale, first = false }: Props) {
  const t = await getTranslations({ locale, namespace: 'reading' });
  const time = formatReadingTime(t as never, readingMinutes(words, genre));
  if (!time) return null;
  return (
    <>
      {!first && <span className="dot" aria-hidden="true" />}
      <span>{time}</span>
    </>
  );
}
