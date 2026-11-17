import type { BookSummary } from './api';
import type { ShelfBook } from '@/components/works/Shelf';
import { localized } from './locale';
import { localePath } from './i18n';

/** Books on Russian and English pages are only those with a title in that language */
export function titledIn(locale: string): 'ru' | 'en' | undefined {
  return locale === 'ru' || locale === 'en' ? locale : undefined;
}

/** A collection from GET /collections as a shelf item */
export function shelfBook(
  book: BookSummary,
  locale: string,
  { kind, note }: { kind?: (genre: string) => string; note?: (book: BookSummary) => string } = {},
): ShelfBook {
  return {
    href: localePath(locale, `/collections/${book.slug}`),
    title: localized(book, 'title', locale) ?? book.titleAz,
    author: localized(book.author, 'name', locale) ?? book.author.nameAz,
    seed: book.author.slug,
    kind: kind?.(book.genre),
    note: note?.(book),
  };
}
