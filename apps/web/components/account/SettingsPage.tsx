'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { accountFetch, writeFlag, type Me } from '@/lib/account';
import { resetMarks } from '@/lib/library';
import { localePath } from '@/lib/i18n';
import { useAccount } from './AccountProvider';

/** Name, the language of sign-in mail, sign out, and deleting the account with everything in it */
export function SettingsPage() {
  const t = useTranslations('settings');
  const ta = useTranslations('account');
  const locale = useLocale();
  const router = useRouter();
  const { status, user, setUser, signOut, requireSignIn } = useAccount();
  const [name, setName] = useState('');
  const [lang, setLang] = useState('az');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setLang(user.locale ?? locale);
  }, [user, locale]);

  if (status === 'unknown') return <div className="shelf-page-loading" aria-busy="true" />;
  if (status === 'guest' || !user) {
    return (
      <div className="shelf-empty">
        <p>{t('signed_out')}</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => requireSignIn()}>{ta('sign_in_short')}</button>
      </div>
    );
  }

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(false);
    const me = await accountFetch<Me>('/me', { method: 'PATCH', body: JSON.stringify({ name: name.trim() || null, locale: lang }) }).catch(() => null);
    if (!me) {
      setSaveError(true);
      return;
    }
    setUser(me);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const remove = async () => {
    setRemoving(true);
    setRemoveError(false);
    try {
      await accountFetch('/me', { method: 'DELETE' });
    } catch {
      // Nothing was deleted: say so and leave the reader signed in
      setRemoveError(true);
      setRemoving(false);
      return;
    }
    writeFlag(false);
    resetMarks();
    await signOut();
    router.push(localePath(locale));
  };

  return (
    <div className="settings">
      <form className="settings-card" onSubmit={save}>
        <h2 className="settings-title">{t('profile')}</h2>
        <p className="settings-email">{t('email', { email: user.email })}</p>
        <label htmlFor="settings-name" className="form-label">{t('name')}</label>
        <input id="settings-name" className="form-input" maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="settings-lang" className="form-label">{t('mail_language')}</label>
        <select id="settings-lang" className="form-input" value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="az">Azərbaycanca</option>
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
        <div className="settings-actions">
          <button type="submit" className="btn btn-primary">{t('save')}</button>
          <span className="settings-saved" role="status">{saved ? t('saved') : ''}</span>
        </div>
        <p className="form-alert" role="alert">{saveError ? t('save_failed') : ''}</p>
      </form>

      <div className="settings-card">
        <h2 className="settings-title">{t('session')}</h2>
        <button type="button" className="btn" onClick={() => signOut().then(() => router.push(localePath(locale)))}>{ta('sign_out')}</button>
      </div>

      <div className="settings-card settings-card--danger">
        <h2 className="settings-title">{t('delete_title')}</h2>
        <p>{t('delete_text')}</p>
        <label htmlFor="settings-confirm" className="form-label">{t('delete_type', { word: t('delete_word') })}</label>
        <input id="settings-confirm" className="form-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        <button type="button" className="btn btn-danger" disabled={removing || confirm.trim().toLocaleLowerCase(locale) !== t('delete_word').toLocaleLowerCase(locale)} onClick={remove}>
          {t('delete_button')}
        </button>
        <p className="form-alert" role="alert">{removeError ? t('delete_failed') : ''}</p>
      </div>
    </div>
  );
}
