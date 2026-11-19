'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { sendProgress, useLoadMarks, useMarks } from '@/lib/library';
import { formatReadingTime } from '@/lib/reading-time';

interface Props {
  slug: string;
  /** Signed in: the place is also kept on the account, so it follows the reader to other devices */
  workId?: string;
  /** The element holding the text whose progress is shown */
  targetId: string;
  dir: 'ltr' | 'rtl';
  /** A paged text: progress and the saved place run across all its pages */
  pagination?: { page: number; pages: number } | null;
  /** Minutes the whole text takes, for the time left in the corner (0: none shown) */
  minutes?: number;
}

const KEY = (slug: string) => `irs-reading-pos:${slug}`;
// Where to scroll on the page a "continue" jump lands on
const PENDING = 'irs-reading-resume';
// Too short to need a bar: under this many screens of text
const MIN_SCREENS = 1.5;
// A saved place this close to either end isn't worth offering
const EDGE = 0.02;
// The place is kept in this browser every second, and on the account this often while the
// reader scrolls; leaving or hiding the page sends whatever is newer
const LOCAL_MS = 1000;
const SYNC_MS = 10_000;

function readSaved(slug: string): number | null {
  try {
    const value = Number(localStorage.getItem(KEY(slug)));
    return value > EDGE && value < 1 - EDGE ? value : null;
  } catch {
    return null;
  }
}

function save(slug: string, progress: number) {
  try {
    if (progress >= 1 - EDGE) localStorage.removeItem(KEY(slug));
    else if (progress > EDGE) localStorage.setItem(KEY(slug), progress.toFixed(4));
  } catch {
    // Storage blocked: the bar still works, only the place isn't remembered
  }
}

/** Where the reader is in a long text, a thin bar along the top of the window and the time
    left in the corner, and an offer to go back to the place they left last time — on
    whichever page it is */
export function ReadingProgress({ slug, workId, targetId, dir, pagination, minutes = 0 }: Props) {
  const t = useTranslations('reading');
  const { status } = useAccount();
  const signedIn = status === 'signed-in' && Boolean(workId);
  const marks = useMarks();
  useLoadMarks(signedIn, { workIds: workId ? [workId] : [] });
  // What the account was last told, so the same place isn't sent twice
  const synced = useRef({ at: 0, progress: -1 });
  // Read by the scroll handlers, which are bound once per page
  const sync = useRef<((p: number, leaving?: boolean) => void) | null>(null);
  sync.current =
    signedIn && workId
      ? (p, leaving) => {
          const value = p >= 1 - EDGE ? 1 : p;
          // Positions next to the start aren't sent: opening a text and nudging it isn't reading it
          if (p <= EDGE || value === synced.current.progress) return;
          synced.current = { at: Date.now(), progress: value };
          sendProgress(workId, value, { beacon: leaving });
        }
      : null;
  // The last place measured while the text was on screen; on leaving, the page may already be
  // scrolled back or gone, so this is what is kept, not a fresh measurement
  const lastMeasured = useRef(0);
  const arrivedAt = useRef<{ page: number; offered: boolean } | null>(null);
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [long, setLong] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const lastSaved = useRef(0);
  const page = pagination?.page ?? 1;
  const pages = pagination?.pages ?? 1;

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const span = () => {
      const top = target.getBoundingClientRect().top + window.scrollY;
      return { top, length: Math.max(1, target.offsetHeight - window.innerHeight) };
    };
    const withinPage = () => {
      const { top, length } = span();
      return Math.min(1, Math.max(0, (window.scrollY - top) / length));
    };
    const overall = () => (page - 1 + withinPage()) / pages;
    const scrollWithin = (fraction: number) => {
      const { top, length } = span();
      window.scrollTo({ top: top + fraction * length });
    };

    // Arrived from "continue" on another page: go to the place on this one
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING) ?? 'null');
      if (pending?.slug === slug && pending.page === page) {
        sessionStorage.removeItem(PENDING);
        requestAnimationFrame(() => scrollWithin(pending.fraction));
      }
    } catch {}

    // Only a reader who has scrolled moves the saved place; opening page 5 from a link doesn't
    let moved = false;
    let frame = 0;
    const measure = () => {
      frame = 0;
      setLong(pages > 1 || target.offsetHeight > window.innerHeight * MIN_SCREENS);
      const p = overall();
      setProgress(p);
      if (!moved) return;
      lastMeasured.current = p;
      if (withinPage() > EDGE) setResumeAt(null);
      const now = Date.now();
      if (now - lastSaved.current > LOCAL_MS) {
        lastSaved.current = now;
        save(slug, p);
      }
      // Reaching the end is sent at once, so the text shows as read without waiting
      if (now - synced.current.at > SYNC_MS || (p >= 1 - EDGE && synced.current.progress !== 1)) sync.current?.(p);
    };
    const onScroll = () => {
      moved = true;
      if (!frame) frame = requestAnimationFrame(measure);
    };

    // Offered on arrival only, not again on every page turned within the text
    let arriving = true;
    try {
      arriving = !sessionStorage.getItem(`${KEY(slug)}:open`);
      sessionStorage.setItem(`${KEY(slug)}:open`, '1');
    } catch {}
    const saved = arriving ? readSaved(slug) : null;
    if (saved !== null) {
      const savedPage = Math.min(pages, Math.floor(saved * pages) + 1);
      const elsewhere = savedPage !== page;
      if (elsewhere ? Math.abs(saved - (page - 1) / pages) > EDGE : window.scrollY < span().top) setResumeAt(saved);
    }
    measure();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const onHide = () => {
      if (!moved) return;
      save(slug, lastMeasured.current);
      sync.current?.(lastMeasured.current, true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
      if (moved) {
        save(slug, lastMeasured.current);
        sync.current?.(lastMeasured.current);
      }
    };
  }, [slug, targetId, page, pages]);

  // Signed in with no place saved in this browser: offer the place kept on the account
  // (read on another device), once it arrives, under the same rules as a local one
  const serverProgress = workId ? marks.works[workId] : undefined;
  useEffect(() => {
    if (!serverProgress || serverProgress.status === 'DONE' || resumeAt !== null) return;
    if (readSaved(slug) !== null) return;
    const p = serverProgress.progress;
    if (!(p > EDGE && p < 1 - EDGE)) return;
    if (arrivedAt.current?.offered) return;
    let arriving = false;
    try {
      arriving = sessionStorage.getItem(`${KEY(slug)}:server`) !== '1';
      sessionStorage.setItem(`${KEY(slug)}:server`, '1');
    } catch {}
    if (!arriving) return;
    arrivedAt.current = { page, offered: true };
    if (Math.abs(p - (page - 1) / pages) > EDGE || window.scrollY < 50) setResumeAt(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverProgress?.progress, serverProgress?.status]);

  function resume() {
    const target = document.getElementById(targetId);
    if (!target || resumeAt === null) return;
    const savedPage = Math.min(pages, Math.floor(resumeAt * pages) + 1);
    const fraction = resumeAt * pages - (savedPage - 1);
    setResumeAt(null);
    if (savedPage !== page) {
      try {
        sessionStorage.setItem(PENDING, JSON.stringify({ slug, page: savedPage, fraction }));
      } catch {}
      const url = new URL(window.location.href);
      if (savedPage > 1) url.searchParams.set('p', String(savedPage));
      else url.searchParams.delete('p');
      url.hash = '';
      router.push(`${url.pathname}${url.search}`);
      return;
    }
    const top = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + fraction * Math.max(1, target.offsetHeight - window.innerHeight) });
    target.focus({ preventScroll: true });
  }

  // Shown once the reader is into the text (the total is under the title) and gone at its end.
  // Hidden from screen readers like the bar: a figure changing as one scrolls is noise there
  const left = long && progress > EDGE && progress < 1 - EDGE ? formatReadingTime(t as never, minutes * (1 - progress)) : null;

  return (
    <>
      {long && (
        <div className="reading-progress" aria-hidden="true" dir={dir}>
          <div className="reading-progress-bar" style={{ '--progress': progress } as CSSProperties} />
        </div>
      )}
      {left && (
        <p className="reading-left" aria-hidden="true">
          {t('time_left', { time: left })}
        </p>
      )}
      {resumeAt !== null && (
        <div className="resume">
          <button type="button" className="resume-btn" onClick={resume}>
            {pages > 1
              ? t('resume_page', { page: Math.min(pages, Math.floor(resumeAt * pages) + 1), percent: Math.round(resumeAt * 100) })
              : t('resume', { percent: Math.round(resumeAt * 100) })}
          </button>
        </div>
      )}
    </>
  );
}
