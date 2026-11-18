import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { notFound, permanentRedirect } from 'next/navigation';
import { listingLabel, pageMetadata } from '@/lib/seo';
import { api, notFoundOn404 } from '@/lib/api';
import { localized } from '@/lib/locale';
import { WorkCard, type Incipit } from '@/components/works/WorkCard';
import { TagPills } from '@/components/works/TagPills';
import { Pagination } from '@/components/ui/Pagination';
import { parseWorkFacets, worksPath, type WorkFilters } from '@/lib/facets';
import { defaultLocale, localePath } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

interface WorkItem {
  id: string;
  slug: string;
  titleAz: string;
  titleRu: string | null;
  titleEn: string | null;
  genre: string;
  form: string | null;
  year: number | null;
  yearApprox: boolean;
  originalLang: string;
  author: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null };
  collection: { slug: string; titleAz: string } | null;
  incipit?: Incipit;
}

interface WorksResponse {
  data: WorkItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const GENRE_FILTERS = ['POEM', 'PROSE', 'PLAY', 'ESSAY'];
const FORM_FILTERS = ['GHAZAL', 'MASNAVI', 'RUBAI', 'QASIDA', 'MURABBA', 'OTHER'];

/**
 * Orders of the list. The default takes the most-read work of each author in turn, most-read
 * authors first, so the index opens on thirty different authors (by year it opened on
 * sixteenth-century decrees, by size it would be thirty ghazals of one poet).
 */
const SORTS = ['popular', 'year', 'title'] as const;
type Sort = (typeof SORTS)[number];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** What the query string asks for beyond the path's filters; defaults stay out of URLs */
function readView(sp: SearchParams) {
  const sort = SORTS.find((s) => s === one(sp.sort)) ?? 'popular';
  return { lang: one(sp.lang), sort: sort === 'popular' ? undefined : sort, page: one(sp.page) };
}
type View = ReturnType<typeof readView>;

/** API query for a list page; generateMetadata and the page build the same one, so the fetch is shared */
function worksQuery(locale: string, filters: WorkFilters, view: View) {
  const uiLang = ['az', 'ru', 'en'].includes(locale) ? locale : 'az';
  const query = new URLSearchParams();
  if (filters.form) query.set('form', filters.form);
  if (filters.genre) query.set('genre', filters.genre);
  if (filters.author) query.set('authorSlug', filters.author);
  if (view.lang) query.set('lang', view.lang);
  if (view.page) query.set('page', view.page);
  query.set('limit', '30');
  query.set('sort', view.sort ?? 'popular');
  if (view.sort === 'title') query.set('titleLang', uiLang);
  query.set('incipit', uiLang);
  return query;
}

/** Filters from the readable path, the author they name, and the page heading */
async function resolveFilters(locale: string, sp: SearchParams) {
  const { filters, invalid, given } = parseWorkFacets(sp.f);
  if (invalid) notFound();
  const [author, t, labels] = await Promise.all([
    filters.author ? api.getAuthorBrief(filters.author).catch(notFoundOn404) : null,
    getTranslations({ locale, namespace: 'works' }),
    getLabels(locale),
  ]);
  const parts = [
    author && (localized(author, 'name', locale) ?? author.nameAz),
    labels.form(filters.form) ?? labels.genre(filters.genre),
  ].filter(Boolean) as string[];
  return { filters, given, labels, heading: parts.length ? parts.join(' · ') : t('title'), filtered: parts.length > 0 };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  const { filters, heading, filtered } = await resolveFilters(locale, sp);
  const view = readView(sp);
  const page = Number(view.page) || 1;
  const result = (await api.getWorks(worksQuery(locale, filters, view))) as WorksResponse;

  return pageMetadata({
    locale,
    path: worksPath(defaultLocale, filters, { sort: view.sort, page }),
    title: listingLabel(filtered ? `${heading} — ${t('nav.works')}` : t('nav.works'), locale, { page }),
    description: t('works.list_description', { heading: listingLabel(heading, locale, { page }), count: result.meta.total }),
    // The same works in another order are one list: only the default order is indexed
    noindex: Boolean(view.sort) || result.data.length === 0,
  });
}

export default async function WorksPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;

  const { filters, given, labels, heading } = await resolveFilters(locale, sp);
  const view = readView(sp);
  // Segments in another order (or a stray ?page=1, ?sort=popular) redirect to the one canonical URL
  const canonical = worksPath(locale, filters, view);
  const requested = worksPath(locale, {}, { lang: one(sp.lang), sort: one(sp.sort), page: one(sp.page) }).replace(
    localePath(locale, `/works`),
    localePath(locale, `/works${given.map((g) => `/${g}`).join('')}`),
  );
  if (canonical !== requested) permanentRedirect(canonical);
  /** The list under other filters or another order, from page one */
  const href = (f: WorkFilters, change: Partial<View> = {}) => worksPath(locale, f, { ...view, page: undefined, ...change });

  const [result, tags, t, tt] = await Promise.all([
    api.getWorks(worksQuery(locale, filters, view)) as Promise<WorksResponse>,
    api.getTags().catch(() => []),
    getTranslations({ locale, namespace: 'works' }),
    getTranslations({ locale, namespace: 'tags' }),
  ]);
  const themes = tags.filter((tag) => tag.kind === 'THEME' && tag.works > 0);
  const sortLabel: Record<Sort, string> = { popular: t('sort_popular'), year: t('sort_year'), title: t('sort_title') };
  const pill = (active: boolean) => ({ className: `pill ${active ? 'active' : ''}`, 'aria-current': active ? ('true' as const) : undefined });

  return (
    <div className="container page-content">
      <header className="page-header page-header--start">
        <h1>{heading}</h1>
        {filters.author && (
          <p className="filter-clear">
            <Link prefetch={false} href={href({ ...filters, author: undefined })}>← {tt('all_authors')}</Link>
          </p>
        )}
      </header>

      <div className="filter-bar">
        {/* Genre and form replace each other (a form is a kind of poem); the author stays */}
        <div className="chip-row" role="group" aria-label={t('genre_label')}>
          {GENRE_FILTERS.map((g) => (
            <Link prefetch={false}
              key={g}
              href={href(filters.genre === g ? { author: filters.author } : { author: filters.author, genre: g })}
              {...pill(filters.genre === g)}
            >
              {labels.genre(g)}
            </Link>
          ))}
        </div>

        <div className="chip-row" role="group" aria-label={t('form_label')}>
          {FORM_FILTERS.map((f) => (
            <Link prefetch={false}
              key={f}
              href={href(filters.form === f ? { author: filters.author } : { author: filters.author, form: f })}
              {...pill(filters.form === f)}
            >
              {labels.form(f)}
            </Link>
          ))}
        </div>

        <div className="chip-row" role="group" aria-label={t('sort_label')}>
          {SORTS.map((s) => (
            <Link key={s} href={href(filters, { sort: s === 'popular' ? undefined : s })} {...pill((view.sort ?? 'popular') === s)} prefetch={false}>
              {sortLabel[s]}
            </Link>
          ))}
        </div>
      </div>

      {themes.length > 0 && (
        <div className="works-themes">
          <TagPills tags={themes} locale={locale} label={tt('title')} />
          <Link prefetch={false} href={localePath(locale, `/tags`)} className="more works-themes-all">{tt('all_tags')} →</Link>
        </div>
      )}

      <hr className="rule rule--tight" />

      <div className="card-grid card-grid--3 work-card-grid">
        {result.data.map((work) => {
          const form = work.form && work.form !== 'OTHER' ? labels.form(work.form) : null;
          return (
            <WorkCard
              key={work.id}
              href={localePath(locale, `/works/${work.slug}`)}
              title={localized(work, 'title', locale) ?? work.titleAz}
              originalLang={work.originalLang}
              incipit={work.incipit}
              meta={
                <>
                  <span>{localized(work.author, 'name', locale) ?? work.author.nameAz}</span>
                  {form && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <span>{form}</span>
                    </>
                  )}
                  {work.year && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <span>{work.yearApprox && '~'}{work.year}</span>
                    </>
                  )}
                </>
              }
            />
          );
        })}
      </div>

      {result.data.length === 0 && <p className="empty-note empty-note--center">{labels.noResults}</p>}

      <Pagination
        page={result.meta.page}
        totalPages={result.meta.totalPages}
        href={(page) => href(filters, { page: String(page) })}
        label={tt('pages')}
      />
    </div>
  );
}
