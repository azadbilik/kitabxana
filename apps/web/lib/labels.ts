import { getTranslations } from 'next-intl/server';
import { CENTURIES } from '@irs-az/shared';

/**
 * The database's enums (author type, genre, poem form, language) in the reader's language.
 * One place for every catalogue page; the words themselves live in the message files
 * (`contribute.options`, shared with the contribute form, and `labels`). Server components only.
 */

const AUTHOR_TYPES = ['POET', 'WRITER', 'PLAYWRIGHT', 'PHILOSOPHER', 'CRITIC', 'FOLK'];
const GENRES = ['POEM', 'PROSE', 'PLAY', 'ESSAY', 'PHILOSOPHY', 'LETTER', 'MEMOIR'];
const FORMS = ['GHAZAL', 'MASNAVI', 'RUBAI', 'QASIDA', 'MURABBA', 'FREE_VERSE', 'OTHER'];
const LANGS = ['AZ_LATIN', 'AZ_ARABIC', 'AZ_CYRILLIC', 'FA', 'AR', 'RU', 'TR', 'EN'];

export interface Labels {
  authorType: (type: string | null | undefined) => string | null;
  genre: (genre: string | null | undefined) => string | null;
  form: (form: string | null | undefined) => string | null;
  /** A work's poem form where it names one, else its genre: "Qəzəl", "Nəsr" */
  kind: (work: { form?: string | null; genre?: string | null }) => string | null;
  /** "Farsca" */
  lang: (lang: string | null | undefined) => string | null;
  /** As a fact about a book: "На персидском", "In Persian" */
  langIn: (lang: string | null | undefined) => string | null;
  /** "1494 — 1556"; with one year only "d. 1907" or "ö. 1766", never a dangling dash */
  lifeYears: (a: LifeYears) => string | null;
  noResults: string;
}

interface LifeYears {
  bornYear?: number | null;
  diedYear?: number | null;
  bornYearApprox?: boolean;
  diedYearApprox?: boolean;
}

export async function getLabels(locale: string): Promise<Labels> {
  const [options, labels, authors] = await Promise.all([
    getTranslations({ locale, namespace: 'contribute.options' }),
    getTranslations({ locale, namespace: 'labels' }),
    getTranslations({ locale, namespace: 'authors' }),
  ]);
  // An enum value the messages don't know yet is left out rather than printed raw
  const pick = (known: string[], t: (key: any) => string, group: string) => (value: string | null | undefined) =>
    value && known.includes(value) ? t(`${group}.${value}`) : null;

  const genre = pick(GENRES, options, 'genre');
  const form = pick(FORMS, options, 'form');
  return {
    authorType: pick(AUTHOR_TYPES, options, 'atype'),
    genre,
    form,
    kind: (work) => (work.form && work.form !== 'OTHER' ? form(work.form) : null) ?? genre(work.genre),
    lang: pick(LANGS, labels, 'lang'),
    langIn: pick(LANGS, labels, 'lang_in'),
    lifeYears: (a) => {
      const born = a.bornYear ? `${a.bornYearApprox ? '~' : ''}${a.bornYear}` : null;
      const died = a.diedYear ? `${a.diedYearApprox ? '~' : ''}${a.diedYear}` : null;
      if (born && died) return `${born} — ${died}`;
      if (born) return `${authors('born')} ${born}`;
      if (died) return `${authors('died')} ${died}`;
      return null;
    },
    noResults: labels('no_results'),
  };
}

/** "XII əsr", "XII век", "12th c." for a century number the filters know (12–21); the number otherwise */
export function centuryLabel(century: number, locale: string): string {
  const c = CENTURIES.find((x) => x.value === century);
  if (!c) return String(century);
  return locale === 'ru' ? c.labelRu : locale === 'en' ? c.labelEn : c.labelAz;
}

/**
 * A part's title as a book's contents show it. Many imported works repeat the book's title
 * ("Leyli və Məcnun, fəsil 20", "Rübai 12" in «Rübai»), which makes a contents list a column
 * of the same words: the repeated title is dropped ("Fəsil 20", "№ 12"). Display only — the
 * stored title and the slug stay as they are. Null when the title does not repeat the book's.
 */
export function partTitle(
  workTitle: string,
  bookTitle: string,
  locale: string,
  numbered: (n: string) => string,
): string | null {
  if (!bookTitle || workTitle.length <= bookTitle.length || !workTitle.startsWith(bookTitle)) return null;
  const rest = workTitle.slice(bookTitle.length);
  const number = rest.match(/^,?\s+(\d+)$/);
  if (number) return numbered(number[1]);
  const named = rest.match(/^,\s+(\S.*)$/) ?? rest.match(/^\s+\((\S.*)\)$/);
  if (!named) return null;
  const text = named[1];
  // Azerbaijani capitalises i as İ: "ikinci hissə" → "İkinci hissə"
  return text.charAt(0).toLocaleUpperCase(locale === 'az' ? 'az' : locale) + text.slice(1);
}
