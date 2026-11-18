'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface Props {
  label: string;
  icon: ReactNode;
  /** The panel's rows: links and buttons with the `action-menu-item` class */
  children: ReactNode;
}

/**
 * A button under the text that opens a small panel of choices (share, download). The same
 * disclosure as "add to list": Escape or a click outside closes it, and focus returns to
 * the button.
 */
export function ActionPopover({ label, icon, children }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return;
        setOpen(false);
        button.current?.focus();
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

  return (
    <div className="list-popover" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="save-btn"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
        <span>{label}</span>
      </button>
      {open && (
        <div className="list-popover-panel action-menu" id={panelId} role="group" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  );
}
