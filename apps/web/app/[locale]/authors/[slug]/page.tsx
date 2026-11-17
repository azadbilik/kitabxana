import type { Metadata } from 'next';
import { api, notFoundOn404 } from '@/lib/api';
import { localized, ownField, periodLabel } from '@/lib/locale';
import { getTranslations } from 'next-intl/server';
import { breadcrumbLd, excerpt, pageMetadata, sameAs, SITE_URL } from '@/lib/seo';
import Link from 'next/link';
import { JsonLd } from '@/components/seo/JsonLd';
import { ArtworkGallery } from '@/components/artworks/ArtworkGallery';
import { DownloadBar } from '@/components/reading/DownloadBar';
import { BioCredit } from '@/components/authors/BioCredit';
import { Shelf, type ShelfBook } from '@/components/works/Shelf';
import { localePath } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

const langLabels: Record<string, Record<string, string>> = {
  AZ_LATIN:   { az: 'Azərbaycanca', ru: 'Азербайджанский', en: 'Azerbaijani' },
  AZ_ARABIC:  { az: 'Azərbaycanca (ərəb)', ru: 'Азерб. (араб.)', en: 'Azerbaijani (Arabic)' },
  FA:         { az: 'Farsca', ru: 'Персидский', en: 'Persian' },
  AR:         { az: 'Ərəbcə', ru: 'Арабский', en: 'Arabic' },
  RU:         { az: 'Rusca', ru: 'Русский', en: 'Russian' },
  TR:         { az: 'Türkcə', ru: 'Турецкий', en: 'Turkish' },
};

const typeLabels: Record<string, Record<string, string>> = {
  POET:        { az: 'Şair', ru: 'Поэт', en: 'Poet' },
  WRITER:      { az: 'Yazıçı', ru: 'Писатель', en: 'Writer' },
  PLAYWRIGHT:  { az: 'Dramaturq', ru: 'Драматург', en: 'Playwright' },
  PHILOSOPHER: { az: 'Filosof', ru: 'Философ', en: 'Philosopher' },
  FOLK:        { az: 'Xalq ədəbiyyatı', ru: 'Народное творчество', en: 'Folk literature' },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const author = (await api.getAuthor(slug).catch(notFoundOn404)) as any;

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
  const author = (await api.getAuthor(slug).catch(notFoundOn404)) as any;

  const name = localized(author, 'name', locale) ?? '';
  // Only a bio in the reader's language; otherwise a pointer to the Azerbaijani one
  const bio = ownField(author, 'bio', locale);
  const bioElsewhere = !bio && locale !== 'az' && Boolean(author.bioAz);
  const t = await getTranslations({ locale, namespace: 'authors' });
  const authorsLabel = locale === 'ru' ? 'Авторы' : locale === 'en' ? 'Authors' : 'Müəlliflər';
  const books = await getTranslations({ locale, namespace: 'book' });
  const home = await getTranslations({ locale, namespace: 'home' });
  const options = await getTranslations({ locale, namespace: 'contribute.options' });
  const booksShelf: ShelfBook[] = (author.collections ?? [])
    .filter((c: any) => c.works?.length > 0)
    .map((c: any) => ({
      href: localePath(locale, `/collections/${c.slug}`),
      title: localized(c, 'title', locale) ?? c.titleAz,
      author: name,
      seed: slug,
      kind: c.genre ? options(`genre.${c.genre}` as any) : undefined,
      note: home('work_count', { count: c.works.length }),
    }));

  const years = [
    author.bornYear ? `${author.bornYearApprox ? '~' : ''}${author.bornYear}` : null,
    author.diedYear ? `${author.diedYearApprox ? '~' : ''}${author.diedYear}` : null,
  ].filter(Boolean).join(' — ');

  return (
    <div className="container page-content">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name,
          url: `${SITE_URL}${localePath(locale, `/authors/${slug}`)}`,
          jobTitle: typeLabels[author.type]?.[locale],
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
          { name: authorsLabel, path: localePath(locale, `/authors`) },
          { name },
        ])}
      />

      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href={localePath(locale, `/authors`)}>
          ← {authorsLabel}
        </Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{name}</span>
      </div>

      {/* Author header — portrait + info grid */}
      <div className="author-header-grid">
        <div>
          <div className="portrait-placeholder">
            {author.portraitUrl ? (
              <img src={author.portraitUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <>
                <svg width="44" height="58" viewBox="0 0 44 58" fill="none">
                  <circle cx="22" cy="17" r="13" stroke="var(--rule)" strokeWidth="1"/>
                  <path d="M2 58 Q12 42 22 38 Q32 42 42 58" stroke="var(--rule)" strokeWidth="1" fill="none"/>
                </svg>
                <span className="portrait-placeholder-label">
                  {locale === 'ru' ? 'Нет портрета' : locale === 'en' ? 'No portrait' : 'Portret yoxdur'}
                </span>
              </>
            )}
          </div>
          {/* Credit the portrait: most are public domain, some CC BY-SA (artist, year, licence) */}
          {author.portraitUrl && author.portraitCredit && (
            <p
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.7rem',
                lineHeight: 1.3,
                color: 'var(--muted)',
                marginTop: '0.35rem',
                maxWidth: '130px',
                overflowWrap: 'anywhere',
              }}
            >
              {author.portraitSource ? (
                <a href={author.portraitSource} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                  {author.portraitCredit}
                </a>
              ) : (
                author.portraitCredit
              )}
            </p>
          )}
        </div>

        <div>
          <h1 className="author-name">{name}</h1>
          <div className="author-period">
            {[years, author.type && (typeLabels[author.type]?.[locale] ?? author.type), periodLabel(author.period, locale)]
              .filter(Boolean)
              .join(' · ')}
          </div>

          {/* Language tags */}
          {author.writingLangs?.length > 0 && (
            <div className="author-tags">
              {author.writingLangs.map((l: string) => (
                <span key={l} className="author-tag">
                  {langLabels[l]?.[locale] ?? l}
                </span>
              ))}
            </div>
          )}

          {/* Bio excerpt */}
          {bio && (
            <>
              <div
                className="author-bio"
                dangerouslySetInnerHTML={{ __html: bio }}
              />
              <BioCredit sources={author.bioSources} locale={locale} />
            </>
          )}
          {bioElsewhere && (
            <p className="author-bio author-bio--elsewhere" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
              {t('bio_only_az')}{' '}
              <Link href={localePath('az', `/authors/${slug}`)} hrefLang="az">{t('bio_read_az')} →</Link>
            </p>
          )}

          {(author.works?.length > 0 || author.collections?.some((c: any) => c.works?.length > 0)) && (
            <div className="download-bar--start">
              <DownloadBar path={`/authors/${encodeURIComponent(slug)}`} author={author} locale={locale} kind="author" />
            </div>
          )}
        </div>
      </div>

      {/* The author's books as covers, when there is more than one to choose between */}
      {booksShelf.length > 1 && (
        <div className="author-books">
          <Shelf id="author-books" title={books('books')} books={booksShelf} />
        </div>
      )}

      <ArtworkGallery artworks={author.artworks ?? []} locale={locale} showCollection initial={6} />

      {/* Collections with works */}
      {author.collections?.map((collection: any, idx: number) => (
        <section key={collection.id} style={{ marginBottom: '1rem' }}>
          {idx > 0 && <hr className="rule" style={{ margin: '1rem 0' }} />}

          <div className="coll-header">
            <Link
              href={localePath(locale, `/collections/${collection.slug}`)}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {localized(collection, 'title', locale)}
            </Link>
            {collection.year && (
              <span> · {collection.yearApprox && '~'}{collection.year}</span>
            )}
            {collection.works?.length > 0 && (
              <span> · {collection.works.length} {locale === 'ru' ? 'произв.' : locale === 'en' ? 'works' : 'əsər'}</span>
            )}
          </div>

          <ul className="work-list">
            {collection.works?.map((work: any) => (
              <li key={work.id} className="work-list-item">
                <Link href={localePath(locale, `/works/${work.slug}`)} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span className="work-title">
                    {localized(work, 'title', locale)}
                  </span>
                  <span className="work-year">
                    {work.form && work.form !== 'OTHER' ? work.form.toLowerCase() : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Standalone works */}
      {author.works?.length > 0 && (
        <section style={{ marginTop: '1rem' }}>
          <hr className="rule" style={{ margin: '1rem 0' }} />
          <div className="coll-header">
            {locale === 'ru' ? 'Отдельные произведения' : locale === 'en' ? 'Standalone works' : 'Sərbəst əsərlər'}
          </div>
          <ul className="work-list">
            {author.works.map((work: any) => (
              <li key={work.id} className="work-list-item">
                <Link href={localePath(locale, `/works/${work.slug}`)} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span className="work-title">
                    {localized(work, 'title', locale)}
                  </span>
                  <span className="work-year">
                    {work.genre.toLowerCase()}
                    {work.year && ` · ${work.year}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
