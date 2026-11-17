import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';
import { SignInPage } from '@/components/account/SignInPage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return pageMetadata({ locale, path: '/giris', title: t('title'), description: t('lead'), images: false, noindex: true });
}

export default function SignIn() {
  return (
    <div className="container page-content signin-page">
      <SignInPage />
    </div>
  );
}
