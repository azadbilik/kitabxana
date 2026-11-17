import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { api, notFoundOn404 } from '@/lib/api';
import { localized } from '@/lib/locale';
import { breadcrumbLd, pageMetadata, publisherLd, sameAs, SITE_URL } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { ArtworkGallery } from '@/components/artworks/ArtworkGallery';
import { DownloadBar } from '@/components/reading/DownloadBar';
import { BookCover } from '@/components/works/BookCover';
import { Shelf } from '@/components/works/Shelf';
import { BookActions } from '@/components/library/BookActions';
import { BookContents } from '@/components/library/BookContents';
import { shelfBook, titledIn } from '@/lib/books';
import { isArabicScript } from '@/lib/verse';
import { localePath } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const collection = (await api.getCollection(slug).catch(notFoundOn404)) as any;
  const title = localized(collection, 'title', locale) ?? collection.titleAz;
  const authorName = localized(collection.author, 'name', locale);
  const firstWorks = collection.works.slice(0, 5).map((w: any) => localized(w, 'title', locale)).join(', ');

  return pageMetadata({
    locale,
    path: `/collections/${slug}`,
    title: `${title} — ${authorName}`,
    description: `${authorName}, ${title}: ${firstWorks}${collection.works.length > 5 ? '…' : ''}`,
    images: false,
  });
}

/** A book's description in the reader's language, as plain paragraphs */
function description(collection: any, locale: string): string[] {
  const text = locale === 'ru' ? collection.descriptionRu : locale === 'az' ? collection.descriptionAz : null;
  return text ? String(text).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [];
}

export default async function CollectionPage({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'book' });
  const reading = await getTranslations({ locale, namespace: 'reading' });
  const home = await getTranslations({ locale, namespace: 'home' });
  const options = await getTranslations({ locale, namespace: 'contribute.options' });
  const collection = (await api.getCollection(slug).catch(notFoundOn404)) as any;

  const title: string = localized(collection, 'title', locale) ?? collection.titleAz;
  const authorName: string = localized(collection.author, 'name', locale) ?? collection.author.nameAz;
  const works: any[] = collection.works;
  const genre = options(`genre.${collection.genre}` as any);
  const kindOf = (w: any) => (w.form && w.form !== 'OTHER' ? options(`form.${w.form}` as any) : options(`genre.${w.genre}` as any));
  const paragraphs = description(collection, locale);

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
        <Link href={localePath(locale, '/collections')}>{t('books')}</Link>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <Link href={localePath(locale, `/authors/${collection.author.slug}`)}>{authorName}</Link>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span className="breadcrumb-current" aria-current="page"><bdi>{title}</bdi></span>
      </nav>

      <section className="book-head">
        <div className="book-head-cover">
          <BookCover title={title} author={authorName} kind={genre} seed={collection.author.slug} size="lg" />
        </div>

        <div className="book-head-info">
          <h1 className="book-title" {...(isArabicScript(title) && { lang: 'fa', dir: 'rtl' })}>{title}</h1>
          <Link href={localePath(locale, `/authors/${collection.author.slug}`)} className="book-author">{authorName}</Link>

          <ul className="book-facts">
            <li>{genre}</li>
            {collection.year && <li>{collection.yearApprox ? '~' : ''}{collection.year}</li>}
            <li>{t('parts', { count: works.length })}</li>
          </ul>

          {paragraphs.length > 0 && (
            <div className="book-description">
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}

          {works.length > 0 && (
            <BookActions
              collectionId={collection.id}
              parts={works.map((w: any) => ({ id: w.id, slug: w.slug, title: localized(w, 'title', locale) ?? w.titleAz }))}
            />
          )}

          {works.length > 0 && (
            <div className="download-bar--start">
              <DownloadBar path={`/collections/${encodeURIComponent(slug)}`} author={collection.author} locale={locale} kind="collection" scans={collection.scans} />
            </div>
          )}
        </div>
      </section>

      <ArtworkGallery artworks={collection.artworks ?? []} locale={locale} initial={6} />

      {works.length > 0 && (
        <section className="book-contents" aria-labelledby="book-contents-title">
          <h2 className="shelf-title" id="book-contents-title">{t('contents')}</h2>
          <BookContents
            collectionId={collection.id}
            rows={works.map((work: any) => {
              const workTitle = localized(work, 'title', locale) ?? work.titleAz;
              return {
                id: work.id,
                slug: work.slug,
                title: workTitle,
                kind: `${kindOf(work)}${work.year ? ` · ${work.year}` : ''}`,
                arabic: isArabicScript(workTitle),
              };
            })}
          />
        </section>
      )}

      {others.length > 0 && (
        <div className="book-more">
          <Shelf
            id="shelf-author"
            row
            title={t('more_by_author')}
            more={{ href: localePath(locale, `/authors/${collection.author.slug}`), label: home('see_all') }}
            books={others.map((b) => shelfBook(b, locale, {
              kind: (g) => options(`genre.${g}` as any),
              note: (b) => home('work_count', { count: b.workCount }),
            }))}
          />
        </div>
      )}
    </div>
  );
}
