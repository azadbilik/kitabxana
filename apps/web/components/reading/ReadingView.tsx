'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useReadingPrefs, type ReadingFont } from '@/lib/useReadingPrefs';
import { isArabicScript, langTag, lineCount, sourceInfo, verseBlocks, type SourceInfo } from '@/lib/verse';
import { AppearancePopover } from './AppearancePopover';
import { ReadingProgress } from './ReadingProgress';
import { Pager } from './Pager';

/** The translation set beside the original: only the one being read is sent to the browser */
export interface ShownTranslation {
  id: string;
  language: string;
  bodyHtml: string;
  translator: string | null;
  translatorNote: string | null;
  year: number | null;
  sourceNote?: string | null;
  scriptDirection: string;
}

/** A way to read the text: the original alone, or beside a translation in one language */
export interface LangChoice {
  /** 'original' or a language enum */
  key: string;
  href: string;
  active: boolean;
}

/** One of several translations into the chosen language (different translators) */
export interface VersionChoice {
  id: string;
  translator: string | null;
  type: string;
  year: number | null;
  href: string;
  active: boolean;
}

interface Props {
  body: string;
  /** Chosen on the server from `?lang=` / `?tr=`; switching is a navigation to the choice's href */
  translation: ShownTranslation | null;
  choices: LangChoice[];
  versions: VersionChoice[];
  /** The work has at least one translation, shown or not */
  translated: boolean;
  originalLang: string;
  scriptDirection: string;
  genre: string;
  source: SourceInfo | null;
  suggestHref: string;
  slug: string;
  /** For a signed-in reader's place and read mark, kept on the account */
  workId?: string;
  /** Headings inside a prose text (acts, scenes, numbered parts), with the ids they carry */
  sections?: { id: string; text: string; href?: string }[];
  /** Which reading page of a long prose text this is; null when it is read whole */
  pagination?: { page: number; pages: number } | null;
}

const ORIGINAL = 'original';
const MAX_SEGMENTS = 4;
// Texts longer than this many lines open folded, culture.ru-style, showing the first part
const LONG_LINES = 40;
const FOLDED_LINES = 24;
// A prose text with at least this many headings gets a contents list
const MIN_SECTIONS = 3;

const fontSizeValues = ['0.95rem', '1.05rem', '1.2rem', '1.35rem'];
const leadingShift = { tight: -0.3, normal: 0, loose: 0.3 } as const;
const widthValues = ['36rem', '44rem', '100%'];
// Book and sans follow the skin; literary and system are the same in both
const readingFontValues: Record<ReadingFont, string> = {
  book: 'var(--font-body)',
  literary: 'var(--font-literary)',
  sans: 'var(--font-ui)',
  system: 'var(--font-system)',
};

export function ReadingView({
  body: text,
  translation,
  choices,
  versions,
  translated,
  originalLang,
  scriptDirection,
  genre,
  source,
  suggestHref,
  slug,
  workId,
  sections = [],
  pagination = null,
}: Props) {
  const t = useTranslations('reading');
  const tc = useTranslations('contribute.options');
  const router = useRouter();

  const { prefs, update: updatePrefs } = useReadingPrefs();

  // The couplet or line a link points at (#b7), marked in the text as it is written out
  const [linked, setLinked] = useState<string | null>(null);
  const body = linked ? text.replace(` id="${linked}">`, ` id="${linked}" data-linked>`) : text;

  // Folding of long texts: open once expanded, across language switches
  const [expanded, setExpanded] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const textId = 'work-text';

  // Where the translation itself comes from, e.g. the scanned book on Internet Archive
  const translationSource = sourceInfo(translation?.sourceNote);

  /** Translator's name, or the translation type when there is none; numbered if still ambiguous */
  const versionLabel = (tr: VersionChoice, i: number) => {
    const base = tr.translator ?? tc(`ttype.${tr.type}` as any);
    const ambiguous = versions.some(
      (other) => other !== tr && (other.translator ?? tc(`ttype.${other.type}` as any)) === base,
    );
    return `${base}${tr.year ? `, ${tr.year}` : ''}${ambiguous ? ` (${i + 1})` : ''}`;
  };

  const isPoem = genre === 'POEM';
  const originalDir = scriptDirection === 'RTL' ? 'rtl' : 'ltr';
  // Some imports are tagged Arabic-script but hold a Latin transliteration;
  // tag by the script actually present so fonts and screen readers match
  const originalTag =
    ['AZ_ARABIC', 'FA', 'AR'].includes(originalLang) && !isArabicScript(body)
      ? `${langTag[originalLang].split('-')[0]}-Latn`
      : langTag[originalLang];
  const langName = (lang: string) => (lang === ORIGINAL ? t('original_option') : tc(`lang.${lang}` as any));

  const readingVars = {
    '--reading-size': fontSizeValues[prefs.fontSize],
    '--reading-width': isPoem ? undefined : widthValues[prefs.width],
    '--reading-font': readingFontValues[prefs.fontFamily],
    '--reading-leading': (prefs.fontSize >= 2 ? 2.1 : 1.95) + leadingShift[prefs.leading],
    // Arabic script keeps its own taller leading and moves by the same step
    '--reading-leading-shift': leadingShift[prefs.leading],
  } as CSSProperties;

  const columnClass = `reading-column${isPoem ? ' is-poem' : ' is-prose'}`;
  // Prose is read straight through: paragraph style and alignment are the reader's
  const proseAttrs = isPoem ? {} : { 'data-paragraphs': prefs.paragraphs, 'data-align': prefs.align };
  const numberAttrs = isPoem && prefs.numbers ? { 'data-numbers': 'on' } : {};

  const originalAttrs = { lang: originalTag, dir: originalDir } as const;
  const translationHtml = translation?.bodyHtml ?? '';
  const translationAttrs = translation
    ? ({ lang: langTag[translation.language], dir: translation.scriptDirection === 'RTL' ? 'rtl' : 'ltr' } as const)
    : null;

  // Long poems open folded; decided from the text itself so server and client agree.
  // Prose opens whole: someone who came to read a chapter shouldn't have to unfold it
  const lines = Math.max(lineCount(body), translation ? lineCount(translationHtml) : 0);
  const foldable = isPoem && lines > LONG_LINES;
  const folded = foldable && !expanded;
  const foldClass = folded ? ' is-folded' : '';
  const foldVars = { '--folded-lines': FOLDED_LINES } as CSSProperties;

  // A link to one couplet or line (#b7, #l12) may point into the folded part: open the
  // text and bring the line into view, which the browser could not do while it was hidden.
  // The line is marked in the HTML itself: :target does not survive the router's history
  // writes, and a class set on the node is lost when React next writes the text
  useEffect(() => {
    const read = () => {
      const id = /^#[bl]\d+$/.test(location.hash) ? location.hash.slice(1) : null;
      const found = id && textRef.current?.querySelector(`#${id}`) ? id : null;
      setLinked(found);
      if (!found) return;
      setExpanded(true);
      // After the text is written out again with the mark: bring the line in, unless a
      // click on its number already has it on screen
      requestAnimationFrame(() => {
        const line = document.getElementById(found);
        const box = line?.getBoundingClientRect();
        if (box && (box.top < 120 || box.bottom > innerHeight - 40)) line?.scrollIntoView({ block: 'center' });
      });
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  function unfold() {
    setExpanded(true);
    // The button goes away; keep focus in the text instead of dropping it on <body>
    requestAnimationFrame(() => textRef.current?.focus({ preventScroll: true }));
  }

  // Line the two texts up beyt by beyt when both split into the same blocks;
  // on a phone this interleaves them instead of stacking two whole poems
  const originalBlocks = translation ? verseBlocks(body) : null;
  const translationBlocks = translation ? verseBlocks(translationHtml) : null;
  const rows =
    originalBlocks && translationBlocks && originalBlocks.length === translationBlocks.length
      ? originalBlocks.map((block, i) => [block, translationBlocks[i]] as const)
      : null;

  // Each choice is a link: the server sends the page with that translation, and only that one
  const control =
    choices.length > 1 &&
    (choices.length <= MAX_SEGMENTS ? (
      <div className="lang-tabs" role="group" aria-label={t('read_as')}>
        {choices.map((choice) => (
          <Link
            key={choice.key}
            href={choice.href}
            replace
            scroll={false}
            prefetch={false}
            className={`lang-tab${choice.active ? ' active' : ''}`}
            aria-current={choice.active ? 'true' : undefined}
          >
            {langName(choice.key)}
          </Link>
        ))}
      </div>
    ) : (
      <label className="reading-select">
        <span>{t('read_as')}</span>
        <select
          value={choices.find((choice) => choice.active)?.key ?? ORIGINAL}
          onChange={(e) => {
            const next = choices.find((choice) => choice.key === e.target.value);
            if (next) router.replace(next.href, { scroll: false });
          }}
        >
          {choices.map((choice) => (
            <option key={choice.key} value={choice.key}>
              {langName(choice.key)}
            </option>
          ))}
        </select>
      </label>
    ));

  return (
    <div className="reading" id="text" tabIndex={-1}>
      <div
        className={`reading-toolbar${
          translation
            ? ' reading-toolbar--wide'
            : !control
              ? ' reading-toolbar--solo'
              : isPoem && originalDir === 'rtl'
                ? ' reading-toolbar--verse'
                : ''
        }`}
      >
        {control || <span />}
        <AppearancePopover prefs={prefs} onUpdate={updatePrefs} isPoem={isPoem} />
      </div>

      {!isPoem && <ReadingProgress slug={slug} workId={workId} targetId={textId} dir={originalDir} pagination={pagination} />}

      {!isPoem && sections.length >= MIN_SECTIONS && (
        <details className="reading-contents">
          <summary>{t('contents')}</summary>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                {section.href ? (
                  <Link prefetch={false} href={section.href}>{section.text}</Link>
                ) : (
                  <a href={`#${section.id}`}>{section.text}</a>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}

      {pagination && <Pager place="top" {...pagination} />}

      {versions.length > 1 && translation && (
        <div className="lang-tabs lang-tabs--versions" role="group" aria-label={t('version_label')}>
          {versions.map((tr, i) => (
            <Link
              key={tr.id}
              href={tr.href}
              replace
              scroll={false}
              prefetch={false}
              className={`lang-tab${tr.active ? ' active' : ''}`}
              aria-current={tr.active ? 'true' : undefined}
            >
              {versionLabel(tr, i)}
            </Link>
          ))}
        </div>
      )}

      {translation && translationAttrs ? (
        <div
          className={`parallel${foldClass}`}
          style={{ ...readingVars, ...foldVars }}
          id={textId}
          ref={textRef}
          tabIndex={foldable || !isPoem ? -1 : undefined}
          {...numberAttrs}
        >
          <div className="parallel-row parallel-head" aria-hidden="true">
            {/* Each head sits on its column's start edge: the right for Persian */}
            <p className="lang-label" dir={originalDir}>
              {langName(originalLang === 'AZ_ARABIC' && originalTag.endsWith('-Latn') ? 'AZ_LATIN' : originalLang)} · {t('original_suffix')}
            </p>
            <p className="lang-label" dir={translationAttrs.dir}>{langName(translation.language)}</p>
          </div>
          {rows ? (
            rows.map(([orig, trans], i) => (
              <div className="parallel-row" key={i}>
                <div className={`${columnClass} parallel-cell`} {...proseAttrs} {...originalAttrs} dangerouslySetInnerHTML={{ __html: orig }} />
                <div className={`${columnClass} parallel-cell`} {...proseAttrs} {...translationAttrs} dangerouslySetInnerHTML={{ __html: trans }} />
              </div>
            ))
          ) : (
            <div className="parallel-row parallel-row--whole">
              <div className={`${columnClass} parallel-cell`} {...proseAttrs} {...originalAttrs} dangerouslySetInnerHTML={{ __html: body }} />
              <div className={`${columnClass} parallel-cell`} {...proseAttrs} {...translationAttrs} dangerouslySetInnerHTML={{ __html: translationHtml }} />
            </div>
          )}
        </div>
      ) : (
        <div
          className={`${columnClass}${foldClass}`}
          style={{ ...readingVars, ...foldVars }}
          id={textId}
          ref={textRef}
          tabIndex={foldable || !isPoem ? -1 : undefined}
          {...numberAttrs}
          {...proseAttrs}
          {...originalAttrs}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}

      {folded && (
        <div className="unfold">
          <button type="button" className="unfold-btn" onClick={unfold} aria-expanded={false} aria-controls={textId}>
            {t('read_on')}
          </button>
        </div>
      )}

      {pagination && <Pager place="bottom" {...pagination} />}


      <footer className="provenance">
        <p>
          <span className="provenance-key">{translation ? t('original_text') : t('source')}</span>
          {source ? (
            <>
              {source.href ? (
                <a href={source.href} target="_blank" rel="noopener noreferrer">
                  {source.label}
                  <span aria-hidden="true"> ↗</span>
                  <span className="sr-only"> {t('new_tab')}</span>
                </a>
              ) : (
                <span>{source.label}</span>
              )}
              {source.license && <span className="provenance-meta">{source.license}</span>}
            </>
          ) : (
            <span className="provenance-missing">{t('source_missing')}</span>
          )}
        </p>
        {translation?.translator && (
          <p>
            <span className="provenance-key">{t('translator')}</span>
            <span>
              {translation.translator}
              {translation.year && `, ${translation.year}`}
            </span>
            {translationSource?.href && (
              <span className="provenance-meta">
                <a href={translationSource.href} target="_blank" rel="noopener noreferrer">
                  {translationSource.label}
                  <span aria-hidden="true"> ↗</span>
                  <span className="sr-only"> {t('new_tab')}</span>
                </a>
              </span>
            )}
          </p>
        )}
        {translation?.translatorNote && (
          <p>
            <span className="provenance-key">{t('translator_note')}</span>
            <span dir="auto">{translation.translatorNote}</span>
          </p>
        )}
        <p className="provenance-cta">
          {!translated && <span>{t('no_translation')} </span>}
          <Link prefetch={false} href={suggestHref}>
            {translated ? t('no_translation_cta') : `${t('no_translation_cta')} →`}
          </Link>
        </p>
      </footer>
    </div>
  );
}
