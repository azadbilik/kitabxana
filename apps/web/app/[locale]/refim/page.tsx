import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';
import { ShelfPage } from '@/components/library/ShelfPage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'library' });
  return pageMetadata({ locale, path: '/refim', title: t('shelf_title'), images: false, noindex: true });
}

/** The reader's shelf. The HTML is the same for everyone; the shelf itself loads in the browser. */
export default async function Shelf({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'library' });
  return (
    <div className="container page-content shelf-page">
      <header className="page-header page-header--start">
        <h1>{t('shelf_title')}</h1>
      </header>
      <ShelfPage />
    </div>
  );
}
