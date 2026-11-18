import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { api, notFoundOn404 } from '@/lib/api';
import { localized, periodLabel } from '@/lib/locale';
import { breadcrumbLd, pageMetadata, publisherLd, sameAs, SITE_URL } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { ArtworkGallery, GALLERY_FIRST } from '@/components/artworks/ArtworkGallery';
import { Pagination } from '@/components/ui/Pagination';
import { DownloadBar } from '@/components/reading/DownloadBar';
import { BookCover } from '@/components/works/BookCover';
import { Shelf } from '@/components/works/Shelf';
import { BookActions } from '@/components/library/BookActions';
import { BookContents } from '@/components/library/BookContents';
import { shelfBook, titledIn } from '@/lib/books';
import { defaultLocale, localePath, locales } from '@/lib/i18n';
import { getLabels, partTitle } from '@/lib/labels';
import { scriptAttrs, textAttrs } from '@/lib/script';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ c?: string }>;
}

/**
 * A few divans run to thousands of poems. Past this many parts the contents are shown a
 * page at a time (?c=2), so the book's page stays a page and not a four-megabyte list.
 */
const CONTENTS_PAGED_OVER = 600;
const CONTENTS_PER_PAGE = 300;

function contentsPage(total: number, c: string | undefined) {
  if (total <= CONTENTS_PAGED_OVER) return null;
  const pages = Math.ceil(total / CONTENTS_PER_PAGE);
  const page = Math.min(Math.max(Number.parseInt(c ?? '1', 10) || 1, 1), pages);
  return { page, pages, start: (page - 1) * CONTENTS_PER_PAGE };
}

/**
 * Locales whose shelves list this book: Azerbaijani always, Russian and English only with a
 * title in that language (see titledIn). The other variants still open, but stay out of
 * hreflang and the index.
 */
function titledLocales(collection: { titleRu?: string | null; titleEn?: string | null }): string[] {
  return locales.filter((l) => l === defaultLocale || (l === 'ru' ? collection.titleRu : collection.titleEn));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const { c } = await searchParams;
  const collection = (await api.getCollection(slug, locale).catch(notFoundOn404)) as any;
  const title = localized(collection, 'title', locale) ?? collection.titleAz;
  const authorName = localized(collection.author, 'name', locale);
  const firstWorks = collection.works.slice(0, 5).map((w: any) => localized(w, 'title', locale)).join(', ');
  const listed = titledLocales(collection);

  return pageMetadata({
    locale,
    path: `/collections/${slug}`,
    title: `${title} — ${authorName}`,
    description: `${authorName}, ${title}: ${firstWorks}${collection.works.length > 5 ? '…' : ''}`,
    images: false,
    hreflang: listed,
    // Later pages of a long book's contents are the same book: only the first is indexed
    noindex: !listed.includes(locale) || (contentsPage(collection.works.length, c)?.page ?? 1) > 1,
  });
}

interface Opening {
  text: string;
  verse: boolean;
  lang: string;
}

/** Letters and digits only, lower-cased: to tell a first line that merely repeats the title */
const bare = (s: string) => s.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function OpeningText({ opening }: { opening: Opening }) {
  return (
    <blockquote
      className={opening.verse ? 'book-opening-text book-opening-text--verse' : 'book-opening-text'}
      {...textAttrs(opening.text, opening.lang)}
    >
      {opening.text}
    </blockquote>
  );
}

/** A book's description in the reader's language, as plain paragraphs */
function description(collection: any, locale: string): string[] {
  const text = locale === 'ru' ? collection.descriptionRu : locale === 'az' ? collection.descriptionAz : null;
  return text ? String(text).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [];
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const { c } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'book' });
  const reading = await getTranslations({ locale, namespace: 'reading' });
  const home = await getTranslations({ locale, namespace: 'home' });
  const labels = await getLabels(locale);
  const collection = (await api.getCollection(slug, locale).catch(notFoundOn404)) as any;

  const title: string = localized(collection, 'title', locale) ?? collection.titleAz;
  const authorName: string = localized(collection.author, 'name', locale) ?? collection.author.nameAz;
  const works: any[] = collection.works;
  const genre = labels.genre(collection.genre) ?? undefined;
  const paragraphs = description(collection, locale);
  const opening: Opening | null = collection.opening ?? null;
  const openingTranslated: Opening | null = collection.openingTranslated ?? null;

  // Contents rows. A title that repeats the book's is shortened, and a poem — or any part
  // whose title was shortened — is told apart by its first line
  const kinds = works.map((w) => `${labels.kind(w) ?? ''}${w.year ? ` · ${w.year}` : ''}`);
  const sameKind = kinds.every((k) => k === kinds[0]);
  const paged = contentsPage(works.length, c);
  const shown = paged ? works.slice(paged.start, paged.start + CONTENTS_PER_PAGE) : works;
  const rows = shown.map((work: any, k: number) => {
    const i = (paged?.start ?? 0) + k;
    const fullTitle: string = localized(work, 'title', locale) ?? work.titleAz;
    const short = partTitle(fullTitle, title, locale, (n) => t('part_no', { n }));
    const line: string | undefined = work.incipit?.line;
    const telling =
      line && (short || work.genre === 'POEM') && !bare(line).startsWith(bare(fullTitle)) && !bare(fullTitle).startsWith(bare(line));
    return {
      id: work.id,
      slug: work.slug,
      title: short ?? fullTitle,
      fullTitle,
      titleScript: scriptAttrs(fullTitle, work.originalLang ?? collection.originalLang),
      incipit: telling ? { text: line!, ...textAttrs(line!, work.incipit.lang) } : null,
      // Where every part is the same kind and has a first line to show, the kind adds nothing
      kind: sameKind && telling ? null : kinds[i] || null,
    };
  });

  // The author's other books, for a shelf under the contents
  const others = await api
    .getCollections({ authorSlug: collection.author.slug, sort: 'size', limit: 13, titledIn: titledIn(locale) })
    .then((r) => r.data.filter((b) => b.slug !== slug).slice(0, 12))
    .catch(() => []);

  return (
    <div className="container page-content book-page">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Book',
          name: title,
          url: `${SITE_URL}${localePath(locale, `/collections/${slug}`)}`,
          ...(collection.year && { dateCreated: String(collection.year) }),
          isAccessibleForFree: true,
          publisher: publisherLd,
          author: {
            '@type': 'Person',
            name: authorName,
            url: `${SITE_URL}${localePath(locale, `/authors/${collection.author.slug}`)}`,
            sameAs: sameAs(collection.author),
          },
          hasPart: works.slice(0, 100).map((w: any) => ({
            '@type': 'CreativeWork',
            name: localized(w, 'title', locale) ?? w.titleAz,
            url: `${SITE_URL}${localePath(locale, `/works/${w.slug}`)}`,
          })),
        }}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: authorName, path: localePath(locale, `/authors/${collection.author.slug}`) },
          { name: title },
        ])}
      />

      <nav className="breadcrumb" aria-label={reading('breadcrumb')}>
        <Link prefetch={false} href={localePath(locale, '/collections')}>{t('books')}</Link>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <Link prefetch={false} href={localePath(locale, `/authors/${collection.author.slug}`)}>{authorName}</Link>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span className="breadcrumb-current" aria-current="page"><bdi {...scriptAttrs(title, collection.originalLang)}>{title}</bdi></span>
      </nav>

      <section className="book-head">
        <div className="book-head-cover">
          <BookCover title={title} author={authorName} kind={genre} seed={collection.id} size="lg" originalLang={collection.originalLang} />
        </div>

        <div className="book-head-info">
          <h1 className="book-title" {...scriptAttrs(title, collection.originalLang)}>{title}</h1>
          <Link prefetch={false} href={localePath(locale, `/authors/${collection.author.slug}`)} className="book-author">{authorName}</Link>

          <ul className="book-facts">
            {genre && <li>{genre}</li>}
            {collection.year && <li>{collection.yearApprox ? '~' : ''}{collection.year}</li>}
            {collection.author.period && <li>{periodLabel(collection.author.period, locale)}</li>}
            {/* The language only where it isn't the site's own Azerbaijani */}
            {!['AZ_LATIN', 'AZ_CYRILLIC'].includes(collection.originalLang) && labels.langIn(collection.originalLang) && (
              <li>{labels.langIn(collection.originalLang)}</li>
            )}
            <li>{t('parts', { count: works.length })}</li>
          </ul>

          {paragraphs.length > 0 ? (
            <div className="book-description">
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ) : (
            opening && (
              // No description: the book's own first lines say what it is — in the reader's
              // language where its first part is translated, with the original beneath
              <figure className="book-opening">
                <figcaption className="book-opening-label">{t('opening')}</figcaption>
                {openingTranslated ? (
                  <>
                    <OpeningText opening={openingTranslated} />
                    <p className="book-opening-label book-opening-label--original">{t('opening_original')}</p>
                    <OpeningText opening={opening} />
                  </>
                ) : (
                  <OpeningText opening={opening} />
                )}
              </figure>
            )
          )}

          {works.length > 0 && (
            <BookActions
              collectionId={collection.id}
              // A paged book names only the parts on this page; the rest go by number
              parts={works.map((w: any, i: number) => ({
                id: w.id,
                slug: w.slug,
                title:
                  paged && (i < paged.start || i >= paged.start + CONTENTS_PER_PAGE)
                    ? t('part_no', { n: i + 1 })
                    : (localized(w, 'title', locale) ?? w.titleAz),
              }))}
            />
          )}

          {works.length > 0 && (
            <div className="download-bar--start">
              <DownloadBar path={`/collections/${encodeURIComponent(slug)}`} author={collection.author} locale={locale} kind="collection" scans={collection.scans} />
            </div>
          )}
        </div>
      </section>

      <ArtworkGallery
        artworks={(collection.artworks ?? []).slice(0, GALLERY_FIRST)}
        total={(collection.artworks ?? []).length}
        moreFrom={`/collections/${encodeURIComponent(slug)}/artworks`}
        locale={locale}
        initial={6}
      />

      {/* A one-part book needs no contents: "Start reading" opens that part */}
      {works.length > 1 && (
        <section className="book-contents" aria-labelledby="book-contents-title">
          <h2 className="shelf-title" id="book-contents-title">{t('contents')}</h2>
          <BookContents collectionId={collection.id} rows={rows} start={paged?.start ?? 0} />
          {paged && (
            <Pagination
              page={paged.page}
              totalPages={paged.pages}
              label={t('contents')}
              href={(n) => localePath(locale, `/collections/${slug}`) + (n > 1 ? `?c=${n}` : '') + '#book-contents-title'}
            />
          )}
        </section>
      )}

      {others.length > 0 && (
        <div className="book-more">
          <Shelf
            id="shelf-author"
            row
            sameAuthor
            title={t('more_by_author')}
            more={{ href: localePath(locale, `/authors/${collection.author.slug}`), label: home('see_all') }}
            books={others.map((b) => shelfBook(b, locale, {
              kind: (g) => labels.genre(g) ?? '',
              note: (b) => home('work_count', { count: b.workCount }),
            }))}
          />
        </div>
      )}
    </div>
  );
}
