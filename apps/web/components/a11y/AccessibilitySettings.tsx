'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { a11yDefaults, loadA11y, saveA11y, type A11yPrefs } from '@/lib/a11y';

/** One setting: its name and what it does on the left, its choices on the right */
function Row({ name, hint, children }: { name: string; hint: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="a11y-row" role="group" aria-labelledby={`${id}-name`} aria-describedby={`${id}-hint`}>
      <div className="a11y-row-text">
        <h3 id={`${id}-name`} className="a11y-row-name">{name}</h3>
        <p id={`${id}-hint`} className="a11y-row-hint">{hint}</p>
      </div>
      <div className="a11y-options">{children}</div>
    </div>
  );
}

/**
 * The site-wide accessibility choices (lib/a11y.ts). They take effect as they are picked
 * and are kept in this browser; nothing is sent anywhere.
 */
export function AccessibilitySettings() {
  const t = useTranslations('a11y');
  const [prefs, setPrefs] = useState<A11yPrefs>(a11yDefaults);
  // Said to screen readers after a change: the page restyles itself without a word otherwise
  const [status, setStatus] = useState('');

  useEffect(() => {
    setPrefs(loadA11y());
  }, []);

  const set = (patch: Partial<A11yPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveA11y(next);
    setStatus(t('saved'));
  };

  const option = (active: boolean, label: string, onClick: () => void, extra?: { className?: string; name?: string }) => (
    <button
      key={label + (extra?.name ?? '')}
      type="button"
      className={`a11y-option${extra?.className ? ` ${extra.className}` : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {extra?.name ? (
        <>
          <span aria-hidden="true">{label}</span>
          <span className="sr-only">{extra.name}</span>
        </>
      ) : (
        label
      )}
    </button>
  );

  const changed = JSON.stringify(prefs) !== JSON.stringify(a11yDefaults);

  return (
    <section className="a11y-settings" aria-labelledby="a11y-settings-title">
      <h2 id="a11y-settings-title" className="a11y-settings-title">{t('settings')}</h2>
      <p className="a11y-settings-note">{t('settings_note')}</p>

      <Row name={t('contrast')} hint={t('contrast_hint')}>
        {option(prefs.contrast === 'auto', t('auto'), () => set({ contrast: 'auto' }))}
        {option(prefs.contrast === 'more', t('contrast_more'), () => set({ contrast: 'more' }))}
      </Row>

      <Row name={t('text')} hint={t('text_hint')}>
        {([0, 1, 2] as const).map((step) =>
          option(prefs.text === step, 'A', () => set({ text: step }), {
            className: ['a11y-option--a', 'a11y-option--aa', 'a11y-option--aaa'][step],
            name: t(`text_names.${step}`),
          }),
        )}
      </Row>

      <Row name={t('spacing')} hint={t('spacing_hint')}>
        {option(!prefs.spacing, t('off'), () => set({ spacing: false }))}
        {option(prefs.spacing, t('on'), () => set({ spacing: true }))}
      </Row>

      <Row name={t('legible')} hint={t('legible_hint')}>
        {option(!prefs.legible, t('off'), () => set({ legible: false }))}
        {option(prefs.legible, t('on'), () => set({ legible: true }))}
      </Row>

      <Row name={t('motion')} hint={t('motion_hint')}>
        {option(prefs.motion === 'auto', t('auto'), () => set({ motion: 'auto' }))}
        {option(prefs.motion === 'reduce', t('motion_reduce'), () => set({ motion: 'reduce' }))}
      </Row>

      <Row name={t('keys')} hint={t('keys_hint')}>
        {option(!prefs.keys, t('off'), () => set({ keys: false }))}
        {option(prefs.keys, t('on'), () => set({ keys: true }))}
      </Row>

      <div className="a11y-foot">
        <button
          type="button"
          className="btn"
          disabled={!changed}
          onClick={() => {
            setPrefs(a11yDefaults);
            saveA11y(a11yDefaults);
            setStatus(t('reset_done'));
          }}
        >
          {t('reset')}
        </button>
        <span className="a11y-status" role="status">{status}</span>
      </div>
    </section>
  );
}
