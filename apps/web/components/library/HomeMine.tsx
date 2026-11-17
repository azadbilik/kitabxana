'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { Shelf } from '@/components/works/Shelf';
import { BookCover } from '@/components/works/BookCover';
import { accountFetch } from '@/lib/account';
import { localized } from '@/lib/locale';
import { localePath } from '@/lib/i18n';
import { shelfBook } from '@/lib/books';
import type { ContinueEntry, ShelfEntry } from './types';

/**
 * The home page's own row for a signed-in reader: "Continue reading" and their shelf.
 * Guests get nothing. Space is reserved before paint for browsers that have signed in
 * (html[data-signed-in], set by the inline script in app/layout.tsx), so nothing jumps.
 */
export function HomeMine() {
  const t = useTranslations('library');
  const tc = useTranslations('contribute.options');
  const locale = useLocale();
  const { status } = useAccount();
  const [cont, setCont] = useState<ContinueEntry | null | undefined>(undefined);
  const [shelf, setShelf] = useState<ShelfEntry[]>([]);

  useEffect(() => {
    if (status === 'guest') document.documentElement.removeAttribute('data-signed-in');
    if (status !== 'signed-in') return;
    accountFetch<ContinueEntry | null>('/me/continue').then(setCont).catch(() => setCont(null));
    accountFetch<{ items: ShelfEntry[] }>('/me/shelf?tab=reading').then((r) => setShelf(r.items)).catch(() => {});
  }, [status]);

  if (status !== 'signed-in') return status === 'unknown' ? <div className="home-mine home-mine--pending" aria-hidden="true" /> : null;
  if (cont === undefined) return <div className="home-mine home-mine--pending" aria-hidden="true" />;

  const books = shelf.flatMap((e) =>
    e.type === 'book'
      ? [shelfBook(e.book, locale, {
          kind: (g) => tc(`genre.${g}` as any),
          note: () => (e.progress && e.progress.done > 0 ? t('book_parts', { done: e.progress.done, total: e.progress.total }) : ''),
        })]
      : [],
  );
  if (!cont && !books.length) return null;

  const work = cont?.work;
  const title = work ? localized(work, 'title', locale) ?? work.titleAz : '';
  const bookTitle = work?.collection ? localized(work.collection, 'title', locale) ?? work.collection.titleAz : null;
  const author = work ? localized(work.author, 'name', locale) ?? work.author.nameAz : '';
  const percent = cont ? Math.round(cont.progress * 100) : 0;

  return (
    <section className="home-mine" aria-label={t('my_shelf_short')}>
      {work && (
        <div className="continue-card">
          <div className="continue-cover">
            <BookCover title={bookTitle ?? title} author={author} kind={tc(`genre.${work.collection?.genre ?? work.genre}` as any)} seed={work.collection?.id ?? work.id} size="sm" />
          </div>
          <div className="continue-info">
            <p className="continue-label">{t('continue_label')}</p>
            <h2 className="continue-title">{bookTitle ?? title}</h2>
            <p className="continue-where">{bookTitle ? `${title} · ${author}` : author}</p>
            {percent > 0 && (
              <div className="continue-progress">
                <span className="continue-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
                <span>{percent}%</span>
              </div>
            )}
            {cont?.book && cont.book.total > 1 && <p className="continue-where">{t('book_parts', { done: cont.book.done, total: cont.book.total })}</p>}
            <Link href={localePath(locale, `/works/${work.slug}`)} className="btn btn-primary btn-lg">{t('continue')}</Link>
          </div>
        </div>
      )}
      {books.length > 0 && (
        <Shelf id="shelf-mine" row title={t('my_shelf_short')} more={{ href: localePath(locale, '/refim'), label: t('tab_reading') }} books={books} />
      )}
    </section>
  );
}
