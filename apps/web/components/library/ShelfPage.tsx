'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { ShelfItem } from '@/components/works/Shelf';
import { accountFetch } from '@/lib/account';
import { localized } from '@/lib/locale';
import { localePath } from '@/lib/i18n';
import { shelfBook } from '@/lib/books';
import type { ShelfEntry } from './types';

const TABS = ['reading', 'want', 'done', 'saved'] as const;
type Tab = (typeof TABS)[number];

interface Counts {
  reading: number;
  want: number;
  done: number;
  saved: number;
  readingWorks: number;
  doneWorks: number;
}

/** The reader's shelf: reading, want to read, read, saved. Client-rendered; the page HTML is the same for everyone. */
export function ShelfPage() {
  const t = useTranslations('library');
  const tc = useTranslations('contribute.options');
  const ta = useTranslations('account');
  const locale = useLocale();
  const { status, requireSignIn } = useAccount();
  const [tab, setTab] = useState<Tab>('reading');
  const [counts, setCounts] = useState<Counts | null>(null);
  const [items, setItems] = useState<ShelfEntry[] | null>(null);

  // The tab lives in the URL hash, so a reload or a shared link keeps it without a new page URL
  useEffect(() => {
    const fromHash = location.hash.slice(1) as Tab;
    if (TABS.includes(fromHash)) setTab(fromHash);
  }, []);

  useEffect(() => {
    if (status !== 'signed-in') return;
    accountFetch<Counts>('/me/shelf/counts').then(setCounts).catch(() => {});
  }, [status]);

  useEffect(() => {
    if (status !== 'signed-in') return;
    setItems(null);
    accountFetch<{ items: ShelfEntry[] }>(`/me/shelf?tab=${tab}`)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [status, tab]);

  if (status === 'unknown') return <div className="shelf-page-loading" aria-busy="true" />;
  if (status === 'guest') {
    return (
      <div className="shelf-empty">
        <p>{t('signed_out')}</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => requireSignIn()}>{ta('sign_in_short')}</button>
      </div>
    );
  }

  const count = (k: Tab) =>
    !counts ? null : k === 'reading' ? counts.reading + counts.readingWorks : k === 'done' ? counts.done + counts.doneWorks : counts[k];

  const books = (items ?? []).filter((i) => i.type === 'book');
  const works = (items ?? []).filter((i) => i.type === 'work');
  const authors = (items ?? []).filter((i) => i.type === 'author');
  const kind = (g: string) => tc(`genre.${g}` as any);

  return (
    <>
      <div className="shelf-tabs" role="tablist" aria-label={t('shelf_title')}>
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls="shelf-panel"
            className={`pill${tab === k ? ' active' : ''}`}
            onClick={() => {
              setTab(k);
              history.replaceState(null, '', `#${k}`);
            }}
          >
            {t(`tab_${k}` as any)}
            {count(k) !== null && <span className="pill-count">{count(k)}</span>}
          </button>
        ))}
      </div>

      <div id="shelf-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="shelf-panel">
        {items === null ? (
          <div className="shelf-page-loading" aria-busy="true" />
        ) : items.length === 0 ? (
          <div className="shelf-empty">
            <p>{t(`empty_${tab}` as any)}</p>
            <Link href={localePath(locale, '/collections')} className="btn btn-primary btn-lg">{t('open_catalog')}</Link>
          </div>
        ) : (
          <>
            {books.length > 0 && (
              <section className="shelf-section">
                {tab === 'saved' && <h2 className="shelf-title">{t('books_label')}</h2>}
                <ul className="shelf-grid books-grid">
                  {books.map((e) => {
                    const p = e.type === 'book' ? e.progress : null;
                    return (
                      <li key={e.type === 'book' ? e.book.id : ''}>
                        {e.type === 'book' && (
                          <ShelfItem
                            book={shelfBook(e.book, locale, {
                              kind,
                              note: () => (p && p.done > 0 ? t('book_parts', { done: p.done, total: p.total }) : ''),
                            })}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {works.length > 0 && (
              <section className="shelf-section">
                <h2 className="shelf-title">{t('works_label')}</h2>
                <ul className="shelf-works">
                  {works.map((e) =>
                    e.type === 'work' ? (
                      <li key={e.work.id}>
                        <Link href={localePath(locale, `/works/${e.work.slug}`)} className="shelf-work">
                          <span className="shelf-work-title">{localized(e.work, 'title', locale) ?? e.work.titleAz}</span>
                          <span className="shelf-work-meta">
                            {localized(e.work.author, 'name', locale)}
                            {e.work.collection && <> · {localized(e.work.collection, 'title', locale)}</>}
                          </span>
                          {tab === 'reading' && typeof e.progress === 'number' && e.progress > 0 && (
                            <span className="shelf-work-progress" aria-label={`${Math.round(e.progress * 100)}%`}>
                              <span style={{ width: `${Math.round(e.progress * 100)}%` }} />
                            </span>
                          )}
                        </Link>
                      </li>
                    ) : null,
                  )}
                </ul>
              </section>
            )}
            {authors.length > 0 && (
              <section className="shelf-section">
                <h2 className="shelf-title">{t('authors_label')}</h2>
                <ul className="chip-row shelf-authors">
                  {authors.map((e) =>
                    e.type === 'author' && e.author ? (
                      <li key={e.author.id}>
                        <Link href={localePath(locale, `/authors/${e.author.slug}`)} className="pill">
                          {localized(e.author, 'name', locale)}
                        </Link>
                      </li>
                    ) : null,
                  )}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
