'use client';

import { useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { setSaved, useMarks, type FavoriteKind } from '@/lib/library';

/** Bookmark a work, book or author. A guest is asked to sign in, and the save follows. */
export function SaveButton({ kind, id, compact = false }: { kind: FavoriteKind; id: string; compact?: boolean }) {
  const t = useTranslations('library');
  const { requireSignIn } = useAccount();
  const marks = useMarks();
  const saved = marks.saved[kind].has(id);
  const label = saved ? t('saved') : t('save');

  return (
    <button
      type="button"
      className={`save-btn${compact ? ' save-btn--compact' : ''}${saved ? ' is-on' : ''}`}
      aria-pressed={saved}
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      onClick={() => requireSignIn(() => setSaved(kind, id, !saved).catch(() => {}))}
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M6 4h12v17l-6-4-6 4z" />
      </svg>
      {!compact && <span>{label}</span>}
    </button>
  );
}
