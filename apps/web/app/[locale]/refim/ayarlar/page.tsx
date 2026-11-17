import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';
import { SettingsPage } from '@/components/account/SettingsPage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings' });
  return pageMetadata({ locale, path: '/refim/ayarlar', title: t('title'), images: false, noindex: true });
}

export default async function Settings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings' });
  return (
    <div className="container page-content settings-page">
      <header className="page-header page-header--start">
        <h1>{t('title')}</h1>
      </header>
      <SettingsPage />
    </div>
  );
}
