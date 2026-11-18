import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SkipLink } from '@/components/layout/SkipLink';
import { OfflineReading } from '@/components/layout/OfflineReading';
import { AccountProvider } from '@/components/account/AccountProvider';
import { api } from '@/lib/api';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });

  return {
    title: { default: t('title'), template: '%s | Kitabxana.az' },
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: 'nav' });
  // Whether sign-in can complete at all: without a mail key or Google, the entry is hidden
  const providers = await api.getAuthProviders().catch(() => null);

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <AccountProvider providers={providers}>
        <SkipLink label={t('skip')} />
        <Header />
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer />
        <OfflineReading />
      </AccountProvider>
    </NextIntlClientProvider>
  );
}
