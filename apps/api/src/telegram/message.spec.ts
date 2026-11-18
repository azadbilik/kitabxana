import { describe, expect, it } from 'vitest';
import { bakuHour, formatDailyPoem } from './message';

describe('formatDailyPoem', () => {
  const post = {
    title: 'Məni candan usandırdı',
    author: 'Məhəmməd Füzuli',
    lines: ['Məni candan usandırdı, cəfadan yar usanmazmı?', 'Fələklər yandı ahimdən, muradım şəmi yanmazmı?'],
    url: 'https://kitabxana.az/works/fuzuli-meni-candan-usandirdi',
  };

  it('lays out title, poet, the opening lines and the link', () => {
    expect(formatDailyPoem(post)).toBe(
      [
        '<b>Məni candan usandırdı</b>',
        '<i>Məhəmməd Füzuli</i>',
        '',
        'Məni candan usandırdı, cəfadan yar usanmazmı?',
        'Fələklər yandı ahimdən, muradım şəmi yanmazmı?',
        '…',
        '',
        '<a href="https://kitabxana.az/works/fuzuli-meni-candan-usandirdi">Davamını Kitabxana.az-da oxuyun</a>',
      ].join('\n'),
    );
  });

  it('escapes what Telegram would read as markup', () => {
    const text = formatDailyPoem({ ...post, title: 'A < B & C', author: '<i>x</i>', lines: ['1 > 0 & <b>'], url: 'https://kitabxana.az/works/a"b?x=1&y=2' });
    expect(text).toContain('<b>A &lt; B &amp; C</b>');
    expect(text).toContain('<i>&lt;i&gt;x&lt;/i&gt;</i>');
    expect(text).toContain('1 &gt; 0 &amp; &lt;b&gt;');
    expect(text).toContain('href="https://kitabxana.az/works/a&quot;b?x=1&amp;y=2"');
  });

  it('cuts an over-long line and stays under Telegram\'s 4096 characters', () => {
    const text = formatDailyPoem({ ...post, lines: Array(8).fill('a'.repeat(5000)) });
    expect(text.length).toBeLessThan(4096);
    expect(text).toContain(`${'a'.repeat(300)}…`);
  });
});

describe('bakuHour', () => {
  it('is UTC+4 all year', () => {
    expect(bakuHour(new Date('2026-01-15T05:30:00Z'))).toBe(9);
    expect(bakuHour(new Date('2026-07-15T05:30:00Z'))).toBe(9);
    expect(bakuHour(new Date('2026-07-15T20:00:00Z'))).toBe(0);
  });
});
