'use client';

import { useEffect } from 'react';
import { A11Y_KEY, applyA11y, loadA11y, parseA11y } from '@/lib/a11y';

/**
 * Keeps the reader's accessibility choices on <html>. The inline script in app/layout.tsx
 * sets them before paint; this covers a page drawn in the browser, where that script never
 * ran (a 404 raised while streaming), and a change made in another tab.
 */
export function A11yBoot() {
  useEffect(() => {
    applyA11y(loadA11y());
    const onStorage = (e: StorageEvent) => {
      if (e.key === A11Y_KEY) applyA11y(parseA11y(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return null;
}
