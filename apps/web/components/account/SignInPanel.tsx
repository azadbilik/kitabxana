'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { accountFetch, AccountError, googleStartUrl, type Me } from '@/lib/account';
import { localePath } from '@/lib/i18n';
import { useAccount } from './AccountProvider';

/**
 * Sign-in: "Continue with Google" (when the server has it configured) or an emailed 6-digit
 * code. Used inside the dialog and on the /giris page. When the server can complete neither
 * (no mail key, no Google), it says sign-in is coming instead of showing a form that can't work.
 */
export function SignInPanel({
  onSignedIn,
  headingId,
  as: Heading = 'h2',
}: {
  onSignedIn: (me: Me) => void;
  headingId?: string;
  /** The /giris page passes h1: there the panel's title is the page's */
  as?: 'h1' | 'h2';
}) {
  const t = useTranslations('account');
  const locale = useLocale();
  const { providers, loadProviders } = useAccount();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProviders();
    if (location.hash === '#google-failed') setError(t('google_failed'));
  }, [t, loadProviders]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await accountFetch('/auth/email/start', { method: 'POST', body: JSON.stringify({ email: email.trim(), locale }) });
      setStep('code');
    } catch (err) {
      setError(err instanceof AccountError && err.status === 429 ? t('too_many') : t('send_failed'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await accountFetch<Me>('/auth/email/verify', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), code: code.trim(), locale }),
      });
      onSignedIn(me);
    } catch (err) {
      setError(err instanceof AccountError && err.status === 429 ? t('too_many') : t('wrong_code'));
    } finally {
      setBusy(false);
    }
  };

  // From the sign-in page itself (in any language) Google returns to the shelf, as the email path does
  const returnTo =
    typeof window === 'undefined'
      ? '/'
      : location.pathname === localePath(locale, '/giris')
        ? localePath(locale, '/refim')
        : location.pathname + location.search;

  if (providers && !providers.google && !providers.email) {
    return (
      <div className="signin">
        <Heading className="signin-title" id={headingId}>{t('soon_title')}</Heading>
        <p className="signin-lead">{t('soon_lead')}</p>
        <p className="signin-note">{t('soon_note')}</p>
      </div>
    );
  }

  return (
    <div className="signin">
      <Heading className="signin-title" id={headingId}>{t('title')}</Heading>
      <p className="signin-lead">{t('lead')}</p>

      {!providers && <div className="signin-pending" aria-busy="true" />}

      {providers?.google && step === 'email' && (
        <>
          <a className="btn signin-google" href={googleStartUrl(returnTo)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6C12.3 13.4 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.3 5.7c4.3-4 7-9.9 7-17.1z" />
              <path fill="#FBBC05" d="M10.4 28.8c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.8-6z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2.1 1.4-4.9 2.3-8.6 2.3-6.3 0-11.7-4.2-13.6-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
            </svg>
            {t('google')}
          </a>
          {providers.email && <p className="signin-or"><span>{t('or')}</span></p>}
        </>
      )}

      {!providers?.email ? null : step === 'email' ? (
        <form className="signin-form" onSubmit={sendCode}>
          <label htmlFor="signin-email" className="form-label">{t('email_label')}</label>
          <input
            id="signin-email"
            className="form-input"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>{busy ? t('sending') : t('send_code')}</button>
        </form>
      ) : (
        <form className="signin-form" onSubmit={verify}>
          <p className="signin-sent">{t('code_sent', { email: email.trim() })}</p>
          <label htmlFor="signin-code" className="form-label">{t('code_label')}</label>
          <input
            ref={codeRef}
            id="signin-code"
            className="form-input signin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || code.length !== 6}>{t('sign_in')}</button>
          <div className="signin-links">
            <button type="button" className="link-btn" onClick={() => sendCode()} disabled={busy}>{t('resend')}</button>
            <button type="button" className="link-btn" onClick={() => { setStep('email'); setCode(''); setError(null); }}>{t('other_email')}</button>
          </div>
        </form>
      )}

      <p className="signin-error" role="alert" aria-live="assertive">{error}</p>
      <p className="signin-note">{t('privacy_note')}</p>
    </div>
  );
}
