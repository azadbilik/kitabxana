import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { Genre, Language, PoemForm, ScriptDirection } from '../types';
import { shortSlug } from '../scrapers/wikisource-az';
import { writeCollectionMd, writeTranslationMd, writeWorkMd } from '../writers/md-writer';

const DATA_DIR = path.resolve(__dirname, '../../data');

/**
 * A book of Azerbaijani translations whose originals are not in the library (Füzuli's
 * «Rindü Zahid» in Persian, Nizami's lyric divan lost): each piece becomes a work with an empty
 * body (`originalLang` = the language it was written in) and one default translation holding the text.
 * Config: data/config/translated/<name>.json
 */
export interface TranslatedBook {
  author: string;
  /** In data/proofread: "@@ NNN" opens each printed page, "# Title" each work, then "% key: value" lines, a blank line, the text */
  file: string;
  /** The Presidential Library e-book id (preslib.az/az/elibrary/ebook/<id>): the works' source and sourceIds */
  preslib: string;
  /** The sourceIds' stem when a book is imported in more than one config (default "preslib-<id>") */
  stem?: string;
  /** The language the pieces were written in */
  originalLang: Language;
  /** The edition's year, the translations' year */
  year: number;
  genre: Genre;
  collection: {
    slug: string;
    titleAz: string;
    genre: Genre;
    /** The collection is already on the site (and in data/collections): only the works are written */
    existing?: boolean;
  };
  /** First `order` in the collection (continuing a collection that already holds works) */
  orderStart?: number;
}

/** Per-work keys the proofread file may set below the title: `% translator: C. Xəndan` */
const META = ['translator', 'form', 'titleFa', 'genre', 'originalLang', 'order', 'year', 'slug'] as const;

export function readTranslated(text: string) {
  const works: { title: string; page: number; meta: Record<string, string>; body: string }[] = [];
  let page = 0;
  let lines: string[] = [];
  const flush = () => {
    if (works.length) works[works.length - 1].body = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    lines = [];
  };
  for (const line of text.split('\n')) {
    const at = line.match(/^@@ (\d+)$/);
    if (at) { page = Number(at[1]); continue; }
    if (line.startsWith('// ')) continue;
    const title = line.match(/^# (.+)$/);
    if (title) {
      flush();
      works.push({ title: title[1].trim(), page, meta: {}, body: '' });
      continue;
    }
    const meta = line.match(/^% (\w+): (.*)$/);
    if (meta && works.length && !lines.some((l) => l.trim())) {
      if (!(META as readonly string[]).includes(meta[1])) throw new Error(`Unknown key "${meta[1]}" under "${works[works.length - 1].title}"`);
      works[works.length - 1].meta[meta[1]] = meta[2].trim();
      continue;
    }
    lines.push(line);
  }
  flush();
  return works;
}

export const scrapeTranslatedCommand = new Command('scrape-translated')
  .description('Turn a book of translations whose originals are not on the site (data/proofread) into work .md files with an empty body plus a default translation each')
  .requiredOption('--config <name>', 'Config name in data/config/translated/<name>.json')
  .option('--dry-run', 'Print the plan without writing files')
  .action((opts: { config: string; dryRun?: boolean }) => {
    const book = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config/translated', `${opts.config}.json`), 'utf-8')) as TranslatedBook;
    const stem = book.stem ?? `preslib-${book.preslib}`;
    const url = `https://www.preslib.az/az/elibrary/ebook/${book.preslib}`;
    const works = readTranslated(fs.readFileSync(path.join(DATA_DIR, 'proofread', book.file), 'utf-8'));

    // Files an earlier run wrote are rewritten from scratch
    const authorDir = path.join(DATA_DIR, 'works', book.author);
    const transDir = path.join(DATA_DIR, 'translations');
    const used = new Set<string>();
    if (fs.existsSync(authorDir)) {
      for (const f of fs.readdirSync(authorDir, { recursive: true }) as string[]) {
        if (!f.endsWith('.md')) continue;
        const fm = fs.readFileSync(path.join(authorDir, f), 'utf-8').split('\n---\n', 1)[0];
        const slug = fm.match(/^slug: (.+)$/m)?.[1];
        if (fm.match(/^sourceId: (.+)$/m)?.[1].startsWith(`${stem}-t`)) {
          if (!opts.dryRun) {
            fs.unlinkSync(path.join(authorDir, f));
            if (slug && fs.existsSync(transDir)) {
              for (const t of fs.readdirSync(transDir)) if (t.startsWith(`${slug}.AZ_LATIN.TRANSLATION.`)) fs.unlinkSync(path.join(transDir, t));
            }
          }
        } else if (slug) used.add(slug);
      }
    }
    const unique = (base: string) => {
      let slug = base;
      for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
      used.add(slug);
      return slug;
    };

    const collDir = path.join(DATA_DIR, 'collections', book.author);
    if (!book.collection.existing) {
      const orders = fs.existsSync(collDir)
        ? fs.readdirSync(collDir).map((f) => Number(fs.readFileSync(path.join(collDir, f), 'utf-8').match(/^order: (\d+)$/m)?.[1]) || 0)
        : [];
      const prev = path.join(collDir, `${book.collection.slug}.md`);
      const kept = fs.existsSync(prev) ? Number(fs.readFileSync(prev, 'utf-8').match(/^order: (\d+)$/m)?.[1]) : 0;
      console.log(`  ${book.collection.slug}  ${book.collection.titleAz}`);
      if (!opts.dryRun) {
        writeCollectionMd({
          slug: book.collection.slug, titleAz: book.collection.titleAz, authorSlug: book.author,
          genre: book.collection.genre, originalLang: book.originalLang, year: book.year,
          order: kept || Math.max(0, ...orders) + 1, status: 'DRAFT',
        });
      }
    }

    works.forEach((w, k) => {
      const lang = (w.meta.originalLang ?? book.originalLang) as Language;
      const direction: ScriptDirection = lang === 'FA' || lang === 'AR' ? 'RTL' : 'LTR';
      const slug = w.meta.slug ?? unique(shortSlug(`${book.author}-${w.title}`));
      const order = Number(w.meta.order) || (book.orderStart ?? 1) + k;
      const genre = (w.meta.genre ?? book.genre) as Genre;
      console.log(`    ${slug}  (${w.body.length} chars, ${w.meta.translator ?? 'no translator'})`);
      if (!w.body) throw new Error(`No text under "${w.title}"`);
      if (opts.dryRun) return;
      writeWorkMd({
        slug, sourceId: `${stem}-t${k + 1}`, titleAz: w.title, titleFa: w.meta.titleFa, authorSlug: book.author,
        collectionSlug: book.collection.slug, originalLang: lang, scriptDirection: direction, genre,
        form: w.meta.form as PoemForm | undefined, year: w.meta.year ? Number(w.meta.year) : undefined,
        order, sourceNote: url, status: 'DRAFT',
      }, '');
      writeTranslationMd({
        workSlug: slug, language: 'AZ_LATIN', type: 'TRANSLATION', scriptDirection: 'LTR',
        translator: w.meta.translator, year: book.year, sourceNote: url, isDefault: true, status: 'DRAFT',
      }, w.body);
    });
    console.log(`  ${works.length} works`);
  });
