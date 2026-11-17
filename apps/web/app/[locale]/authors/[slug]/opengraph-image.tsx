import { api } from '@/lib/api';
import { localized, ownField, periodLabel } from '@/lib/locale';
import { plainLines, yearRange } from '@/lib/seo';
import { ogCard, ogContentType, ogSize, portraitData } from '@/lib/og';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = 'Kitabxana.az';

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const author = (await api.getAuthor(slug)) as any;
  const firstSentence = plainLines(ownField(author, 'bio', locale)).join(' ').split(/(?<=\.)\s/)[0];

  return ogCard({
    eyebrow: periodLabel(author.period, locale) ?? undefined,
    title: localized(author, 'name', locale) ?? author.nameAz,
    subtitle: yearRange(author.bornYear, author.diedYear),
    lines: firstSentence ? [firstSentence] : [],
    portrait: await portraitData(author.portraitUrl),
  });
}
