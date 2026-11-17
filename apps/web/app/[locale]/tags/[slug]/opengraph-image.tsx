import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import { ogCard, ogContentType, ogSize } from '@/lib/og';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = 'Kitabxana.az';

/** A theme, mood or era: its name and size, with the authors who wrote most under it */
export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'tags' });
  const tag = await api.getTag(slug);
  const authors = [...tag.authors].sort((a, b) => b.works - a.works).slice(0, 3);

  return ogCard({
    eyebrow: t(`kind_${tag.kind}` as any),
    title: localized(tag, 'name', locale) ?? tag.nameAz,
    subtitle: t('works_count', { count: tag.works }),
    lines: authors.map((a) => localized(a, 'name', locale) ?? a.nameAz),
  });
}
