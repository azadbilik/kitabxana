import { describe, expect, it } from 'vitest';
import { marked } from 'marked';
import { renderMarkdown } from './markdown';

describe('renderMarkdown: what the library uses comes through unchanged', () => {
  it('keeps a poem\'s line breaks and stanzas', () => {
    expect(renderMarkdown('Məni candan usandırdı,\ncəfadan yar usanmazmı?\n\nFələklər yandı ahimdən,')).toBe(
      '<p>Məni candan usandırdı,<br>cəfadan yar usanmazmı?</p>\n<p>Fələklər yandı ahimdən,</p>\n',
    );
  });

  it.each([
    ['emphasis', '*əyri* və **qalın**'],
    ['headings', '## Birinci pərdə\n\n### Səhnə 1\n\n#### Qeyd'],
    ['lists', '- bir\n- iki\n\n3. üç\n4. dörd'],
    ['a rule and footnote marks', 'mətn<sup>1</sup>\n\n---\n\n<sup>1</sup> izah'],
    ['indented verse', 'sətir\n\n        girintili sətir\n        ikinci'],
    ['a table', '| a | b |\n|---|:-:|\n| 1 | 2 |'],
    ['quotes and ampersands in text', '"Dedim" & \'dedi\' <3'],
    ['a link in a bio', '[Vikipediya](https://az.wikipedia.org/wiki/F%C3%BCzuli "Füzuli")'],
    ['Persian text', 'ای ساقی\nبده جامی'],
    ['a block quote', '> sitat\n> davamı'],
  ])('%s: byte for byte what marked renders', (_name, md) => {
    expect(renderMarkdown(md)).toBe(marked.parse(md));
  });
});

describe('renderMarkdown: nothing executable survives', () => {
  const TAGS = new Set(['p', 'br', 'hr', 'em', 'strong', 'del', 'sup', 'sub', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'code', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
  const ATTRS = new Set(['href', 'title', 'start', 'align']);

  /** Every tag and attribute in the output is on the allow-list, and links go to http(s) or mailto */
  function assertInert(html: string) {
    // What is left once real tags are taken out must hold no "<": everything else is escaped text
    expect(html.replace(/<\/?[a-z][a-z0-9]*(\s[^<>]*)?>/gi, '')).not.toContain('<');
    for (const [, name, rest] of html.matchAll(/<\/?([a-z][a-z0-9]*)((?:\s[^<>]*)?)>/gi)) {
      expect(TAGS.has(name.toLowerCase()), `tag <${name}>`).toBe(true);
      for (const [, attr, value] of rest.matchAll(/([^\s=]+)\s*=\s*"([^"]*)"/g)) {
        expect(ATTRS.has(attr.toLowerCase()), `attribute ${attr}`).toBe(true);
        if (attr.toLowerCase() === 'href') expect(value).toMatch(/^(https?:|mailto:|[/#?]|[^:]*$)/i);
      }
      // No attribute without a quoted value slipped through
      expect(rest.replace(/[^\s=]+\s*=\s*"[^"]*"/g, '').trim()).toBe('');
    }
  }

  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)><circle/></svg>',
    '<iframe src="https://evil.example"></iframe>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '[bas](javascript:alert(1))',
    '[bas](JaVaScRiPt:alert(1))',
    '[bas](jav&#x61;script:alert(1))',
    '[bas](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '<a href="javascript:alert(1)">bas</a>',
    '<a href="jav&#x09;ascript:alert(1)">bas</a>',
    '<a href="https://ok.example" onclick="alert(1)">bas</a>',
    '<p onmouseover="alert(1)">mətn</p>',
    '<style>body{display:none}</style>',
    '<p style="position:fixed;inset:0">mətn</p>',
    '<form action="https://evil.example"><input name="password"></form>',
    '<meta http-equiv="refresh" content="0;url=https://evil.example">',
    '<object data="x"></object><embed src="x">',
    '<math><mtext><script>alert(1)</script></mtext></math>',
    '<div><script>alert(1)</script>mətn</div>',
    '<<script>script>alert(1)<</script>/script>',
    '![x](x" onerror="alert(1))',
    '<sup onclick="alert(1)">1</sup>',
  ])('%s', (md) => {
    assertInert(renderMarkdown(md));
  });

  it('the check itself catches what it should', () => {
    expect(() => assertInert('<p onclick="x()">a</p>')).toThrow();
    expect(() => assertInert('<script>x</script>')).toThrow();
    expect(() => assertInert('<a href="javascript:x()">a</a>')).toThrow();
    expect(() => assertInert('<p>a</p><img src=x>')).toThrow();
    expect(() => assertInert('<p>fine <a href="https://kitabxana.az">x</a></p>')).not.toThrow();
  });

  it('drops the markup but keeps the reader-visible text', () => {
    const html = renderMarkdown('Salam <span class="x">dünya</span> <b onclick="x()">!</b>');
    expect(html).toBe('<p>Salam dünya !</p>\n');
  });

  it('keeps a safe link and strips unknown attributes from it', () => {
    expect(renderMarkdown('<a href="https://kitabxana.az" target="_blank" onclick="x()">sayt</a>')).toBe(
      '<p><a href="https://kitabxana.az">sayt</a></p>\n',
    );
  });

  it('removes HTML comments', () => {
    expect(renderMarkdown('əvvəl <!-- gizli --> sonra')).toBe('<p>əvvəl  sonra</p>\n');
  });
});
