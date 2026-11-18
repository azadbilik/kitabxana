'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { setWorkStatus, useLoadMarks, useMarks } from '@/lib/library';
import { SaveButton } from './SaveButton';
import { ListPopover } from './ListPopover';

interface Props {
  workId: string;
  collectionId?: string | null;
  /** Further buttons on the same row: share and download */
  children?: ReactNode;
}

/** Under a text, one row: save it, add it to a list, mark it read (or unread again), share, download */
export function WorkActions({ workId, collectionId, children }: Props) {
  const t = useTranslations('library');
  const { status, requireSignIn } = useAccount();
  const marks = useMarks();
  useLoadMarks(status === 'signed-in', { workIds: [workId], ...(collectionId && { collectionIds: [collectionId] }) });
  const done = marks.works[workId]?.status === 'DONE';

  return (
    <div className="work-actions" role="group" aria-label={t('actions_label')}>
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
        <span>{done ? t('read_done') : t('mark_read_short')}</span>
      </button>
      {children}
    </div>
  );
}
