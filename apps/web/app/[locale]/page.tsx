import type { Metadata } from 'next';
import { pageMetadata, publisherLd, SITE_URL } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { api, type BookSummary, type PoemOfTheDay } from '../../lib/api';
import { Shelf } from '@/components/works/Shelf';
import { HomeMine } from '@/components/library/HomeMine';
import { shelfBook, titledIn } from '@/lib/books';
import { localized, ownField, periodLabel } from '@/lib/locale';
import { TagPills } from '@/components/works/TagPills';
import { CatalogTiles } from '@/components/home/CatalogTiles';
import { BioCredit } from '@/components/authors/BioCredit';
import { RefreshIcon } from '@/components/ui/RefreshIcon';
import { authorsPath, worksPath } from '@/lib/facets';
import { localePath } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const CENTURIES = [
  { label: 'XI', y: 11 }, { label: 'XII', y: 12 }, { label: 'XIII', y: 13 },
  { label: 'XVI', y: 16 }, { label: 'XVII', y: 17 }, { label: 'XIX', y: 19 },
  { label: 'XX', y: 20 },
];

// Poem forms and prose genres side by side; each links to its own filter
const GENRES = [
  { filter: { form: 'GHAZAL' },  az: 'Qəzəl',  ru: 'Газель', en: 'Ghazal' },
  { filter: { form: 'MASNAVI' }, az: 'Məsnəvi', ru: 'Маснави', en: 'Masnavi' },
  { filter: { form: 'RUBAI' },   az: 'Rübai',   ru: 'Рубаи',  en: 'Rubai' },
  { filter: { genre: 'PROSE' },  az: 'Nəsr',    ru: 'Проза',   en: 'Prose' },
  { filter: { genre: 'PLAY' },   az: 'Dram',    ru: 'Драма',   en: 'Drama' },
];

interface FeaturedAuthor {
  slug: string;
  nameAz: string;
  nameRu?: string;
  nameEn?: string;
  bornYear?: number;
  diedYear?: number;
  type: string;
  period?: string;
  portraitUrl?: string;
  bioAz?: string;
  bioRu?: string;
  bioEn?: string;
  bioSources?: unknown;
  _count: { works: number };
}

function localeName(item: Record<string, any>, locale: string) {
  return localized(item, 'name', locale) ?? '';
}

function localeTitle(item: Record<string, any>, locale: string) {
  return localized(item, 'title', locale) ?? '';
}

/** Only a bio written in the reader's language; never the Azerbaijani one in its place */
function localeBio(item: Record<string, any>, locale: string) {
  return ownField(item, 'bio', locale);
}

function authorTypeMeta(type: string, locale: string) {
  const map: Record<string, Record<string, string>> = {
    POET:        { az: 'Şair',       ru: 'Поэт',       en: 'Poet' },
    WRITER:      { az: 'Yazıçı',     ru: 'Писатель',    en: 'Writer' },
    PLAYWRIGHT:  { az: 'Dramaturq',  ru: 'Драматург',   en: 'Playwright' },
    PHILOSOPHER: { az: 'Filosof',    ru: 'Философ',     en: 'Philosopher' },
    FOLK:        { az: 'Xalq ədəbiyyatı', ru: 'Народное творчество', en: 'Folk literature' },
  };
  const lang = locale === 'ru' ? 'ru' : locale === 'en' ? 'en' : 'az';
  return map[type]?.[lang] ?? type;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });

  return pageMetadata({ locale, path: '', title: t('title'), description: t('description'), absoluteTitle: true });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('home');
  const options = await getTranslations({ locale, namespace: 'contribute.options' });
  const kind = (genre: string) => options(`genre.${genre}` as any);
  const note = (b: BookSummary) => t('work_count', { count: b.workCount });

  // Shelves of books; on Russian and English pages only books titled in that language
  const books = (q: Record<string, string | number | boolean>) =>
    api
      .getCollections({ limit: 24, onePerAuthor: true, titledIn: titledIn(locale), ...q })
      .then((r) => r.data)
      .catch(() => [] as BookSummary[]);

  const [featured, daily, tags, catalog, newBooks, classics, prose, drama] = await Promise.all([
    api.getFeaturedAuthor(locale).catch(() => null) as Promise<FeaturedAuthor | null>,
    api.getPoemOfTheDay(locale).catch(() => null) as Promise<PoemOfTheDay | null>,
    api.getTags().catch(() => []),
    api.getCatalog().catch(() => null),
    books({ sort: 'recent' }),
    books({ bornBefore: 1800, sort: 'size' }),
    books({ genre: 'PROSE', sort: 'recent' }),
    books({ genre: 'PLAY', sort: 'recent' }),
  ]);
  const themes = tags.filter((tag) => tag.kind === 'THEME' && tag.works > 0).slice(0, 8);
  const booksPath = (q: Record<string, string> = {}) =>
    `${localePath(locale, '/collections')}${Object.keys(q).length ? `?${new URLSearchParams(q)}` : ''}`;
  // Each book on one shelf only: a later shelf skips what an earlier one already shows
  const shown = new Set<string>();
  const shelf = (list: BookSummary[]) => {
    const fresh = list.filter((b) => !shown.has(b.slug)).slice(0, 12);
    fresh.forEach((b) => shown.add(b.slug));
    return fresh.map((b) => shelfBook(b, locale, { kind, note }));
  };

  // Truncate bio to first 2 sentences for the featured box
  const bio = featured ? localeBio(featured, locale) : null;
  const bioSnippet = bio
    ? bio.replace(/\n/g, ' ').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
    : null;

  return (
    <div className="container page-content home">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Kitabxana.az',
          url: `${SITE_URL}${localePath(locale)}`,
          inLanguage: locale,
          publisher: publisherLd,
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}${localePath(locale, '/search')}?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        }}
      />

      {/* ── Hero: poet of the week, poem of the day ─────────── */}
      <div className="home-hero">
        <section className="home-poet" aria-labelledby="home-poet-label">
          {featured ? (
            <div className="featured-box">
              <div className="featured-box-inner">
                <p className="section-label" id="home-poet-label">{t('featured_label')}</p>
                <h1 className="featured-name">{localeName(featured, locale)}</h1>
                <div className="meta-strip featured-meta">
                  {featured.bornYear && featured.diedYear && (
                    <span>{featured.bornYear} — {featured.diedYear}</span>
                  )}
                  {featured.period && (
                    <>
                      {featured.bornYear && <span className="dot" />}
                      <span>{periodLabel(featured.period, locale)}</span>
                    </>
                  )}
                  <span className="dot" />
                  <span>{authorTypeMeta(featured.type, locale)}</span>
                </div>

                {bioSnippet && (
                  // The drop cap only takes a letter: a bio opening on a year would split it
                  <p className={`featured-bio${/^\p{L}/u.test(bioSnippet) ? ' featured-bio--dropcap' : ''}`}>
                    <span className="featured-quote" aria-hidden="true">{'“'}</span>
                    {bioSnippet}
                  </p>
                )}
                {bioSnippet && <BioCredit sources={featured.bioSources} locale={locale} />}

                <Link href={localePath(locale, `/authors/${featured.slug}`)} className="more featured-more">
                  {t('read_more')} →
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="section-label" id="home-poet-label">{t('featured_label')}</p>
              <p className="empty-note">{t('coming_soon')}</p>
            </>
          )}
        </section>

        {daily && (
          <section className="daily-poem" aria-labelledby="daily-poem-title">
            <p className="section-label">{t('daily_label')}</p>
            <h2 id="daily-poem-title" className="daily-poem-title">
              <Link href={localePath(locale, `/works/${daily.slug}`)}>{localeTitle(daily, locale)}</Link>
            </h2>
            <div className="daily-poem-author">
              <Link href={localePath(locale, `/authors/${daily.author.slug}`)}>{localeName(daily.author, locale)}</Link>
              {daily.year ? ` · ${daily.year}` : ''}
            </div>
            <blockquote className="daily-poem-excerpt" lang={daily.lang === 'az' ? 'az-Latn' : daily.lang}>
              {daily.excerpt.map((line, i) => <p key={i}>{line}</p>)}
            </blockquote>
            <div className="daily-poem-actions">
              <Link href={localePath(locale, `/works/${daily.slug}`)} className="more">{t('read_full')} →</Link>
              <Link href={localePath(locale, `/random`)} prefetch={false} className="more"><RefreshIcon /> {t('random_poem')}</Link>
            </div>
          </section>
        )}
      </div>

      {/* ── The signed-in reader's own row: continue reading, their shelf ── */}
      <HomeMine />

      {/* ── Shelves ─────────────────────────────────────────── */}
      <div className="home-shelves">
        <Shelf id="shelf-new" row title={t('shelf_new')} more={{ href: booksPath(), label: t('see_all') }} books={shelf(newBooks)} />
        <Shelf id="shelf-classics" row title={t('shelf_classics')} more={{ href: booksPath({ sort: 'size' }), label: t('see_all') }} books={shelf(classics)} />
        <Shelf id="shelf-prose" row title={t('shelf_prose')} more={{ href: booksPath({ genre: 'PROSE' }), label: t('see_all') }} books={shelf(prose)} />
        <Shelf id="shelf-drama" row title={t('shelf_drama')} more={{ href: booksPath({ genre: 'PLAY' }), label: t('see_all') }} books={shelf(drama)} />
      </div>

      {/* ── Browse: themes, centuries, forms ─────────────────── */}
      <section className="home-browse" aria-labelledby="home-browse-title">
        <h2 className="shelf-title" id="home-browse-title">{t('browse_label')}</h2>
        <div className="home-browse-grid">
          {themes.length > 0 && (
            <div className="home-browse-group">
              <p className="home-browse-label">{t('themes_label')}</p>
              <TagPills tags={themes} locale={locale} label={t('themes_label')} />
            </div>
          )}
          <div className="home-browse-group">
            <p className="home-browse-label">{t('centuries_label')}</p>
            <div className="chip-row">
              {CENTURIES.map(({ label, y }) => (
                <Link key={label} href={authorsPath(locale, { century: y })} className="pill pill--century">{label}</Link>
              ))}
            </div>
          </div>
          <div className="home-browse-group">
            <p className="home-browse-label">{t('genres_label')}</p>
            <div className="chip-row">
              {GENRES.map((g) => (
                <Link key={g.en} href={worksPath(locale, g.filter)} className="pill">
                  {locale === 'ru' ? g.ru : locale === 'en' ? g.en : g.az}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {catalog && (
        <CatalogTiles
          catalog={catalog}
          themes={tags.filter((tag) => tag.kind === 'THEME' && tag.works > 0).length}
          locale={locale}
        />
      )}
    </div>
  );
}
