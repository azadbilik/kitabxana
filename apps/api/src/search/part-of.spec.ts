import { describe, expect, it } from 'vitest';
import { partOf } from './search.service';

const work = (titleAz: string, collection = 'Dəli Kür') => ({ titleAz, collection: { titleAz: collection } });

describe('partOf', () => {
  it('names the longer work for a part titled by its place in it', () => {
    for (const t of ['1', '29', 'IV', 'Birinci hissə, 3', 'IV fəsil, 2', 'Birinci məclis', 'Üçüncü pərdə', 'Epiloq', 'Proloq'])
      expect(partOf(work(t))).toBe('Dəli Kür');
  });
  it('leaves a work with a title of its own alone', () => {
    for (const t of ['Ana dili', 'Kamança', 'Pərdələr arxasında gizli bir söz deyirəm sənə', 'Hissəmizə düşən'])
      expect(partOf(work(t, 'Şeirlər'))).toBeNull();
    expect(partOf({ titleAz: '1', collection: null })).toBeNull();
    expect(partOf(work('Dəli Kür'))).toBeNull();
  });
});
