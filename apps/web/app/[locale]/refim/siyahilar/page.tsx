import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';
import { ListsPage } from '@/components/library/ListsPage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'lists' });
  return pageMetadata({ locale, path: '/refim/siyahilar', title: t('title'), images: false, noindex: true });
}

/** The reader's lists; the same HTML for everyone, filled in the browser */
export default async function Lists({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'lists' });
  return (
    <div className="container page-content shelf-page">
      <header className="page-header page-header--start">
        <h1>{t('title')}</h1>
      </header>
      <ListsPage />
    </div>
  );
}
