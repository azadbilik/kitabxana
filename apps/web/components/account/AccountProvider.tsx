'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { accountFetch, AccountError, readFlag, writeFlag, type Me, type SignInProviders } from '@/lib/account';
import { importLocalPositions, resetMarks } from '@/lib/library';
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
  /** null until known: from the layout when it passes them, else once a sign-in form asks */
  providers: SignInProviders | null;
  /** Asks the API which sign-in methods work; called by the sign-in form, never on page load */
  loadProviders: () => void;
}

const Ctx = createContext<AccountContext | null>(null);

export function useAccount(): AccountContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAccount outside AccountProvider');
  return ctx;
}

/**
 * Whether anyone can sign in right now: false when the server has neither mail nor Google
 * set up, null while that isn't known. The header uses it to leave out "Sign in" rather
 * than lead to a form that can't complete.
 */
export function useSignInAvailable(): boolean | null {
  const { providers } = useAccount();
  return providers ? providers.google || providers.email : null;
}

/**
 * Holds the signed-in reader for every page. It asks the API only when this browser has
 * signed in before (a localStorage flag), so guests and crawlers cost nothing extra.
 * Returning from Google, the page carries #signed-in, which sets the flag.
 */
export function AccountProvider({
  children,
  providers: knownProviders = null,
}: {
  children: ReactNode;
  /** From the server (the same for every reader, so safe in cached HTML); optional */
  providers?: SignInProviders | null;
}) {
  const [status, setStatus] = useState<Status>('unknown');
  const [providers, setProviders] = useState<SignInProviders | null>(knownProviders);
  const providersAsked = useRef(false);
  const [user, setUserState] = useState<Me | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Back from Google: the first sign-in in this browser, unless the flag was already set
    let fresh = false;
    if (location.hash === '#signed-in') {
      fresh = !readFlag();
      writeFlag(true);
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (!readFlag()) {
      setStatus('guest');
      return;
    }
    accountFetch<Me>('/me')
      .then((me) => {
        // Places read in this browser before signing in join the account, as on the email path
        if (fresh) importLocalPositions();
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
    // Places read in this browser before signing in join the account
    if (!readFlag()) importLocalPositions();
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

  const loadProviders = useCallback(() => {
    if (providersAsked.current) return;
    providersAsked.current = true;
    accountFetch<Partial<SignInProviders>>('/auth/providers')
      .then((p) => setProviders({ google: Boolean(p.google), email: p.email !== false }))
      .catch(() => {
        providersAsked.current = false;
        // Unreachable API: offer the form, which reports its own failure, rather than "closed"
        setProviders((known) => known ?? { google: false, email: true });
      });
  }, []);

  const signOut = useCallback(async () => {
    await accountFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    writeFlag(false);
    resetMarks();
    setUserState(null);
    setStatus('guest');
  }, []);

  const value = useMemo(
    () => ({ status, user, requireSignIn, signedIn, signOut, setUser: setUserState, providers, loadProviders }),
    [status, user, requireSignIn, signedIn, signOut, providers, loadProviders],
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
