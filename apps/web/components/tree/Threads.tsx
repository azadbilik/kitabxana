'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { localePath } from '@/lib/i18n';
import { useMarks } from '@/lib/library';

export interface TreeThreadStop {
  id: string;
  kind: 'work' | 'book';
  href: string;
  title: string;
  author: string;
  authorSlug: string;
  year: number;
  /** The date as shown: «1536», «XIV əsr», «~1920» */
  when: string;
  note?: string;
}

export interface TreeThread {
  key: string;
  title: string;
  gist: string;
  stops: TreeThreadStop[];
}

export type StopState = 'done' | 'reading' | null;

/** A stop is read when its work, or its whole book, is marked read */
export function useStopStates() {
  const marks = useMarks();
  return (s: TreeThreadStop): StopState => {
    const st = s.kind === 'work' ? marks.works[s.id]?.status : marks.books[s.id]?.status;
    return st === 'DONE' ? 'done' : st === 'READING' ? 'reading' : null;
  };
}

/** The ids the threads stop at, for the reader's marks */
export function threadIds(threads: TreeThread[]) {
  const stops = threads.flatMap((t) => t.stops);
  return {
    workIds: stops.filter((s) => s.kind === 'work').map((s) => s.id),
    collectionIds: stops.filter((s) => s.kind === 'book').map((s) => s.id),
  };
}

// ── one time scale for every thread ─────────────────────────────────────────
// Most of what the threads cross is the last two centuries, so the older ones are drawn
// narrower: these are [year, share of the width] pairs, straight lines between them.
const SCALE: [number, number][] = [[1100, 0], [1500, 0.12], [1800, 0.3], [1900, 0.5], [2026, 1]];

export function xOf(year: number) {
  const y = Math.min(Math.max(year, SCALE[0][0]), SCALE[SCALE.length - 1][0]);
  for (let i = 1; i < SCALE.length; i++) {
    const [y1, x1] = SCALE[i];
    if (y <= y1) {
      const [y0, x0] = SCALE[i - 1];
      return x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
    }
  }
  return 1;
}

/** The tree's eras, as edges on the axis; the first edge stands for everything before it */
const ERA_EDGES = [1100, 1250, 1500, 1700, 1830, 1895, 1920, 1956, 1991, 2026];
const LABELLED = new Set([1500, 1700, 1830, 1895, 1920, 1956, 1991]);
const pct = (year: number) => `${(xOf(year) * 100).toFixed(3)}%`;

function Bands() {
  return (
    <div className="tl-bands" aria-hidden="true">
      {ERA_EDGES.slice(0, -1).map((y, i) => (
        <span key={y} className={`tl-band${i % 2 ? ' tl-band--alt' : ''}`}
          style={{ left: pct(y), width: `calc(${pct(ERA_EDGES[i + 1])} - ${pct(y)})` }}>
          {LABELLED.has(y) && <b>{y}</b>}
        </span>
      ))}
    </div>
  );
}

/** A thread as one lane of the map: its line from first to last stop, a dot per stop */
function Track({ thread, state }: { thread: TreeThread; state: (s: TreeThreadStop) => StopState }) {
  const first = thread.stops[0].year, last = thread.stops[thread.stops.length - 1].year;
  return (
    <span className="tl-track" aria-hidden="true">
      <i className="tl-line" style={{ left: pct(first), width: `calc(${pct(last)} - ${pct(first)})` }} />
      {thread.stops.map((s) => (
        <i key={s.id} className={`tl-dot tl-dot--${state(s) ?? 'none'}`} style={{ left: pct(s.year) }} />
      ))}
    </span>
  );
}

// ── the open thread, its works hung along the axis ──────────────────────────
// Cards are spaced evenly in order, alternately above and below the axis; a curve runs from
// each card to its true date on the axis, so a crowded century fans out instead of stacking.
const CARD_MAX = 232;
const GAP = 16;
const CARD_H = 128;
const BEND = 46;

function River({ thread, state, locale }: { thread: TreeThread; state: (s: TreeThreadStop) => StopState; locale: string }) {
  const t = useTranslations('tree');
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = thread.stops.length;
  const slot = w / n;
  const card = Math.min(CARD_MAX, 2 * slot - GAP);
  const axisY = CARD_H + BEND;
  const height = 2 * (CARD_H + BEND);
  const first = thread.stops[0].year, last = thread.stops[n - 1].year;
  const placed = thread.stops.map((stop, i) => {
    const cx = (i + 0.5) * slot;
    return { stop, x: xOf(stop.year) * w, cx, left: Math.min(Math.max(cx - card / 2, 0), w - card), up: i % 2 === 0 };
  });

  return (
    <div className="rv" ref={ref} style={{ height }}>
      {w > 0 && (
        <>
          <svg className="rv-leaders" width={w} height={height} aria-hidden="true">
            {placed.map((p) => {
              const y0 = p.up ? CARD_H : height - CARD_H;
              const mid = (y0 + axisY) / 2;
              return <path key={p.stop.id} d={`M${p.cx} ${y0} C${p.cx} ${mid} ${p.x} ${mid} ${p.x} ${axisY}`} />;
            })}
          </svg>
          <div className="rv-axis" style={{ top: axisY }} aria-hidden="true">
            <i className="rv-path" style={{ left: pct(first), width: `calc(${pct(last)} - ${pct(first)})` }} />
            {placed.map((p) => <i key={p.stop.id} className={`rv-dot tl-dot--${state(p.stop) ?? 'none'}`} style={{ left: p.x }} />)}
          </div>
          <ol className="rv-cards">
            {placed.map((p, i) => {
              const st = state(p.stop);
              return (
                <li key={p.stop.id}
                  className={`rv-card rv-card--${p.up ? 'up' : 'down'}${st ? ` rv-card--${st}` : ''}`}
                  style={{ left: p.left, width: card, maxHeight: CARD_H, ...(p.up ? { bottom: height - CARD_H } : { top: height - CARD_H }), animationDelay: `${i * 60}ms` }}>
                  <span className="rv-when">{p.stop.when}</span>
                  <Link prefetch={false} href={localePath(locale, p.stop.href)} className="rv-title">{p.stop.title}</Link>
                  <span className="rv-author">{p.stop.author}</span>
                  {st && <span className="sr-only">{t(st === 'done' ? 'stop_done' : 'stop_reading')}</span>}
                  {p.stop.note && <span className="rv-note">{p.stop.note}</span>}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

export function Threads({
  threads, active, onSelect, signedIn,
}: { threads: TreeThread[]; active: string | null; onSelect: (key: string | null) => void; signedIn: boolean }) {
  const t = useTranslations('tree');
  const locale = useLocale();
  const state = useStopStates();
  const thread = threads.find((th) => th.key === active) ?? null;

  const readIn = (th: TreeThread) => th.stops.filter((s) => state(s) === 'done').length;
  const walked = threads.filter((th) => readIn(th) === th.stops.length).length;
  const anyRead = threads.some((th) => readIn(th) > 0);

  return (
    <section className="threads" aria-labelledby="threads-title">
      <div className="threads-head">
        <h2 id="threads-title">{t('threads_title')}</h2>
        <p className="threads-lead">{t('threads_lead')}</p>
        {signedIn && anyRead && <p className="threads-walked">{t('threads_walked', { n: walked, total: threads.length })}</p>}
      </div>

      {/* The map: every thread on one time axis, divided into the tree's eras */}
      <div className="tl" role="group" aria-label={t('threads_title')}>
        <div className="tl-field"><Bands /></div>
        {threads.map((th) => {
          const n = readIn(th);
          const on = active === th.key;
          return (
            <button key={th.key} type="button" className={`tl-lane${on ? ' tl-lane--on' : ''}`} aria-pressed={on}
              aria-controls={on ? `thread-${th.key}` : undefined}
              onClick={() => onSelect(on ? null : th.key)}>
              <span className="tl-name">
                {th.title}
                {signedIn && n > 0 && <span className="tl-count">{n === th.stops.length ? '✓' : `${n}/${th.stops.length}`}</span>}
              </span>
              <Track thread={th} state={state} />
            </button>
          );
        })}
      </div>

      {thread && (
        <div className="thread" id={`thread-${thread.key}`}>
          <h3 className="thread-title">{thread.title}</h3>
          <p className="thread-gist">{thread.gist}</p>
          <River key={thread.key} thread={thread} state={state} locale={locale} />
          {/* On a phone the same stops, as a list */}
          <ol className="thread-stops">
            {thread.stops.map((s) => {
              const st = state(s);
              return (
                <li key={s.id} className={`thread-stop${st ? ` thread-stop--${st}` : ''}`}>
                  <span className="thread-stop-when">{s.when}</span>
                  <span className="thread-stop-mark" aria-hidden="true" />
                  <div className="thread-stop-body">
                    <Link prefetch={false} href={localePath(locale, s.href)} className="thread-stop-title">{s.title}</Link>
                    <span className="thread-stop-author">{s.author}</span>
                    {st && <span className="sr-only">{t(st === 'done' ? 'stop_done' : 'stop_reading')}</span>}
                    {s.note && <p className="thread-stop-note">{s.note}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="thread-foot">
            {signedIn && readIn(thread) > 0
              ? readIn(thread) === thread.stops.length
                ? t('thread_done')
                : t('thread_progress', { n: readIn(thread), total: thread.stops.length })
              : !signedIn ? t('thread_guest') : null}
            {' '}{t('thread_in_tree')}
          </p>
        </div>
      )}
    </section>
  );
}
