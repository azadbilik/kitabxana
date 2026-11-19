import { describe, expect, it } from 'vitest';
import { inReadingBand } from './reading-time';

describe('inReadingBand', () => {
  it('counts verse slower than prose', () => {
    expect(inReadingBand('short').OR).toEqual([
      { genre: 'POEM', wordCount: { gte: 0, lt: 660 } },
      { genre: { not: 'POEM' }, wordCount: { gte: 0, lt: 990 } },
    ]);
  });
  it('leaves the last band open', () => {
    expect(inReadingBand('book').OR).toEqual([
      { genre: 'POEM', wordCount: { gte: 7140 } },
      { genre: { not: 'POEM' }, wordCount: { gte: 10710 } },
    ]);
  });
  it('never matches a work without text', () => expect(inReadingBand('short').wordCount).toEqual({ gt: 0 }));
});
