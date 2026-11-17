import { describe, expect, it } from 'vitest';
import { cleanProgress, statusOnPartDone, statusOnPartOpened } from './rules';

describe('statusOnPartOpened', () => {
  it('shelves a prose or drama book as reading when a part is opened', () => {
    expect(statusOnPartOpened(null, 'PROSE')).toBe('READING');
    expect(statusOnPartOpened(null, 'PLAY')).toBe('READING');
  });
  it('does not shelve a poem collection the reader never added', () => {
    expect(statusOnPartOpened(null, 'POEM')).toBeNull();
  });
  it('moves a wanted book, poems included, to reading', () => {
    expect(statusOnPartOpened('WANT', 'POEM')).toBe('READING');
    expect(statusOnPartOpened('WANT', 'PROSE')).toBe('READING');
  });
  it('never demotes a read book, and leaves a book being read alone', () => {
    expect(statusOnPartOpened('DONE', 'PROSE')).toBeNull();
    expect(statusOnPartOpened('READING', 'PROSE')).toBeNull();
  });
});

describe('statusOnPartDone', () => {
  it('marks a prose book read when its last part is read', () => {
    expect(statusOnPartDone('READING', 'PROSE', 9, 9)).toBe('DONE');
    expect(statusOnPartDone(null, 'PROSE', 1, 1)).toBe('DONE');
  });
  it('keeps a half-read book reading', () => {
    expect(statusOnPartDone('READING', 'PROSE', 4, 9)).toBeNull();
    expect(statusOnPartDone(null, 'PROSE', 4, 9)).toBe('READING');
  });
  it('leaves an unshelved poem collection alone even when every poem is read', () => {
    expect(statusOnPartDone(null, 'POEM', 7, 7)).toBeNull();
  });
  it('finishes a shelved poem collection when all its poems are read', () => {
    expect(statusOnPartDone('WANT', 'POEM', 7, 7)).toBe('DONE');
    expect(statusOnPartDone('WANT', 'POEM', 3, 7)).toBe('READING');
  });
  it('does nothing to a book already read', () => {
    expect(statusOnPartDone('DONE', 'PROSE', 9, 9)).toBeNull();
  });
});

describe('cleanProgress', () => {
  it('clamps to 0..1 and rounds to 4 decimals', () => {
    expect(cleanProgress(1.4)).toBe(1);
    expect(cleanProgress(-2)).toBe(0);
    expect(cleanProgress(0.123456)).toBe(0.1235);
    expect(cleanProgress('x')).toBe(0);
    expect(cleanProgress(Number.NaN)).toBe(0);
  });
});
