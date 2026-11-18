'use client';

import { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { localePath } from '@/lib/i18n';
import { GlossLookup } from './WordGloss';
import { lineSpacings, paragraphStyles, readingFonts, textAligns, type ReadingPrefs } from '@/lib/useReadingPrefs';

interface Props {
  prefs: ReadingPrefs;
  onUpdate: (patch: Partial<ReadingPrefs>) => void;
  isPoem: boolean;
  /** The text has Azerbaijani in Latin script, which the dictionary reads */
  hasGlossary: boolean;
}

const fontSizeSteps = ['S', 'M', 'L', 'XL'] as const;
const widthSteps = ['standard', 'wide', 'full'] as const;

export function AppearancePopover({ prefs, onUpdate, isPoem, hasGlossary }: Props) {
  const t = useTranslations('reading');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLButtonElement>('button.active') ?? panel?.querySelector('button'))?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    // Tabbing out of the panel closes it, like any non-modal popup
    function onFocusIn(e: FocusEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  // A step shown as a letter (S, XL) is named in words for screen readers; the name stands
  // in the button's own text, so what is seen and what is announced never part ways
  const step = (active: boolean, label: string, name: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      className={`appearance-step${active ? ' active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {label === name ? (
        label
      ) : (
        <>
          <span aria-hidden="true">{label}</span>
          <span className="sr-only">{name}</span>
        </>
      )}
    </button>
  );

  return (
    <div className="appearance-anchor" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className="appearance-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('appearance')}
        aria-expanded={open}
        aria-controls={panelId}
        title={t('appearance')}
      >
        Aa
      </button>

      {open && (
        <div className="appearance-popover" id={panelId} ref={panelRef} role="dialog" aria-label={t('appearance')}>
          <div className="appearance-row" role="group" aria-label={t('appearance_size')}>
            <span className="appearance-label" aria-hidden="true">{t('appearance_size')}</span>
            <div className="appearance-steps">
              {fontSizeSteps.map((s, i) =>
                step(prefs.fontSize === i, s, t(`size_names.${s}`), () => onUpdate({ fontSize: i })),
              )}
            </div>
          </div>

          <div className="appearance-row" role="group" aria-label={t('appearance_leading')}>
            <span className="appearance-label" aria-hidden="true">{t('appearance_leading')}</span>
            <div className="appearance-steps">
              {lineSpacings.map((l) => {
                const name = t(`leading_names.${l}`);
                return step(prefs.leading === l, name, name, () => onUpdate({ leading: l }));
              })}
            </div>
          </div>

          {/* Column width — poems keep their own measure */}
          {!isPoem && (
            <div className="appearance-row" role="group" aria-label={t('appearance_width')}>
              <span className="appearance-label" aria-hidden="true">{t('appearance_width')}</span>
              <div className="appearance-steps">
                {widthSteps.map((w, i) => {
                  const name = t(`width_names.${w}`);
                  return step(prefs.width === i, name, name, () => onUpdate({ width: i }));
                })}
              </div>
            </div>
          )}

          {/* Prose only: paragraphs apart or indented like a book, ragged or justified */}
          {!isPoem && (
            <div className="appearance-row" role="group" aria-label={t('appearance_paragraphs')}>
              <span className="appearance-label" aria-hidden="true">{t('appearance_paragraphs')}</span>
              <div className="appearance-steps">
                {paragraphStyles.map((style) => {
                  const name = t(`paragraph_names.${style}`);
                  return step(prefs.paragraphs === style, name, name, () => onUpdate({ paragraphs: style }));
                })}
              </div>
            </div>
          )}
          {!isPoem && (
            <div className="appearance-row" role="group" aria-label={t('appearance_align')}>
              <span className="appearance-label" aria-hidden="true">{t('appearance_align')}</span>
              <div className="appearance-steps">
                {textAligns.map((align) => {
                  const name = t(`align_names.${align}`);
                  return step(prefs.align === align, name, name, () => onUpdate({ align }));
                })}
              </div>
            </div>
          )}

          {/* Verse only: number every fifth couplet or line; a number links to its line */}
          {isPoem && (
            <div className="appearance-row" role="group" aria-label={t('appearance_numbers')}>
              <span className="appearance-label" aria-hidden="true">{t('appearance_numbers')}</span>
              <div className="appearance-steps">
                {[false, true].map((on) => {
                  const name = t(`numbers_names.${on ? 'on' : 'off'}`);
                  return step(prefs.numbers === on, name, name, () => onUpdate({ numbers: on }));
                })}
              </div>
            </div>
          )}

          {/* A tapped word opens its entry in the dictionary of Arabic and Persian words */}
          {hasGlossary && (
            <div className="appearance-row" role="group" aria-label={t('appearance_glossary')}>
              <span className="appearance-label" aria-hidden="true">{t('appearance_glossary')}</span>
              <div className="appearance-steps">
                {[false, true].map((on) => {
                  const name = t(`glossary_names.${on ? 'on' : 'off'}`);
                  return step(prefs.glossary === on, name, name, () => onUpdate({ glossary: on }));
                })}
              </div>
            </div>
          )}

          {/* Four faces don't fit beside the label: they sit under it, two by two */}
          <div className="appearance-row appearance-row--stacked" role="group" aria-label={t('appearance_font')}>
            <span className="appearance-label" aria-hidden="true">{t('appearance_font')}</span>
            <div className="appearance-steps appearance-steps--grid">
              {readingFonts.map((f) => {
                const name = t(`font_names.${f}`);
                return step(prefs.fontFamily === f, name, name, () => onUpdate({ fontFamily: f }));
              })}
            </div>
          </div>

          {/* The dictionary without a pointer: a word typed, its entry read */}
          {hasGlossary && prefs.glossary && <GlossLookup />}

          {/* Contrast, text size across the site, spacing, a legible face, motion */}
          <Link prefetch={false} className="appearance-more" href={localePath(locale, '/accessibility')}>
            {t('appearance_more')}
          </Link>
        </div>
      )}
    </div>
  );
}
