'use client';

import { useState, useEffect } from 'react';

export interface ReadingPrefs {
  fontSize: number;   // 0–3
  width: number;      // 0–2
  fontFamily: ReadingFont;
  // Space between lines, on top of what the size already asks for
  leading: LineSpacing;
  // Prose only: paragraphs apart or book-style first-line indents, ragged or justified
  paragraphs: ParagraphStyle;
  align: TextAlign;
  // Verse only: every fifth couplet or line numbered in the margin; a number links to its line
  numbers: boolean;
  // Azerbaijani texts: a tapped word opens its dictionary entry
  glossary: boolean;
}

export const readingFonts = ['book', 'literary', 'sans', 'system'] as const;
export type ReadingFont = (typeof readingFonts)[number];
export const lineSpacings = ['tight', 'normal', 'loose'] as const;
export type LineSpacing = (typeof lineSpacings)[number];
export const paragraphStyles = ['spaced', 'indented'] as const;
export type ParagraphStyle = (typeof paragraphStyles)[number];
export const textAligns = ['start', 'justify'] as const;
export type TextAlign = (typeof textAligns)[number];

const STORAGE_KEY = 'irs-reading-prefs';

const defaults: ReadingPrefs = {
  fontSize: 1,
  width: 0,
  fontFamily: 'book',
  leading: 'normal',
  // Prose is set like a book page by default: indented paragraphs. Ragged right, because no
  // browser hyphenates Azerbaijani and a justified 36rem column opens rivers; justified is a choice
  paragraphs: 'indented',
  align: 'start',
  numbers: false,
  glossary: true,
};

/** A saved choice, including the older 'serif' (now 'book') */
function fontOf(saved: unknown): ReadingFont {
  if (saved === 'serif') return 'book';
  return readingFonts.includes(saved as ReadingFont) ? (saved as ReadingFont) : defaults.fontFamily;
}

function load(): ReadingPrefs {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      fontSize: typeof parsed.fontSize === 'number' ? Math.min(3, Math.max(0, parsed.fontSize)) : defaults.fontSize,
      width: typeof parsed.width === 'number' ? Math.min(2, Math.max(0, parsed.width)) : defaults.width,
      fontFamily: fontOf(parsed.fontFamily),
      leading: lineSpacings.includes(parsed.leading) ? parsed.leading : defaults.leading,
      paragraphs: paragraphStyles.includes(parsed.paragraphs) ? parsed.paragraphs : defaults.paragraphs,
      align: textAligns.includes(parsed.align) ? parsed.align : defaults.align,
      numbers: parsed.numbers === true,
      glossary: parsed.glossary !== false,
    };
  } catch {
    return defaults;
  }
}

export function useReadingPrefs() {
  const [prefs, setPrefs] = useState<ReadingPrefs>(defaults);

  useEffect(() => {
    setPrefs(load());
  }, []);

  function update(patch: Partial<ReadingPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private mode or blocked storage: the choice still holds for this visit
      }
      return next;
    });
  }

  return { prefs, update };
}
