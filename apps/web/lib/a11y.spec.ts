import { describe, expect, it } from 'vitest';
import { A11Y_BOOT, a11yAttrs, a11yDefaults, parseA11y, type A11yPrefs } from './a11y';

/** Runs the pre-paint script against a stand-in for <html> and localStorage */
function boot(stored: string | null): Record<string, string> {
  const set: Record<string, string> = {};
  const d = { setAttribute: (name: string, value: unknown) => (set[name] = String(value)) };
  const localStorage = { getItem: () => stored };
  new Function('d', 'localStorage', A11Y_BOOT)(d, localStorage);
  return set;
}

const present = (attrs: Record<string, string | null>) =>
  Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== null));

describe('accessibility choices', () => {
  it('reads nothing stored as the defaults, which set no attribute', () => {
    expect(parseA11y(null)).toEqual(a11yDefaults);
    expect(present(a11yAttrs(a11yDefaults))).toEqual({});
  });

  it('drops values it does not know', () => {
    expect(parseA11y('{"contrast":"less","text":7,"spacing":"yes","motion":1}')).toEqual(a11yDefaults);
    expect(parseA11y('not json')).toEqual(a11yDefaults);
    expect(parseA11y('null')).toEqual(a11yDefaults);
  });

  it('applies the same attributes before paint as after', () => {
    const cases: A11yPrefs[] = [
      a11yDefaults,
      { contrast: 'more', text: 2, spacing: true, legible: true, motion: 'reduce', keys: false },
      { contrast: 'auto', text: 1, spacing: false, legible: true, motion: 'auto', keys: true },
    ];
    for (const prefs of cases) {
      expect(boot(JSON.stringify(prefs))).toEqual(present(a11yAttrs(prefs)));
    }
    expect(boot(null)).toEqual({});
    expect(boot('{"text":9,"contrast":"x"}')).toEqual({});
  });
});
