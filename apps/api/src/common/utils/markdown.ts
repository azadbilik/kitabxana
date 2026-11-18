import { marked } from 'marked';
import sanitizeHtml = require('sanitize-html');

marked.setOptions({
  breaks: true, // respect line breaks — critical for poetry
  gfm: true,
});

/**
 * What stored texts and bios actually use (measured on the library, see `pnpm rerender`):
 * paragraphs and line breaks, emphasis, headings, lists, rules, footnote marks, indented
 * verse (pre/code), the odd table, and links in bios. Everything else, including raw HTML
 * typed into a submission, is dropped: the web app injects this HTML as is.
 */
const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'em', 'strong', 'del', 'sup', 'sub', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'pre', 'code', 'a',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    ol: ['start'],
    th: ['align'],
    td: ['align'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  // marked writes quotes in text as entities; put them back so clean HTML passes through
  // byte for byte. (Entities stay decoded while parsing, or `jav&#x61;script:` would slip
  // past the scheme check.)
  textFilter: (text) => text.replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
};

export function sanitizeRenderedHtml(html: string): string {
  // sanitize-html writes void tags as `<br />`; marked (and every stored body) as `<br>`
  return sanitizeHtml(html, SANITIZE).replace(/<(br|hr) \/>/g, '<$1>');
}

export function renderMarkdown(md: string): string {
  return sanitizeRenderedHtml(marked.parse(md) as string);
}
