'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { BookCover } from '@/components/works/BookCover';
import { ShelfItem } from '@/components/works/Shelf';
import { accountFetch } from '@/lib/account';
import { localized } from '@/lib/locale';
import { localePath } from '@/lib/i18n';
import { shelfBook } from '@/lib/books';
import type { BookSummary } from '@/lib/api';
import type { LibraryWork } from './types';

interface ListRow {
  id: string;
  name: string;
  count: number;
  covers: { id: string; titleAz: string; titleRu: string | null; titleEn: string | null; genre: string; author: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null } }[];
}
interface ListDetail {
  id: string;
  name: string;
  items: ({ id: string; type: 'book'; book: BookSummary } | { id: string; type: 'work'; work: LibraryWork })[];
}

/**
 * The reader's lists, and one list when the URL hash names it (#<id>). Client-rendered;
 * the hash keeps one page URL for every list, so nothing per reader reaches a cache.
 */
export function ListsPage() {
  const t = useTranslations('lists');
  const tl = useTranslations('library');
  const ta = useTranslations('account');
  const tc = useTranslations('contribute.options');
  const locale = useLocale();
  const { status, requireSignIn } = useAccount();
  const [lists, setLists] = useState<ListRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ListDetail | null>(null);
  const [name, setName] = useState('');
  const [rename, setRename] = useState<string | null>(null);

  const load = useCallback(() => accountFetch<ListRow[]>('/me/lists').then(setLists).catch(() => setLists([])), []);

  useEffect(() => {
    const read = () => setOpenId(location.hash.slice(1) || null);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  useEffect(() => {
    if (status === 'signed-in') load();
  }, [status, load]);

  useEffect(() => {
    setDetail(null);
    setRename(null);
    if (status !== 'signed-in' || !openId) return;
    accountFetch<ListDetail>(`/me/lists/${encodeURIComponent(openId)}`).then(setDetail).catch(() => (location.hash = ''));
  }, [status, openId]);

  if (status === 'unknown') return <div className="shelf-page-loading" aria-busy="true" />;
  if (status === 'guest') {
    return (
      <div className="shelf-empty">
        <p>{t('signed_out')}</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => requireSignIn()}>{ta('sign_in_short')}</button>
      </div>
    );
  }

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await accountFetch('/me/lists', { method: 'POST', body: JSON.stringify({ name: name.trim() }) }).catch(() => {});
    setName('');
    load();
  };

  if (openId && detail) {
    const removeItem = async (itemId: string) => {
      setDetail((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== itemId) } : d));
      await accountFetch(`/me/lists/${detail.id}/items/${itemId}`, { method: 'DELETE' }).catch(() => {});
    };
    const saveName = async (e: FormEvent) => {
      e.preventDefault();
      if (!rename?.trim()) return;
      const r = await accountFetch<{ name: string }>(`/me/lists/${detail.id}`, { method: 'PATCH', body: JSON.stringify({ name: rename.trim() }) }).catch(() => null);
      if (r) setDetail({ ...detail, name: r.name });
      setRename(null);
      load();
    };
    const removeList = async () => {
      if (!window.confirm(t('delete_confirm', { name: detail.name }))) return;
      await accountFetch(`/me/lists/${detail.id}`, { method: 'DELETE' }).catch(() => {});
      location.hash = '';
      load();
    };
    const books = detail.items.filter((i) => i.type === 'book');
    const works = detail.items.filter((i) => i.type === 'work');

    return (
      <div className="list-detail">
        <a href="#" className="list-back">← {t('all_lists')}</a>
        {rename === null ? (
          <div className="list-detail-head">
            <h2 className="list-detail-title">{detail.name}</h2>
            <button type="button" className="link-btn" onClick={() => setRename(detail.name)}>{t('rename')}</button>
            <button type="button" className="link-btn" onClick={removeList}>{t('delete')}</button>
          </div>
        ) : (
          <form className="list-rename" onSubmit={saveName}>
            <label htmlFor="list-rename" className="sr-only">{t('new_name')}</label>
            <input id="list-rename" className="form-input" maxLength={80} value={rename} onChange={(e) => setRename(e.target.value)} autoFocus />
            <button type="submit" className="btn btn-primary">{t('save')}</button>
            <button type="button" className="btn" onClick={() => setRename(null)}>{t('cancel')}</button>
          </form>
        )}

        {detail.items.length === 0 && <div className="shelf-empty"><p>{t('empty_list')}</p></div>}

        {books.length > 0 && (
          <ul className="shelf-grid books-grid">
            {books.map((i) =>
              i.type === 'book' ? (
                <li key={i.id} className="list-item">
                  <ShelfItem book={shelfBook(i.book, locale, { kind: (g) => tc(`genre.${g}` as any) })} />
                  <button type="button" className="link-btn" onClick={() => removeItem(i.id)}>{t('remove')}</button>
                </li>
              ) : null,
            )}
          </ul>
        )}
        {works.length > 0 && (
          <section className="shelf-section">
            <h3 className="shelf-title">{tl('works_label')}</h3>
            <ul className="shelf-works">
              {works.map((i) =>
                i.type === 'work' ? (
                  <li key={i.id} className="list-item list-item--work">
                    <Link href={localePath(locale, `/works/${i.work.slug}`)} className="shelf-work">
                      <span className="shelf-work-title">{localized(i.work, 'title', locale) ?? i.work.titleAz}</span>
                      <span className="shelf-work-meta">{localized(i.work.author, 'name', locale)}</span>
                    </Link>
                    <button type="button" className="link-btn" onClick={() => removeItem(i.id)}>{t('remove')}</button>
                  </li>
                ) : null,
              )}
            </ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="lists-overview">
      <form className="list-new" onSubmit={create}>
        <label htmlFor="list-new" className="form-label">{t('new_name')}</label>
        <div className="list-new-row">
          <input id="list-new" className="form-input" maxLength={80} placeholder={t('new_placeholder')} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>{t('create')}</button>
        </div>
      </form>

      {lists === null ? (
        <div className="shelf-page-loading" aria-busy="true" />
      ) : lists.length === 0 ? (
        <div className="shelf-empty"><p>{t('none_yet')}</p></div>
      ) : (
        <ul className="lists-grid">
          {lists.map((l) => (
            <li key={l.id}>
              <a href={`#${l.id}`} className="list-card">
                <span className="list-card-covers" aria-hidden="true">
                  {l.covers.length ? (
                    l.covers.map((c) => (
                      <span key={c.id} className="list-card-cover">
                        <BookCover title={localized(c, 'title', locale) ?? c.titleAz} author={localized(c.author, 'name', locale) ?? c.author.nameAz} seed={c.id} size="sm" />
                      </span>
                    ))
                  ) : (
                    <span className="list-card-blank" />
                  )}
                </span>
                <span className="list-card-name">{l.name}</span>
                <span className="list-card-count">{t('count', { count: l.count })}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
