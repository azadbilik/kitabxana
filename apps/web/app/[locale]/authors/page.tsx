import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { notFound, permanentRedirect } from 'next/navigation';
import type { PaginatedResponse, AuthorSummary } from '@irs-az/shared';
import { listingLabel, pageMetadata } from '@/lib/seo';
import { api } from '@/lib/api';
import { localized, periodLabel } from '@/lib/locale';
import { AuthorFilters } from '@/components/authors/AuthorFilters';
import { AuthorPortrait } from '@/components/authors/AuthorPortrait';
import { Pagination } from '@/components/ui/Pagination';
import { authorsPath, parseAuthorFacets, type AuthorFilters as Filters } from '@/lib/facets';
import { defaultLocale, localePath } from '@/lib/i18n';
import { centuryLabel, getLabels } from '@/lib/labels';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const TYPE_NAV: Record<string, string> = {
  POET: 'poets',
  WRITER: 'writers',
  PHILOSOPHER: 'philosophers',
  PLAYWRIGHT: 'playwrights',
};

/**
 * Two in five authors are a name attached to a single poem (folk attributions: "Abbas",
 * "Aslan" twice…). The list opens on authors with a body of work, most works first;
 * `?show=all` brings everyone in and `?sort=name` puts the list in alphabetical order.
 */
const MIN_WORKS = 2;

/** What the query string asks for beyond the path's filters; defaults stay out of URLs */
function readView(sp: SearchParams) {
  return {
    letter: one(sp.letter),
    page: one(sp.page),
    show: one(sp.show) === 'all' ? 'all' : undefined,
    sort: one(sp.sort) === 'name' ? 'name' : undefined,
  };
}
type View = ReturnType<typeof readView>;

/** Filters from the readable path, and the heading they make: "Şairlər · XII əsr" */
async function resolveFilters(locale: string, sp: SearchParams) {
  const { filters, invalid, given } = parseAuthorFacets(sp.f);
  if (invalid) notFound();
  const t = await getTranslations({ locale, namespace: 'nav' });
  const parts = [
    filters.type && t(TYPE_NAV[filters.type] as any),
    filters.century && centuryLabel(filters.century, locale),
  ].filter(Boolean) as string[];
  return { filters, given, heading: parts.length ? parts.join(' · ') : t('authors') };
}

/** API query for a list page; generateMetadata and the page build the same one, so the fetch is shared */
function authorsQuery(filters: Filters, view: View, sp: SearchParams) {
  const query = new URLSearchParams();
  if (filters.type) query.set('type', filters.type);
  if (one(sp.period)) query.set('period', one(sp.period)!);
  if (filters.century) query.set('century', String(filters.century));
  if (view.letter) query.set('letter', view.letter);
  if (view.page) query.set('page', view.page);
  query.set('sort', view.sort ?? 'works');
  if (!view.show) query.set('minWorks', String(MIN_WORKS));
  return query;
}

const AZ_ALPHABET = 'ABCÇDEƏFGĞHXIİJKQLMNOÖPRSŞTUÜVYZ';

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'authors' });
  const { filters, heading } = await resolveFilters(locale, sp);
  const view = readView(sp);
  const result = (await api.getAuthors(authorsQuery(filters, view, sp))) as PaginatedResponse<AuthorSummary>;
  const suffix = { letter: view.letter, page: view.page };

  return pageMetadata({
    locale,
    path: authorsPath(defaultLocale, filters, view),
    title: listingLabel(heading, locale, suffix),
    description: t('list_description', { heading: listingLabel(heading, locale, suffix), count: result.meta.total }),
    // One indexed list per filter; a letter, another order or the everyone view only lead crawlers on to the authors
    noindex: Boolean(view.letter || view.show || view.sort) || result.data.length === 0,
  });
}

export default async function AuthorsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;

  const { filters, given, heading } = await resolveFilters(locale, sp);
  const view = readView(sp);
  // Segments in another order (or a stray ?page=1) redirect to the one canonical URL
  const canonical = authorsPath(locale, filters, view);
  const requested = authorsPath(locale, {}, view).replace(
    localePath(locale, `/authors`),
    localePath(locale, `/authors${given.map((g) => `/${g}`).join('')}`),
  );
  if (canonical !== requested) permanentRedirect(canonical);

  const [result, t, home, labels] = await Promise.all([
    api.getAuthors(authorsQuery(filters, view, sp)) as Promise<PaginatedResponse<AuthorSummary>>,
    getTranslations({ locale, namespace: 'authors' }),
    getTranslations({ locale, namespace: 'home' }),
    getLabels(locale),
  ]);
  /** The same list with one choice changed; any change starts again from page one */
  const href = (change: Partial<View>) => authorsPath(locale, filters, { ...view, page: undefined, ...change });
  const pill = (active: boolean) => ({ className: `pill ${active ? 'active' : ''}`, 'aria-current': active ? ('true' as const) : undefined });

  return (
    <div className="container page-content authors-page">
      <header className="page-header page-header--start">
        <h1>{heading}</h1>
      </header>

      <AuthorFilters locale={locale} current={filters} keep={{ show: view.show, sort: view.sort }} />

      <nav className="alpha-strip" aria-label={t('letter_label')}>
        {AZ_ALPHABET.split('').map((letter) => (
          <Link
            key={letter}
            href={href({ letter: letter === view.letter ? undefined : letter })}
            className={`pill alpha-pill ${view.letter === letter ? 'active' : ''}`}
            aria-current={view.letter === letter ? 'true' : undefined}
            prefetch={false}
          >
            {letter}
          </Link>
        ))}
        {view.letter && (
          <Link href={href({ letter: undefined })} className="pill alpha-pill" aria-label={t('all_letters')} prefetch={false}>
            <span aria-hidden="true">✕</span>
          </Link>
        )}
      </nav>

      <div className="filter-bar authors-view">
        <div className="chip-row" role="group" aria-label={t('show_label')}>
          <Link href={href({ show: undefined })} {...pill(!view.show)} prefetch={false}>{t('show_main')}</Link>
          <Link href={href({ show: 'all' })} {...pill(Boolean(view.show))} prefetch={false}>{t('show_all')}</Link>
        </div>
        <div className="chip-row" role="group" aria-label={t('sort_label')}>
          <Link href={href({ sort: undefined })} {...pill(!view.sort)} prefetch={false}>{t('sort_works')}</Link>
          <Link href={href({ sort: 'name' })} {...pill(Boolean(view.sort))} prefetch={false}>{t('sort_name')}</Link>
        </div>
      </div>

      {result.data.length > 0 ? (
        <ul className="card-grid card-grid--3 author-grid">
          {result.data.map((author) => {
            const name = localized(author, 'name', locale) ?? author.nameAz;
            const facts = [
              labels.lifeYears(author),
              periodLabel(author.period, locale),
              author._count.works > 0 ? home('work_count', { count: author._count.works }) : null,
            ].filter((p): p is string => !!p);
            return (
              <li key={author.id}>
                <Link href={localePath(locale, `/authors/${author.slug}`)} className="card-item author-card" prefetch={false}>
                  <span className="author-card-text">
                    <span className="author-card-head">
                      <span className="author-card-name">{name}</span>
                      {/* On a page already filtered to one kind of author the badge would repeat the heading */}
                      {!filters.type && <span className="author-type">{labels.authorType(author.type)}</span>}
                    </span>
                    {facts.length > 0 && (
                      <span className="meta-strip author-card-meta">
                        {facts.map((fact, i) => (
                          <span key={i} className="author-card-meta-item">
                            {i > 0 && <span className="dot" aria-hidden="true" />}
                            <span>{fact}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  {/* Decorative here: the name beside it already says who it is */}
                  {author.portraitUrl && <AuthorPortrait url={author.portraitUrl} alt="" size="sm" />}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : view.show ? (
        <p className="empty-note empty-note--center">{labels.noResults}</p>
      ) : (
        <p className="empty-note empty-note--center">
          {t('empty_main')}{' '}
          <Link href={href({ show: 'all' })} className="authors-empty-link" prefetch={false}>{t('empty_show_all')}</Link>
        </p>
      )}

      <Pagination
        page={result.meta.page}
        totalPages={result.meta.totalPages}
        href={(page) => href({ page: String(page) })}
        label={t('pages')}
      />
    </div>
  );
}
