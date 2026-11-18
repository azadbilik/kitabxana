/**
 * The reader's accessibility choices, site-wide: stronger contrast, larger text, wider
 * letter and word spacing, a typeface with unmistakable letters, no motion. Kept in
 * localStorage (the pages stay the same for everyone) and put on <html> as data-*
 * attributes, which styles/a11y.css reads. The inline script in app/layout.tsx applies
 * them before the first paint; A11Y_BOOT below is that script's part.
 */
export interface A11yPrefs {
  /** 'auto' follows the system's "increase contrast" */
  contrast: 'auto' | 'more';
  /** Steps above the browser's own text size: 0 (100%), 1 (112.5%), 2 (125%) */
  text: 0 | 1 | 2;
  spacing: boolean;
  /** Andika in place of the site's faces, the reading text included */
  legible: boolean;
  /** 'auto' follows the system's "reduce motion" */
  motion: 'auto' | 'reduce';
  /** Single-letter shortcuts (R: a random work). Off for readers whose speech input or
   *  switch would set them off by accident; the arrow keys are not affected */
  keys: boolean;
}

export const A11Y_KEY = 'a11y';

export const a11yDefaults: A11yPrefs = { contrast: 'auto', text: 0, spacing: false, legible: false, motion: 'auto', keys: true };

/** A stored value read back, with anything unknown falling to its default */
export function parseA11y(raw: string | null): A11yPrefs {
  if (!raw) return a11yDefaults;
  try {
    const p = JSON.parse(raw) ?? {};
    return {
      contrast: p.contrast === 'more' ? 'more' : 'auto',
      text: p.text === 1 || p.text === 2 ? p.text : 0,
      spacing: p.spacing === true,
      legible: p.legible === true,
      motion: p.motion === 'reduce' ? 'reduce' : 'auto',
      keys: p.keys !== false,
    };
  } catch {
    return a11yDefaults;
  }
}

/** The <html> attributes for a set of choices; null removes the attribute */
export function a11yAttrs(p: A11yPrefs): Record<string, string | null> {
  return {
    'data-contrast': p.contrast === 'more' ? 'more' : null,
    'data-text': p.text ? String(p.text) : null,
    'data-spacing': p.spacing ? '' : null,
    'data-legible': p.legible ? '' : null,
    'data-motion': p.motion === 'reduce' ? 'reduce' : null,
  };
}

export function loadA11y(): A11yPrefs {
  try {
    return parseA11y(localStorage.getItem(A11Y_KEY));
  } catch {
    return a11yDefaults;
  }
}

export function applyA11y(p: A11yPrefs) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(a11yAttrs(p))) {
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
}

export function saveA11y(p: A11yPrefs) {
  applyA11y(p);
  try {
    // Nothing chosen leaves nothing stored
    if (JSON.stringify(p) === JSON.stringify(a11yDefaults)) localStorage.removeItem(A11Y_KEY);
    else localStorage.setItem(A11Y_KEY, JSON.stringify(p));
  } catch {
    // Private mode or blocked storage: the choice still holds for this page
  }
}

/** True when the reader, here or in the system's settings, asked for no motion */
export function reducedMotion(): boolean {
  return (
    document.documentElement.getAttribute('data-motion') === 'reduce' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * The same choices applied before the first paint, as source for the inline script (`d` is
 * document.documentElement there). Written out by hand because that script runs before any
 * module loads; lib/a11y.spec.ts runs it against a11yAttrs so the two cannot drift apart.
 */
export const A11Y_BOOT =
  `var a=JSON.parse(localStorage.getItem('${A11Y_KEY}')||'{}')||{};` +
  `if(a.contrast==='more')d.setAttribute('data-contrast','more');` +
  `if(a.text===1||a.text===2)d.setAttribute('data-text',a.text);` +
  `if(a.spacing===true)d.setAttribute('data-spacing','');` +
  `if(a.legible===true)d.setAttribute('data-legible','');` +
  `if(a.motion==='reduce')d.setAttribute('data-motion','reduce');`;
