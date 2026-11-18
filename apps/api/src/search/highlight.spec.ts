import { describe, expect, it } from 'vitest';
import { excerpt, highlight, matchStarts, opening, queryTerms, snippet } from './highlight';

/** What Meilisearch reports: the match's offset in UTF-8 bytes */
const byteStart = (text: string, word: string, from = 0) => ({ start: Buffer.byteLength(text.slice(0, text.indexOf(word, from)), 'utf8') });

describe('queryTerms', () => {
  it('folds Azerbaijani letters and treats the last word as a prefix', () => {
    expect(queryTerms('Qəzəl GÜL')).toEqual({ whole: ['qezel'], prefix: 'gul' });
    expect(queryTerms('  ')).toEqual({ whole: [], prefix: null });
  });
});

describe('matchStarts', () => {
  it('turns byte offsets into character offsets in Azerbaijani text', () => {
    const text = 'Məni candan usandırdı, cəfadan yar usanmazmı';
    expect(matchStarts(text, [byteStart(text, 'cəfadan')])).toEqual([text.indexOf('cəfadan')]);
    expect(Buffer.byteLength(text.slice(0, text.indexOf('cəfadan')))).toBeGreaterThan(text.indexOf('cəfadan'));
  });

  it('does the same for Persian text, where every letter is two bytes', () => {
    const text = 'ای ساقی بده جامی که من دلتنگم';
    expect(matchStarts(text, [byteStart(text, 'جامی')])).toEqual([text.indexOf('جامی')]);
  });

  it('counts astral characters as JavaScript does', () => {
    const text = '𝄞 gül 😀 bülbül';
    expect(matchStarts(text, [byteStart(text, 'bülbül')])).toEqual([text.indexOf('bülbül')]);
  });

  it('returns positions in ascending order whatever order they arrive in', () => {
    const text = 'gül açdı, bülbül oxudu, gül soldu';
    const second = text.indexOf('gül', 5);
    expect(matchStarts(text, [byteStart(text, 'gül', 5), byteStart(text, 'bülbül'), { start: 0 }])).toEqual([0, text.indexOf('bülbül'), second]);
  });

  it('maps offsets in the folded (*Plain) copy onto the original', () => {
    const text = 'Şəbi-hicran yanar canım';
    // "sebi-hicran yanar canim": positions are counted in the folded bytes
    expect(matchStarts(text, [{ start: Buffer.byteLength('sebi-hicran ') }], true)).toEqual([text.indexOf('yanar')]);
  });

  it('is empty without positions', () => {
    expect(matchStarts('mətn', undefined)).toEqual([]);
    expect(matchStarts('mətn', [])).toEqual([]);
  });
});

describe('highlight', () => {
  it('marks words Meilisearch matched and words matching the query without Azerbaijani letters', () => {
    const text = 'Qəzəl və gül';
    expect(highlight(text, queryTerms('qezel'))).toBe('<mark>Qəzəl</mark> və gül');
    expect(highlight(text, { whole: [], prefix: null }, [text.indexOf('gül')])).toBe('Qəzəl və <mark>gül</mark>');
  });

  it('marks a prefix of the last query word only', () => {
    expect(highlight('gülüstan gül bağ', queryTerms('bağ gül'))).toBe('<mark>gülüstan</mark> <mark>gül</mark> <mark>bağ</mark>');
    expect(highlight('gülüstan gül', queryTerms('gül bağ'))).toBe('gülüstan <mark>gül</mark>');
  });

  it('escapes HTML in the text, inside and outside marks', () => {
    expect(highlight('<b>gül</b> & "bülbül"', queryTerms('gül'))).toBe('&lt;b&gt;<mark>gül</mark>&lt;/b&gt; &amp; &quot;bülbül&quot;');
  });

  it('accepts match positions in any order', () => {
    const text = 'bir iki üç';
    expect(highlight(text, { whole: [], prefix: null }, [text.indexOf('üç'), 0])).toBe('<mark>bir</mark> iki <mark>üç</mark>');
  });
});

describe('excerpt and snippet', () => {
  it('is null when nothing matches', () => {
    expect(snippet('heç nə yoxdur', queryTerms('gül'))).toBeNull();
  });

  it('shows line breaks as " / " and marks the match', () => {
    expect(snippet('Məni candan usandırdı,\ncəfadan yar usanmazmı?', queryTerms('cefadan'))).toBe(
      'Məni candan usandırdı, / <mark>cəfadan</mark> yar usanmazmı?',
    );
  });

  it('prefers the place where the most different query words meet over an earlier lone match', () => {
    const filler = Array.from({ length: 60 }, (_, i) => `söz${i}`).join(' ');
    const text = `gül ${filler} bülbül gül ${filler}`;
    const result = excerpt(text, queryTerms('bülbül gül'))!;
    expect(result.score).toBe(2);
    expect(result.html).toContain('<mark>bülbül</mark> <mark>gül</mark>');
    expect(result.html.startsWith('…')).toBe(true);
    expect(result.html.endsWith('…')).toBe(true);
  });

  it('cuts a long text to a window around the densest matches and still finds them', () => {
    const line = 'Bu bir sətirdir, içində heç nə yoxdur.\n';
    const head = line.repeat(2000);
    const text = `${head}Şəbi-hicran yanar canım, tökər qan çeşmi-giryanım.\n${line.repeat(2000)}`;
    const starts = [...matchStarts(text, [byteStart(text, 'yanar'), byteStart(text, 'canım')])];
    const started = Date.now();
    const result = excerpt(text, queryTerms('yanar canım'), starts)!;
    expect(Date.now() - started).toBeLessThan(200);
    expect(result.score).toBe(2);
    expect(result.html).toContain('<mark>yanar</mark> <mark>canım</mark>');
    expect(result.html.startsWith('…')).toBe(true);
    expect(result.html.endsWith('…')).toBe(true);
    expect(result.html.length).toBeLessThan(600);
  });

  it('stays fast when a word matches thousands of times in a long text', () => {
    const text = 'gül bülbül bağ çəmən '.repeat(20_000);
    // Byte offsets counted as we go: measuring the whole prefix for every match is itself
    // quadratic and took longer than the 5 s test limit on CI runners
    const positions: { start: number }[] = [];
    let prev = 0;
    let bytes = 0;
    for (let at = text.indexOf('gül'); at >= 0 && positions.length < 20_000; at = text.indexOf('gül', at + 1)) {
      bytes += Buffer.byteLength(text.slice(prev, at));
      prev = at;
      positions.push({ start: bytes });
    }
    const started = Date.now();
    const starts = matchStarts(text.slice(0, 200_000), positions.slice(0, 5_000));
    const result = excerpt(text, queryTerms('gül'), starts)!;
    expect(Date.now() - started).toBeLessThan(1500);
    expect(result.html).toContain('<mark>gül</mark>');
  });

  it('gives a long text without reported positions an excerpt from its start', () => {
    const text = `gül açdı. ${'Uzun mətn davam edir. '.repeat(2000)}`;
    expect(snippet(text, queryTerms('gül'))).toMatch(/^<mark>gül<\/mark> açdı\./);
  });

  it('escapes HTML', () => {
    expect(snippet('<i>gül</i> & tikan', queryTerms('gül'))).toBe('&lt;i&gt;<mark>gül</mark>&lt;/i&gt; &amp; tikan');
  });
});

describe('opening', () => {
  it('returns a short text whole and a long one cut at thirty words', () => {
    expect(opening('bir iki\nüç')).toBe('bir iki / üç');
    const long = Array.from({ length: 50 }, (_, i) => `söz${i}`).join(' ');
    expect(opening(long)).toBe(`${Array.from({ length: 30 }, (_, i) => `söz${i}`).join(' ')}…`);
  });
});
