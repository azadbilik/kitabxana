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
    <div className="container page-content" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{t('title')}</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>{t('text')}</p>
      <button onClick={reset} className="btn btn-primary">
        ◆ {t('retry')}
      </button>
    </div>
  );
}
