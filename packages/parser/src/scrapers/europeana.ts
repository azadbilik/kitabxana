/**
 * Europeana — paintings from museums whose own collections have no usable open API for us: the
 * Rijksmuseum (public domain) and the Chester Beatty Library (CC BY 4.0).
 *
 * A search for Nizami there mostly finds Shahnama folios, lamps called "khamsa" and Ottoman
 * pashas named Nizami, and the Rijksmuseum titles its pages by what they show in Dutch ("A man
 * carries a warrior and his horse on his shoulders"). So the records are chosen by hand in
 * authors.json (`europeana.records`, each with an English title and its poem); this fetches each
 * record for its image, page, date and licence. EUROPEANA_KEY, or Europeana's public demo key.
 */
import { cachedGetJson } from '../utils/http';
import type { AuthorConfig } from '../types';
import type { PlannedArtwork } from './met';

const API = 'https://api.europeana.eu/record/v2';
const KEY = process.env.EUROPEANA_KEY ?? 'api2demo';

interface EuropeanaRecord {
  object: {
    about: string;
    aggregations: { edmIsShownBy?: string; edmIsShownAt?: string; edmDataProvider?: { def?: string[] }; edmRights?: { def?: string[] } }[];
    proxies: { dcDate?: Record<string, string[]>; dctermsCreated?: Record<string, string[]> }[];
  };
}

/** The holders' licence statements, as the gallery and kitabxana name them */
const LICENCES: [RegExp, string][] = [
  [/publicdomain\/mark/, 'Public domain'],
  [/publicdomain\/zero/, 'CC0'],
  [/licenses\/by\/4\.0/, 'CC BY 4.0'],
];

/** Credit the holder asks for when the licence requires it */
const CREDIT: Record<string, string> = {
  'Chester Beatty': '© The Trustees of the Chester Beatty Library, Dublin (CC BY 4.0)',
};

export type EuropeanaArtwork = PlannedArtwork & { museum: string; license: string };

export async function planEuropeanaArtworks(cfg: AuthorConfig): Promise<EuropeanaArtwork[]> {
  const artworks: EuropeanaArtwork[] = [];
  for (const rec of cfg.europeana!.records) {
    const { object } = await cachedGetJson<EuropeanaRecord>(`${API}${rec.id}.json?wskey=${KEY}`);
    const agg = object.aggregations[0];
    const rights = agg.edmRights?.def?.[0] ?? '';
    const licence = LICENCES.find(([re]) => re.test(rights))?.[1];
    if (!licence || !agg.edmIsShownBy) {
      console.warn(`  ${rec.id}: no open licence or no image (${rights || 'no rights statement'}), left out`);
      continue;
    }
    const provider = agg.edmDataProvider?.def?.[0] ?? '';
    const dates = object.proxies.flatMap((p) => Object.values(p.dcDate ?? p.dctermsCreated ?? {}).flat());
    const years = dates.flatMap((d) => [...d.matchAll(/\b(1[0-9]{3})\b/g)].map((m) => Number(m[1])));
    const date = dates.find((d) => !d.startsWith('#')) ?? undefined;
    // Rijksmuseum images come from Google's image server: "=s0" is the original, "=s900" a 900px copy
    const small = agg.edmIsShownBy.replace(/=s0$/, '=s900');

    artworks.push({
      sourceId: `europeana-${rec.id.replace(/^\//, '').replace(/[^A-Za-z0-9]+/g, '-')}`,
      title: rec.title,
      collectionSlug: rec.collection,
      objectDate: date,
      yearStart: years.length ? Math.min(...years) : undefined,
      yearEnd: years.length ? Math.max(...years) : undefined,
      imageUrl: agg.edmIsShownBy,
      imageSmallUrl: small !== agg.edmIsShownBy ? small : undefined,
      additionalImages: [],
      sourceUrl: agg.edmIsShownAt ?? `https://www.europeana.eu/item${rec.id}`,
      creditLine: CREDIT[provider] ?? provider,
      medium: rec.medium,
      museum: provider === 'Chester Beatty' ? 'Chester Beatty Library' : provider,
      license: licence,
    });
  }
  return artworks;
}
