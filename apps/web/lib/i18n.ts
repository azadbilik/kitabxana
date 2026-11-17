export const locales = ['az', 'ru', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'az';

/**
 * A locale-less path (`/works/foo`) in a locale. Azerbaijani, the default, has no prefix:
 * `/works/foo`, `/ru/works/foo`. The home page is `/` or `/ru`.
 */
export function localePath(locale: string, path = ''): string {
  if (locale === defaultLocale) return path || '/';
  return `/${locale}${path}`;
}

/** `/ru/works/foo` → ru + `/works/foo`; a path without a locale prefix is Azerbaijani */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const m = pathname.match(/^\/([a-z]{2})(?=\/|$)/);
  if (m && (locales as readonly string[]).includes(m[1])) {
    return { locale: m[1] as Locale, path: pathname.slice(3) };
  }
  return { locale: defaultLocale, path: pathname };
}
