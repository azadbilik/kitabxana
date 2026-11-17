'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { localePath, locales, splitLocale } from '@/lib/i18n';

const labels: Record<string, string> = {
  az: 'AZ',
  ru: 'RU',
  en: 'EN',
};

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();

  const switchLocale = (newLocale: string) => {
    const { path } = splitLocale(pathname);
    // Keep the query, so a search (?q=) or a chosen translation (?tr=) survives the switch
    router.push(localePath(newLocale, path === '/' ? '' : path) + window.location.search);
  };

  return (
    <>
    {/* Phones: one compact control in place of the three buttons */}
    <label className="lang-select-wrap">
      <span className="sr-only">Language / Dil / Язык</span>
      <select
        className="lang-select"
        value={currentLocale}
        onChange={(e) => switchLocale(e.target.value)}
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>{labels[loc]}</option>
        ))}
      </select>
    </label>
    <div className="lang-switcher">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => switchLocale(loc)}
          className={`lang-btn ${loc === currentLocale ? 'active' : ''}`}
          aria-current={loc === currentLocale ? 'true' : undefined}
        >
          {labels[loc]}
        </button>
      ))}
    </div>
    </>
  );
}
