'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { setBookStatus, useLoadMarks, useMarks, type BookStatus } from '@/lib/library';
import { localePath } from '@/lib/i18n';
import { SaveButton } from './SaveButton';
import { ListPopover } from './ListPopover';

export interface BookPart {
  id: string;
  slug: string;
  title: string;
}

const STATUSES: BookStatus[] = ['WANT', 'READING', 'DONE'];

/**
 * A book page's actions: start or continue reading, want / reading / read, save.
 * Server-rendered as for a guest; a signed-in reader's state fills in after load.
 */
export function BookActions({ collectionId, parts }: { collectionId: string; parts: BookPart[] }) {
  const t = useTranslations('library');
  const locale = useLocale();
  const { status: account, requireSignIn } = useAccount();
  const marks = useMarks();
  useLoadMarks(account === 'signed-in', { collectionIds: [collectionId], workIds: parts.map((p) => p.id) });

  const book = marks.books[collectionId];
  const doneCount = parts.filter((p) => marks.works[p.id]?.status === 'DONE').length;
  // Continue at the part last opened, else the first part not yet read
  const last = book?.lastWorkId ? parts.find((p) => p.id === book.lastWorkId) : undefined;
  const lastDone = last && marks.works[last.id]?.status === 'DONE';
  const next = (last && !lastDone ? last : parts.find((p) => marks.works[p.id]?.status !== 'DONE')) ?? parts[0];
  const started = Boolean(book?.lastWorkId) || doneCount > 0;

  const choose = (s: BookStatus) =>
    requireSignIn(() => {
      const current = marks.books[collectionId]?.status;
      setBookStatus(collectionId, current === s ? null : s, parts.map((p) => p.id)).catch(() => {});
    });

  return (
    <div className="book-actions">
      {next && (
        <Link href={localePath(locale, `/works/${next.slug}`)} className="btn btn-primary btn-lg book-start">
          {started && book?.status !== 'DONE' ? (
            <>
              {t('continue')}
              <span className="book-start-part">{next.title}</span>
            </>
          ) : (
            t('start')
          )}
        </Link>
      )}

      <div className="status-switch" role="group" aria-label={t('status_label')}>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={book?.status === s ? 'is-on' : undefined}
            aria-pressed={book?.status === s}
            onClick={() => choose(s)}
          >
            {t(`book_${s}` as any)}
          </button>
        ))}
      </div>

      <SaveButton kind="book" id={collectionId} />
      <ListPopover collectionId={collectionId} />

      {account === 'signed-in' && doneCount > 0 && (
        <p className="book-progress">
          <span className="book-progress-bar" aria-hidden="true">
            <span style={{ width: `${Math.round((doneCount / parts.length) * 100)}%` }} />
          </span>
          {t('parts_read', { done: doneCount, total: parts.length })}
        </p>
      )}
    </div>
  );
}
