/**
 * The UI locales in which a work page has text of its own, for the sitemap and hreflang.
 * Azerbaijani is the site's language and always counts. Russian and English count only
 * when the original is in that language or a published translation into it exists;
 * otherwise those pages repeat the original under translated chrome, so search engines
 * are not pointed at them.
 */
export function workLocales(originalLang: string, translationLangs: Iterable<string>): ('az' | 'ru' | 'en')[] {
  const langs = new Set([originalLang, ...translationLangs]);
  return ['az', ...(langs.has('RU') ? ['ru' as const] : []), ...(langs.has('EN') ? ['en' as const] : [])] as (
    | 'az'
    | 'ru'
    | 'en'
  )[];
}
