'use client';

import Link from 'next/link';
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

const NOW = 2026;

/**
 * The thread drawn along the centuries it crosses: one dot per stop, filled once read.
 * Decorative: the list below says the same in words.
 */
function Drawing({ thread, state }: { thread: TreeThread; state: (s: TreeThreadStop) => StopState }) {
  const from = Math.floor(thread.stops[0].year / 100) * 100;
  const span = NOW - from;
  const at = (y: number) => `${((y - from) / span) * 100}%`;
  const step = span > 600 ? 200 : 100;
  const centuries: number[] = [];
  for (let c = from; c <= NOW; c += 100) centuries.push(c);
  const first = thread.stops[0].year, last = thread.stops[thread.stops.length - 1].year;
  return (
    <div className="thread-drawing" aria-hidden="true">
      <div className="thread-axis">
        {centuries.map((c) => (
          <span key={c} className="thread-tick" style={{ left: at(c) }}>
            {(c - from) % step === 0 && <b>{c}</b>}
          </span>
        ))}
        <span className="thread-path" style={{ left: at(first), width: `calc(${at(last)} - ${at(first)})` }} />
        {thread.stops.map((s, i) => (
          <span key={s.id} className={`thread-dot thread-dot--${state(s) ?? 'none'}`} style={{ left: at(s.year), animationDelay: `${i * 70}ms` }} />
        ))}
      </div>
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

  return (
    <section className="threads" aria-labelledby="threads-title">
      <div className="threads-head">
        <h2 id="threads-title">{t('threads_title')}</h2>
        <p className="threads-lead">{t('threads_lead')}</p>
        {signedIn && <p className="threads-walked">{t('threads_walked', { n: walked, total: threads.length })}</p>}
      </div>

      <div className="threads-tabs" role="group" aria-label={t('threads_title')}>
        {threads.map((th) => {
          const n = readIn(th);
          const done = n === th.stops.length;
          return (
            <button
              key={th.key}
              type="button"
              className={`pill thread-tab${active === th.key ? ' active' : ''}${done ? ' thread-tab--done' : ''}`}
              aria-pressed={active === th.key}
              onClick={() => onSelect(active === th.key ? null : th.key)}
            >
              {th.title}
              {signedIn && n > 0 && <span className="thread-tab-count">{n}/{th.stops.length}</span>}
            </button>
          );
        })}
      </div>

      {thread && (
        <div className="thread" id={`thread-${thread.key}`}>
          <p className="thread-gist">{thread.gist}</p>
          <Drawing thread={thread} state={state} />
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
            {signedIn
              ? readIn(thread) === thread.stops.length
                ? t('thread_done')
                : t('thread_progress', { n: readIn(thread), total: thread.stops.length })
              : t('thread_guest')}
            {' '}{t('thread_in_tree')}
          </p>
        </div>
      )}
    </section>
  );
}
