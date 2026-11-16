/**
 * An author's Wikidata item, for schema.org sameAs on the site (Author.wikidataId).
 *
 * In order of trust:
 *  1. `wikidata` in the author's config: a QID, or `false` for "checked, no item"
 *  2. the item linked to the author's Wikipedia article (config `wikipedia` titles)
 *  3. a name search: exact az/ru/en labels, kept only when exactly one person matches and
 *     every year we know agrees with theirs (within a year). Authors with no known year
 *     are never matched this way: a bare name such as "Abbas" or "Əli" fits hundreds.
 *
 * Linking the wrong person tells search engines a false fact, so anything doubtful is left
 * out and reported for a look by hand.
 */
import type { AuthorConfig } from '../types';
import { cachedGetJson } from '../utils/http';
import { findWikidataItem, type WikidataItem } from './portraits';

const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const HUMAN = 'Q5';
const YEAR_SLACK = 1;

export interface WikidataMatch {
  id: string | null;
  via: 'config' | 'existing' | 'wikipedia' | 'search' | 'none';
  /** Why nothing was linked, or what was rejected */
  note?: string;
}

interface Years {
  bornYear?: number;
  diedYear?: number;
}

const isHuman = (item: WikidataItem) =>
  (item.claims.P31 ?? []).some((c: any) => c.mainsnak?.datavalue?.value?.id === HUMAN);

/** Every year stated for a date property, at decade precision or better */
function claimYears(item: WikidataItem, prop: string): number[] {
  return (item.claims[prop] ?? [])
    .filter((c: any) => c.rank !== 'deprecated' && c.mainsnak?.datavalue?.value?.precision >= 8)
    .map((c: any) => {
      const m = (c.mainsnak.datavalue.value.time as string).match(/^([+-])0*(\d+)/);
      return m ? (m[1] === '-' ? -1 : 1) * parseInt(m[2], 10) : NaN;
    })
    .filter(Number.isFinite);
}

/** No year we know contradicts the item; a year the item lacks is no contradiction */
function yearsAgree(item: WikidataItem, years: Years): boolean {
  const ok = (known: number | undefined, prop: string) => {
    if (known == null) return true;
    const theirs = claimYears(item, prop);
    return !theirs.length || theirs.some((y) => Math.abs(y - known) <= YEAR_SLACK);
  };
  return ok(years.bornYear, 'P569') && ok(years.diedYear, 'P570');
}

/** For the name search the years must be confirmed, not merely uncontradicted */
function yearsConfirmed(item: WikidataItem, years: Years): boolean {
  const ok = (known: number | undefined, prop: string) =>
    known == null || claimYears(item, prop).some((y) => Math.abs(y - known) <= YEAR_SLACK);
  return ok(years.bornYear, 'P569') && ok(years.diedYear, 'P570');
}

async function searchByName(cfg: AuthorConfig, years: Years): Promise<WikidataMatch> {
  if (years.bornYear == null && years.diedYear == null) {
    return { id: null, via: 'none', note: 'no Wikipedia article and no known year; check by hand' };
  }
  const ids = new Set<string>();
  for (const [name, lang] of [[cfg.nameAz, 'az'], [cfg.nameRu, 'ru'], [cfg.nameEn, 'en']] as const) {
    if (!name) continue;
    const qs = new URLSearchParams({ action: 'wbsearchentities', search: name, language: lang, uselang: lang, type: 'item', limit: '7', format: 'json' });
    const d = await cachedGetJson<{ search?: { id: string }[] }>(`${WIKIDATA}?${qs}`);
    for (const r of d.search ?? []) ids.add(r.id);
  }
  if (!ids.size) return { id: null, via: 'none', note: 'no Wikidata item by that name' };

  const qs = new URLSearchParams({ action: 'wbgetentities', ids: [...ids].slice(0, 50).join('|'), props: 'claims', format: 'json' });
  const d = await cachedGetJson<{ entities?: Record<string, any> }>(`${WIKIDATA}?${qs}`);
  const fits = Object.values(d.entities ?? {})
    .map((e: any) => ({ id: e.id as string, claims: e.claims ?? {} }))
    .filter((item) => isHuman(item) && yearsConfirmed(item, years));
  if (fits.length === 1) return { id: fits[0].id, via: 'search' };
  return {
    id: null,
    via: 'none',
    note: fits.length ? `several people fit: ${fits.map((f) => f.id).join(', ')}; check by hand` : 'nobody by that name has these years',
  };
}

export async function findWikidataId(cfg: AuthorConfig, years: Years, existing?: string): Promise<WikidataMatch> {
  if (cfg.wikidata === false) return { id: null, via: 'config' };
  if (cfg.wikidata) return { id: cfg.wikidata, via: 'config' };
  if (existing) return { id: existing, via: 'existing' };

  try {
    const item = await findWikidataItem(cfg);
    if (item) {
      if (!isHuman(item)) return { id: null, via: 'none', note: `${item.id}, the Wikipedia article's item, is not a person` };
      if (!yearsAgree(item, years)) return { id: null, via: 'none', note: `${item.id}, the Wikipedia article's item, has other years` };
      return { id: item.id, via: 'wikipedia' };
    }
    return await searchByName(cfg, years);
  } catch (e) {
    return { id: null, via: 'none', note: `lookup failed (${(e as Error).message}); run link-wikidata again` };
  }
}
