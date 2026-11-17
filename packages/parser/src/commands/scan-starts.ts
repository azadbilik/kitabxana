import { Command } from 'commander';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { getDb } from '../importers/db';

const run = promisify(execFile);

const SCANS_DIR = process.env.SCANS_DIR || path.join(os.homedir(), 'kitabxana-scans');
// OCR'd pages are kept here (git-ignored), per page-segmentation mode, so a re-run only reads new pages
const OCR_ROOT = path.resolve(__dirname, '../../data/raw/scan-ocr');
// Tesseract's automatic layout (3) keeps the two pages of a scanned spread apart; single-column
// reading (4) interleaves their lines, which loses the openings on Soviet-era spreads
let PSM = '3';
const ocrDir = () => path.join(OCR_ROOT, `psm${PSM}`);
const OUT_FILE = path.resolve(__dirname, '../../../../apps/api/src/downloads/scan-starts.ts');

/** A run of works the National Library marks at one page, up to the next mark */
interface Run {
  key: string;
  start: number;
  end: number | null;
  works: { sourceId: string; body: string }[];
}

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'q', ғ: 'ğ', д: 'd', е: 'e', ә: 'ə', ж: 'j', з: 'z', и: 'i', ы: 'ı', ј: 'y',
  к: 'k', ҝ: 'g', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ү: 'ü', ф: 'f',
  х: 'x', һ: 'h', ч: 'ç', ҹ: 'c', ш: 'ş', ө: 'ö', ё: 'yo', ю: 'yu', я: 'ya', ц: 'ts', щ: 'ş', й: 'y',
  ь: '', ъ: '', э: 'e',
};

// Letters folded together, so 1930s Latin prints (Yanalif: c for ç, ƣ for ğ, ь for ı, old spellings
// like "kibi") and OCR slips still meet the modern text: what's left is the word's skeleton
const FOLD: Record<string, string> = {
  ç: 'c', ş: 's', ğ: 'g', ƣ: 'g', q: 'g', k: 'g', ı: 'i', ь: 'i', ö: 'o', ü: 'u', ə: 'e', ä: 'e', ʒ: 'j', y: 'i', j: 'i',
};

/** Lower-case Latin words of 3+ letters, Cyrillic read as Latin and look-alike letters folded */
function tokens(text: string): string[] {
  const latin = [...text.replace(/-\n/g, '').toLocaleLowerCase('az')].map((c) => CYR[c] ?? c).join('');
  return (latin.match(/[a-zəğıöüçşƣьäʒ]{3,}/g) ?? []).map((w) => [...w].map((c) => FOLD[c] ?? c).join(''));
}

/** The first words of a work as printed: its heading, stage direction, first lines */
function opening(body: string, n = 24) {
  return tokens(body.replace(/^#+\s*/gm, '').replace(/[*_>[\]()]/g, ' ')).slice(0, n);
}

/** How much of a work's opening a page holds: its word pairs, in order or at least both words */
function score(snippet: string[], page: string[]) {
  const pairs = new Set(snippet.slice(1).map((w, i) => `${snippet[i]} ${w}`));
  if (!pairs.size) return 0;
  const have = new Set(page.slice(1).map((w, i) => `${page[i]} ${w}`));
  const words = new Set(page);
  let hit = 0;
  let loose = 0;
  for (const pair of pairs) {
    if (have.has(pair)) hit++;
    const [a, b] = pair.split(' ');
    if (words.has(a) && words.has(b)) loose++;
  }
  return (hit + 0.3 * loose) / pairs.size / 1.3;
}

const natural = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

async function pageCount(pdf: string) {
  const { stdout } = await run('qpdf', ['--show-npages', pdf]);
  return Number(stdout.trim());
}

async function ocrPage(key: string, page: number): Promise<string> {
  const out = path.join(ocrDir(), key, `p${page}`);
  if (fs.existsSync(`${out}.txt`)) return fs.readFileSync(`${out}.txt`, 'utf8');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-ocr-'));
  try {
    await run('pdftoppm', ['-r', '150', '-gray', '-png', '-f', String(page), '-l', String(page), path.join(SCANS_DIR, `${key}.pdf`), path.join(tmp, 'i')]);
    const image = fs.readdirSync(tmp).find((f) => f.endsWith('.png'));
    if (!image) return '';
    await run('tesseract', [path.join(tmp, image), out, '-l', 'aze+aze_cyrl', '--psm', PSM]);
    return fs.readFileSync(`${out}.txt`, 'utf8');
  } catch {
    return '';
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Runs worth placing: several works at one mark spread over more pages than they'd fill sharing */
async function findRuns(only?: string): Promise<Run[]> {
  const rows = await getDb().$queryRaw<{ sourceId: string; body: string; pno: number }[]>`
    select "sourceId", body, substring("sourceNote" from '[?&]pno=(\\d+)')::int as pno
      from "Work" where "sourceId" ~ '^anl-\\d+-' and "sourceNote" ~ '[?&]pno=[1-9]'`;
  const books = new Map<string, Map<number, Run['works']>>();
  for (const row of rows) {
    const key = row.sourceId.match(/^anl-\d+/)![0];
    if (only && key !== only) continue;
    const marks = books.get(key) ?? new Map();
    books.set(key, marks);
    marks.set(row.pno, [...(marks.get(row.pno) ?? []), { sourceId: row.sourceId, body: row.body }]);
  }
  const runs: Run[] = [];
  for (const [key, marks] of books) {
    if (!fs.existsSync(path.join(SCANS_DIR, `${key}.pdf`))) continue;
    const starts = [...marks.keys()].sort((a, b) => a - b);
    starts.forEach((start, i) => {
      const works = marks.get(start)!.sort((a, b) => natural(a.sourceId, b.sourceId));
      const end = starts[i + 1] ?? null;
      if (works.length > 1 && (end ?? start + 40) - start > Math.floor(works.length / 2) + 3) {
        runs.push({ key, start, end, works });
      }
    });
  }
  return runs.sort((a, b) => natural(a.key, b.key) || a.start - b.start);
}

/** Run tasks a few at a time */
async function pool<T>(items: T[], size: number, task: (item: T) => Promise<unknown>) {
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) await task(items[next++]);
  }));
}

/** Entries already in the generated file, to keep the books this run doesn't redo */
function existing(): Map<string, number> {
  if (!fs.existsSync(OUT_FILE)) return new Map();
  const text = fs.readFileSync(OUT_FILE, 'utf8').split('SCAN_TEXT_END')[0];
  return new Map([...text.matchAll(/'([^']+)': (\d+),/g)].map((m) => [m[1], Number(m[2])]));
}

function textEndBlock(): string {
  const text = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
  const at = text.indexOf('/** The last scan page of text');
  return at >= 0
    ? text.slice(at)
    : '/** The last scan page of text, where a book\'s contents or colophon follow */\nexport const SCAN_TEXT_END: Record<string, number> = {};\n';
}

function write(starts: Map<string, number>) {
  const byBook = new Map<string, [string, number][]>();
  for (const [sourceId, page] of starts) {
    const key = sourceId.match(/^anl-\d+/)![0];
    byBook.set(key, [...(byBook.get(key) ?? []), [sourceId, page]]);
  }
  const lines = [
    '/**',
    ' * The scan page each work starts on, where the National Library marks a whole run of works',
    " * (a play's acts, a novel's chapters) at one page. Found by OCR'ing every page of such a run and",
    " * locating each work's opening words, in book order; checked against «Gələcək gün»'s contents",
    ' * page (all 33 chapters agree). Works not found clearly are left out and keep an estimate.',
    ' * Generated by `pnpm parse scan-starts` — regenerate rather than edit by hand.',
    ' */',
    'export const SCAN_STARTS: Record<string, number> = {',
  ];
  for (const key of [...byBook.keys()].sort(natural)) {
    lines.push(`  // ${key}`);
    for (const [sourceId, page] of byBook.get(key)!.sort((a, b) => natural(a[0], b[0]))) {
      lines.push(`  '${sourceId}': ${page},`);
    }
  }
  lines.push('};', '', textEndBlock().trimEnd(), '');
  fs.writeFileSync(OUT_FILE, lines.join('\n'));
}

export const scanStartsCommand = new Command('scan-starts')
  .description(
    "Find the scan page each act, scene or chapter starts on where the National Library marks a whole play or novel at one page, and write the API's SCAN_STARTS table (apps/api/src/downloads/scan-starts.ts). Needs tesseract (aze, aze_cyrl), poppler and qpdf",
  )
  .option('--book <key>', 'only this book, e.g. anl-8289; the others keep their entries')
  .option('--jobs <n>', 'pages OCR\'d at once', '6')
  .option('--min-score <n>', 'how clearly an opening must be found to be kept', '0.45')
  .option('--psm <n>', "Tesseract page segmentation: 3 automatic (spreads read page by page), 4 single column", '3')
  .option('--dry-run', 'report only, write nothing')
  .action(async (opts) => {
    PSM = String(opts.psm);
    const runs = await findRuns(opts.book);
    if (!runs.length) {
      console.log('No runs of works sharing a page mark' + (opts.book ? ` in ${opts.book}` : '') + ' with a scan.');
      return;
    }

    // Every page each run spans, OCR'd once
    const pages: [string, number][] = [];
    const counts = new Map<string, number>();
    for (const r of runs) {
      if (!counts.has(r.key)) counts.set(r.key, await pageCount(path.join(SCANS_DIR, `${r.key}.pdf`)));
      r.end = Math.min(r.end ?? counts.get(r.key)!, counts.get(r.key)!);
      for (let p = r.start; p <= r.end; p++) pages.push([r.key, p]);
    }
    const unique = [...new Map(pages.map((p) => [p.join(':'), p])).values()];
    const todo = unique.filter(([key, p]) => !fs.existsSync(path.join(ocrDir(), key, `p${p}.txt`)));
    console.log(`${runs.length} runs in ${counts.size} books: ${unique.length} pages, ${todo.length} to OCR`);
    let done = 0;
    await pool(todo, Number(opts.jobs), async ([key, p]) => {
      await ocrPage(key, p);
      if (++done % 50 === 0) console.log(`  OCR ${done}/${todo.length}`);
    });

    const minScore = Number(opts.minScore);
    const found = new Map<string, number>();
    let missed = 0;
    for (const r of runs) {
      const text = new Map<number, string[]>();
      for (let p = r.start; p <= r.end!; p++) text.set(p, tokens(await ocrPage(r.key, p)));
      let prev = r.start;
      r.works.forEach((work, i) => {
        // The library's mark is where the run's first work starts
        if (i === 0) return found.set(work.sourceId, r.start);
        const snippet = opening(work.body);
        let best = 0;
        let at: number | null = null;
        for (let p = prev; p <= r.end!; p++) {
          const s = score(snippet, text.get(p)!);
          if (s > best + 0.05) {
            best = s;
            at = p;
          }
        }
        if (at !== null && best >= minScore) {
          found.set(work.sourceId, at);
          prev = at;
        } else {
          missed++;
          console.log(`  not found: ${work.sourceId} (${best.toFixed(2)}) ${snippet.slice(0, 6).join(' ')}`);
        }
      });
    }
    console.log(`${found.size} works placed, ${missed} left to the estimate`);
    if (opts.dryRun) return;

    const merged = existing();
    const redone = new Set(runs.map((r) => r.key));
    for (const id of [...merged.keys()]) if (redone.has(id.match(/^anl-\d+/)![0])) merged.delete(id);
    for (const [id, page] of found) merged.set(id, page);
    write(merged);
    console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} (${merged.size} works); commit it and rebuild the API.`);
    await getDb().$disconnect();
  });
