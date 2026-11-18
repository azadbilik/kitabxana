'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { useLoadMarks, useMarks } from '@/lib/library';
import { localePath } from '@/lib/i18n';

export interface BookPart {
  id: string;
  slug: string;
  title: string;
}

/**
 * Where a signed-in reader is in a book, from the marks the page already holds: the part
 * to go on with — the one last opened, or the next unread after it — and how many are read.
 */
export function bookPlace(
  parts: BookPart[],
  marks: ReturnType<typeof useMarks>,
  collectionId: string,
) {
  const book = marks.books[collectionId];
  const done = parts.filter((p) => marks.works[p.id]?.status === 'DONE').length;
  const last = book?.lastWorkId ? parts.find((p) => p.id === book.lastWorkId) : undefined;
  const status = (p: BookPart) => marks.works[p.id]?.status;
  const lastDone = last && status(last) === 'DONE';
  // After a finished part comes the next unread one in the book's order
  const after = lastDone ? parts.slice(parts.indexOf(last) + 1).find((p) => status(p) !== 'DONE') : undefined;
  const next =
    (last && !lastDone
      ? last
      : (after ?? parts.find((p) => status(p) === 'READING') ?? parts.find((p) => status(p) !== 'DONE'))) ?? parts[0];
  const started = Boolean(book?.lastWorkId) || done > 0 || parts.some((p) => marks.works[p.id]);
  return { book, done, next, started, finished: parts.length > 0 && done >= parts.length };
}

interface Props {
  collectionId: string;
  parts: BookPart[];
  /** Leave out the "Continue: …" link where a button beside it already says so */
  link?: boolean;
}

/**
 * A reader's progress through a book: "12 / 46 read" on a bar, and the part to continue
 * with. Renders nothing for guests and for a book not yet started, and loads in the
 * browser, so the page stays the same for everyone.
 */
export function BookProgress({ collectionId, parts, link = true }: Props) {
  const t = useTranslations('library');
  const locale = useLocale();
  const { status } = useAccount();
  const marks = useMarks();
  useLoadMarks(status === 'signed-in', { collectionIds: [collectionId], workIds: parts.map((p) => p.id) });

  if (status !== 'signed-in' || parts.length < 2) return null;
  const { done, next, started, finished } = bookPlace(parts, marks, collectionId);
  if (!started) return null;
  const at = next ? marks.works[next.id] : undefined;
  const percent = at && at.status !== 'DONE' ? Math.round(at.progress * 100) : 0;

  return (
    <p className="book-progress">
      <span className="book-progress-bar" aria-hidden="true">
        <span className="book-progress-fill" style={{ '--progress': done / parts.length } as CSSProperties} />
      </span>
      <span>{t('parts_read', { done, total: parts.length })}</span>
      {link && next && !finished && (
        <Link href={localePath(locale, `/works/${next.slug}`)} className="book-progress-next" prefetch={false}>
          {t('continue_with', { title: next.title })}
          {percent > 0 && <span className="book-progress-at"> · {percent}%</span>}
        </Link>
      )}
    </p>
  );
}
