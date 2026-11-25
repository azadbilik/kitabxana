/**
 * The Cleveland Museum of Art Open Access importer — CC0 manuscript pages, miniatures and
 * textiles illustrating an author's poems (openaccess-api.clevelandart.org, no key).
 *
 * Searches only gather candidates ("nizami" also finds a Mughal hookah bowl and Jami's Haft
 * Awrang, Amir Khusraw's Khamsa). An object is kept when it is CC0 with an image and its title
 * matches the config's `require` and not its `exclude` (titles only: a description may name the
 * poet for a sampler merely in his style). Text-only versos are left out: the gallery is for
 * pictures. A leaf catalogued whole and by side (1944.487, .a, .b) is kept whole.
 */
import { cachedGetJson } from '../utils/http';
import type { AuthorConfig } from '../types';
import type { PlannedArtwork } from './met';

const API = 'https://openaccess-api.clevelandart.org/api/artworks/';

interface ClevelandObject {
  id: number;
  accession_number: string;
  title: string;
  creation_date: string | null;
  creation_date_earliest: number | null;
  creation_date_latest: number | null;
  culture: string[] | null;
  technique: string | null;
  url: string;
  share_license_status: string;
  creditline: string | null;
  description: string | null;
  images: { web?: { url: string } | null; print?: { url: string } | null } | null;
  creators: { description: string; role?: string }[] | null;
}

export async function planClevelandArtworks(cfg: AuthorConfig): Promise<{ artworks: PlannedArtwork[]; candidates: number }> {
  const cl = cfg.cleveland!;
  const require = new RegExp(cl.require, 'i');
  const exclude = cl.exclude ? new RegExp(cl.exclude, 'i') : null;
  const rules = (cl.collections ?? []).map((r) => ({ re: new RegExp(r.match, 'i'), collection: r.collection }));

  const found = new Map<number, ClevelandObject>();
  for (const q of cl.queries) {
    const qs = new URLSearchParams({ q, cc0: '1', has_image: '1', limit: '200' });
    const res = await cachedGetJson<{ data: ClevelandObject[] }>(`${API}?${qs}`);
    for (const o of res.data) found.set(o.id, o);
  }

  const artworks: PlannedArtwork[] = [];
  for (const o of found.values()) {
    if (o.share_license_status !== 'CC0' || !o.images?.web?.url) continue;
    if (!require.test(o.title)) continue;
    if (exclude?.test(o.title)) continue;
    // "Text Page, Persian Verses (verso) …": the back of a painted leaf, nothing to look at
    if (/^Text(?: Page)?\b|^Text in\b/i.test(o.title)) continue;

    const place = o.culture?.[0];
    artworks.push({
      sourceId: `cleveland-${o.accession_number}`,
      title: o.title,
      collectionSlug: rules.find((r) => r.re.test(o.title))?.collection,
      objectDate: o.creation_date || undefined,
      yearStart: o.creation_date_earliest ?? undefined,
      yearEnd: o.creation_date_latest ?? undefined,
      medium: [o.technique, place].filter(Boolean).join('; ') || undefined,
      artists: o.creators?.map((c) => c.description).join(', ') || undefined,
      imageUrl: o.images.print?.url ?? o.images.web.url,
      imageSmallUrl: o.images.web.url,
      additionalImages: [],
      sourceUrl: o.url,
      creditLine: o.creditline ? `The Cleveland Museum of Art, ${o.creditline}` : 'The Cleveland Museum of Art',
    });
  }

  // The whole leaf stands for its recto and verso
  const accessions = new Set(artworks.map((a) => a.sourceId));
  const whole = artworks.filter((a) => !accessions.has(a.sourceId.replace(/\.[a-z]$/, '')) || a.sourceId === a.sourceId.replace(/\.[a-z]$/, ''));
  artworks.length = 0;
  artworks.push(...whole);

  artworks.sort((a, b) => (a.yearStart ?? 9999) - (b.yearStart ?? 9999) || a.sourceId.localeCompare(b.sourceId));
  return { artworks, candidates: found.size };
}
