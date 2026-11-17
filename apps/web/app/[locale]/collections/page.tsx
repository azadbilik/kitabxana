import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import { listingLabel, pageMetadata } from '@/lib/seo';
import { localePath } from '@/lib/i18n';
import { shelfBook, titledIn } from '@/lib/books';
import { ShelfItem } from '@/components/works/Shelf';
import { clothSequence } from '@/components/works/BookCover';
import { Pagination } from '@/components/ui/Pagination';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const GENRES = ['POEM', 'PROSE', 'PLAY', 'ESSAY'] as const;
const CENTURIES = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const SORTS = ['recent', 'size', 'title'] as const;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The filters a request asks for, keeping only values the list knows */
function readFilters(sp: Record<string, string | string[] | undefined>) {
  const genre = GENRES.find((g) => g === one(sp.genre));
  const centuryN = Number(one(sp.century));
  const century = CENTURIES.includes(centuryN) ? centuryN : undefined;
  const sort = SORTS.find((s) => s === one(sp.sort)) ?? 'recent';
  const page = Math.max(1, Number(one(sp.page)) || 1);
  return { genre, century, sort, page };
}
type Filters = ReturnType<typeof readFilters>;

function booksHref(locale: string, f: Partial<Filters>) {
  const q = new URLSearchParams();
  if (f.genre) q.set('genre', f.genre);
  if (f.century) q.set('century', String(f.century));
  if (f.sort && f.sort !== 'recent') q.set('sort', f.sort);
  if (f.page && f.page > 1) q.set('page', String(f.page));
  return `${localePath(locale, '/collections')}${q.size ? `?${q}` : ''}`;
}

const fetchBooks = (locale: string, f: Filters) =>
  api.getCollections({ genre: f.genre, century: f.century, sort: f.sort, page: f.page, limit: 36, titledIn: titledIn(locale) });

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const f = readFilters(await searchParams);
  const t = await getTranslations({ locale, namespace: 'books' });
  const result = await fetchBooks(locale, f).catch(() => null);
  const filtered = Boolean(f.genre || f.century || f.sort !== 'recent');
  return pageMetadata({
    locale,
    // The default locale is unprefixed, so this is the path pageMetadata expects
    path: booksHref('az', f),
    title: listingLabel(t('title'), locale, { page: f.page }),
    description: t('description'),
    // One indexed list; filtered and re-sorted views only lead crawlers on to the books
    noindex: filtered || !result?.data.length,
  });
}

export default async function BooksPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const f = readFilters(await searchParams);
  const t = await getTranslations({ locale, namespace: 'books' });
  const home = await getTranslations({ locale, namespace: 'home' });
  const options = await getTranslations({ locale, namespace: 'contribute.options' });
  const result = await fetchBooks(locale, f);
  const cloths = clothSequence(result.data.map((b) => b.id));
  const sortLabel = { recent: t('sort_recent'), size: t('sort_size'), title: t('sort_title') };

  return (
    <div className="container page-content books-page">
      <header className="page-header page-header--start">
        <h1>{t('title')}</h1>
        <p className="books-count">{t('count', { count: result.meta.total })}</p>
      </header>

      <div className="filter-bar books-filters">
        <div className="chip-row" role="group" aria-label={t('genre_label')}>
          <Link href={booksHref(locale, { ...f, genre: undefined, page: 1 })} className={`pill ${!f.genre ? 'active' : ''}`} aria-current={!f.genre ? 'true' : undefined}>
            {t('all')}
          </Link>
          {GENRES.map((g) => (
            <Link key={g} href={booksHref(locale, { ...f, genre: g, page: 1 })} className={`pill ${f.genre === g ? 'active' : ''}`} aria-current={f.genre === g ? 'true' : undefined}>
              {options(`genre.${g}` as any)}
            </Link>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label={t('century_label')}>
          {CENTURIES.map((c) => (
            <Link
              key={c}
              href={booksHref(locale, { ...f, century: f.century === c ? undefined : c, page: 1 })}
              className={`pill pill--century ${f.century === c ? 'active' : ''}`}
              aria-current={f.century === c ? 'true' : undefined}
            >
              {ROMAN[c]}
            </Link>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label={t('sort_label')}>
          {SORTS.map((s) => (
            <Link key={s} href={booksHref(locale, { ...f, sort: s, page: 1 })} className={`pill ${f.sort === s ? 'active' : ''}`} aria-current={f.sort === s ? 'true' : undefined}>
              {sortLabel[s]}
            </Link>
          ))}
        </div>
      </div>

      {result.data.length ? (
        <ul className="shelf-grid books-grid">
          {result.data.map((b, i) => (
            <li key={b.id}>
              <ShelfItem
                cloth={cloths[i]}
                book={shelfBook(b, locale, {
                  kind: (g) => options(`genre.${g}` as any),
                  note: (b) => home('work_count', { count: b.workCount }),
                })}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">{t('empty')}</p>
      )}

      <Pagination
        page={result.meta.page}
        totalPages={result.meta.totalPages}
        href={(p) => booksHref(locale, { ...f, page: p })}
        label={t('title')}
      />
    </div>
  );
}
