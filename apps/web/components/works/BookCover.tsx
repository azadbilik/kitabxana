import { isArabicScript } from '@/lib/verse';

/**
 * A generated cover: no images, just the author, the title in the book serif and the kind,
 * on one of six cloth colours. The colour comes from the author's slug, so every book by one
 * author shares it and a shelf reads as a row of different authors.
 */
const CLOTHS = ['red', 'navy', 'green', 'plum', 'sand', 'ochre'] as const;

export function clothFor(seed: string): (typeof CLOTHS)[number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CLOTHS[h % CLOTHS.length];
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
  /** Usually the author's slug */
  seed: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BookCover({ title, author, kind, seed, size = 'md' }: Props) {
  const arabic = isArabicScript(title);
  return (
    <div className={`book-cover book-cover--${size} cloth-${clothFor(seed)}`} aria-hidden="true">
      <span className="book-cover-author">{author}</span>
      <span
        className="book-cover-title"
        style={{ '--title-size': `${titleSize(title)}cqi` } as React.CSSProperties}
        {...(arabic && { lang: 'fa', dir: 'rtl' })}
      >
        {title}
      </span>
      {kind && <span className="book-cover-kind">{kind}</span>}
    </div>
  );
}
