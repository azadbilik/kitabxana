'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { localePath } from '@/lib/i18n';

/** The imprint line: the masthead again, what the site is, and where to write */
export function Footer() {
  const t = useTranslations('site');
  const nav = useTranslations('nav');
  const locale = useLocale();

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <Link href={localePath(locale)} className="footer-mark">
          Kitabxana<span className="logo-orn" aria-hidden="true">◆</span><em>AZ</em>
        </Link>
        <p className="footer-text">{t('description')}</p>
        <nav className="footer-links" aria-label={t('name')}>
          <Link href={localePath(locale, `/about`)}>{nav('about')}</Link>
          <Link href={localePath(locale, `/contribute`)}>{nav('contribute')}</Link>
          <Link href={localePath(locale, `/contact`)}>{nav('contact')}</Link>
          <Link href={localePath(locale, `/privacy`)}>{nav('privacy')}</Link>
        </nav>
      </div>
    </footer>
  );
}
