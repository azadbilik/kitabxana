'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { Me } from '@/lib/account';
import { SignInPanel } from './SignInPanel';

/** Sign-in as a modal <dialog>: Escape and the close button dismiss it, focus stays inside */
export function SignInDialog({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: (me: Me) => void }) {
  const t = useTranslations('account');
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => opener?.focus?.();
  }, []);

  return (
    <dialog
      ref={ref}
      className="signin-dialog"
      aria-labelledby="signin-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop (the dialog element itself, outside its panel) closes it
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="signin-dialog-panel">
        <button type="button" className="signin-close" onClick={onClose} aria-label={t('close')}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <SignInPanel onSignedIn={onSignedIn} headingId="signin-dialog-title" />
      </div>
    </dialog>
  );
}
