import { Command } from 'commander';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KNOWN, loadWordlist } from './ocr-book';

/**
 * Two OCR readings of the same scan made into one draft, so a person (or a model) only looks
 * at the places the machines could not settle. The vision model's reading is the base (fewer
 * slips, and it keeps verse lines); Tesseract's is aligned to it word by word, page by page.
 * Where they agree the word stands. Where they differ, the reading the site's word list knows
 * wins; when neither is known, or both are, the place is marked ⟦vlm|tesseract⟧. A run of
 * known words Tesseract has and the model dropped is marked ⟦+…⟧ where it belongs.
 */

const norm = (w: string) => w.toLocaleLowerCase('az').replace(/[^\p{L}\p{N}]/gu, '');

/** Pages of a draft by their `@@ NNN` marks, each as its lines */
function pages(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let key = '';
  for (const line of text.split('\n')) {
    const m = line.match(/^@@ (\S+)/);
    if (m) {
      key = m[1];
      out.set(key, []);
    } else if (key) out.get(key)!.push(line);
  }
  return out;
}

interface Tok {
  line: number;
  idx: number;
  text: string;
  n: string;
}

function tokens(lines: string[]): { toks: Tok[]; cells: string[][] } {
  const cells = lines.map((l) => (l.trim() ? l.split(/(\s+)/) : [l]));
  const toks: Tok[] = [];
  cells.forEach((parts, line) =>
    parts.forEach((text, idx) => {
      const n = norm(text);
      if (n && !/^\s+$/.test(text) && !/^#+$/.test(text)) toks.push({ line, idx, text, n });
    }),
  );
  return { toks, cells };
}

/** Longest common subsequence of two word lists, as matched index pairs */
function lcs(a: string[], b: string[]): [number, number][] {
  const m = a.length;
  const n = b.length;
  const dp = new Uint32Array((m + 1) * (n + 1));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i * (n + 1) + j] =
        a[i] === b[j] ? dp[(i + 1) * (n + 1) + j + 1] + 1 : Math.max(dp[(i + 1) * (n + 1) + j], dp[i * (n + 1) + j + 1]);
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) pairs.push([i++, j++]);
    else if (dp[(i + 1) * (n + 1) + j] >= dp[i * (n + 1) + j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** Levenshtein distance */
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]++;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/**
 * Words of two short differing runs paired by spelling (Needleman–Wunsch): a pair costs its
 * share of differing letters, a word left unpaired 0.6. [x, null] is a word only in `a`,
 * [null, y] one only in `b`; in order.
 */
function align(a: string[], b: string[]): [number | null, number | null][] {
  const GAP = 0.6;
  const cost = (x: string, y: string) => distance(x, y) / Math.max(x.length, y.length);
  const m = a.length;
  const n = b.length;
  // Each cell remembers its move, so the way back never depends on float equality
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  const move: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++)
    for (let j = 0; j <= n; j++) {
      if (i === 0 && j === 0) continue;
      const diag = i > 0 && j > 0 ? dp[i - 1][j - 1] + cost(a[i - 1], b[j - 1]) : Infinity;
      const up = i > 0 ? dp[i - 1][j] + GAP : Infinity;
      const left = j > 0 ? dp[i][j - 1] + GAP : Infinity;
      dp[i][j] = Math.min(diag, up, left);
      move[i][j] = dp[i][j] === diag ? 0 : dp[i][j] === up ? 1 : 2;
    }
  const out: [number | null, number | null][] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const mv = i === 0 ? 2 : j === 0 ? 1 : move[i][j];
    if (mv === 0) out.push([--i, --j]);
    else if (mv === 1) out.push([--i, null]);
    else out.push([null, --j]);
  }
  return out.reverse();
}

/** The letters of `to` in the place of `from`'s, keeping the punctuation around them */
function swapCore(from: string, to: string) {
  const m = from.match(/^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u)!;
  const core = to.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  return m[1] + core + m[3];
}

/**
 * Which reading of a word to keep, by how often each occurs in the site's texts (which hold
 * some OCR slips of their own, so a rare form counts for little): 'a', 'b', or null to check.
 * One must be far commoner — 50 times, or 8 times when the other is rare (under 100) — so a
 * real choice like qış/quş or olsa/ölsə is left to the page.
 */
export function pick(fa: number, fb: number): 'a' | 'b' | null {
  const wins = (x: number, y: number) => x > 0 && (x >= 50 * y || (y < 100 && x >= 8 * y));
  return wins(fa, fb) ? 'a' : wins(fb, fa) ? 'b' : null;
}

export function mergePage(
  vlm: string[],
  tess: string[],
  known: (n: string) => boolean,
  count: (n: string) => number = (n) => (known(n) ? 1 : 0),
) {
  const A = tokens(vlm);
  const B = tokens(tess).toks;
  const set = (t: Tok, text: string) => (A.cells[t.line][t.idx] = text);
  let flags = 0;
  let fixed = 0;
  const flag = (t: Tok, text: string) => {
    set(t, text);
    flags++;
  };

  const pairs = lcs(
    A.toks.map((t) => t.n),
    B.map((t) => t.n),
  );
  let pi = 0;
  let pj = 0;
  const hunks: [number, number, number, number][] = [];
  for (const [i, j] of [...pairs, [A.toks.length, B.length] as [number, number]]) {
    if (i > pi || j > pj) hunks.push([pi, i, pj, j]);
    pi = i + 1;
    pj = j + 1;
  }

  for (const [i1, i2, j1, j2] of hunks) {
    const a = A.toks.slice(i1, i2);
    const b = B.slice(j1, j2);
    // Pair the differing words by spelling, so each keeps its own line
    const pairsIn = align(
      a.map((t) => t.n),
      b.map((t) => t.n),
    );
    let pending: Tok[] = [];
    let after: Tok | undefined = A.toks[i1 - 1];
    const flush = () => {
      if (pending.length >= 3 && pending.filter((t) => known(t.n)).length * 3 >= pending.length * 2) {
        // A run of real words the model left out
        const extra = `⟦+${pending.map((t) => t.text).join(' ')}⟧`;
        const at = after ?? a[0] ?? A.toks[i2];
        if (at) set(at, after ? `${A.cells[at.line][at.idx]} ${extra}` : `${extra} ${A.cells[at.line][at.idx]}`);
        else A.cells.push([extra]);
        flags++;
      }
      pending = [];
    };
    for (const [x, y] of pairsIn) {
      if (x == null) {
        pending.push(b[y!]);
        continue;
      }
      flush();
      const t = a[x];
      after = t;
      if (y == null) {
        // A word only the model saw: kept, unless unknown (it can make text up)
        if (!known(t.n)) flag(t, `⟦${t.text}|–⟧`);
        continue;
      }
      // Tesseract reads a closing "!" as "l": baltala!.. → baltalal..
      if (/!/.test(t.text) && b[y].n === `${t.n}l`) continue;
      const choice = pick(count(t.n), count(b[y].n));
      if (choice === 'a') continue;
      if (choice === 'b') {
        set(t, swapCore(t.text, b[y].text));
        fixed++;
      } else flag(t, `⟦${t.text}|${b[y].text}⟧`);
    }
    flush();
  }
  const lines = A.cells.map((parts) => parts.join('').replace(/ {2,}/g, ' ').replace(/^ (?=\S)/, ''));
  return { lines, flags, fixed };
}

export const ocrMergeCommand = new Command('ocr-merge')
  .description('Merge a vision-model OCR draft with a Tesseract draft of the same pages; mark only what they cannot settle')
  .requiredOption('--vlm <file>', 'draft from ocr-book --engine vlm (the base)')
  .requiredOption('--tess <file>', 'draft from ocr-book (Tesseract) over the same images')
  .requiredOption('--out <file>', 'merged draft; ⟦a|b⟧ marks what is left to check')
  .option('--exclude-source <prefix>', 'leave works whose sourceId starts with this out of the word list')
  .action((opts: { vlm: string; tess: string; out: string; excludeSource?: string }) => {
    const freq = loadWordlist(opts.excludeSource);
    const count = (n: string) => (/^\p{N}+$/u.test(n) ? 1e9 : (freq.get(n) ?? 0));
    const known = (n: string) => count(n) >= KNOWN;
    const vlm = pages(fs.readFileSync(opts.vlm, 'utf-8'));
    const tess = pages(fs.readFileSync(opts.tess, 'utf-8'));
    const out: string[] = [];
    let flags = 0;
    let fixed = 0;
    let words = 0;
    const flagged: string[] = [];
    for (const [key, lines] of vlm) {
      const other = tess.get(key);
      out.push(`@@ ${key}`);
      if (!other) {
        out.push(...lines);
        flagged.push(`${key}: no Tesseract page`);
        continue;
      }
      const page = mergePage(lines, other, known, count);
      words += tokens(lines).toks.length;
      flags += page.flags;
      fixed += page.fixed;
      if (page.flags) flagged.push(`${key}: ${page.flags}`);
      out.push(...page.lines);
    }
    // Running heads Tesseract read and the model rightly left out come back as ⟦+…⟧ on page
    // after page: a run whose words recur in five or more of them is dropped
    const PLUS = /\s?⟦\+([^⟧]*)⟧/g;
    const runs = out.flatMap((line) => [...line.matchAll(PLUS)].map((m) => m[1]));
    const seen = new Map<string, number>();
    for (const run of runs) for (const w of new Set(run.split(/\s+/).map(norm).filter(Boolean))) seen.set(w, (seen.get(w) ?? 0) + 1);
    const head = (run: string) => {
      const ws = run.split(/\s+/).map(norm).filter(Boolean);
      return ws.filter((w) => (seen.get(w) ?? 0) >= 5).length * 2 >= ws.length;
    };
    let heads = 0;
    const text = out
      .map((line) =>
        line.replace(PLUS, (all, run: string) => {
          if (!head(run)) return all;
          heads++;
          return '';
        }),
      )
      .join('\n');
    flags -= heads;
    fs.writeFileSync(opts.out, text);
    console.log(`${vlm.size} pages, ${words} words: ${fixed} settled by the word list, ${flags} marked to check (${((100 * flags) / Math.max(words, 1)).toFixed(1)}%)`);
    console.log(flagged.join('  '));
  });

const VLM_MODEL = 'mlx-community/Qwen3-VL-30B-A3B-Instruct-4bit';
const VLM_PYTHON = process.env.OCR_VLM_PYTHON ?? path.join(os.homedir(), '.local/share/irs-local-ocr/bin/python');

/**
 * The marks ocr-merge left, settled by the local vision model: each word is asked about on its
 * own line, cut from the full-resolution scan, with the two readings in both orders; only an
 * answer given the same both ways counts. On Ramiz Rövşən's «Nəfəs» it settled 23 of 28 marks,
 * 2 of them wrongly (ə/e and m/n on a worn print): what is left, and a sample of the rest, is
 * still checked against the scan.
 */
export const ocrJudgeCommand = new Command('ocr-judge')
  .description('Settle the ⟦a|b⟧ marks of an ocr-merge draft with the local vision model looking at the scan')
  .requiredOption('--merged <file>', 'draft from ocr-merge')
  .requiredOption('--images <dir>', 'the page images both readings were made from (pNNN.jpg)')
  .requiredOption('--out <file>', 'draft with the settled marks replaced')
  .option('--vlm-model <id>', 'mlx-vlm model', VLM_MODEL)
  .action((opts: { merged: string; images: string; out: string; vlmModel: string }) => {
    if (!fs.existsSync(VLM_PYTHON)) throw new Error(`No Python with mlx-vlm at ${VLM_PYTHON} (set OCR_VLM_PYTHON)`);
    const res = spawnSync(VLM_PYTHON, [path.join(__dirname, 'ocr-judge.py'), opts.vlmModel, opts.merged, opts.images, opts.out], {
      stdio: ['ignore', 'inherit', 'inherit'],
      // The model is already downloaded; without this the hub check can hang
      env: { ...process.env, HF_HUB_OFFLINE: '1' },
    });
    if (res.status !== 0) throw new Error('ocr-judge.py failed');
  });
