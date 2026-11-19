'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { authorsPath, worksPath } from '@/lib/facets';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SkinToggle } from '@/components/ui/SkinToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { AccountMenu } from '@/components/account/AccountMenu';
import { useHideOnScroll } from './useHideOnScroll';
import { localePath } from '@/lib/i18n';

interface NavLink {
  href: string;
  label: string;
}

function NavLinks({ links, pathname }: { links: NavLink[]; pathname: string }) {
  const t = useTranslations('nav');
  // A section is current on its own page and below it (/authors/sairler/esr-12 is still Poets).
  // Only the most specific match: on /works/forma-qezel that is Ghazals, not Works too.
  const current = links
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const navRef = useRef<HTMLElement>(null);

  // On a phone the nav is a strip that scrolls sideways: bring the current section into
  // view so it is never cut at the edge. scrollLeft only, so the page itself stays put.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);

  return (
    <nav className="site-nav" aria-label={t('menu_label')} ref={navRef}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch={false}
          aria-current={link.href === current ? 'page' : undefined}
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
  // Phones get the short placeholder; the server HTML carries the long one for everyone
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <form
      className="header-search"
      role="search"
      aria-label={t('search')}
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
        placeholder={t(narrow ? 'search_placeholder_short' : 'search_placeholder')}
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

const AZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];

/**
 * The Gazette's dateline under the masthead (hidden in Nar). The date is filled in the browser:
 * the page is edge-cached, and Node's and the browser's date formats differ.
 */
function Dateline({ locale }: { locale: string }) {
  const t = useTranslations('skin');
  const [date, setDate] = useState('');
  useEffect(() => {
    const now = new Date();
    // Browsers ship no Azerbaijani month names (Chrome writes «2026 M11 19»): spelt here
    setDate(locale === 'ru' || locale === 'en'
      ? now.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : `${now.getDate()} ${AZ_MONTHS[now.getMonth()]} ${now.getFullYear()}`);
  }, [locale]);
  return (
    <div className="dateline" aria-hidden="true">
      <div className="dateline-inner">
        {date && <>{date} &nbsp;◆&nbsp; </>}{t('city')} &nbsp;◆&nbsp; {t('dateline')}
      </div>
    </div>
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
    { href: authorsPath(locale, { type: 'PLAYWRIGHT' }), label: t('playwrights') },
    { href: authorsPath(locale, { type: 'PHILOSOPHER' }), label: t('philosophers') },
    { href: localePath(locale, `/works`), label: t('works') },
    { href: worksPath(locale, { form: 'GHAZAL' }), label: t('ghazals') },
    { href: worksPath(locale, { genre: 'PROSE' }), label: t('prose') },
    { href: localePath(locale, `/agac`), label: t('tree') },
    { href: localePath(locale, `/random`), label: t('random') },
    { href: localePath(locale, `/contribute`), label: t('contribute') },
  ];

  return (
    <header ref={headerRef} className={hidden ? 'site-header is-hidden' : 'site-header'}>
      <div className="header-inner">
        <Link prefetch={false} href={localePath(locale)} className="logo" aria-label="Kitabxana.az">
          Kitabxana<span className="logo-orn" aria-hidden="true">◆</span><em>AZ</em>
        </Link>

        <Link prefetch={false} href={localePath(locale, '/collections')} className="catalog-btn">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {t('catalog')}
        </Link>

        <HeaderSearch locale={locale} />

        <NavLinks links={navLinks} pathname={pathname} />

        {/* Its own grid cell: beside the tools on wide screens, beside the search on phones */}
        <SkinToggle />

        <div className="header-tools">
          <LanguageSwitcher />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
      <Dateline locale={locale} />
    </header>
  );
}
