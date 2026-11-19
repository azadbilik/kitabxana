'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Nar is the site's design; the Gazette (styles/gazette.css) is a look a reader may switch to.
 * Kept in localStorage.skin and set as <html data-skin="gazette"> before paint by app/layout.tsx,
 * so pages stay the same for everyone and edge-cacheable.
 */
export function SkinToggle() {
  const t = useTranslations('skin');
  const [gazette, setGazette] = useState(false);

  useEffect(() => {
    setGazette(document.documentElement.getAttribute('data-skin') === 'gazette');
  }, []);

  const toggle = () => {
    const next = !gazette;
    setGazette(next);
    const root = document.documentElement;
    if (next) root.setAttribute('data-skin', 'gazette');
    else root.removeAttribute('data-skin');
    try {
      if (next) localStorage.setItem('skin', 'gazette');
      else localStorage.removeItem('skin');
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-btn skin-btn"
      aria-label={t('gazette')}
      aria-pressed={gazette}
      title={t(gazette ? 'to_nar' : 'to_gazette')}
    >
      {/* A newspaper page: masthead, a double rule, columns */}
      <svg className="icon" aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="14" height="14" rx="1.5" />
        <path d="M6 6.5h8" />
        <path d="M5.5 9h9M5.5 10.4h9" strokeWidth="1" />
        <path d="M6 13h3M11 13h3M6 15h3M11 15h3" strokeWidth="1.2" />
      </svg>
    </button>
  );
}
