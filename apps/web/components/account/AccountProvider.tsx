'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { accountFetch, AccountError, readFlag, writeFlag, type Me } from '@/lib/account';
import { SignInDialog } from './SignInDialog';

type Status = 'unknown' | 'guest' | 'signed-in';

interface AccountContext {
  status: Status;
  user: Me | null;
  /** Opens sign-in; `then` runs once the reader is signed in (e.g. the save they clicked) */
  requireSignIn: (then?: () => void) => void;
  signedIn: (user: Me) => void;
  signOut: () => Promise<void>;
  setUser: (user: Me) => void;
}

const Ctx = createContext<AccountContext | null>(null);

export function useAccount(): AccountContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAccount outside AccountProvider');
  return ctx;
}

/**
 * Holds the signed-in reader for every page. It asks the API only when this browser has
 * signed in before (a localStorage flag), so guests and crawlers cost nothing extra.
 * Returning from Google, the page carries #signed-in, which sets the flag.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('unknown');
  const [user, setUserState] = useState<Me | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (location.hash === '#signed-in') {
      writeFlag(true);
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (!readFlag()) {
      setStatus('guest');
      return;
    }
    accountFetch<Me>('/me')
      .then((me) => {
        setUserState(me);
        setStatus('signed-in');
      })
      .catch((err) => {
        // Only a definite "not signed in" clears the flag; a network blip keeps it for next time
        if (err instanceof AccountError && err.status === 401) writeFlag(false);
        setStatus('guest');
      });
  }, []);

  const signedIn = useCallback((me: Me) => {
    writeFlag(true);
    setUserState(me);
    setStatus('signed-in');
    setDialogOpen(false);
    const next = pending.current;
    pending.current = null;
    next?.();
  }, []);

  const requireSignIn = useCallback(
    (then?: () => void) => {
      if (status === 'signed-in') return then?.();
      pending.current = then ?? null;
      setDialogOpen(true);
    },
    [status],
  );

  const signOut = useCallback(async () => {
    await accountFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    writeFlag(false);
    setUserState(null);
    setStatus('guest');
  }, []);

  const value = useMemo(
    () => ({ status, user, requireSignIn, signedIn, signOut, setUser: setUserState }),
    [status, user, requireSignIn, signedIn, signOut],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {dialogOpen && (
        <SignInDialog
          onClose={() => {
            pending.current = null;
            setDialogOpen(false);
          }}
          onSignedIn={signedIn}
        />
      )}
    </Ctx.Provider>
  );
}
