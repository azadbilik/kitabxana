'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { localePath } from '@/lib/i18n';
import { useAccount } from './AccountProvider';

const BOOK_ICON = (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
    <path d="M12 6c-2-1.5-4.5-2-8-2v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V4c-3.5 0-6 .5-8 2zM12 6v14" />
  </svg>
);

/** The header's account slot: "Sign in" for guests; the shelf link and a menu when signed in */
export function AccountMenu() {
  const t = useTranslations('account');
  const locale = useLocale();
  const { status, user, requireSignIn, signOut } = useAccount();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  // Holds its width while the account loads, so the header doesn't shift
  if (status === 'unknown') return <div className="account-slot account-slot--pending" aria-hidden="true" />;

  if (status === 'guest' || !user) {
    return (
      <div className="account-slot">
        <button type="button" className="account-signin" onClick={() => requireSignIn()}>
          {t('sign_in_short')}
        </button>
      </div>
    );
  }

  const initial = (user.name || user.email).trim().charAt(0).toLocaleUpperCase(locale);

  return (
    <div className="account-slot" ref={wrap}>
      <Link href={localePath(locale, '/refim')} className="account-shelf">
        {BOOK_ICON}
        <span className="account-shelf-label">{t('my_shelf')}</span>
      </Link>
      <button
        type="button"
        className="account-avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('menu_label', { name: user.name || user.email })}
        onClick={() => setOpen((o) => !o)}
      >
        {initial}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <p className="account-menu-who">{user.name || user.email}</p>
          <Link role="menuitem" href={localePath(locale, '/refim')} onClick={() => setOpen(false)}>{t('my_shelf')}</Link>
          <Link role="menuitem" href={localePath(locale, '/refim/siyahilar')} onClick={() => setOpen(false)}>{t('lists')}</Link>
          <Link role="menuitem" href={localePath(locale, '/refim/ayarlar')} onClick={() => setOpen(false)}>{t('settings')}</Link>
          <button role="menuitem" type="button" onClick={() => { setOpen(false); signOut(); }}>{t('sign_out')}</button>
        </div>
      )}
    </div>
  );
}
