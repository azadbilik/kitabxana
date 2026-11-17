import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import { plainLines } from '@/lib/seo';
import { ogCard, ogContentType, ogSize, portraitData } from '@/lib/og';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = 'Kitabxana.az';

/** A book or cycle: its title, author and size, with its description or first works below */
export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'tags' });
  const collection = (await api.getCollection(slug)) as any;
  const author = (await api.getAuthor(collection.author.slug).catch(() => null)) as any;
  const description = plainLines(localized(collection, 'description', locale)).join(' ').split(/(?<=\.)\s/)[0];
  const year = collection.year ? `${collection.yearApprox ? '~' : ''}${collection.year}` : null;

  return ogCard({
    eyebrow: t('works_count', { count: collection.works.length }),
    title: localized(collection, 'title', locale) ?? collection.titleAz,
    subtitle: [localized(collection.author, 'name', locale), year].filter(Boolean).join(' · '),
    lines: description
      ? [description]
      : collection.works.slice(0, 3).map((w: any) => localized(w, 'title', locale) ?? w.titleAz),
    portrait: await portraitData(author?.portraitUrl),
  });
}
