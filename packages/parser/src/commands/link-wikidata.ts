import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import type { AuthorConfig, AuthorFrontmatter } from '../types';
import { findWikidataId } from '../scrapers/wikidata-id';

const CONFIG_PATH = path.resolve(__dirname, '../../data/config/authors.json');
const AUTHORS_DIR = path.resolve(__dirname, '../../data/authors');

const authorFile = (slug: string) => path.join(AUTHORS_DIR, `${slug}.md`);

export function readAuthorFrontmatter(slug: string): AuthorFrontmatter | null {
  const file = authorFile(slug);
  return fs.existsSync(file) ? (matter(fs.readFileSync(file, 'utf-8')).data as AuthorFrontmatter) : null;
}

/** Adds `wikidataId:` under the slug line, leaving the rest of the file as written */
function writeWikidataId(slug: string, id: string) {
  const file = authorFile(slug);
  const raw = fs.readFileSync(file, 'utf-8');
  const next = /^wikidataId:.*$/m.test(raw)
    ? raw.replace(/^wikidataId:.*$/m, `wikidataId: ${id}`)
    : raw.replace(/^(slug:.*)$/m, `$1\nwikidataId: ${id}`);
  fs.writeFileSync(file, next, 'utf-8');
}

/**
 * Links authors to their Wikidata items (see scrapers/wikidata-id.ts) without re-scraping
 * them: fills `wikidataId` in data/authors/<slug>.md for authors that lack it. Then
 * `import-md --type authors` carries it to the database.
 */
export const linkWikidataCommand = new Command('link-wikidata')
  .description('Find authors\' Wikidata items and write them into their .md files')
  .option('--author <slug>', 'Only this author')
  .option('--dry-run', 'Report what would be linked without writing files')
  .action(async (opts: { author?: string; dryRun?: boolean }) => {
    const authors: AuthorConfig[] = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const todo = authors.filter((a) => (opts.author ? a.slug === opts.author : true));
    if (!todo.length) {
      console.error(`No authors matched${opts.author ? ` slug "${opts.author}"` : ''}`);
      process.exit(1);
    }

    let linked = 0;
    const unresolved: string[] = [];
    for (const cfg of todo) {
      const fm = readAuthorFrontmatter(cfg.slug);
      if (!fm) continue; // not scraped yet; scrape-authors does the lookup
      // Already linked, unless the config overrides it
      if (fm.wikidataId && !(cfg.wikidata && cfg.wikidata !== fm.wikidataId)) continue;

      const match = await findWikidataId(cfg, { bornYear: fm.bornYear, diedYear: fm.diedYear });
      if (match.id) {
        console.log(`  ${cfg.slug}: ${match.id} (${match.via})`);
        if (!opts.dryRun) writeWikidataId(cfg.slug, match.id);
        linked++;
      } else if (match.via !== 'config') {
        unresolved.push(`  ${cfg.slug}: ${match.note}`);
      }
    }

    console.log(`\n${opts.dryRun ? 'Would link' : 'Linked'} ${linked} author(s).`);
    if (unresolved.length) {
      console.log(`\nNot linked (${unresolved.length}). Set "wikidata" in the config to a QID, or to false when none exists:`);
      console.log(unresolved.join('\n'));
    }
  });
