const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface DailyPost {
  title: string;
  author: string;
  lines: string[];
  url: string;
}

/** Telegram's limit for one message is 4096 characters; a few long lines stay well under this */
const MAX_LINE = 300;

/**
 * The poem of the day as a Telegram message (parse_mode HTML): title, poet, the opening
 * lines, and a link to read on. Text from the library is escaped; the URL goes in an
 * attribute, so quotes are escaped there too.
 */
export function formatDailyPoem({ title, author, lines, url }: DailyPost): string {
  const verse = lines.map((l) => escapeHtml(l.length > MAX_LINE ? `${l.slice(0, MAX_LINE)}…` : l)).join('\n');
  return [
    `<b>${escapeHtml(title)}</b>`,
    `<i>${escapeHtml(author)}</i>`,
    '',
    `${verse}\n…`,
    '',
    `<a href="${escapeHtml(url).replace(/"/g, '&quot;')}">Davamını Kitabxana.az-da oxuyun</a>`,
  ].join('\n');
}

/** The hour (0–23) in Baku right now */
export function bakuHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baku', hour: '2-digit', hourCycle: 'h23' }).format(now));
}
