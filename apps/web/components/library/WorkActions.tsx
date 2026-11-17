'use client';

import { useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { setWorkStatus, useLoadMarks, useMarks } from '@/lib/library';
import { SaveButton } from './SaveButton';
import { ListPopover } from './ListPopover';

/** Under a text: save it, and mark it read (or unread again) */
export function WorkActions({ workId, collectionId }: { workId: string; collectionId?: string | null }) {
  const t = useTranslations('library');
  const { status, requireSignIn } = useAccount();
  const marks = useMarks();
  useLoadMarks(status === 'signed-in', { workIds: [workId], ...(collectionId && { collectionIds: [collectionId] }) });
  const done = marks.works[workId]?.status === 'DONE';

  return (
    <div className="work-actions">
      <SaveButton kind="work" id={workId} />
      <ListPopover workId={workId} />
      <button
        type="button"
        className={`read-btn${done ? ' is-on' : ''}`}
        aria-pressed={done}
        onClick={() => requireSignIn(() => setWorkStatus(workId, done ? null : 'DONE').catch(() => {}))}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        <span>{done ? t('read_done') : t('mark_read')}</span>
      </button>
    </div>
  );
}
