'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { setBookStatus, useLoadMarks, useMarks, type BookStatus } from '@/lib/library';
import { localePath } from '@/lib/i18n';
import { SaveButton } from './SaveButton';
import { ListPopover } from './ListPopover';
import { BookProgress, bookPlace, type BookPart } from './BookProgress';

export type { BookPart };

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

  const { book, next, started } = bookPlace(parts, marks, collectionId);

  const choose = (s: BookStatus) =>
    requireSignIn(() => {
      const current = marks.books[collectionId]?.status;
      setBookStatus(collectionId, current === s ? null : s, parts.map((p) => p.id)).catch(() => {});
    });

  return (
    <div className="book-actions">
      {next && (
        <Link prefetch={false} href={localePath(locale, `/works/${next.slug}`)} className="btn btn-primary btn-lg book-start">
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

      {/* The button above already names the part to continue with */}
      <BookProgress collectionId={collectionId} parts={parts} link={false} />
    </div>
  );
}
