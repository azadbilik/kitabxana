'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Props {
  page: number;
  pages: number;
  /** 'top': where the reader is; 'bottom': turn the page, or jump to any */
  place: 'top' | 'bottom';
}

/** Page numbers to show: the first, the last, and two either side of the current one */
function visible(page: number, pages: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 2) out.push(n);
    else if (out.at(-1) !== null) out.push(null);
  }
  return out;
}

/** Reading pages of a long prose text, LitRes-style: `?p=N`, landing on the text itself */
export function Pager({ page, pages, place }: Props) {
  const t = useTranslations('reading');
  const params = useSearchParams();
  const pathname = usePathname();

  const href = (n: number) => {
    const next = new URLSearchParams(params.toString());
    if (n > 1) next.set('p', String(n));
    else next.delete('p');
    const query = next.toString();
    return `${pathname}${query ? `?${query}` : ''}#text`;
  };
  const percent = Math.round(((page - 1) / pages) * 100);

  if (place === 'top') {
    return (
      <p className="pager-status">
        {t('page_of', { n: page, total: pages })}
        {page > 1 && <span className="pager-percent"> · {percent}%</span>}
      </p>
    );
  }

  return (
    <nav className="pager" aria-label={t('pages_label')}>
      {page < pages && (
        <Link className="pager-next" href={href(page + 1)} rel="next">
          {t('next_page')} <span aria-hidden="true">→</span>
        </Link>
      )}
      <div className="pager-numbers">
        {page > 1 ? (
          <Link className="pager-step" href={href(page - 1)} rel="prev" aria-label={t('prev_page')}>←</Link>
        ) : (
          <span className="pager-step" aria-hidden="true" />
        )}
        {visible(page, pages).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">…</span>
          ) : n === page ? (
            <span key={n} className="pager-num active" aria-current="page">{n}</span>
          ) : (
            <Link
              key={n}
              // Two away from the current page: dropped on a phone, so the row fits one line
              className={`pager-num${Math.abs(n - page) === 2 && n !== 1 && n !== pages ? ' pager-num--far' : ''}`}
              href={href(n)}
              aria-label={t('page_n', { n })}
            >
              {n}
            </Link>
          ),
        )}
        {page < pages ? (
          <Link className="pager-step" href={href(page + 1)} aria-label={t('next_page')}>→</Link>
        ) : (
          <span className="pager-step" aria-hidden="true" />
        )}
      </div>
    </nav>
  );
}
