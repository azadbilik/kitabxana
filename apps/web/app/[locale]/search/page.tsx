'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, type SearchFacets, type SearchGroups, type SearchHit, type SearchResult } from '@/lib/api';
import { localized } from '@/lib/locale';
import { displayTitle, isArabicScript, isPlaceholderTitle, langTag } from '@/lib/verse';
import { localePath } from '@/lib/i18n';

const GENRES = ['POEM', 'PROSE', 'PLAY', 'ESSAY', 'PHILOSOPHY', 'LETTER', 'MEMOIR'];
const LANGS = ['AZ_LATIN', 'AZ_ARABIC', 'AZ_CYRILLIC', 'FA', 'AR', 'TR', 'RU', 'EN'];
// Filters are offered once there is more than a page of works to narrow down
const PAGE_SIZE = 20;

// useSearchParams needs a Suspense boundary for the page to prerender
export default function SearchPage() {
  return (
    <Suspense>
      <Search />
    </Suspense>
  );
}

interface Filters {
  author: string;
  genre: string;
  lang: string;
  translated: boolean;
}

/** The API's query for a search with these filters */
function apiParams(q: string, f: Filters, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ q, ...extra });
  if (f.author) params.set('authorSlug', f.author);
  if (f.genre) params.set('genre', f.genre);
  if (f.lang) params.set('lang', f.lang);
  if (f.translated) params.set('translated', '1');
  return params;
}

/** A facet's values, the fullest first, with the chosen one kept even when it counts nothing */
function options(counts: Record<string, number>, chosen: string, known: string[]) {
  const all = Object.entries(counts).filter(([key]) => known.includes(key));
  if (chosen && !all.some(([key]) => key === chosen)) all.push([chosen, 0]);
  return all.sort((a, b) => b[1] - a[1]);
}

function Search() {
  const t = useTranslations();
  const genres = useTranslations('contribute.options.genre');
  const langs = useTranslations('contribute.options.lang');
  const forms = useTranslations('contribute.options.form');
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  // Everything that decides the results lives in the URL, so a search can be shared,
  // survives a reload, and the back button undoes the last filter
  const sp = useSearchParams();
  const q = sp.get('q')?.trim() ?? '';
  const author = sp.get('author') ?? '';
  const genre = GENRES.includes(sp.get('genre') ?? '') ? sp.get('genre')! : '';
  const lang = LANGS.includes(sp.get('lang') ?? '') ? sp.get('lang')! : '';
  const translated = sp.get('tr') === '1';
  const filtered = Boolean(author || genre || lang || translated);

  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [facets, setFacets] = useState<SearchFacets | null>(null);
  const [groups, setGroups] = useState<SearchGroups>({ authors: [], books: [] });
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [attempt, setAttempt] = useState(0);
  // Works come 20 at a time; "show more" appends the next page
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const shownFor = useRef('');

  useEffect(() => setQuery(q), [q]);

  // Authors and books by name: asked once per query, whatever the filters on the works
  useEffect(() => {
    setGroups({ authors: [], books: [] });
    if (!q) return;
    let current = true;
    api
      .searchGroups(q)
      .then((data) => current && setGroups(data))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [q]);

  useEffect(() => {
    if (!q) {
      setResults(null);
      setFacets(null);
      setState('idle');
      return;
    }
    let current = true;
    // Another query's works don't stay under this one's name while it loads; a changed filter keeps them
    if (shownFor.current !== q) setResults(null);
    shownFor.current = q;
    setState('loading');
    setPage(1);
    setMoreFailed(false);
    api
      .search(apiParams(q, { author, genre, lang, translated }, { facets: '1' }))
      .then((data) => {
        if (!current) return;
        setResults(data);
        setFacets(data.facets ?? null);
        setState('done');
      })
      .catch(() => {
        if (!current) return;
        setResults(null);
        setState('error');
      });
    return () => {
      current = false;
    };
  }, [q, author, genre, lang, translated, attempt]);

  const loadMore = async () => {
    if (!results) return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const next = page + 1;
      const data = await api.search(apiParams(q, { author, genre, lang, translated }, { page: String(next) }));
      setResults((prev) => {
        if (!prev) return prev;
        const seen = new Set(prev.hits.map((h) => h.id));
        return { ...prev, hits: [...prev.hits, ...data.hits.filter((h) => !seen.has(h.id))] };
      });
      setPage(next);
    } catch {
      // What is shown stays; the button stays too, so the reader can try again
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  /** A new search or a changed filter is a new history entry */
  const go = (next: { q?: string } & Partial<Filters>) => {
    const f = { author, genre, lang, translated, ...next };
    const params = new URLSearchParams({ q: next.q ?? q });
    if (f.author) params.set('author', f.author);
    if (f.genre) params.set('genre', f.genre);
    if (f.lang) params.set('lang', f.lang);
    if (f.translated) params.set('tr', '1');
    router.push(localePath(locale, `/search?${params}`), { scroll: false });
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const text = query.trim();
    if (!text) return;
    // The same words again: ask again rather than do nothing
    if (text === q && !filtered) setAttempt((n) => n + 1);
    // A new query starts without the old query's filters
    else go({ q: text, author: '', genre: '', lang: '', translated: false });
  };

  const total = results?.estimatedTotalHits ?? 0;
  const showFilters = Boolean(facets) && (filtered || total > PAGE_SIZE);
  const authorName = (a: { nameAz: string; nameRu: string | null; nameEn: string | null }) => localized(a, 'name', locale) ?? a.nameAz;
  // Books still titled by their slug say nothing to a reader
  const books = groups.books.filter((b) => !isPlaceholderTitle(localized(b, 'title', locale), b.slug));

  return (
    <div className="container page-content search-page">
      <header className="page-header page-header--start">
        <h1>{t('nav.search')}</h1>
      </header>

      <form className="search-form" role="search" aria-label={t('search.label')} onSubmit={handleSearch}>
        <label htmlFor="search-q" className="sr-only">{t('search.label')}</label>
        <input
          id="search-q"
          type="search"
          enterKeyHint="search"
          // Arriving to type a query, not to read results
          autoFocus={!q}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className="search-input"
        />
        <button type="submit" className="search-btn">{t('nav.search_go')}</button>
      </form>

      <p className="search-status" role="status">
        {state === 'loading'
          ? t('search.loading')
          : state === 'done' && total > 0
            ? t('search.results_for', { q, count: total })
            : ''}
      </p>

      {state === 'idle' && <p className="search-hint">{t('search.hint')}</p>}

      {state === 'error' && (
        <div className="shelf-empty" role="alert">
          <p>{t('search.error')}</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setAttempt((n) => n + 1)}>
            {t('error.retry')}
          </button>
        </div>
      )}

      {groups.authors.length > 0 && (
        <section className="search-group" aria-labelledby="search-authors-title">
          <h2 id="search-authors-title" className="search-group-title">{t('search.authors')}</h2>
          <ul className="chip-row search-chips">
            {groups.authors.map((a) => (
              <li key={a.slug}>
                <Link href={localePath(locale, `/authors/${a.slug}`)} className="pill" prefetch={false}>
                  {authorName(a)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {books.length > 0 && (
        <section className="search-group" aria-labelledby="search-books-title">
          <h2 id="search-books-title" className="search-group-title">{t('search.books')}</h2>
          <ul className="search-books">
            {books.map((b) => {
              const title = localized(b, 'title', locale) ?? b.titleAz;
              return (
                <li key={b.id}>
                  <Link href={localePath(locale, `/collections/${b.slug}`)} className="search-book" prefetch={false}>
                    <span className="search-book-title" {...(isArabicScript(title) && { lang: 'fa', dir: 'rtl' })}>{title}</span>
                    <span className="search-book-meta">
                      {authorName(b.author)} · {genres(b.genre as any)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {state !== 'idle' && state !== 'error' && (
        <section className="search-group" aria-labelledby="search-works-title" aria-busy={state === 'loading'}>
          <h2 id="search-works-title" className="search-group-title">{t('search.works')}</h2>

          {showFilters && facets && (
            <div className="search-filters" role="group" aria-label={t('search.filters')}>
              {(facets.authors.length > 1 || author) && (
                <label className="search-filter">
                  <span className="sr-only">{t('search.filter_author')}</span>
                  <select className="form-input" value={author} onChange={(e) => go({ author: e.target.value })}>
                    <option value="">{t('search.all_authors')}</option>
                    {facets.authors.map((a) => (
                      <option key={a.slug} value={a.slug}>
                        {authorName(a)} ({a.count})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(Object.keys(facets.genre).length > 1 || genre) && (
                <label className="search-filter">
                  <span className="sr-only">{t('search.filter_genre')}</span>
                  <select className="form-input" value={genre} onChange={(e) => go({ genre: e.target.value })}>
                    <option value="">{t('search.all_genres')}</option>
                    {options(facets.genre, genre, GENRES).map(([key, count]) => (
                      <option key={key} value={key}>
                        {genres(key as any)} ({count})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(Object.keys(facets.lang).length > 1 || lang) && (
                <label className="search-filter">
                  <span className="sr-only">{t('search.filter_lang')}</span>
                  <select className="form-input" value={lang} onChange={(e) => go({ lang: e.target.value })}>
                    <option value="">{t('search.all_langs')}</option>
                    {options(facets.lang, lang, LANGS).map(([key, count]) => (
                      <option key={key} value={key}>
                        {langs(key as any)} ({count})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {/* Absent until the search index knows which works are translated */}
              {facets.translated !== null && (facets.translated > 0 || translated) && (
                <button
                  type="button"
                  className={`pill search-toggle${translated ? ' active' : ''}`}
                  aria-pressed={translated}
                  onClick={() => go({ translated: !translated })}
                >
                  {t('search.has_translation')}
                </button>
              )}
              {filtered && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => go({ author: '', genre: '', lang: '', translated: false })}
                >
                  {t('search.clear_filters')}
                </button>
              )}
            </div>
          )}

          {state === 'done' && total === 0 && (
            <div className="shelf-empty">
              <p>{t('search.no_results_for', { q })}</p>
              <p className="search-empty-hint">{filtered ? t('search.no_results_filtered') : t('search.no_results_hint')}</p>
              {filtered && (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={() => go({ author: '', genre: '', lang: '', translated: false })}
                >
                  {t('search.clear_filters')}
                </button>
              )}
            </div>
          )}

          {results && results.hits.length > 0 && (
            <ol className="search-results">
              {results.hits.map((hit) => (
                <li key={hit.id}>
                  <Hit
                    hit={hit}
                    locale={locale}
                    kind={hit.genre && GENRES.includes(hit.genre) ? genres(hit.genre as any) : null}
                    title={displayTitle(hit.titleAz, {
                      formLabel: hit.form && hit.form !== 'OTHER' ? forms(hit.form as any) : null,
                      sectionLabel: t('reading.section'),
                      numbered: (form, n) => t('reading.numbered', { form, n }),
                    })}
                  />
                </li>
              ))}
            </ol>
          )}

          {results && results.hits.length > 0 && results.hits.length < total && (
            <div className="unfold">
              <button type="button" className="unfold-btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? t('search.loading') : t('search.more')}
              </button>
              <p className="form-alert" role="alert">{moreFailed ? t('search.error') : ''}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

interface HitProps {
  hit: SearchHit;
  locale: string;
  kind: string | null;
  /** The Azerbaijani title, with a Persian placeholder ("شمارهٔ ۷") turned into "Qəzəl № 7" */
  title: { text: string; original: string | null };
}

/**
 * One found work. Title and author are shown in the page's language where the work has
 * them; the match is marked in the Azerbaijani ones, which is what the index highlights.
 */
function Hit({ hit, locale, kind, title }: HitProps) {
  const ownTitle = locale === 'ru' ? hit.titleRu : locale === 'en' ? hit.titleEn : null;
  const ownAuthor = locale === 'ru' ? hit.authorNameRu : locale === 'en' ? hit.authorNameEn : null;
  const marked = !ownTitle && !title.original ? hit._formatted?.titleAz : null;
  const plainTitle = ownTitle ?? title.text;
  const arabic = isArabicScript(plainTitle);

  return (
    <Link href={localePath(locale, `/works/${hit.slug}`)} className="search-hit" prefetch={false}>
      <span className="search-hit-head">
        {marked ? (
          <span className="search-hit-title" {...(arabic && { lang: 'fa', dir: 'rtl' })} dangerouslySetInnerHTML={{ __html: marked }} />
        ) : (
          <span className="search-hit-title" {...(arabic && { lang: 'fa', dir: 'rtl' })}>{plainTitle}</span>
        )}
        <span className="search-hit-kind">
          {kind}
          {kind && hit.year ? ' · ' : ''}
          {hit.year}
        </span>
      </span>
      {ownAuthor || !hit._formatted?.authorNameAz ? (
        <span className="search-hit-author">{ownAuthor ?? hit.authorNameAz}</span>
      ) : (
        <span className="search-hit-author" dangerouslySetInnerHTML={{ __html: hit._formatted.authorNameAz }} />
      )}
      {hit._formatted?.body && <Snippet html={hit._formatted.body} lang={hit.lang} />}
    </Link>
  );
}

/**
 * The passage that matched. It may come from the original or from any translation,
 * so its script decides the direction: Persian and Arabic-script Azerbaijani run
 * right to left in the Naskh face, never in a slanted Latin italic.
 */
function Snippet({ html, lang }: { html: string; lang?: string }) {
  const rtl = isArabicScript(html.replace(/<[^>]+>/g, ''));
  const tag = rtl ? (['FA', 'AR', 'AZ_ARABIC'].includes(lang ?? '') ? langTag[lang!] : 'fa') : undefined;
  return (
    <span
      className="search-snippet"
      lang={tag}
      dir={rtl ? 'rtl' : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
