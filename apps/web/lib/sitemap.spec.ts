import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ api: {} }));
vi.mock('@/lib/seo', () => ({ SITE_URL: 'https://kitabxana.az' }));

import { indexXml, urlsetXml } from './sitemap';

describe('urlsetXml', () => {
  it('lists one URL per locale with hreflang siblings, Azerbaijani unprefixed', () => {
    const xml = urlsetXml([{ path: '/works/foo' }]);
    expect(xml).toContain('<loc>https://kitabxana.az/works/foo</loc>');
    expect(xml).toContain('<loc>https://kitabxana.az/ru/works/foo</loc>');
    expect(xml).toContain('hreflang="x-default" href="https://kitabxana.az/works/foo"');
    expect(xml.match(/<url>/g)).toHaveLength(3);
  });
  it('lists only the locales a work has text in', () => {
    const xml = urlsetXml([{ path: '/works/foo', locales: ['az'] }]);
    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).not.toContain('/ru/works/foo');
  });
  it('escapes XML', () => {
    expect(urlsetXml([{ path: '/tags/a&b' }])).toContain('a&amp;b');
  });
});

describe('indexXml', () => {
  it('points at each section', () => {
    expect(indexXml(['pages', 'works-1'])).toContain('<loc>https://kitabxana.az/sitemaps/works-1.xml</loc>');
  });
});
