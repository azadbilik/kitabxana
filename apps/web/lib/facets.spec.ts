import { describe, expect, it } from 'vitest';
import { authorsPath, checkFacetPath, parseWorkFacets, worksPath } from './facets';

describe('filter paths', () => {
  it('builds readable work filters in a fixed order', () => {
    const path = worksPath('az', { author: 'fuzuli', form: 'GHAZAL' });
    expect(path).toBe('/works/muellif-fuzuli/forma-qezel');
    expect(worksPath('ru', { form: 'GHAZAL' })).toBe('/ru/works/forma-qezel');
  });
  it('round-trips through the parser', () => {
    const segments = worksPath('az', { author: 'fuzuli', form: 'GHAZAL' }).split('/').slice(2);
    expect(parseWorkFacets(segments).filters).toMatchObject({ author: 'fuzuli', form: 'GHAZAL' });
  });
  it('builds author filters', () => {
    expect(authorsPath('az', { type: 'POET' })).toBe('/authors/sairler');
  });
});

describe('checkFacetPath', () => {
  it('accepts a canonical path', () => {
    expect(checkFacetPath('/works/muellif-fuzuli/forma-qezel')).toMatchObject({ kind: 'ok', author: 'fuzuli' });
  });
  it('redirects filters given in the wrong order', () => {
    expect(checkFacetPath('/works/forma-qezel/muellif-fuzuli')).toMatchObject({
      kind: 'redirect',
      to: '/works/muellif-fuzuli/forma-qezel',
    });
  });
  it('ignores paths that are not filters', () => {
    expect(checkFacetPath('/works/fuzuli-qezel-1')).toBeNull();
    expect(checkFacetPath('/about')).toBeNull();
  });
});
