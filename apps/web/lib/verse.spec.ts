import { describe, expect, it } from 'vitest';
import { formatVerse, lineCount, verseBlocks } from './verse';

const ghazal = '<p>a1<br>a2</p><p>b1<br>b2</p><p>c1<br>c2</p>';
const stanzas = '<p>one<br>two<br>three</p><p>four<br>five</p>';

describe('formatVerse', () => {
  it('leaves a text without anchors as it was: no ids, no margin marks', () => {
    const { html } = formatVerse(ghazal, { form: 'GHAZAL' });
    expect(html).not.toContain(' id=');
    expect(html).not.toContain('verse-no');
  });

  it('gives every couplet of the original its own address', () => {
    const { html } = formatVerse(ghazal, { form: 'GHAZAL', anchors: true });
    expect(html.match(/<p class="beyt[^"]*" id="b\d+">/g)).toHaveLength(3);
    expect(html).toContain('href="#b2" data-n="2"');
  });

  it('numbers verse that is not in couplets by line, across stanzas', () => {
    const { html } = formatVerse(stanzas, { anchors: true });
    expect(html.match(/class="verse-line" id="l\d+"/g)).toHaveLength(5);
    expect(html).toContain('<span class="verse-line" id="l4">');
  });

  it('marks every fifth for the margin and no other', () => {
    const six = Array.from({ length: 6 }, (_, i) => `<p>x${i}<br>y${i}</p>`).join('');
    const { html } = formatVerse(six, { anchors: true });
    expect(html.match(/verse-no--fifth/g)).toHaveLength(1);
    expect(html).toContain('class="verse-no verse-no--fifth" href="#b5"');
  });

  it('keeps the number out of the text: the mark is an empty link', () => {
    const { html } = formatVerse(ghazal, { anchors: true });
    expect(html.replace(/<[^>]+>/g, '')).toBe('a1a2b1b2c1c2');
  });
});

describe('verseBlocks and lineCount with anchors', () => {
  it('still splits anchored verse into its couplets, to line up with a translation', () => {
    const { html } = formatVerse(ghazal, { form: 'GHAZAL', anchors: true, maqtaLabel: 'Maqta' });
    expect(verseBlocks(html)).toHaveLength(3);
    expect(lineCount(html)).toBe(6);
  });
});
