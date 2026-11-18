import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { api, notFoundOn404, type TagDetail } from '@/lib/api';
import { localized } from '@/lib/locale';
import { listingLabel, pageMetadata } from '@/lib/seo';
import { WorkCard, type Incipit } from '@/components/works/WorkCard';
import { Pagination } from '@/components/ui/Pagination';
import { notFound } from 'next/navigation';
import { parseTagFacet, tagPath } from '@/lib/facets';
import { defaultLocale, localePath } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** A theme like love has some 190 authors: the ones with most works show, the rest fold away */
const TOP_AUTHORS = 10;

/** The author named by /tags/<slug>/muellif-<author>; an unknown one is a 404 */
function authorFacet(tag: TagDetail, f: string | string[] | undefined) {
  const { filters, invalid } = parseTagFacet(f);
  if (invalid) notFound();
  if (filters.author && !tag.authors.some((a) => a.slug === filters.author)) notFound();
  return filters.author;
}

interface WorkItem {
  id: string;
  slug: string;
  titleAz: string;
  titleRu: string | null;
  titleEn: string | null;
  form: string | null;
  year: number | null;
  yearApprox: boolean;
  originalLang: string;
  author: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null };
  incipit?: Incipit;
}

/** Page heading: the tag alone, or "Author: tag" when narrowed to one author */
function heading(tag: TagDetail, authorSlug: string | undefined, locale: string, byAuthor: (v: object) => string) {
  const name = localized(tag, 'name', locale) ?? tag.nameAz;
  const author = authorSlug ? tag.authors.find((a) => a.slug === authorSlug) : undefined;
  return { name, author, title: author ? byAuthor({ author: localized(author, 'name', locale), tag: name }) : name };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'tags' });
  const tag = await api.getTag(slug).catch(notFoundOn404);
  const { title, author } = heading(tag, authorFacet(tag, sp.f), locale, (v) => t('by_author', v as any));

  return pageMetadata({
    locale,
    path: tagPath(defaultLocale, slug, author?.slug, { page: one(sp.page) }),
    title: listingLabel(title, locale, { page: one(sp.page) }),
    description: `${listingLabel(title, locale, { page: one(sp.page) })} — ${t('works_count', { count: author?.works ?? tag.works })}`,
    images: false,
  });
}

export default async function TagPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'tags' });
  const labels = await getLabels(locale);

  const tag = await api.getTag(slug).catch(notFoundOn404);
  const { title, author } = heading(tag, authorFacet(tag, sp.f), locale, (v) => t('by_author', v as any));

  const query = new URLSearchParams({ tag: slug, limit: '24', incipit: ['az', 'ru', 'en'].includes(locale) ? locale : 'az' });
  if (author) query.set('authorSlug', author.slug);
  if (one(sp.page)) query.set('page', one(sp.page)!);
  const result = (await api.getWorks(query)) as {
    data: WorkItem[];
    meta: { total: number; page: number; totalPages: number };
  };

  const withAuthor = (authorSlug?: string, page?: number) => tagPath(locale, slug, authorSlug, { page });
  // The API lists authors by number of works under the tag, most first
  const topAuthors = tag.authors.slice(0, TOP_AUTHORS);
  const moreAuthors = tag.authors.slice(TOP_AUTHORS);
  const authorPill = (a: TagDetail['authors'][number]) => (
    <li key={a.slug}>
      <Link
        href={withAuthor(a.slug)}
        className={`pill ${author?.slug === a.slug ? 'active' : ''}`}
        aria-current={author?.slug === a.slug ? 'page' : undefined}
        prefetch={false}
      >
        {localized(a, 'name', locale)}
        <span className="tag-pill-count">{a.works}</span>
      </Link>
    </li>
  );

  return (
    <div className="container page-content">
      <nav className="breadcrumb" aria-label={t('title')}>
        <Link prefetch={false} href={localePath(locale, `/tags`)}>{t('title')}</Link>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span className="breadcrumb-current" aria-current="page">{title}</span>
      </nav>

      <header className="page-header page-header--start tag-header">
        <h1>{title}</h1>
        <p className="meta-strip">{t('works_count', { count: result.meta.total })}</p>
      </header>

      {tag.authors.length > 1 && (
        <nav className="tag-authors" aria-label={t('authors_label')}>
          <ul className="chip-row">
            <li>
              <Link href={withAuthor()} className={`pill ${author ? '' : 'active'}`} aria-current={author ? undefined : 'page'} prefetch={false}>
                {t('all_authors')}
              </Link>
            </li>
            {topAuthors.map(authorPill)}
          </ul>
          {moreAuthors.length > 0 && (
            // Closed, the links stay in the page for crawlers; it opens itself on a page narrowed to one of them
            <details className="tag-authors-more" open={moreAuthors.some((a) => a.slug === author?.slug)}>
              <summary className="pill tag-authors-summary">{t('more_authors', { count: moreAuthors.length })}</summary>
              <ul className="chip-row">{moreAuthors.map(authorPill)}</ul>
            </details>
          )}
        </nav>
      )}

      {result.data.length > 0 ? (
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
                    <span>{localized(work.author, 'name', locale)}</span>
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
      ) : (
        <p className="empty-note empty-note--center">{t('empty')}</p>
      )}

      <Pagination
        page={result.meta.page}
        totalPages={result.meta.totalPages}
        href={(p) => withAuthor(author?.slug, p)}
        label={t('pages')}
      />

      <p className="tag-note">{t('auto_note')}</p>
    </div>
  );
}
