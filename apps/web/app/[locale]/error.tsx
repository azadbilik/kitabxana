'use client';

import { useTranslations } from 'next-intl';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');
  return (
    <div className="container page-content not-found">
      <header className="page-header">
        <h1>{t('title')}</h1>
        <p className="not-found-text">{t('text')}</p>
      </header>
      <button type="button" onClick={reset} className="btn btn-primary">
        {t('retry')}
      </button>
    </div>
  );
}
