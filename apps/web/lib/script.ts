import { isArabicScript, langTag } from './verse';

/**
 * `lang` and `dir` for a title or line that may be in Arabic script. The language comes from
 * the work's or book's original language (Persian, Arabic, or Azerbaijani in the old alphabet);
 * Arabic-script text of anything else is taken for Persian. Latin and Cyrillic text gets nothing:
 * it is in the page's own language.
 */
export function scriptAttrs(text: string | null | undefined, originalLang?: string | null): { lang?: string; dir?: 'rtl' } {
  if (!isArabicScript(text)) return {};
  const lang = originalLang && ['AZ_ARABIC', 'FA', 'AR'].includes(originalLang) ? langTag[originalLang] : 'fa';
  return { lang, dir: 'rtl' };
}

/**
 * `lang` and `dir` for a line of text stored under a Language enum value. Some imports are
 * tagged Arabic-script but hold a Latin transliteration, so the tag follows the script
 * actually present.
 */
export function textAttrs(text: string, language: string): { lang?: string; dir: 'rtl' | 'ltr' } {
  const arabic = isArabicScript(text);
  const tag = langTag[language];
  const lang = !arabic && ['AZ_ARABIC', 'FA', 'AR'].includes(language) ? `${tag.split('-')[0]}-Latn` : tag;
  return { lang, dir: arabic ? 'rtl' : 'ltr' };
}
