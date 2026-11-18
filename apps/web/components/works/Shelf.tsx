import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookCover, clothSequence, isGenericTitle, type Cloth } from './BookCover';
import { scriptAttrs } from '@/lib/script';

export interface ShelfBook {
  href: string;
  title: string;
  author: string;
  /** The book's id: picks the cover colour and motif */
  seed: string;
  kind?: string;
  /** A muted line under the author ("9 hissə", "Oxunur · 42%") */
  note?: ReactNode;
  /** The book's original language, for a title in Arabic script */
  originalLang?: string | null;
}

interface ItemProps {
  book: ShelfBook;
  cloth?: Cloth;
  /** The shelf holds one author's books: the name is left out under each, and generic titles stay titles */
  sameAuthor?: boolean;
}

/**
 * A book as it sits on a shelf: cover, then title and author beneath. A book with a generic
 * title («Şeirlər») is known by its author, so the name leads on the cover and under it.
 */
export function ShelfItem({ book, cloth, sameAuthor = false }: ItemProps) {
  const byAuthor = !sameAuthor && Boolean(book.author) && isGenericTitle(book.title);
  const title = <span {...scriptAttrs(book.title, book.originalLang)}>{book.title}</span>;
  return (
    <Link prefetch={false} href={book.href} className="shelf-item">
      <BookCover
        title={book.title}
        author={book.author}
        kind={book.kind}
        seed={book.seed}
        cloth={cloth}
        originalLang={book.originalLang}
        sameAuthor={sameAuthor}
      />
      <span className="shelf-item-title">{byAuthor ? book.author : title}</span>
      {!sameAuthor && <span className="shelf-item-author">{byAuthor ? title : book.author}</span>}
      {book.note && <span className="shelf-item-note">{book.note}</span>}
    </Link>
  );
}

interface Props {
  title: string;
  /** "Hamısı": the full list behind the shelf */
  more?: { href: string; label: string };
  books: ShelfBook[];
  /** One row that scrolls sideways on narrow screens, instead of wrapping */
  row?: boolean;
  id?: string;
  /** Every book is by one author (an author's page, "more by the author") */
  sameAuthor?: boolean;
}

export function Shelf({ title, more, books, row = false, id, sameAuthor = false }: Props) {
  if (!books.length) return null;
  const headingId = id ? `${id}-title` : undefined;
  const cloths = clothSequence(books.map((b) => b.seed));
  return (
    <section className="shelf" aria-labelledby={headingId} id={id}>
      <div className="shelf-head">
        <h2 className="shelf-title" id={headingId}>{title}</h2>
        {more && <Link prefetch={false} href={more.href} className="shelf-more">{more.label}</Link>}
      </div>
      <ul className={row ? 'shelf-grid shelf-grid--row' : 'shelf-grid'}>
        {books.map((b, i) => (
          <li key={b.href}><ShelfItem book={b} cloth={cloths[i]} sameAuthor={sameAuthor} /></li>
        ))}
      </ul>
    </section>
  );
}
