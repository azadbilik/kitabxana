import type { Metadata } from 'next';
import { workLocales } from '@irs-az/shared';
import { api, getWorkOrRedirect, type MoreWork, type OtherWork, type TagRef } from '@/lib/api';
import { localized } from '@/lib/locale';
import { breadcrumbLd, excerpt, LANGUAGE_TAGS, pageMetadata, publisherLd, sameAs, SITE_URL, fitTitle } from '@/lib/seo';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ReadingView,
  type LangChoice,
  type ReadingMode,
  type ShownTranslation,
  type VersionChoice,
} from '@/components/reading/ReadingView';
import { prosePages } from '@/components/reading/pages';
import { WorkNavKeys } from '@/components/reading/WorkNavKeys';
import { JsonLd } from '@/components/seo/JsonLd';
import { WorkCard } from '@/components/works/WorkCard';
import { ReadingTimeMeta } from '@/components/works/ReadingTimeMeta';
import { TagPills } from '@/components/works/TagPills';
import { RefreshIcon } from '@/components/ui/RefreshIcon';
import { ShareMenu } from '@/components/reading/ShareMenu';
import { WorkActions } from '@/components/library/WorkActions';
import { DownloadMenu } from '@/components/reading/DownloadBar';
import { getTranslations } from 'next-intl/server';
import {
  displayTitle,
  formatVerse,
  incipit,
  isArabicScript,
  isNumberedTitle,
  isPlaceholderTitle,
  sourceInfo,
} from '@/lib/verse';
import { localePath } from '@/lib/i18n';
import { formatReadingTime, readingMinutes } from '@/lib/reading-time';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{
    p?: string | string[];
    lang?: string | string[];
    tr?: string | string[];
    view?: string | string[];
  }>;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const ORIGINAL = 'original';
const PARALLEL = 'parallel';

const workPath = (locale: string, slug: string) => localePath(locale, `/works/${encodeURIComponent(slug)}`);
const pagePath = (locale: string, slug: string, n: number) => `${workPath(locale, slug)}${n > 1 ? `?p=${n}` : ''}`;

/**
 * The reading pages of a long prose text, LitRes-style. Poems are never paged, and a text
 * with a translation stays whole, so the two can be read side by side.
 */
function pagesOf(work: any) {
  if (work.genre === 'POEM') return null;
  const paged = prosePages(work, work.bodyHtml || work.body);
  return { ...paged, count: work.translations?.length ? 1 : paged.pages.length };
}

/**
 * The reading page asked for (`?p=3`). Anything but a page the text has (`?p=2` on a poem,
 * `?p=99`, `?p=1`, `?p=x`) redirects to the page's real address, so no made-up URL is ever
 * rendered or named as canonical.
 */
function resolvePage(raw: string | string[] | undefined, pageCount: number, locale: string, slug: string) {
  if (raw === undefined) return 1;
  const n = Number(first(raw));
  if (Number.isInteger(n) && n > 1 && n <= pageCount) return n;
  redirect(pagePath(locale, slug, Number.isInteger(n) && n > pageCount ? pageCount : 1));
}

/** A work kept only in translation: its original is not in the library (yet) */
const hasOriginal = (work: any) => Boolean((work.body ?? '').trim());

/**
 * What is read: the original alone, one translation alone, or the two side by side
 * (`?view=parallel`). `?tr=<id>` names a translation, `?lang=` a language (or `original`);
 * otherwise the reader's own language when the work has it, then the default translation,
 * shown on its own: a reader who reads Azerbaijani shouldn't scroll past the Persian.
 * Only the chosen translation goes to the browser; the others are links.
 */
function chooseTranslation(
  work: any,
  locale: string,
  slug: string,
  query: { lang?: string; tr?: string; view?: string },
) {
  const all: any[] = (work.translations ?? []).filter((tr: any) => tr.language !== work.originalLang);
  const langs = [...new Set(all.map((tr) => tr.language as string))];
  const withOriginal = hasOriginal(work);
  const preferred = LOCALE_LANG[locale];
  const fallback = langs.includes(preferred)
    ? preferred
    : (all.find((tr) => tr.isDefault)?.language ?? langs[0] ?? ORIGINAL);

  const named = query.tr ? all.find((tr) => tr.id === query.tr) : undefined;
  const asked =
    named?.language ??
    ((query.lang === ORIGINAL && withOriginal) || langs.includes(query.lang ?? '') ? query.lang! : fallback);
  const parallel = withOriginal && langs.length > 0 && query.view === PARALLEL;
  // Side by side always pairs the original with a translation
  const lang = parallel && asked === ORIGINAL ? (fallback === ORIGINAL ? langs[0] : fallback) : asked;
  const inLang = lang === ORIGINAL ? [] : all.filter((tr) => tr.language === lang);
  const standard = inLang.find((tr) => tr.isDefault) ?? inLang[0] ?? null;
  const shown = named ?? standard;
  const view: ReadingMode = !shown ? 'original' : parallel ? 'parallel' : 'translation';

  const href = (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return `${workPath(locale, slug)}${qs ? `?${qs}` : ''}`;
  };
  const langParams = (key: string): Record<string, string> => (key === fallback ? {} : { lang: key });
  const inView = (params: Record<string, string>) => (parallel ? { ...params, view: PARALLEL } : params);

  const choices: LangChoice[] = [
    ...(withOriginal ? [{ key: ORIGINAL, href: href(langParams(ORIGINAL)), active: view === 'original' }] : []),
    ...langs.map((key) => ({ key, href: href(langParams(key)), active: view === 'translation' && key === lang })),
    ...(withOriginal && langs.length > 0
      ? [{ key: PARALLEL, href: href({ ...langParams(lang), view: PARALLEL }), active: view === 'parallel' }]
      : []),
  ];
  const versions: VersionChoice[] = inLang.map((tr) => ({
    id: tr.id,
    translator: tr.translator,
    type: tr.type,
    year: tr.year,
    href: href(inView(tr === standard ? langParams(lang) : { tr: tr.id })),
    active: tr === shown,
  }));
  return { shown, view, choices, versions, translated: all.length > 0, withOriginal };
}

const GLOSSED_FORMS = ['GHAZAL', 'MASNAVI', 'RUBAI', 'QASIDA', 'MURABBA'];
// Fallback collection names for imports still titled by their slug
const FORM_PLURALS = ['GHAZAL', 'MASNAVI', 'RUBAI', 'QASIDA'];

/**
 * Poems titled only by form and number ("Qəzəl 195", "Rübai 90", "شمارهٔ ۷") are known by
 * their first line: the first hemistich becomes the heading (and the page title readers
 * search by), and the number moves to the meta strip.
 */
function headingFor(work: any, title: { text: string; original: string | null }) {
  const numbered = work.genre === 'POEM' && (title.original || isNumberedTitle(title.text));
  const first = numbered ? incipit(work.bodyHtml || work.body) : null;
  return first ? { heading: first, number: title.text } : { heading: title.text, number: null };
}

async function titleHelpers(locale: string) {
  const t = await getTranslations({ locale, namespace: 'reading' });
  const options = await getTranslations({ locale, namespace: 'contribute.options' });
  return {
    t,
    options,
    titleFor: (title: string | null, form: string | null) =>
      displayTitle(title, {
        formLabel: form && form !== 'OTHER' ? options(`form.${form}` as any) : null,
        sectionLabel: t('section'),
        numbered: (f, n) => t('numbered', { form: f, n }),
      }),
  };
}

// The work language each UI locale reads
const LOCALE_LANG: Record<string, string> = { az: 'AZ_LATIN', ru: 'RU', en: 'EN' };
const DESCRIPTION_MAX = 160;

/**
 * The search snippet, in the page's language where the work has text in it: the start of
 * the original or of the default translation. Without one (a Persian ghazal with no
 * Azerbaijani translation yet) it says what the work is and whose, then quotes the start
 * of the original, so the snippet still reads in the page's language.
 */
async function workDescription(work: any, locale: string, authorName: string | null): Promise<string | undefined> {
  const poem = work.genre !== 'PROSE';
  const lang = LOCALE_LANG[locale];
  const translation = (work.translations ?? [])
    .filter((t: any) => t.language === lang)
    .sort((a: any, b: any) => Number(b.isDefault) - Number(a.isDefault))[0];
  const own = work.originalLang === lang ? work.body : translation?.body;
  if (own) return excerpt(own, { poem });

  const { t, options } = await titleHelpers(locale);
  const kind =
    work.form && work.form !== 'OTHER'
      ? options(`form.${work.form}` as any)
      : work.genre
        ? options(`genre.${work.genre}` as any)
        : null;
  const who = [kind, authorName].filter(Boolean).join(' — ');
  const lead = `${who ? `${who}. ` : ''}${t(`original_in.${work.originalLang}` as any)}: `;
  const quote = excerpt(work.body, { poem, max: DESCRIPTION_MAX - lead.length });
  return quote ? lead + quote : lead.replace(/[.:]\s*$/, '').trim();
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const work = (await getWorkOrRedirect(slug, locale)) as any;
  const page = resolvePage((await searchParams).p, pagesOf(work)?.count ?? 1, locale, slug);
  const { titleFor } = await titleHelpers(locale);
  const { heading, number } = headingFor(work, titleFor(localized(work, 'title', locale) ?? work.titleAz, work.form));
  const authorName = localized(work.author, 'name', locale);

  return pageMetadata({
    locale,
    // Each reading page of a long text is its own page for search engines
    path: `/works/${slug}${page > 1 ? `?p=${page}` : ''}`,
    title: fitTitle(heading, `${number ? ` (${number})` : ''}${page > 1 ? ` · ${(await titleHelpers(locale)).t('page_n', { n: page })}` : ''} — ${authorName}`),
    description: await workDescription(work, locale, authorName),
    type: 'article',
    images: false,
    hreflang: workLocales(work.originalLang, (work.translations ?? []).map((t: any) => t.language)),
  });
}

export default async function WorkPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const query = await searchParams;

  const [work, nav, more, others] = await Promise.all([
    getWorkOrRedirect(slug, locale) as Promise<any>,
    // Old slugs redirect above, so nav only matters when the work exists
    api.getWorkNav(slug).catch(() => ({ prev: null, next: null })),
    api.getMoreByAuthor(slug, locale).catch(() => [] as MoreWork[]),
    api.getOtherPoets(slug, locale).catch(() => ({ theme: null, works: [] as OtherWork[] })),
  ]);

  const { t, options, titleFor } = await titleHelpers(locale);
  const tTags = await getTranslations({ locale, namespace: 'tags' });
  const title = titleFor(localized(work, 'title', locale), work.form);
  const { heading, number } = headingFor(work, title);
  const authorName = localized(work.author, 'name', locale);
  const rawCollectionTitle = work.collection ? localized(work.collection, 'title', locale) : null;
  const collectionTitle = work.collection
    ? isPlaceholderTitle(rawCollectionTitle, work.collection.slug)
      ? t(`form_plural.${FORM_PLURALS.includes(work.form) ? work.form : 'OTHER'}` as any)
      : rawCollectionTitle
    : null;

  const isPoem = work.genre === 'POEM';
  const verse = (html: string, anchors = false) =>
    isPoem ? formatVerse(html, { form: work.form, maqtaLabel: t('maqta'), labelLang: locale, anchors }) : { html, maqta: false };
  // Each couplet of the original can be linked to (#b7); the translation lines up beside it
  const original = verse(work.bodyHtml || work.body, true);
  // Long prose is read a page at a time; only the current page is sent
  const paged = pagesOf(work);
  const pageCount = paged?.count ?? 1;
  const page = resolvePage(query.p, pageCount, locale, slug);
  const pageHref = (n: number) => pagePath(locale, slug, n);
  if (paged) original.html = pageCount > 1 ? paged.pages[page - 1] : paged.pages.join('\n');
  // Contents entries lead to the page their heading is on
  const sections = (paged?.sections ?? []).map(({ id, text, page: on }) => ({
    id,
    text,
    ...(pageCount > 1 && { href: `${pageHref(on)}#${id}` }),
  }));
  const minutes = readingMinutes(work.wordCount, work.genre);
  const readingTime = formatReadingTime(t, minutes);

  const chosen = chooseTranslation(work, locale, slug, {
    lang: first(query.lang),
    tr: first(query.tr),
    view: first(query.view),
  });
  const translation: ShownTranslation | null = chosen.shown && {
    id: chosen.shown.id,
    language: chosen.shown.language,
    // Read on its own, the translation's couplets can be linked to as the original's are
    bodyHtml: verse(chosen.shown.bodyHtml || chosen.shown.body, chosen.view === 'translation').html,
    translator: chosen.shown.translator,
    translatorNote: chosen.shown.translatorNote,
    year: chosen.shown.year,
    sourceNote: chosen.shown.sourceNote,
    scriptDirection: chosen.shown.scriptDirection,
  };
  const formLabel = work.form && work.form !== 'OTHER' ? options(`form.${work.form}` as any) : null;

  const navHref = (item: { slug: string } | null) => (item ? workPath(locale, item.slug) : null);
  const navTitle = (item: any) => titleFor(localized(item, 'title', locale), work.form).text;
  const titleLang = (text: string) => (isArabicScript(text) ? { lang: 'fa', dir: 'rtl' as const } : {});
  // At the end of a text the way on is the main thing: the next part of the book
  const nextUp = page === pageCount ? nav.next : null;
  const shareUrl = `${SITE_URL}${localePath(locale, `/works/${slug}`)}`;

  /** A card for another work: one titled only by form and number is shown by its first line */
  const cardFor = (item: MoreWork) => {
    const itemTitle = titleFor(localized(item, 'title', locale), item.form);
    const itemForm = item.form && item.form !== 'OTHER' ? options(`form.${item.form}` as any) : null;
    const numbered = item.genre === 'POEM' && Boolean(itemTitle.original || isNumberedTitle(itemTitle.text));
    const [opening, ...rest] = item.incipit?.lines ?? [];
    return numbered && opening
      ? {
          title: opening.replace(/[\s,;:—–-]+$/u, ''),
          incipit: { ...item.incipit, lines: rest },
          kind: itemTitle.text,
        }
      : { title: itemTitle.text, incipit: item.incipit, kind: itemForm };
  };

  return (
    <div className="container page-content">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: heading,
          url: shareUrl,
          genre: formLabel ?? options(`genre.${work.genre}` as any),
          inLanguage: LANGUAGE_TAGS[work.originalLang],
          description: await workDescription(work, locale, authorName),
          ...(work.year && { dateCreated: String(work.year) }),
          dateModified: work.updatedAt,
          isAccessibleForFree: true,
          publisher: publisherLd,
          author: {
            '@type': 'Person',
            name: authorName,
            url: `${SITE_URL}${localePath(locale, `/authors/${work.author.slug}`)}`,
            sameAs: sameAs(work.author),
          },
          ...(work.translations?.length && {
            workTranslation: work.translations.map((tr: any) => ({
              '@type': 'CreativeWork',
              inLanguage: LANGUAGE_TAGS[tr.language],
              ...(tr.translator && { translator: { '@type': 'Person', name: tr.translator } }),
            })),
          }),
          ...(collectionTitle && {
            isPartOf: {
              '@type': 'CreativeWork',
              name: collectionTitle,
              url: `${SITE_URL}${localePath(locale, `/collections/${work.collection.slug}`)}`,
            },
          }),
        }}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: authorName ?? '', path: localePath(locale, `/authors/${work.author.slug}`) },
          ...(collectionTitle ? [{ name: collectionTitle, path: localePath(locale, `/collections/${work.collection.slug}`) }] : []),
          { name: number ? `${heading} (${number})` : heading },
        ])}
      />

      <nav className="breadcrumb" aria-label={t('breadcrumb')}>
        <Link prefetch={false} href={localePath(locale, `/authors/${work.author.slug}`)}>{authorName}</Link>
        {collectionTitle && (
          <>
            <span className="breadcrumb-sep" aria-hidden="true">›</span>
            <Link prefetch={false} href={localePath(locale, `/collections/${work.collection.slug}`)}>
              <bdi>{collectionTitle}</bdi>
            </Link>
          </>
        )}
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span className="breadcrumb-current" aria-current="page">
          <bdi {...titleLang(title.text)}>{title.text}</bdi>
        </span>
      </nav>

      <header className="page-header work-header">
        <h1 id="work-title" className="work-heading" tabIndex={-1} {...titleLang(heading)}>
          {heading}
        </h1>
        {title.original && !number && (
          <p className="work-heading-original" lang="fa" dir="rtl">{title.original}</p>
        )}
        <div className="meta-strip">
          <span>{options(`genre.${work.genre}` as any)}</span>
          {(number || formLabel) && (
            <>
              <span className="dot" aria-hidden="true" />
              <span>{number ?? formLabel}</span>
            </>
          )}
          {work.year && (
            <>
              <span className="dot" aria-hidden="true" />
              <span>{work.yearApprox ? '~' : ''}{work.year}</span>
            </>
          )}
          {readingTime && (
            <>
              <span className="dot" aria-hidden="true" />
              <span>{t('reading_time', { time: readingTime })}</span>
            </>
          )}
        </div>
        {formLabel && GLOSSED_FORMS.includes(work.form) && (
          <details className="work-gloss">
            <summary>
              {t('what_is', { form: locale === 'az' ? formLabel : formLabel.toLocaleLowerCase(locale) })}
            </summary>
            <p>
              {t(`gloss.${work.form}` as any)}
              {original.maqta && <> {t('gloss_maqta')}</>}
            </p>
          </details>
        )}
      </header>

      <div className="ornament" aria-hidden="true" />

      <ReadingView
        body={original.html}
        translation={translation}
        view={chosen.view}
        hasOriginal={chosen.withOriginal}
        choices={chosen.choices}
        versions={chosen.versions}
        translated={chosen.translated}
        originalLang={work.originalLang}
        scriptDirection={work.scriptDirection}
        genre={work.genre}
        source={sourceInfo(work.sourceNote)}
        suggestHref={localePath(locale, `/contribute?type=translation&work=${encodeURIComponent(slug)}`)}
        slug={slug}
        workId={work.id}
        sections={sections}
        pagination={pageCount > 1 ? { page, pages: pageCount } : null}
        minutes={minutes}
      />

      {nextUp && (
        <nav className="next-up-nav" aria-label={t('nav_label')}>
          <Link href={navHref(nextUp)!} className="next-up" rel="next">
            <span className="next-up-text">
              <span className="next-up-label">
                {collectionTitle ? t('next_in', { book: collectionTitle }) : t('next')}
              </span>
              <span className="next-up-title">
                <bdi {...titleLang(navTitle(nextUp))}>{navTitle(nextUp)}</bdi>
              </span>
            </span>
            <span className="next-up-go">
              {t('read_next')} <span aria-hidden="true">→</span>
            </span>
          </Link>
          <div className="next-up-foot">
            {nav.prev && (
              <Link prefetch={false} href={navHref(nav.prev)!} className="next-up-prev" rel="prev">
                <span aria-hidden="true">← </span>
                <span className="sr-only">{t('prev')}: </span>
                <bdi {...titleLang(navTitle(nav.prev))}>{navTitle(nav.prev)}</bdi>
              </Link>
            )}
            {work.collection && (
              <Link prefetch={false} href={localePath(locale, `/collections/${work.collection.slug}`)} className="next-up-prev">
                {t('book_contents')}
              </Link>
            )}
          </div>
        </nav>
      )}

      <WorkActions workId={work.id} collectionId={work.collection?.id ?? null}>
        <ShareMenu url={shareUrl} text={`${heading} — ${authorName}`} title={heading} subtitle={authorName ?? ''} />
        <DownloadMenu path={`/works/${encodeURIComponent(slug)}`} author={work.author} locale={locale} scans={work.scan ? [work.scan] : null} originalText={chosen.withOriginal} />
      </WorkActions>

      <TagPills
        tags={(work.tags ?? []).map((wt: { tag: TagRef }) => wt.tag)}
        locale={locale}
        label={tTags('work_tags')}
        className="work-tag-row"
      />

      <p className="print-source">Kitabxana.az · {shareUrl}</p>

      {!nextUp && (nav.prev || nav.next) && (
        <nav className="work-nav" aria-label={t('nav_label')}>
          {nav.prev ? (
            <Link prefetch={false} href={navHref(nav.prev)!} className="work-nav-btn" rel="prev">
              <span className="work-nav-dir">← {t('prev')}</span>
              <span className="work-nav-title"><bdi {...titleLang(navTitle(nav.prev))}>{navTitle(nav.prev)}</bdi></span>
            </Link>
          ) : (
            <span />
          )}
          {nav.next ? (
            <Link prefetch={false} href={navHref(nav.next)!} className="work-nav-btn work-nav-btn--next" rel="next">
              <span className="work-nav-dir">{t('next')} →</span>
              <span className="work-nav-title"><bdi {...titleLang(navTitle(nav.next))}>{navTitle(nav.next)}</bdi></span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      {(nav.prev || nav.next) && <p className="work-nav-hint">{t('keys_hint')}</p>}
      {/* On a paged text the arrows turn its pages first, then move on to the next work */}
      <WorkNavKeys
        prevHref={page > 1 ? `${pageHref(page - 1)}#text` : navHref(nav.prev)}
        nextHref={page < pageCount ? `${pageHref(page + 1)}#text` : navHref(nav.next)}
        randomHref={localePath(locale, `/random`)}
      />
      <p className="work-random">
        <Link href={localePath(locale, `/random`)} prefetch={false} aria-keyshortcuts="r"><RefreshIcon /> {t('random_poem')}</Link>
      </p>

      {more.length > 0 && (
        <section className="more-works" aria-labelledby="more-works-title">
          <h2 id="more-works-title" className="more-works-title">
            <Link prefetch={false} href={localePath(locale, `/authors/${work.author.slug}`)}>{t('more_by_author')}</Link>
          </h2>
          <div className="card-grid more-works-grid">
            {more.map((item) => {
              const card = cardFor(item);
              return (
                <WorkCard
                  key={item.slug}
                  href={navHref(item)!}
                  title={card.title}
                  incipit={card.incipit}
                  meta={
                    <>
                      {card.kind && <span>{card.kind}</span>}
                      {card.kind && item.year && <span className="dot" aria-hidden="true" />}
                      {item.year && <span>{item.year}</span>}
                      <ReadingTimeMeta words={item.wordCount} genre={item.genre} locale={locale} first={!card.kind && !item.year} />
                    </>
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {others.works.length > 0 && (
        <section className="more-works more-works--others" aria-labelledby="other-poets-title">
          <h2 id="other-poets-title" className="more-works-title">
            <Link prefetch={false} href={localePath(locale, others.theme ? `/tags/${others.theme.slug}` : '/works')}>
              {t('other_poets')}
              {others.theme && <span className="more-works-theme"> · {localized(others.theme, 'name', locale)}</span>}
            </Link>
          </h2>
          <div className="card-grid more-works-grid">
            {others.works.map((item) => {
              const card = cardFor(item);
              return (
                <WorkCard
                  key={item.slug}
                  href={navHref(item)!}
                  title={card.title}
                  incipit={card.incipit}
                  meta={
                    <>
                      <span>{localized(item.author, 'name', locale)}</span>
                      {card.kind && (
                        <>
                          <span className="dot" aria-hidden="true" />
                          <span>{card.kind}</span>
                        </>
                      )}
                      <ReadingTimeMeta words={item.wordCount} genre={item.genre} locale={locale} />
                    </>
                  }
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
