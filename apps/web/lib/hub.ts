/**
 * Links into the rest of Azad Bilik (azadbilik.org), whose pages take the reader's language
 * as ?lang= (Azerbaijani is their default). The author page's map link is in literary-map.ts.
 */
const GALLERY_URL = 'https://azadbilik.org/qalereya/';

/** Poems with their own tab in the gallery (its scripts/build.mjs: a poem with more than one picture) */
const GALLERY_POEMS = new Set([
  'nizami-mexzenul-esrar',
  'nizami-xosrov-va-sirin',
  'nizami-leyli-va-macnun',
  'nizami-heft-peyker',
  'nizami-serefname',
  'nizami-xerednama',
  'fuzuli-leyli-ve-mecnun',
]);

/** The gallery opened on this poem, its miniatures scene by scene; null for a poem it lacks */
export function galleryPoemHref(slug: string, locale: string): string | null {
  if (!GALLERY_POEMS.has(slug)) return null;
  const q = new URLSearchParams({ p: slug });
  if (locale !== 'az') q.set('lang', locale);
  return `${GALLERY_URL}?${q}`;
}
