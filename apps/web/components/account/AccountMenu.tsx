'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { localePath } from '@/lib/i18n';
import { useAccount, useSignInAvailable } from './AccountProvider';

const BOOK_ICON = (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
    <path d="M12 6c-2-1.5-4.5-2-8-2v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V4c-3.5 0-6 .5-8 2zM12 6v14" />
  </svg>
);

/**
 * The header's account slot: "Sign in" for guests; the shelf link and a short list of account
 * links when signed in. While the server can't sign anyone in (no mail key, no Google) and
 * that is known, guests get no button at all.
 */
export function AccountMenu() {
  const t = useTranslations('account');
  const locale = useLocale();
  const { status, user, requireSignIn, signOut } = useAccount();
  const available = useSignInAvailable();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const avatar = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return;
        setOpen(false);
        avatar.current?.focus();
      } else if (!wrap.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  // Holds its width while the account loads, so the header doesn't shift. With sign-in known
  // to be closed it holds none, except in a browser that has signed in before
  if (status === 'unknown') {
    return <div className={`account-slot account-slot--pending${available === false ? ' account-slot--off' : ''}`} aria-hidden="true" />;
  }

  if (status === 'guest' || !user) {
    if (available === false) return null;
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
      <Link prefetch={false} href={localePath(locale, '/refim')} className="account-shelf">
        {BOOK_ICON}
        <span className="account-shelf-label">{t('my_shelf')}</span>
      </Link>
      <button
        type="button"
        className="account-avatar"
        ref={avatar}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t('menu_label', { name: user.name || user.email })}
        onClick={() => setOpen((o) => !o)}
      >
        {initial}
      </button>
      {open && (
        // A plain disclosure: links and a button in tab order, not an ARIA menu
        <div className="account-menu" id={panelId}>
          <p className="account-menu-who">{user.name || user.email}</p>
          <Link prefetch={false} href={localePath(locale, '/refim')} onClick={() => setOpen(false)}>{t('my_shelf')}</Link>
          <Link prefetch={false} href={localePath(locale, '/refim/siyahilar')} onClick={() => setOpen(false)}>{t('lists')}</Link>
          <Link prefetch={false} href={localePath(locale, '/refim/ayarlar')} onClick={() => setOpen(false)}>{t('settings')}</Link>
          <button type="button" onClick={() => { setOpen(false); signOut(); }}>{t('sign_out')}</button>
        </div>
      )}
    </div>
  );
}
