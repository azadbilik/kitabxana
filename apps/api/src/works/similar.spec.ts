import { describe, expect, it } from 'vitest';
import { SimilarIndex, pickSimilar } from './similar';

describe('SimilarIndex', () => {
  it('maps indexes to ids, skipping unknown works and the work itself', () => {
    const index = new SimilarIndex({ ids: ['a', 'b', null, 'd'], nn: [[1, 2, 3, 0], [0], [0], []] });
    expect(index.of('a')).toEqual(['b', 'd']);
    expect(index.of('b')).toEqual(['a']);
    expect(index.of('d')).toEqual([]);
    expect(index.of('zzz')).toEqual([]);
    expect(index.size).toBe(2);
  });
});

describe('pickSimilar', () => {
  const authorOf = new Map([
    ['w1', 'vaqif'],
    ['w2', 'vaqif'],
    ['w3', 'zakir'],
    ['w5', 'vidadi'],
  ]);

  it('keeps the nearest work of each other author, in order', () => {
    expect(pickSimilar(['w1', 'w2', 'w3', 'w4', 'w5'], authorOf, 4)).toEqual(['w1', 'w3', 'w5']);
  });

  it('skips works that may not be shown and stops at take', () => {
    expect(pickSimilar(['w4', 'w3', 'w1', 'w5'], authorOf, 2)).toEqual(['w3', 'w1']);
  });
});
