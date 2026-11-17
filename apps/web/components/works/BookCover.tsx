import { isArabicScript } from '@/lib/verse';

/**
 * A generated cover: no images, just the author, the title in the book serif and the kind,
 * on one of six cloth colours with a small blind-stamped motif. Colour and motif come from
 * the book's own id, so one author's books differ and a shelf never reads as a wall of
 * one colour; on a shelf, `clothSequence` also keeps two neighbours from sharing a cloth.
 */
const CLOTHS = ['red', 'navy', 'green', 'plum', 'sand', 'ochre'] as const;
export type Cloth = (typeof CLOTHS)[number];

/** Motifs stamped between the author and the title */
const MOTIFS = ['rule', 'dots', 'star', 'arch'] as const;

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  // Spread the low bits, so seeds that differ only at the end still land on different cloths
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function clothFor(seed: string): Cloth {
  return CLOTHS[hash(seed) % CLOTHS.length];
}

/** Cloths for a row of books: each book's own, moved on one step where it would match the book before it */
export function clothSequence(seeds: string[]): Cloth[] {
  const out: Cloth[] = [];
  for (const seed of seeds) {
    let i = CLOTHS.indexOf(clothFor(seed));
    if (out.length && CLOTHS[i] === out[out.length - 1]) i = (i + 1) % CLOTHS.length;
    out.push(CLOTHS[i]);
  }
  return out;
}

function Motif({ kind }: { kind: (typeof MOTIFS)[number] }) {
  const common = { className: 'book-cover-motif', 'aria-hidden': true, viewBox: '0 0 48 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 } as const;
  switch (kind) {
    case 'rule':
      return <svg {...common}><path d="M2 6h44" /></svg>;
    case 'dots':
      return <svg {...common}><g fill="currentColor" stroke="none"><circle cx="16" cy="6" r="1.6" /><circle cx="24" cy="6" r="1.6" /><circle cx="32" cy="6" r="1.6" /></g></svg>;
    case 'star':
      // The eight-pointed star of Azerbaijani ornament, between two short rules
      return (
        <svg {...common}>
          <path d="M2 6h14M32 6h14" />
          <g fill="currentColor" stroke="none">
            <rect x="20.5" y="2.5" width="7" height="7" />
            <rect x="20.5" y="2.5" width="7" height="7" transform="rotate(45 24 6)" />
          </g>
        </svg>
      );
    case 'arch':
      return <svg {...common}><path d="M8 10.5h32M14 10.5V7a10 5.5 0 0 1 20 0v3.5" /></svg>;
  }
}

/**
 * Title size in container units (% of the cover's content width): small enough that the
 * whole title fits in six lines and its longest word fits one line, so no word is ever split.
 * A bold Literata letter is about 0.6em wide.
 */
function titleSize(title: string): number {
  const len = title.length;
  const byLength = len <= 14 ? 18 : len <= 24 ? 15.5 : len <= 40 ? 13 : 11;
  const longest = Math.max(...title.split(/[\s\-–—/]+/).map((w) => w.length), 1);
  const byWord = 96 / (longest * 0.6);
  return Math.round(Math.min(byLength, byWord) * 10) / 10;
}

interface Props {
  title: string;
  author: string;
  /** "Roman", "Şeir"…: set at the foot of the cover */
  kind?: string;
  /** The book's id: picks the cloth and the motif */
  seed: string;
  /** A cloth already chosen for this place on a shelf (see clothSequence) */
  cloth?: Cloth;
  size?: 'sm' | 'md' | 'lg';
}

export function BookCover({ title, author, kind, seed, cloth, size = 'md' }: Props) {
  const arabic = isArabicScript(title);
  const motif = MOTIFS[(hash(seed) >>> 8) % MOTIFS.length];
  return (
    <div className={`book-cover book-cover--${size} cloth-${cloth ?? clothFor(seed)}`} aria-hidden="true">
      <span className="book-cover-author">{author}</span>
      <span className="book-cover-body">
        <Motif kind={motif} />
        <span
          className="book-cover-title"
          style={{ '--title-size': `${titleSize(title)}cqi` } as React.CSSProperties}
          {...(arabic && { lang: 'fa', dir: 'rtl' })}
        >
          {title}
        </span>
      </span>
      {kind && <span className="book-cover-kind">{kind}</span>}
    </div>
  );
}
