/** Pick the right localized field: en → En || Az, ru → Ru || Az, else → Az */
export function localized<T extends Record<string, any>>(
  item: T,
  field: string,
  locale: string,
): string | null {
  if (locale === 'en') return item[`${field}En`] || item[`${field}Az`] || null;
  if (locale === 'ru') return item[`${field}Ru`] || item[`${field}Az`] || null;
  return item[`${field}Az`] || null;
}

/** A localized field in exactly this language, with no fallback to Azerbaijani */
export function ownField(item: Record<string, any>, field: string, locale: string): string | null {
  const suffix = locale === 'ru' ? 'Ru' : locale === 'en' ? 'En' : 'Az';
  return item[`${field}${suffix}`] || null;
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };

function fromRoman(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]];
    n += v < (ROMAN[s[i + 1]] ?? 0) ? -v : v;
  }
  return n;
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/**
 * An author's period, stored in Azerbaijani ("XVI əsr", "XIX-XX əsr", "Xalq yaradıcılığı"),
 * in the reader's language: "XVI век", "XIX–XX вв.", "16th century", "19th–20th centuries".
 * Anything else is shown as stored.
 */
export function periodLabel(period: string | null | undefined, locale: string): string | null {
  if (!period) return null;
  if (locale === 'az') return period;
  if (/^xalq yaradıcılığı$/i.test(period.trim())) return locale === 'ru' ? 'Народное творчество' : 'Folk tradition';
  const m = period.trim().match(/^([IVXL]+)(?:\s*[-–—]\s*([IVXL]+))?\s*əsr(?:lər)?$/);
  if (!m) return period;
  const [, from, to] = m;
  if (locale === 'ru') return to ? `${from}–${to} вв.` : `${from} век`;
  return to
    ? `${ordinal(fromRoman(from))}–${ordinal(fromRoman(to))} centuries`
    : `${ordinal(fromRoman(from))} century`;
}
