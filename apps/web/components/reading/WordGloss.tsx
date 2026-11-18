'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { lookupWord, wordAt, type GlossMatch } from '@/lib/glossary';

interface Shown {
  matches: GlossMatch[];
  /** The tapped word's box on the page */
  box: { left: number; right: number; top: number; bottom: number };
}

// The dictionary's marks for where a word is from, as message keys
const ORIGIN: Record<string, string> = { ə: 'ar', f: 'fa', a: 'az', türk: 'tr', y: 'el', l: 'la', ibr: 'he', sansk: 'sa', süry: 'syr' };
const HIGHLIGHT = 'word-gloss';

type Highlights = { set: (name: string, value: unknown) => void; delete: (name: string) => void };
const highlights = () => (typeof CSS !== 'undefined' ? (CSS as unknown as { highlights?: Highlights }).highlights : undefined);

/**
 * Tap a word of an Azerbaijani text and the dictionary's entry for it opens beside it: classical
 * verse is a third Arabic and Persian. Words the dictionary lacks do nothing. The text itself is
 * never touched (it is written out by React): the word is marked with a CSS highlight.
 */
export function WordGloss({ root }: { root: RefObject<HTMLElement | null> }) {
  const t = useTranslations('reading');
  const [shown, setShown] = useState<Shown | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const asking = useRef(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onClick = async (e: MouseEvent) => {
      const target = e.target as Element;
      if (e.defaultPrevented || e.button !== 0 || target.closest('a, button, summary, sup, input, select')) return;
      // Dragging across words selects them; that is not a tap
      if (!window.getSelection()?.isCollapsed) return;
      const lang = target.closest('[lang]')?.getAttribute('lang') ?? '';
      if (lang !== 'az' && lang !== 'az-Latn') return;
      const found = wordAt(e.clientX, e.clientY);
      if (!found) return;
      const turn = ++asking.current;
      const matches = await lookupWord(found.word);
      if (turn !== asking.current) return;
      if (!matches.length) {
        setShown(null);
        return;
      }
      const r = found.range.getBoundingClientRect();
      const HighlightCtor = (window as unknown as { Highlight?: new (r: Range) => unknown }).Highlight;
      if (HighlightCtor) highlights()?.set(HIGHLIGHT, new HighlightCtor(found.range));
      setPlace(null);
      setShown({
        matches,
        box: { left: r.left + window.scrollX, right: r.right + window.scrollX, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY },
      });
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [root]);

  // Under the word, or over it when the screen ends first; kept inside the page's sides
  useLayoutEffect(() => {
    if (!shown || !panel.current) return;
    const { width, height } = panel.current.getBoundingClientRect();
    const gap = 8;
    const side = 12;
    const middle = (shown.box.left + shown.box.right) / 2;
    const left = Math.max(window.scrollX + side, Math.min(middle - width / 2, window.scrollX + document.documentElement.clientWidth - width - side));
    const below = shown.box.bottom + gap;
    const fits = below + height <= window.scrollY + window.innerHeight - side;
    const above = shown.box.top - gap - height;
    setPlace({ left, top: fits || above < window.scrollY + side ? below : above });
  }, [shown]);

  useEffect(() => {
    if (!shown) {
      highlights()?.delete(HIGHLIGHT);
      return;
    }
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !panel.current?.contains(e.target as Node)) setShown(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [shown]);

  if (!shown) return null;

  /** «ə+f» → Arabic + Persian; «ə<y» → Arabic, from Greek */
  const origin = (mark: string) => {
    const name = (m: string) => (ORIGIN[m] ? t(`gloss_origin.${ORIGIN[m]}` as never) : m);
    if (mark.includes('<')) {
      const [via, first] = mark.split('<');
      return t('gloss_origin_from', { via: name(via), first: name(first) });
    }
    return mark.split('+').filter(Boolean).map(name).join(' + ');
  };

  return createPortal(
    <div
      ref={panel}
      className="word-gloss"
      role="dialog"
      aria-label={t('gloss_title')}
      lang="az"
      style={place ? { left: place.left, top: place.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      <div aria-live="polite">
        {shown.matches.map((m) => (
          <section className="word-gloss-entry" key={m.head}>
            {m.phrase && (
              <p className="word-gloss-phrase">
                <strong>{m.phrase.text}</strong> {m.phrase.gloss}
              </p>
            )}
            <h3 className="word-gloss-head">{m.head}</h3>
            {m.senses.map((s, i) => (
              <p className="word-gloss-sense" key={i}>
                {s.origin && <span className="word-gloss-origin">{origin(s.origin)}</span>}
                {s.text}
              </p>
            ))}
          </section>
        ))}
      </div>
      <p className="word-gloss-source">{t('gloss_source')}</p>
    </div>,
    document.body,
  );
}
