import { getTranslations } from 'next-intl/server';

export interface BioSource {
  /** Wikipedia language edition the text comes from */
  wiki: 'az' | 'ru' | 'en';
  /** Article title in that edition */
  title: string;
}

const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

/** The credit a bio from Wikipedia needs (CC BY-SA): the article, and whether it is a translation */
export async function BioCredit({ sources, locale }: { sources: unknown; locale: string }) {
  const source = (sources as Record<string, BioSource> | null)?.[locale];
  if (!source?.wiki || !source.title) return null;
  const t = await getTranslations({ locale, namespace: 'authors' });
  const href = `https://${source.wiki}.wikipedia.org/wiki/${encodeURIComponent(source.title.replace(/ /g, '_'))}`;
  const link = (chunks: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" hrefLang={source.wiki}>
      {chunks}
    </a>
  );
  const text =
    source.wiki === locale
      ? t('bio_from_wikipedia', { title: source.title })
      : t('bio_translated_from', { title: source.title, wiki: t(`wiki_${source.wiki}` as any) });

  return (
    <p className="bio-credit">
      {link(text)} ·{' '}
      <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer license">
        {t('bio_license')}
      </a>
    </p>
  );
}
