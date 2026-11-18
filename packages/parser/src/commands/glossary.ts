import { Command } from 'commander';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { decodeAzFont } from '../scrapers/latin-reprint';

const run = promisify(execFile);

const RAW_DIR = path.resolve(__dirname, '../../data/raw');
const OUT_FILE = path.resolve(__dirname, '../../../../apps/api/src/glossary/efsl.json');

/** One dictionary article: its spellings, the language it came from, the gloss, set phrases */
export interface GlossaryEntry {
  h: string[];
  o: string;
  d: string;
  p?: [string, string][];
}

const UPPER = 'A-ZÇƏĞIİÖŞÜ';
const LOWER = 'a-zçəğıöşü';
const ORIGIN = '(?:ə|f|a|türk|y|l|ibr|sansk|süry)';
// «BARGAH, BARGƏH1 f.», «ABNOS // ABNUS f.», «ABÜ DANƏ f.», «ABAD2(AN)1 f.», «RİZA’ 1 ə.»: capitals
// with their figures and brackets, then where the word is from. The book drops that mark, or its
// full stop, now and then; a head of three capitals or more still opens an article without it
const HEAD_CHARS = `[${UPPER}’'()\\-\\d ,/]`;
const HEAD = new RegExp(`^\\s*([${UPPER}(]${HEAD_CHARS}*?)(?:\\s+|(?<=\\d))(?:(${ORIGIN})\\.|([əf]))(?=\\s|$)(.*)$`);
const BARE_HEAD = new RegExp(`^\\s*([${UPPER}(]${HEAD_CHARS}*[${UPPER}’)\\d])(?=\\s|$)(.*)$`);

function head(line: string): { head: string; origin: string; rest: string } | null {
  const m = line.match(HEAD);
  if (m) return { head: m[1], origin: m[2] ?? m[3], rest: m[4] };
  const bare = line.match(BARE_HEAD);
  if (!bare || (bare[1].match(new RegExp(`[${UPPER}]`, 'g')) ?? []).length < 3) return null;
  // «DƏ’VA 1) iddia»: the first sense's figure is not part of the head
  const sense = bare[1].match(/^(.*?)\s+(\d+\))$/);
  return sense ? { head: sense[1], origin: '', rest: `${sense[2]}${bare[2]}` } : { head: bare[1], origin: '', rest: bare[2] };
}

const lower = (s: string) => s.toLocaleLowerCase('az');

/**
 * The original spelling is set in an Arabic font whose text layer is noise: control characters,
 * ASCII letters and signs, a few stray Arabic letters, sometimes glued to the next word. Every
 * real letter of the book's own font sits above 0x7F, so a token without one is kept only when
 * it is a figure («1)», «40») or a dash, and a token with one loses the noise in front of it.
 */
function withoutArabicColumn(rawLine: string): string {
  return rawLine
    .replace(/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF\u200E\u200F\u202A-\u202E\u2020\u2021\u2030]/g, '')
    .split(/( +)/)
    .map((tok) => {
      if (!tok.trim() || tok === '//') return tok;
      if (!/[^\x00-\x7F]/.test(tok)) return /^(?:[\d().,;:-]*\d[\d().,;:-]*|-|\.\.\.)$/.test(tok) ? tok : '';
      // Noise glued to a word: «&və» → «və», «ə.R» → «ə.»
      const m = tok.match(/^([\x00-\x7F]*)([^\x00-\x7F].*[^\x00-\x7F]|[^\x00-\x7F])([\x00-\x7F]*)$/)!;
      const noisy = (part: string) => /[\x00-\x1FA-Za-z"#$%&'*+/<=>@[\\\]^_`{|}~]/.test(part);
      const before = noisy(m[1]) ? '' : m[1];
      const after = noisy(m[3]) ? m[3].match(/^[.,;:)!?]*/)![0] : m[3];
      return before + m[2].replace(/[\x00-\x1F]/g, '') + after;
    })
    .join('');
}

/** A volume's dictionary lines as Latin Azerbaijani, front matter, page furniture and contents left out */
async function volumeLines(pdf: string): Promise<string[]> {
  const { stdout } = await run('pdftotext', ['-layout', pdf, '-'], { maxBuffer: 1 << 28 });
  const out: string[] = [];
  let started = false;
  for (const raw of stdout.split('\n')) {
    const line = decodeAzFont(withoutArabicColumn(raw.replace(/\f/g, ''))).replace(/\s+$/, '');
    const bare = line.trim();
    if (!bare || /downloaded from/i.test(bare)) continue;
    // Page numbers, and the raised figure of a homonym when it lands on a line of its own
    if (/^\d+$/.test(bare)) continue;
    if (new RegExp(`^[${UPPER}]$`).test(bare)) {
      started = true;
      continue;
    }
    if (!started) continue;
    if (bare === 'MÜNDƏRİCAT' || /\.{10,}/.test(bare)) break;
    out.push(line);
  }
  return out;
}

/** Entries as single lines; a word broken at a line end is joined by what the book itself spells */
function articles(lines: string[]): { head: string; origin: string; rest: string }[] {
  const known = new Set<string>();
  // First parts of compounds the book hyphenates inside a line: «abi-» of «abi-didə»
  const firstParts = new Set<string>();
  const word = `[${LOWER}’]+`;
  lines.forEach((line, i) => {
    const text = lower(line);
    let words: string[] = text.match(new RegExp(word, 'g')) ?? [];
    // The pieces either side of a line-end hyphen are no words
    if (/-$/.test(line)) words = words.slice(0, -1);
    if (i > 0 && /-$/.test(lines[i - 1])) words = words.slice(1);
    for (const w of words) known.add(w);
    for (const m of text.matchAll(new RegExp(`(${word})-(?=${word})`, 'g'))) firstParts.add(m[1]);
  });
  const join = (a: string, b: string) => {
    if (!/-$/.test(a)) return `${a} ${b.trim()}`;
    const left = lower(a.match(new RegExp(`[${UPPER}${LOWER}’]+(?=-$)`))?.[0] ?? '');
    const right = lower(b.trim().match(new RegExp(`^[${UPPER}${LOWER}’]+`))?.[0] ?? '');
    // «abi-|kövsər» keeps its hyphen, «qu-|yunun» and «qur-|ğu» do not
    const compound = !known.has(left + right) && firstParts.has(left) && known.has(right);
    return compound ? a + b.trim() : a.slice(0, -1) + b.trim();
  };

  const out: { head: string; origin: string; rest: string }[] = [];
  let current: string | null = null;
  const flush = () => {
    if (current === null) return;
    const found = head(current);
    if (found) out.push(found);
    current = null;
  };
  for (const line of lines) {
    if (head(line)) {
      flush();
      current = line;
    } else if (current !== null) {
      current = join(current, line);
    }
  }
  flush();
  return out;
}

/** «BARGAH, BARGƏH1» → bargah, bargəh; «ABAD2(AN)1» → abad, abadan */
function spellings(head: string): string[] {
  const out = new Set<string>();
  for (const part of head.split(/\s*,\s*|\s*\/\/\s*/)) {
    const clean = part.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    // «AS(İ)TAN(Ə)»: every spelling with and without the bracketed letters
    let forms = [''];
    for (const piece of clean.replace(/'/g, '’').split(/\s*(\([^)]*\))/)) {
      const optional = piece.match(/^\((.*)\)$/);
      forms = optional ? forms.flatMap((f) => [f, f + optional[1]]) : forms.map((f) => f + piece);
    }
    for (const f of forms) if (f.trim()) out.add(lower(f.trim()));
  }
  return [...out];
}

function tidy(s: string): string {
  return s
    .replace(/[†‡‰‚]/g, '')
    .replace(/\bb a x\b/g, 'bax')
    // The raised homonym figure of a cross-reference: «bax bari1»
    .replace(new RegExp(`([${LOWER}’])\\d(?=[\\s.;,)]|$)`, 'g'), '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s+([;,.)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();
}

function entry(a: { head: string; origin: string; rest: string }): GlossaryEntry | null {
  const h = spellings(a.head);
  let rest = a.rest.replace(/^\s*(?:\d+\s+)+/, ' ');
  let o = a.origin;
  // «ALİMNÜMA ə. və f.»: an Arabic word joined to a Persian one; «AMİN ə. əsli ibr.»
  const second = rest.match(new RegExp(`^\\s*və\\s+(${ORIGIN})\\.`));
  if (second) {
    o += `+${second[1]}`;
    rest = rest.slice(second[0].length);
  }
  const first = rest.match(new RegExp(`^\\s*əsli\\s+(${ORIGIN})\\.`));
  if (first) {
    o += `<${first[1]}`;
    rest = rest.slice(first[0].length);
  }
  rest = rest.replace(/^\s*(?:\d+\s+)+/, ' ');
  const text = tidy(rest);
  if (!h.length || !text) return null;

  // Set phrases follow the gloss: «Bari-giran ağır yük; abi-həyat bax abi-zindəgani». Each starts
  // with the headword in its izafet form, which tells them from a hyphenated word in a gloss
  const stem = h[0].replace(/[’\- ]/g, '').slice(0, 2);
  const phraseAt = new RegExp(`(?:^|[.;]\\s+)(${stem}[${LOWER}’]*(?:-[${LOWER}’]+)+)\\s+`, 'gi');
  const marks = stem.length === 2 ? [...text.matchAll(phraseAt)] : [];
  if (!marks.length) return { h, o, d: text };
  const p: [string, string][] = marks.map((m, i) => {
    const from = m.index! + m[0].length;
    const to = i + 1 < marks.length ? marks[i + 1].index! : text.length;
    return [lower(m[1]), text.slice(from, to).replace(/[;.\s]+$/, '').replace(/^[–—]\s*/, '')];
  });
  const d = text.slice(0, marks[0].index!).replace(/[;\s]+$/, '').trim();
  const kept = p.filter(([, gloss]) => gloss);
  if (!d) return kept.length ? { h, o, d: kept.map(([ph, g]) => `${ph}: ${g}`).join('; ') } : null;
  return kept.length ? { h, o, d: /[.…)!?»]$/.test(d) ? d : `${d}.`, p: kept } : { h, o, d };
}

export const glossaryCommand = new Command('glossary')
  .description('Read «Ərəb və fars sözləri lüğəti» (2 vols, Şərq-Qərb 2005) from its PDFs into the API\'s glossary file')
  .option('--pdf <file...>', 'The volumes, in order', [path.join(RAW_DIR, 'efsl-1.pdf'), path.join(RAW_DIR, 'efsl-2.pdf')])
  .option('--dry-run', 'Count and sample, write nothing')
  .action(async (opts: { pdf: string[]; dryRun?: boolean }) => {
    const entries: GlossaryEntry[] = [];
    for (const pdf of opts.pdf) {
      const found = articles(await volumeLines(pdf)).map(entry).filter((e): e is GlossaryEntry => e !== null);
      console.log(`${path.basename(pdf)}: ${found.length} entries`);
      entries.push(...found);
    }
    const phrases = entries.reduce((n, e) => n + (e.p?.length ?? 0), 0);
    console.log(`${entries.length} entries, ${phrases} set phrases`);
    if (opts.dryRun) {
      for (let i = 0; i < entries.length; i += Math.floor(entries.length / 12)) console.log(JSON.stringify(entries[i]));
      return;
    }
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, `[\n${entries.map((e) => JSON.stringify(e)).join(',\n')}\n]\n`);
    console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)}`);
  });
