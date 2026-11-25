import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorConfig } from '../types';
import { planMetArtworks } from '../scrapers/met';
import { planWaltersArtworks } from '../scrapers/walters';
import { planCommonsArtworks } from '../scrapers/commons';
import matter from 'gray-matter';
import { writeArtworkMd } from '../writers/md-writer';
import type { ArtworkFrontmatter } from '../types';

const DATA_DIR = path.resolve(__dirname, '../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'config/authors.json');

function loadAuthors(): AuthorConfig[] {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

type Source = 'met' | 'walters' | 'commons';

/**
 * Artworks taken out by hand (another poet's work, a photo, a carpet): a re-scrape must not bring
 * them back. data/artworks/removed.json: { "<sourceId>": "why" }.
 */
const REMOVED: Record<string, string> = (() => {
  const file = path.join(DATA_DIR, 'artworks', 'removed.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : {};
})();

/** The fields set by hand after a scrape (the poem a folio belongs to, the passage it illustrates) */
type Curated = Pick<ArtworkFrontmatter, 'collectionSlug' | 'workSlug'>;

/**
 * Rewrites one source's files for an author from a fresh scrape (so objects a museum withdraws drop
 * out), keeping what was curated by hand: a poem set on a folio the scraper couldn't place, and
 * the chapter it illustrates (Azad Bilik's scene catalogues). The existing file's poem wins over
 * the scraper's, so a folio moved or taken out of a poem by hand stays where it was put.
 */
function regenerate(cfg: AuthorConfig, prefix: string, artworks: ArtworkFrontmatter[]) {
  const dir = path.join(DATA_DIR, 'artworks', cfg.slug);
  const curated = new Map<string, Curated>();
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (!f.startsWith(prefix)) continue;
      const { data } = matter(fs.readFileSync(path.join(dir, f), 'utf-8'));
      curated.set(data.sourceId, { collectionSlug: data.collectionSlug, workSlug: data.workSlug });
      fs.unlinkSync(path.join(dir, f));
    }
  }
  const kept = artworks.filter((a) => !(a.sourceId in REMOVED));
  for (const a of kept) {
    const c = curated.get(a.sourceId);
    writeArtworkMd(c ? { ...a, collectionSlug: c.collectionSlug, workSlug: c.workSlug ?? a.workSlug } : a);
  }
  console.log(`  Wrote ${kept.length} artworks${kept.length < artworks.length ? ` (${artworks.length - kept.length} removed by hand left out)` : ''}`);
}

async function scrapeMet(cfg: AuthorConfig, dryRun: boolean) {
  if (!cfg.met) {
    console.warn(`  No met config for ${cfg.slug}`);
    return;
  }

  const { artworks, candidates } = await planMetArtworks(cfg);
  const byCollection = new Map<string, number>();
  for (const a of artworks) {
    const key = a.collectionSlug ?? '(author only)';
    byCollection.set(key, (byCollection.get(key) ?? 0) + 1);
  }
  console.log(`  ${artworks.length} public-domain artworks credited to ${cfg.slug} (of ${candidates} candidates)`);
  for (const [coll, n] of byCollection) console.log(`    ${coll}: ${n}`);

  if (dryRun) {
    for (const a of artworks.slice(0, 10)) console.log(`    ${a.sourceId}  ${a.objectDate ?? ''}  ${a.title.slice(0, 70)}`);
    return;
  }

  // Regenerate rather than merge, so objects the Met withdraws or re-credits drop out
  regenerate(cfg, 'met-', artworks.map((a, i) => ({
    ...a, authorSlug: cfg.slug, museum: 'The Metropolitan Museum of Art', license: 'CC0', order: i + 1, status: 'DRAFT',
  })));
}

async function scrapeWalters(cfg: AuthorConfig, dryRun: boolean) {
  if (!cfg.walters) {
    console.warn(`  No walters config for ${cfg.slug}`);
    return;
  }
  const { artworks, skipped } = await planWaltersArtworks(cfg);
  const byCollection = new Map<string, number>();
  for (const a of artworks) byCollection.set(a.collectionSlug ?? '(author only)', (byCollection.get(a.collectionSlug ?? '(author only)') ?? 0) + 1);
  console.log(`  ${artworks.length} miniatures from ${cfg.walters.manuscripts.length} manuscripts (${skipped} skipped: other poets' works or no page image)`);
  for (const [coll, n] of byCollection) console.log(`    ${coll}: ${n}`);
  console.log(`  Licence: ${[...new Set(artworks.map((a) => a.license))].join(', ')}`);
  if (dryRun) {
    for (const a of artworks.slice(0, 8)) console.log(`    ${a.sourceId}  ${a.objectDate ?? ''}  ${a.title.slice(0, 80)}`);
    return;
  }

  regenerate(cfg, 'walters-', artworks.map((a, i) => ({
    ...a, authorSlug: cfg.slug, museum: 'The Walters Art Museum', order: i + 1, status: 'DRAFT',
  })));
}

async function scrapeCommons(cfg: AuthorConfig, dryRun: boolean) {
  if (!cfg.commons) {
    console.warn(`  No commons config for ${cfg.slug}`);
    return;
  }
  const { artworks, candidates, reasons } = await planCommonsArtworks(cfg);
  const byCollection = new Map<string, number>();
  for (const a of artworks) byCollection.set(a.collectionSlug ?? '(author only)', (byCollection.get(a.collectionSlug ?? '(author only)') ?? 0) + 1);
  console.log(`  ${artworks.length} illustrations kept of ${candidates} files`);
  for (const [coll, n] of byCollection) console.log(`    ${coll}: ${n}`);
  console.log(`  Dropped: ${Object.entries(reasons).map(([why, n]) => `${n} ${why}`).join('; ')}`);
  if (dryRun) {
    for (const a of artworks.slice(0, 10)) console.log(`    ${a.sourceId}  ${a.yearStart ?? '?'}  ${a.title.slice(0, 70)}  [${a.creditLine?.slice(0, 40) ?? ''}]`);
    return;
  }

  regenerate(cfg, 'commons-', artworks.map((a, i) => ({ ...a, authorSlug: cfg.slug, museum: 'Wikimedia Commons', order: i + 1, status: 'DRAFT' })));
}

export const scrapeImagesCommand = new Command('scrape-images')
  .description('Collect public-domain artworks for authors from museum open-access APIs')
  .requiredOption('--source <source>', 'Source to scrape: met, walters, commons')
  .option('--author <slug>', 'Only scrape artworks for a specific author')
  .option('--dry-run', 'Print what would be written without writing files')
  .action(async (opts: { source: Source; author?: string; dryRun?: boolean }) => {
    const authors = loadAuthors().filter((a) => (opts.author ? a.slug === opts.author : a[opts.source]));
    if (authors.length === 0) {
      console.error(`No authors matched${opts.author ? ` slug "${opts.author}"` : ` with a ${opts.source} config`}`);
      process.exit(1);
    }

    for (const cfg of authors) {
      console.log(`\n=== ${cfg.nameAz} (${cfg.slug}) ===`);
      switch (opts.source) {
        case 'met':
          await scrapeMet(cfg, !!opts.dryRun);
          break;
        case 'walters':
          await scrapeWalters(cfg, !!opts.dryRun);
          break;
        case 'commons':
          await scrapeCommons(cfg, !!opts.dryRun);
          break;
        default:
          console.error(`Unknown source: ${opts.source}`);
          process.exit(1);
      }
    }
  });
