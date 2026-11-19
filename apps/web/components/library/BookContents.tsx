'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { setWorkStatus, useMarks } from '@/lib/library';
import { localePath } from '@/lib/i18n';

export interface ContentsRow {
  id: string;
  slug: string;
  /** As shown: a title that repeats the book's is shortened ("Fəsil 20") */
  title: string;
  /** The stored title, for the read-mark button's name */
  fullTitle: string;
  /** `lang`/`dir` for a title in Arabic script */
  titleScript?: { lang?: string; dir?: 'rtl' };
  /** The part's first line, where the title alone doesn't tell the parts apart */
  incipit?: { text: string; lang?: string; dir: 'rtl' | 'ltr' } | null;
  /** Form or genre and year; left out where every part would say the same */
  kind?: string | null;
  /** Reading time («12 dəq») */
  time?: string | null;
}

/**
 * A book's contents. Each row's number becomes a read mark for a signed-in reader: a tick
 * when read (click to unmark), a filled dot where they stopped. Marks load with BookActions.
 */
export function BookContents({ rows, collectionId, start = 0 }: { rows: ContentsRow[]; collectionId: string; start?: number }) {
  const t = useTranslations('library');
  const locale = useLocale();
  const { status } = useAccount();
  const marks = useMarks();
  const signedIn = status === 'signed-in';
  const lastWorkId = signedIn ? marks.books[collectionId]?.lastWorkId : null;

  return (
    <ol className="book-parts" start={start + 1}>
      {rows.map((row, i) => {
        const mark = signedIn ? marks.works[row.id] : undefined;
        const state = mark?.status === 'DONE' ? 'done' : mark || row.id === lastWorkId ? 'now' : 'none';
        const status = state === 'now' && mark ? t('stopped_at', { percent: Math.round(mark.progress * 100) }) : row.kind;
        const note = [status, row.time].filter(Boolean).join(' · ');
        return (
          <li key={row.id} className="book-part-row" data-state={state}>
            <Link prefetch={false} href={localePath(locale, `/works/${row.slug}`)} className="book-part">
              <span className="book-part-no" aria-hidden="true">{state === 'done' ? '' : start + i + 1}</span>
              <span className="book-part-text">
                <span className="book-part-title" {...row.titleScript}>{row.title}</span>
                {row.incipit && (
                  <span className="book-part-incipit" lang={row.incipit.lang} dir={row.incipit.dir}>{row.incipit.text}</span>
                )}
                {note && <span className="book-part-kind">{note}</span>}
              </span>
            </Link>
            {signedIn && (
              <button
                type="button"
                className="book-part-toggle"
                aria-pressed={state === 'done'}
                aria-label={state === 'done' ? t('mark_unread_named', { title: row.fullTitle }) : t('mark_read_named', { title: row.fullTitle })}
                onClick={() => setWorkStatus(row.id, state === 'done' ? null : 'DONE').catch(() => {})}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
