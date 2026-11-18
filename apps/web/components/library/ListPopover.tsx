'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useAccount } from '@/components/account/AccountProvider';
import { accountFetch, AccountError } from '@/lib/account';

interface ListRow {
  id: string;
  name: string;
  count: number;
}

/**
 * What went wrong with a list, in the reader's words. The API answers 400 (409 once the
 * limits get their own status) when the reader is at 50 lists or a list at 1,000 items.
 */
export function listError(err: unknown, what: 'list' | 'item', t: (key: 'limit_lists' | 'limit_items' | 'failed') => string) {
  const status = err instanceof AccountError ? err.status : 0;
  if (status === 400 || status === 409) return t(what === 'list' ? 'limit_lists' : 'limit_items');
  return t('failed');
}

/** "Add to list": tick the reader's lists that should hold this work or book, or start a new one */
export function ListPopover({ workId, collectionId }: { workId?: string; collectionId?: string }) {
  const t = useTranslations('lists');
  const { requireSignIn } = useAccount();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ListRow[] | null>(null);
  const [inLists, setInLists] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const target: Record<string, string> = workId ? { workId } : { collectionId: collectionId! };
  const query = new URLSearchParams(target).toString();

  useEffect(() => {
    if (!open) return;
    let live = true;
    setError(null);
    Promise.all([
      accountFetch<ListRow[]>('/me/lists'),
      accountFetch<string[]>(`/me/lists/containing?${query}`),
    ])
      .then(([all, holding]) => {
        if (!live) return;
        setLists(all);
        setInLists(new Set(holding));
      })
      .catch(() => {
        if (!live) return;
        setLists([]);
        setError(t('load_failed'));
      });
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      live = false;
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open, query, t]);

  const toggle = async (listId: string) => {
    const on = !inLists.has(listId);
    setError(null);
    setInLists((s) => {
      const next = new Set(s);
      if (on) next.add(listId);
      else next.delete(listId);
      return next;
    });
    try {
      if (on) await accountFetch(`/me/lists/${listId}/items`, { method: 'PUT', body: JSON.stringify(target) });
      else await accountFetch(`/me/lists/${listId}/items?${query}`, { method: 'DELETE' });
    } catch (err) {
      setInLists((s) => {
        const next = new Set(s);
        if (on) next.delete(listId);
        else next.add(listId);
        return next;
      });
      setError(listError(err, 'item', t));
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setError(null);
    let list: { id: string; name: string };
    try {
      list = await accountFetch<{ id: string; name: string }>('/me/lists', { method: 'POST', body: JSON.stringify({ name: clean }) });
    } catch (err) {
      setError(listError(err, 'list', t));
      return;
    }
    // The list exists from here on, so it is shown even if adding to it fails
    setLists((l) => [...(l ?? []), { ...list, count: 0 }]);
    setName('');
    try {
      await accountFetch(`/me/lists/${list.id}/items`, { method: 'PUT', body: JSON.stringify(target) });
      setInLists((s) => new Set(s).add(list.id));
    } catch (err) {
      setError(listError(err, 'item', t));
    }
  };

  return (
    <div className="list-popover" ref={wrap}>
      <button
        type="button"
        className="save-btn"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => requireSignIn(() => setOpen((o) => !o))}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 6h11M4 12h11M4 18h7M18 15v6M15 18h6" />
        </svg>
        <span>{t('add')}</span>
      </button>
      {open && (
        <div className="list-popover-panel" id={panelId} role="group" aria-label={t('add')}>
          {lists === null ? (
            <p className="list-popover-note">…</p>
          ) : lists.length === 0 ? (
            <p className="list-popover-note">{t('none_yet')}</p>
          ) : (
            <ul className="list-popover-lists">
              {lists.map((l) => (
                <li key={l.id}>
                  <label>
                    <input type="checkbox" checked={inLists.has(l.id)} onChange={() => toggle(l.id)} />
                    <span>{l.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <form className="list-popover-new" onSubmit={create}>
            <label htmlFor={`${panelId}-name`} className="sr-only">{t('new_name')}</label>
            <input
              id={`${panelId}-name`}
              className="form-input"
              placeholder={t('new_placeholder')}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn" disabled={!name.trim()}>{t('create')}</button>
          </form>
          <p className="form-alert" role="alert">{error}</p>
        </div>
      )}
    </div>
  );
}
