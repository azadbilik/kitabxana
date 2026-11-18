import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CENTURIES } from '@irs-az/shared';
import { authorsPath, type AuthorFilters as Filters } from '@/lib/facets';
import { centuryLabel, getLabels } from '@/lib/labels';

interface Props {
  locale: string;
  current: Filters;
  /** Query the filter links keep (who is shown, the order); the letter and page start over */
  keep?: Record<string, string | undefined>;
}

const TYPES = ['POET', 'WRITER', 'PHILOSOPHER', 'PLAYWRIGHT'];

/** Kind of author, then century: the same pills, in the same size, as the books page filters */
export async function AuthorFilters({ locale, current, keep }: Props) {
  const t = await getTranslations({ locale, namespace: 'authors' });
  const labels = await getLabels(locale);
  return (
    <div className="filter-bar author-filters">
      <div className="chip-row" role="group" aria-label={t('type_label')}>
        {TYPES.map((type) => (
          <Link
            key={type}
            href={authorsPath(locale, { ...current, type: current.type === type ? undefined : type }, keep)}
            className={`pill ${current.type === type ? 'active' : ''}`}
            aria-current={current.type === type ? 'true' : undefined}
            prefetch={false}
          >
            {labels.authorType(type)}
          </Link>
        ))}
      </div>

      <div className="chip-row" role="group" aria-label={t('century_label')}>
        {CENTURIES.filter((c) => c.value >= 12 && c.value <= 21).map((c) => (
          <Link
            key={c.value}
            href={authorsPath(locale, { ...current, century: current.century === c.value ? undefined : c.value }, keep)}
            className={`pill pill--century ${current.century === c.value ? 'active' : ''}`}
            aria-current={current.century === c.value ? 'true' : undefined}
            prefetch={false}
          >
            {centuryLabel(c.value, locale)}
          </Link>
        ))}
      </div>
    </div>
  );
}
