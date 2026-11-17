'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { authorsPath, worksPath } from '@/lib/facets';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { AccountMenu } from '@/components/account/AccountMenu';
import { useHideOnScroll } from './useHideOnScroll';
import { localePath } from '@/lib/i18n';

const city: Record<string, string> = { az: 'Bakı', ru: 'Баку', en: 'Baku' };

const datelineSubtitle: Record<string, string> = {
  az: 'Azərbaycan ədəbiyyatı xəzinəsi',
  ru: 'Сокровищница азербайджанской литературы',
  en: 'Treasury of Azerbaijani literature',
};

function formatDate(locale: string): string {
  const dateLocale = locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'ru-RU';
  return new Date().toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: locale === 'az' ? 'numeric' : 'long',
    year: 'numeric',
  });
}

interface NavLink {
  href: string;
  label: string;
  /** Shown only in one skin: the search link is the gazette's, Nar has the search field */
  only?: 'gazette' | 'nar';
}

function NavLinks({ links, pathname }: { links: NavLink[]; pathname: string }) {
  const t = useTranslations('nav');
  // A section is current on its own page and below it (/authors/sairler/esr-12 is still Poets)
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const navRef = useRef<HTMLElement>(null);

  // On a phone the nav is a strip that scrolls sideways: bring the current section into
  // view so it is never cut at the edge. scrollLeft only, so the page itself stays put.
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = current.offsetLeft - nav.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2;
  }, [pathname]);

  return (
    <nav className="site-nav" aria-label={t('menu_label')} ref={navRef}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={link.only ? `only-${link.only}` : undefined}
          prefetch={link.href.endsWith('/random') ? false : undefined}
          aria-current={isActive(link.href) ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/** The header's search field: submits to the search page, which runs the query */
function HeaderSearch({ locale }: { locale: string }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const [q, setQ] = useState('');
  const action = localePath(locale, '/search');

  return (
    <form
      className="header-search"
      role="search"
      action={action}
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        router.push(query ? `${action}?${new URLSearchParams({ q: query })}` : action);
      }}
    >
      <label htmlFor="header-q" className="sr-only">{t('search')}</label>
      <input
        id="header-q"
        name="q"
        type="search"
        className="header-search-input"
        placeholder={t('search_placeholder')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        enterKeyHint="search"
      />
      <button type="submit" className="header-search-btn">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="header-search-btn-label">{t('search_go')}</span>
      </button>
    </form>
  );
}

export function Header() {
  const t = useTranslations('nav');
  // From next-intl, not the route: the root 404 page has no [locale] param
  const locale = useLocale();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const hidden = useHideOnScroll(headerRef);

  const navLinks: NavLink[] = [
    { href: authorsPath(locale, { type: 'POET' }), label: t('poets') },
    { href: authorsPath(locale, { type: 'WRITER' }), label: t('writers') },
    { href: authorsPath(locale, { type: 'PLAYWRIGHT' }), label: t('playwrights'), only: 'nar' },
    { href: authorsPath(locale, { type: 'PHILOSOPHER' }), label: t('philosophers') },
    { href: localePath(locale, `/works`), label: t('works') },
    { href: worksPath(locale, { form: 'GHAZAL' }), label: t('ghazals'), only: 'nar' },
    { href: worksPath(locale, { genre: 'PROSE' }), label: t('prose'), only: 'nar' },
    { href: localePath(locale, `/random`), label: t('random') },
    { href: localePath(locale, `/search`), label: t('search'), only: 'gazette' },
    { href: localePath(locale, `/contribute`), label: t('contribute') },
  ];

  return (
    <header ref={headerRef} className={hidden ? 'site-header is-hidden' : 'site-header'}>
      <div className="header-inner">
        <Link href={localePath(locale)} className="logo">
          Kitabxana<span className="logo-orn" aria-hidden="true">◆</span><em>AZ</em>
        </Link>

        <Link href={localePath(locale, '/collections')} className="catalog-btn">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {t('catalog')}
        </Link>

        <HeaderSearch locale={locale} />

        <NavLinks links={navLinks} pathname={pathname} />

        <div className="header-tools">
          <LanguageSwitcher />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
      <div className="dateline">
        <div className="dateline-inner">
          {formatDate(locale)} &nbsp;·&nbsp; {city[locale] ?? city.az} &nbsp;·&nbsp; {datelineSubtitle[locale] ?? datelineSubtitle.az}
        </div>
      </div>
    </header>
  );
}
