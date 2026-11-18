import { describe, expect, it } from 'vitest';
import { localePath, splitLocale } from './i18n';

describe('localePath', () => {
  it('leaves Azerbaijani unprefixed', () => {
    expect(localePath('az')).toBe('/');
    expect(localePath('az', '/works/foo')).toBe('/works/foo');
  });
  it('prefixes Russian and English', () => {
    expect(localePath('ru')).toBe('/ru');
    expect(localePath('en', '/works/foo')).toBe('/en/works/foo');
  });
});

describe('splitLocale', () => {
  it('reads a locale prefix', () => {
    expect(splitLocale('/ru/works/foo')).toEqual({ locale: 'ru', path: '/works/foo' });
    expect(splitLocale('/en')).toEqual({ locale: 'en', path: '' });
  });
  it('treats an unprefixed path as Azerbaijani', () => {
    expect(splitLocale('/works/foo')).toEqual({ locale: 'az', path: '/works/foo' });
  });
  it('does not mistake a two-letter-looking segment for a locale', () => {
    expect(splitLocale('/rubai')).toEqual({ locale: 'az', path: '/rubai' });
    expect(splitLocale('/de/works')).toEqual({ locale: 'az', path: '/de/works' });
  });
});
