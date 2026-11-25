import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorConfig, Genre } from '../types';
import { parts, type Layout } from '../scrapers/latin-reprint';
import { shortSlug } from '../scrapers/wikisource-az';
import { writeCollectionMd, writeWorkMd } from '../writers/md-writer';

const DATA_DIR = path.resolve(__dirname, '../../data');

export interface TranscribedSection {
  /** Title of the section's first work; the section runs to the next one's */
  first: string;
  collection: string;
  titleAz: string;
  genre: Genre;
  layout: Layout;
  /** A novel in parts («Proloq», «Birinci hissə», «Epiloq» as `### …`): one work per part; other `###` headings stay inside */
  novel?: boolean;
  /** A novel in named chapters: one work per `### …` heading (other headings and `**…**` lines stay inside) */
  chapters?: boolean;
  /** Numbered short pieces ("### 17"): one work each, "Balaca mütəfərriqələr 17" */
  pieces?: boolean;
  /** Untitled poems set apart by "* * *" (a divan's ghazals): one work each, titled by its first line */
  stars?: boolean;
}

export interface TranscribedBook {
  /** In data/proofread: "@@ NNN" opens each scanned spread, "# Title" each work, ">>" a paragraph run on from the spread before */
  file: string;
  /** The National Library reader's book id the spreads are numbered in */
  bibid?: number;
  /** Starts the works' slugs instead of the author's slug: a book moved to another author keeps its URLs */
  slugPrefix?: string;
  /** Or the item id of a print in ULB Halle's MENAdoc (opendata.uni-halle.de/handle/1981185920/<id>); "@@ NNN" is then the PDF page */
  halle?: number;
  /**
   * Or a book of kitabxana.net (Milli Virtual Kitabxana): its book id and the PDF it serves
   * (files/books/file/<n>.pdf, from the book page); "@@ NNN" is then the PDF page. No pdf: a text the book page holds inline, linked as the page
   */
  kitabxana?: { id: number; pdf?: string };
  /** Or an e-book of the Presidential Library (preslib.az/az/elibrary/ebook/<id>), downloaded by hand */
  preslib?: string;
  /** Or a scan on turuz.com: its path under /storage/ (e.g. "shiir-2018/1467-….pdf"); "@@ NNN" is then the PDF page. Kept as ~/kitabxana-scans/turuz-<leading number>.pdf */
  turuz?: string;
  /** Or an archive.org item: its identifier; "@@ NNN" is then the page of its scan */
  archive?: string;
  /** Or a web text with no scan (a wikisource page, a site's own PDF): the sourceId stem and the page it came from */
  web?: { key: string; url: string };
  /** An anthology several authors share: their works' sourceIds take this stem instead (e.g. "halle-35518-koroglu") */
  sourceKey?: string;
  sections: TranscribedSection[];
  /** Works already on the site from another source, left out by title (their numbering is kept) */
  skip?: string[];
}

const readerUrl = (book: TranscribedBook, page: number) =>
  book.preslib ? `https://www.preslib.az/az/elibrary/ebook/${book.preslib}`
    : book.turuz ? `https://turuz.com/storage/${book.turuz}#page=${page}`
    : book.kitabxana ? (book.kitabxana.pdf ? `https://www.kitabxana.net/files/books/file/${book.kitabxana.pdf}#page=${page}` : `https://www.kitabxana.net/book.php?id=${book.kitabxana.id}`)
    : book.archive ? `https://archive.org/details/${book.archive}/page/n${page - 1}`
    : book.web ? book.web.url
    : book.halle ? `https://opendata.uni-halle.de/handle/1981185920/${book.halle}`
      : `http://web2.anl.az:81/read/page.php?bibid=${book.bibid}&pno=${page}`;
/** The stem of the book's works' sourceIds */
const sourceKey = (book: TranscribedBook) =>
  book.sourceKey ?? (book.preslib ? `preslib-${book.preslib}` : book.turuz ? `turuz-${book.turuz.match(/\/(\d+(?:-\d+)?)-/)?.[1] ?? book.turuz}` : book.kitabxana ? `kxn-${book.kitabxana.id}` : book.halle ? `halle-${book.halle}` : book.archive ? `archive-${book.archive}` : book.web ? book.web.key : `anl-${book.bibid}`);

/** The book's works in order: title, the spread it starts on, and its Markdown */
/** A novel cut at its part headings («### Proloq», «### Birinci hissə», «### Epiloq»); text before the first is the novel's opening */
function novelSplit(body: string, chapters = false): { title: string | null; body: string }[] {
  const out: { title: string | null; lines: string[] }[] = [{ title: null, lines: [] }];
  for (const line of body.split('\n')) {
    if (chapters) {
      const c = line.match(/^### (.+?)\s*$/);
      if (c) { out.push({ title: c[1], lines: [] }); continue; }
      out[out.length - 1].lines.push(line);
      continue;
    }
    const m = line.match(/^### ((?:\S+ hissə|Proloq|Epiloq))\.?$/i);
    if (m) { out.push({ title: m[1][0].toLocaleUpperCase('az') + m[1].slice(1).toLocaleLowerCase('az'), lines: [] }); continue; }
    out[out.length - 1].lines.push(line);
  }
  const parts = out.map((p) => ({ title: p.title, body: p.lines.join('\n').trim() })).filter((p) => p.body);
  // A named-chapter novel's opening that is only an epigraph or subtitle goes with its first chapter, not a work of its own
  if (chapters && parts.length > 1 && parts[0].title === null && parts[0].body.length < 1500) {
    parts[1].body = `${parts[0].body}\n\n${parts[1].body}`;
    parts.shift();
  }
  return parts;
}

export function readTranscription(text: string) {
  const works: { title: string; spread: number; body: string }[] = [];
  let spread = 0;
  let lines: string[] = [];
  const flush = () => {
    if (works.length) works[works.length - 1].body = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    lines = [];
  };
  for (const line of text.split('\n')) {
    const at = line.match(/^@@ (\d+)$/);
    if (at) { spread = Number(at[1]); continue; }
    // "// Povestlər": a note on where a section starts, for the config's `first`; not text
    if (line.startsWith('// ')) continue;
    const title = line.match(/^# (.+)$/);
    if (title) {
      flush();
      works.push({ title: title[1].trim(), spread, body: '' });
      continue;
    }
    if (line.startsWith('>>')) {
      // The paragraph the spread before broke off: join it back up, mending a word split at the turn
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      const prev = lines.pop() ?? '';
      const rest = line.slice(2);
      lines.push(/\p{L}-$/u.test(prev) && /^\p{Ll}/u.test(rest) ? prev.slice(0, -1) + rest : `${prev} ${rest}`.trim());
      continue;
    }
    lines.push(line);
  }
  flush();
  return works;
}

export const scrapeTranscribedCommand = new Command('scrape-transcribed')
  .description('Turn a book typed from scans (data/proofread) into .md files, cut at its works and a play\'s acts')
  .requiredOption('--author <slug>', 'Author slug, with a "transcribed" entry in authors.json')
  .option('--dry-run', 'Print the plan without writing files')
  .action((opts: { author: string; dryRun?: boolean }) => {
    const cfg = (JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config/authors.json'), 'utf-8')) as AuthorConfig[])
      .find((a) => a.slug === opts.author);
    if (!cfg?.transcribed) {
      console.error(`No transcribed config for "${opts.author}"`);
      process.exit(1);
    }
    // One book or several (one per volume): slugs and collection order run on across them
    const books = [cfg.transcribed].flat();

    // Slugs the author's works from other sources hold ("Ayrı söhbət" is also a feuilleton in another book)
    const own = books.map((b) => `${sourceKey(b)}-t`);
    const authorDir = path.join(DATA_DIR, 'works', cfg.slug);
    const taken = fs.existsSync(authorDir) ? fs.readdirSync(authorDir, { recursive: true }) as string[] : [];
    const used = new Set<string>(taken.filter((f) => f.endsWith('.md')).flatMap((f) => {
      const fm = fs.readFileSync(path.join(authorDir, f), 'utf-8').split('\n---\n', 1)[0];
      const slug = fm.match(/^slug: (.+)$/m)?.[1];
      return slug && !own.some((o) => fm.match(/^sourceId: (.+)$/m)?.[1].startsWith(o)) ? [slug] : [];
    }));
    const unique = (base: string) => {
      let slug = base;
      for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
      used.add(slug);
      return slug;
    };
    let section: TranscribedSection | undefined;
    let collOrder = 0;
    const order = new Map<string, number>();
    const collection = (slug: string, titleAz: string, genre: Genre) => {
      if (order.has(slug)) return;
      order.set(slug, 0);
      console.log(`  ${slug}  ${titleAz}`);
      ++collOrder;
      // A collection the author already has keeps its place among the others
      const existing = path.join(DATA_DIR, 'collections', cfg.slug, `${slug}.md`);
      const prev = fs.existsSync(existing) ? fs.readFileSync(existing, 'utf-8') : '';
      const kept = Number(prev.match(/^order: (\d+)$/m)?.[1]) || undefined;
      const year = Number(prev.match(/^year: (\d+)$/m)?.[1]) || undefined;
      if (!opts.dryRun) writeCollectionMd({ slug, titleAz, authorSlug: cfg.slug, genre, originalLang: 'AZ_LATIN', ...(year && { year }), order: kept ?? collOrder, status: 'DRAFT' });
    };
    // Files an earlier run wrote are rewritten from scratch: renumbered works would otherwise stay twice
    if (!opts.dryRun && fs.existsSync(authorDir)) {
      for (const f of fs.readdirSync(authorDir, { recursive: true }) as string[]) {
        if (!f.endsWith('.md')) continue;
        const id = fs.readFileSync(path.join(authorDir, f), 'utf-8').split('\n---\n', 1)[0].match(/^sourceId: (.+)$/m)?.[1];
        if (id && own.some((o) => id.startsWith(o))) fs.unlinkSync(path.join(authorDir, f));
      }
    }
    const writeIn = (book: TranscribedBook) => (slug: string, sourceId: string, titleAz: string, coll: string, genre: Genre, spread: number, body: string, year?: number) => {
      const n = (order.get(coll) ?? 0) + 1;
      order.set(coll, n);
      console.log(`    ${slug}  (${body.length} chars)`);
      // A poem kept in Persian is titled "… {fa}" in the transcription
      const fa = / \{fa\}$/.test(titleAz);
      if (!opts.dryRun) writeWorkMd({
        slug, sourceId, titleAz: titleAz.replace(/ \{fa\}$/, ''), authorSlug: cfg.slug, collectionSlug: coll,
        originalLang: fa ? 'FA' : 'AZ_LATIN', scriptDirection: fa ? 'RTL' : 'LTR',
        genre, year, order: n, sourceNote: readerUrl(book, spread), status: 'DRAFT',
      }, body);
    };

    for (const book of books) {
    const prefix = book.slugPrefix ?? cfg.slug;
    const works = readTranscription(fs.readFileSync(path.join(DATA_DIR, 'proofread', book.file), 'utf-8'));
    for (const s of book.sections) if (!works.some((w) => w.title === s.first)) console.warn(`  Section start not found: ${s.first}`);
    const write = writeIn(book);
    section = undefined;
    for (const s of book.skip ?? []) if (!works.some((w) => w.title === s)) console.warn(`  Skipped work not found: ${s}`);
    // Sections run in book order, each opening at the first work after the one before it: a title that opens a later section ("Yadıma düşdü") may also name an earlier poem
    let at = -1;
    works.forEach((w, k) => {
      if (book.sections[at + 1]?.first === w.title) section = book.sections[++at];
      if (!section) { console.warn(`  Before any section, left out: ${w.title}`); return; }
      if (book.skip?.includes(w.title)) {
        console.log(`    (skipped: ${w.title})`);
        // The site's copy from another source, when it sits in this section's collection, takes
        // the skipped work's place in book order (a writer's stories from Wikisource among the book's)
        const dir = path.join(DATA_DIR, 'works', cfg.slug, section.collection);
        const other = fs.existsSync(dir)
          ? fs.readdirSync(dir).find((f) => {
            const fm = fs.readFileSync(path.join(dir, f), 'utf-8').split('\n---\n', 1)[0];
            const title = fm.match(/^titleAz: ['"]?(.+?)['"]?$/m)?.[1];
            return title === w.title && !fm.match(/^sourceId: (.+)$/m)?.[1].startsWith(sourceKey(book));
          })
          : undefined;
        if (other) {
          collection(section.collection, section.titleAz, section.genre);
          const n = (order.get(section.collection) ?? 0) + 1;
          order.set(section.collection, n);
          if (!opts.dryRun) {
            const text = fs.readFileSync(path.join(dir, other), 'utf-8').replace(/^order: \d+$/m, `order: ${n}`);
            fs.unlinkSync(path.join(dir, other));
            fs.writeFileSync(path.join(dir, `${String(n).padStart(3, '0')}-${other.replace(/^\d{3}-/, '')}`), text);
          }
        }
        return;
      }
      // The date printed under a work's end ("*1890*", "*1898-1900*", "*Dekabr, 1973*", "*İyun – avqust, 1970*") is its year
      const month = '(?:yanvar|fevral|mart|aprel|may|[iİ]yun|[iİ]yul|avqust|sentyabr|oktyabr|noyabr|dekabr)';
      const dated = w.body.match(new RegExp(`\\n\\*(?:${month}(?:\\s*[-–]\\s*${month})?,?\\s*)?(\\d{4})(?:\\s*[-–]\\s*\\d{2,4})?\\*$`, 'iu'));
      const year = dated ? Number(dated[1]) : undefined;
      // A bare year goes into the work's year; a date naming the month also stays printed under the poem
      const body = dated && /^\n\*\d/.test(dated[0]) ? w.body.slice(0, dated.index).trim() : w.body;
      if (section.stars) {
        collection(section.collection, section.titleAz, section.genre);
        body.split(/^\* \* \*$/m).map((p) => p.trim()).filter(Boolean).forEach((poem, n) => {
          // A shared ghazal names its poets over the couplets ("*Vaqif*", "### Vahid"): the title is the first verse line
          const first = poem.split('\n').find((l) => l.trim() && !/^(#|\*)/.test(l.trim())) ?? poem;
          const title = first.trim().replace(/[,;:–-]+$/, '');
          write(unique(shortSlug(`${prefix}-${title}`)), `${sourceKey(book)}-t${k + 1}-${n + 1}`, title,
            section!.collection, section!.genre, w.spread, poem);
        });
        return;
      }
      if (section.pieces) {
        collection(section.collection, section.titleAz, section.genre);
        body.split(/^### (?=\d+$)/m).forEach((piece, n) => {
          const m = piece.match(/^(\d+)\n/);
          if (!m) {
            if (piece.trim()) console.warn(`  Before the first numbered piece, left out: ${piece.slice(0, 60)}`);
            return;
          }
          const title = `${w.title} ${m[1]}`;
          const text = piece.slice(m[0].length).trim();
          // Each piece closes on the paper it ran in: "*“Həyat” qəzeti, 5 oktyabr 1905, №78*"
          const ran = text.match(/\*[^*\n]*\b(1[89]\d\d)\b[^*\n]*\*$/);
          write(unique(shortSlug(`${prefix}-${title}`)), `${sourceKey(book)}-t${k + 1}-${m[1]}`, title,
            section!.collection, section!.genre, w.spread, text, ran ? Number(ran[1]) : undefined);
        });
        return;
      }
      const split = section.novel || section.chapters ? novelSplit(body, section.chapters) : parts(body, section.layout);
      let base = shortSlug(`${prefix}-${w.title.replace(/ \{fa\}$/, '')}`);
      // A play named after the author's novel ("Dumanlı Təbriz"): its own collection, not the novel's
      if (split.length > 1 && order.has(base)) base = `${base}-pyes`;
      if (split.length === 1) {
        collection(section.collection, section.titleAz, section.genre);
        write(unique(base), `${sourceKey(book)}-t${k + 1}`, w.title, section.collection, section.genre, w.spread, body, year);
        return;
      }
      // A play in acts: a collection of its own, one work per act
      collection(base, w.title, section.genre);
      split.forEach((part, n) => {
        write(unique(part.title ? shortSlug(`${base}-${part.title}`) : base), `${sourceKey(book)}-t${k + 1}-${n}`,
          part.title ?? w.title, base, section!.genre, w.spread, part.body, year);
      });
    });
    console.log(`  ${works.length} works`);
    }
  });
