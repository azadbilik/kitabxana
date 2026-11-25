import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { api, notFoundOn404, type AuthorPage as AuthorData } from '@/lib/api';
import { localized, ownField, periodLabel } from '@/lib/locale';
import { breadcrumbLd, excerpt, pageMetadata, plainLines, sameAs, SITE_URL } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { ArtworkGallery, type Artwork } from '@/components/artworks/ArtworkGallery';
import { DownloadBar } from '@/components/reading/DownloadBar';
import { ShareMenu } from '@/components/reading/ShareMenu';
import { BioCredit } from '@/components/authors/BioCredit';
import { AuthorPortrait } from '@/components/authors/AuthorPortrait';
import { Shelf, type ShelfBook } from '@/components/works/Shelf';
import { worksPath } from '@/lib/facets';
import { localePath } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';
import { scriptAttrs } from '@/lib/script';
import { literaryMapPlace } from '@/lib/literary-map';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

/** A bio longer than this is folded to a few lines behind "read more" */
const BIO_FOLD_CHARS = 600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const author = await api.getAuthorPage(slug).catch(notFoundOn404);

  return pageMetadata({
    locale,
    path: `/authors/${slug}`,
    title: localized(author, 'name', locale) ?? author.nameAz,
    description: excerpt(ownField(author, 'bio', locale)),
    type: 'profile',
    images: false,
  });
}

export default async function AuthorPage({ params }: Props) {
  const { locale, slug } = await params;
  const author: AuthorData = await api.getAuthorPage(slug).catch(notFoundOn404);
  const [t, book, home, reading, nav, labels, onMap] = await Promise.all([
    getTranslations({ locale, namespace: 'authors' }),
    getTranslations({ locale, namespace: 'book' }),
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'reading' }),
    getTranslations({ locale, namespace: 'nav' }),
    getLabels(locale),
    literaryMapPlace(slug, locale),
  ]);

  const name = localized(author, 'name', locale) ?? author.nameAz;
  // Only a bio in the reader's language; otherwise a pointer to the Azerbaijani one
  const bio = ownField(author, 'bio', locale);
  const bioElsewhere = !bio && locale !== 'az' && Boolean(author.bioAz);
  const bioFolds = plainLines(bio).join(' ').length > BIO_FOLD_CHARS;
  const typeLabel = labels.authorType(author.type);
  const facts = [labels.lifeYears(author), typeLabel, periodLabel(author.period, locale)].filter(Boolean);

  const books: ShelfBook[] = author.collections.map((c) => ({
    href: localePath(locale, `/collections/${c.slug}`),
    title: localized(c, 'title', locale) ?? c.titleAz,
    author: name,
    seed: c.id,
    originalLang: c.originalLang,
    kind: labels.genre(c.genre) ?? undefined,
    note: home('work_count', { count: c.workCount }),
  }));
  const allWorksHref = worksPath(locale, { author: slug });

  return (
    <div className="container page-content author-page">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name,
          url: `${SITE_URL}${localePath(locale, `/authors/${slug}`)}`,
          ...(typeLabel && { jobTitle: typeLabel }),
          ...(author.bornYear && { birthDate: String(author.bornYear) }),
          ...(author.diedYear && { deathDate: String(author.diedYear) }),
          ...(author.portraitUrl && { image: author.portraitUrl }),
          ...(author.bornPlace && { birthPlace: { '@type': 'Place', name: author.bornPlace } }),
          ...(author.diedPlace && { deathPlace: { '@type': 'Place', name: author.diedPlace } }),
          sameAs: sameAs(author),
          description: excerpt(bio, { max: 300 }),
        }}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: nav('authors'), path: localePath(locale, '/authors') },
          { name },
        ])}
      />

      <nav className="breadcrumb" aria-label={reading('breadcrumb')}>
        <Link prefetch={false} href={localePath(locale, '/authors')}>{nav('authors')}</Link>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span className="breadcrumb-current" aria-current="page">{name}</span>
      </nav>

      <header className="author-head">
        <div className="author-portrait">
          {author.portraitUrl ? (
            <AuthorPortrait url={author.portraitUrl} alt={t('portrait_alt', { name })} size="lg" />
          ) : (
            <div className="author-portrait-empty" aria-hidden="true">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                <circle cx="12" cy="8.5" r="3.75" />
                <path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" />
              </svg>
            </div>
          )}
          {/* Most portraits are public domain, some CC BY-SA: the artist, year and licence */}
          {author.portraitUrl && author.portraitCredit && (
            <p className="author-portrait-credit">
              {author.portraitSource ? (
                <a href={author.portraitSource} target="_blank" rel="noopener noreferrer">{author.portraitCredit}</a>
              ) : (
                author.portraitCredit
              )}
            </p>
          )}
        </div>

        <div className="author-head-info">
          <h1 className="author-name">{name}</h1>
          {facts.length > 0 && <p className="author-period">{facts.join(' · ')}</p>}
          {onMap && (
            <p className="author-map">
              <a href={onMap.href}>{t('on_map', { place: onMap.place })}</a>
            </p>
          )}

          {author.writingLangs.length > 0 && (
            <ul className="author-tags">
              {author.writingLangs.map((l) => (
                <li key={l} className="author-tag">{labels.lang(l) ?? l}</li>
              ))}
            </ul>
          )}

          {bio && (
            <div className="author-bio-wrap">
              {/* The whole bio is in the page; the checkbox only lifts the visual fold, so it works without scripts */}
              {bioFolds && <input type="checkbox" id="author-bio-toggle" className="author-bio-toggle sr-only" aria-controls="author-bio" />}
              <div id="author-bio" className={bioFolds ? 'author-bio author-bio--folds' : 'author-bio'} dangerouslySetInnerHTML={{ __html: bio }} />
              {bioFolds && (
                <label htmlFor="author-bio-toggle" className="author-bio-more">
                  <span className="author-bio-more-open">{t('bio_more')}</span>
                  <span className="author-bio-more-close">{t('bio_less')}</span>
                </label>
              )}
              <BioCredit sources={author.bioSources} locale={locale} />
            </div>
          )}
          {bioElsewhere && (
            <p className="author-bio author-bio--elsewhere">
              {t('bio_only_az')}{' '}
              <Link prefetch={false} href={localePath('az', `/authors/${slug}`)} hrefLang="az">{t('bio_read_az')} →</Link>
            </p>
          )}

          {author.worksCount > 0 && (
            <div className="download-bar--start">
              <DownloadBar path={`/authors/${encodeURIComponent(slug)}`} author={author} locale={locale} kind="author" />
            </div>
          )}

          <div className="page-share">
            <ShareMenu
              url={`${SITE_URL}${localePath(locale, `/authors/${slug}`)}`}
              text={name}
              title={name}
              subtitle={facts.join(' · ')}
              kind="author"
              print={false}
            />
          </div>
        </div>
      </header>

      {/* Each book opens its own page with its contents; the works are not repeated here */}
      {books.length > 0 && (
        <div className="author-books">
          <Shelf
            id="author-books"
            sameAuthor
            title={book('books')}
            more={author.worksCount > 0 ? { href: allWorksHref, label: t('all_works', { count: author.worksCount }) } : undefined}
            books={books}
          />
        </div>
      )}

      <ArtworkGallery
        artworks={author.artworks as Artwork[]}
        total={author.artworksCount}
        moreFrom={`/authors/${encodeURIComponent(slug)}/artworks`}
        locale={locale}
        showCollection
        initial={6}
      />

      {author.works.length > 0 && (
        <section className="author-works" aria-labelledby="author-works-title">
          <div className="shelf-head">
            <h2 className="shelf-title" id="author-works-title">{t('other_works')}</h2>
            {author.standaloneCount > author.works.length && (
              <Link href={allWorksHref} className="shelf-more" prefetch={false}>
                {t('all_works', { count: author.worksCount })}
              </Link>
            )}
          </div>
          <ul className="author-work-list">
            {author.works.map((work) => {
              const title = localized(work, 'title', locale) ?? work.titleAz;
              const meta = [labels.kind(work), work.year && `${work.yearApprox ? '~' : ''}${work.year}`].filter(Boolean).join(' · ');
              return (
                <li key={work.id}>
                  <Link href={localePath(locale, `/works/${work.slug}`)} className="author-work" prefetch={false}>
                    <span className="author-work-title" {...scriptAttrs(title, work.originalLang)}>{title}</span>
                    {meta && <span className="author-work-meta">{meta}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
