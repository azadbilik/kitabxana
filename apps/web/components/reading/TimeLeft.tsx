'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatReadingTime } from '@/lib/reading-time';

// Not shown this close to either end: at the top the total is under the title
const EDGE = 0.02;
// Too short to need it: under this many screens of text
const MIN_SCREENS = 1.5;

/**
 * The time left in a long text, in the corner while it is read («19 dəq qaldı»): gone at its
 * start and end. Hidden from screen readers like the progress bar: a figure that changes as
 * one scrolls is noise there.
 */
export function TimeLeftPill({ progress, minutes }: { progress: number; minutes: number }) {
  const t = useTranslations('reading');
  const left = progress > EDGE && progress < 1 - EDGE ? formatReadingTime(t as never, minutes * (1 - progress)) : null;
  if (!left) return null;
  return (
    <p className="reading-left" aria-hidden="true">
      {t('time_left', { time: left })}
    </p>
  );
}

/**
 * The pill for a poem. Prose gets it from ReadingProgress, which also keeps the reader's
 * place; a poem's place isn't kept, so this only follows the scroll. A folded poem is short
 * until it is opened, so the pill shows from then on.
 */
export function PoemTimeLeft({ targetId, minutes }: { targetId: string; minutes: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || !minutes) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const length = target.offsetHeight - window.innerHeight;
      if (target.offsetHeight < window.innerHeight * MIN_SCREENS) return setProgress(0);
      const top = target.getBoundingClientRect().top + window.scrollY;
      setProgress(Math.min(1, Math.max(0, (window.scrollY - top) / Math.max(1, length))));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [targetId, minutes]);

  return <TimeLeftPill progress={progress} minutes={minutes} />;
}
