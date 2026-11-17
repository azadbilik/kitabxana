'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Props {
  slug: string;
  /** The element holding the text whose progress is shown */
  targetId: string;
  dir: 'ltr' | 'rtl';
  /** A paged text: progress and the saved place run across all its pages */
  pagination?: { page: number; pages: number } | null;
}

const KEY = (slug: string) => `irs-reading-pos:${slug}`;
// Where to scroll on the page a "continue" jump lands on
const PENDING = 'irs-reading-resume';
// Too short to need a bar: under this many screens of text
const MIN_SCREENS = 1.5;
// A saved place this close to either end isn't worth offering
const EDGE = 0.02;

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

/** Where the reader is in a long text, a thin bar along the top of the window,
    and an offer to go back to the place they left last time — on whichever page it is */
export function ReadingProgress({ slug, targetId, dir, pagination }: Props) {
  const t = useTranslations('reading');
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
      if (withinPage() > EDGE) setResumeAt(null);
      const now = Date.now();
      if (now - lastSaved.current > 1000) {
        lastSaved.current = now;
        save(slug, p);
      }
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
    const onHide = () => moved && save(slug, overall());
    window.addEventListener('pagehide', onHide);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pagehide', onHide);
      if (moved) save(slug, overall());
    };
  }, [slug, targetId, page, pages]);

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

  return (
    <>
      {long && (
        <div className="reading-progress" aria-hidden="true" dir={dir}>
          <div className="reading-progress-bar" style={{ '--progress': progress } as CSSProperties} />
        </div>
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
