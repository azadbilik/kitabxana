import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookCover, clothSequence, type Cloth } from './BookCover';

export interface ShelfBook {
  href: string;
  title: string;
  author: string;
  /** The book's id: picks the cover colour and motif */
  seed: string;
  kind?: string;
  /** A muted line under the author ("9 hissə", "Oxunur · 42%") */
  note?: ReactNode;
}

/** A book as it sits on a shelf: cover, then title and author beneath */
export function ShelfItem({ book, cloth }: { book: ShelfBook; cloth?: Cloth }) {
  return (
    <Link href={book.href} className="shelf-item">
      <BookCover title={book.title} author={book.author} kind={book.kind} seed={book.seed} cloth={cloth} />
      <span className="shelf-item-title">{book.title}</span>
      <span className="shelf-item-author">{book.author}</span>
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
}

export function Shelf({ title, more, books, row = false, id }: Props) {
  if (!books.length) return null;
  const headingId = id ? `${id}-title` : undefined;
  const cloths = clothSequence(books.map((b) => b.seed));
  return (
    <section className="shelf" aria-labelledby={headingId} id={id}>
      <div className="shelf-head">
        <h2 className="shelf-title" id={headingId}>{title}</h2>
        {more && <Link href={more.href} className="shelf-more">{more.label}</Link>}
      </div>
      <ul className={row ? 'shelf-grid shelf-grid--row' : 'shelf-grid'}>
        {books.map((b, i) => (
          <li key={b.href}><ShelfItem book={b} cloth={cloths[i]} /></li>
        ))}
      </ul>
    </section>
  );
}
