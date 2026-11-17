'use client';

import Link from 'next/link';
import { CENTURIES } from '@irs-az/shared';
import { authorsPath, type AuthorFilters as Filters } from '@/lib/facets';

interface Props {
  locale: string;
  current: Filters;
}

const authorTypes = [
  { value: 'POET', labelAz: 'Şair', labelRu: 'Поэт', labelEn: 'Poet' },
  { value: 'WRITER', labelAz: 'Yazıçı', labelRu: 'Писатель', labelEn: 'Writer' },
  { value: 'PHILOSOPHER', labelAz: 'Filosof', labelRu: 'Философ', labelEn: 'Philosopher' },
  { value: 'PLAYWRIGHT', labelAz: 'Dramaturq', labelRu: 'Драматург', labelEn: 'Playwright' },
];

/** Kind of author, then century: the same pills, in the same size, as the books page filters */
export function AuthorFilters({ locale, current }: Props) {
  return (
    <div className="filter-bar author-filters">
      <div className="chip-row" role="group">
        {authorTypes.map((t) => (
          <Link
            key={t.value}
            href={authorsPath(locale, { ...current, type: current.type === t.value ? undefined : t.value })}
            className={`pill ${current.type === t.value ? 'active' : ''}`}
            aria-current={current.type === t.value ? 'true' : undefined}
          >
            {locale === 'ru' ? t.labelRu : locale === 'en' ? t.labelEn : t.labelAz}
          </Link>
        ))}
      </div>

      <div className="chip-row" role="group">
        {CENTURIES.filter((c) => c.value >= 12 && c.value <= 21).map((c) => (
          <Link
            key={c.value}
            href={authorsPath(locale, { ...current, century: current.century === c.value ? undefined : c.value })}
            className={`pill pill--century ${current.century === c.value ? 'active' : ''}`}
            aria-current={current.century === c.value ? 'true' : undefined}
          >
            {locale === 'ru' ? c.labelRu : locale === 'en' ? c.labelEn : c.labelAz}
          </Link>
        ))}
      </div>
    </div>
  );
}
