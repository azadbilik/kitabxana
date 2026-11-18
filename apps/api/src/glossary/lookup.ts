/**
 * Finding a word of a text in the dictionary: as written, as a set phrase («abi-həyat»), or under
 * the suffixes Azerbaijani hangs on it («dərdimdən» → dərd). Kept free of Nest so it is tested
 * on its own.
 */

/** One dictionary article, as `pnpm parse glossary` writes it */
export interface GlossaryEntry {
  /** Its spellings, lower case */
  h: string[];
  /** Where the word is from: «ə», «f», «ə+f» (an Arabic word joined to a Persian one), «ə<y» (Arabic, from Greek) */
  o: string;
  /** The gloss */
  d: string;
  /** Set phrases under the word, each with its gloss */
  p?: [string, string][];
}

export interface GlossaryMatch {
  /** The dictionary's spelling of the word found */
  head: string;
  senses: { origin: string; text: string }[];
  /** The set phrase the reader's word is, when it is one */
  phrase?: { text: string; gloss: string };
}

const LETTERS = 'a-zçəğıöşüâîû';

/** Lower case by Azerbaijani rules (İ → i, I → ı), every apostrophe the same, edges trimmed to letters */
export function normalise(word: string): string {
  return word
    .normalize('NFC')
    .toLocaleLowerCase('az')
    .replace(/[ʼ'`ʻ‘′]/g, '’')
    .replace(/[‐‑–]/g, '-')
    .replace(new RegExp(`^[^${LETTERS}]+|[^${LETTERS}’]+$`, 'g'), '')
    .replace(/’+$/, (m) => m.slice(0, 1));
}

/** The form entries are filed under: texts print «məna» where the dictionary has «mə’na» */
const key = (word: string) => word.replace(/’/g, '').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');

// What a word may end in, by its place in the word: stem · made-from · plural · whose · case · is/was.
// Suffixes come off from the end, so each one taken must sit in an earlier place than the last
const PLACES: string[][] = [
  // 1 words made from it
  ['lıq', 'lik', 'luq', 'lük', 'lığ', 'liy', 'luğ', 'lüy', 'lı', 'li', 'lu', 'lü', 'sız', 'siz', 'suz', 'süz', 'dakı', 'dəki', 'kı', 'ki', 'ca', 'cə'],
  // 2 plural
  ['lar', 'lər'],
  // 3 whose it is
  ['ımız', 'imiz', 'umuz', 'ümüz', 'ınız', 'iniz', 'unuz', 'ünüz', 'mız', 'miz', 'muz', 'müz', 'nız', 'niz', 'nuz', 'nüz',
    'ım', 'im', 'um', 'üm', 'ın', 'in', 'un', 'ün', 'sı', 'si', 'su', 'sü', 'm', 'n', 'ı', 'i', 'u', 'ü'],
  // 4 case, and "with"
  ['ndan', 'ndən', 'dan', 'dən', 'nda', 'ndə', 'da', 'də', 'nın', 'nin', 'nun', 'nün', 'ın', 'in', 'un', 'ün', 'na', 'nə', 'ya', 'yə',
    'nı', 'ni', 'nu', 'nü', 'yı', 'yi', 'yu', 'yü', 'a', 'ə', 'ı', 'i', 'u', 'ü', 'yla', 'ylə', 'la', 'lə'],
  // 5 is, was, I am
  ['dır', 'dir', 'dur', 'dür', 'dı', 'di', 'du', 'dü', 'ydı', 'ydi', 'ydu', 'ydü', 'yam', 'yəm', 'am', 'əm', 'san', 'sən'],
];

/**
 * Stems a word may stand on, nearest first: «dərdimdən» → dərdim, dərd. `min` is the shortest
 * stem allowed: three letters, or two for the first part of a compound («abi-» is «ab»).
 */
export function stems(word: string, min = 3): string[] {
  const found = new Set<string>();
  const walk = (w: string, before: number) => {
    for (let place = 0; place < before; place++) {
      for (const suffix of PLACES[place]) {
        if (!w.endsWith(suffix)) continue;
        const stem = w.slice(0, -suffix.length);
        if (stem.length < min) continue;
        found.add(stem);
        // «fərağı» stands on «fəraq», «mələyi» on «mələk»
        if (/[aıou]ğ$/.test(stem)) found.add(`${stem.slice(0, -1)}q`);
        if (/[əeiöü]y$/.test(stem)) found.add(`${stem.slice(0, -1)}k`);
        walk(stem, place);
      }
    }
  };
  walk(word, PLACES.length);
  // Fewest letters taken off first
  return [...found].sort((a, b) => b.length - a.length);
}

// Everyday Azerbaijani words that are spelt like an entry (bir / bi’r «quyu», mən / mənn, qara / qar)
// or carry no reader to the dictionary: tapping them finds nothing
const EVERYDAY = new Set(
  `bir biri bu o nə mən sən biz siz mənim sənin məni səni mənə sənə da də ki və ya ha indi deyə niyə bütün
   kişi qara sarı su al ala ac dur bala balaca ana ata sanki bacı qarı xala qala bakı dərin kənd qulluq
   var yox az çox ol et de gəl get gör bil ver at ad il ay gün əl əli baş yan`.split(/\s+/),
);
// Entries a suffixed word must not be read as: «saldı» is not «sal» (il), «əlini» not «əli» (uca)
const NOT_A_STEM = new Set(
  `bir mən sən mənim sənin dey sal qal qaz gəz dal ara əli əlim kəsi xal qar sar bak bac kən kiş büt nik amm
   kərb san qul dər bəs ol et de gəl get gör bil ver var yox yan yat tut qoy qaç düş çıx gir dön at ad il ay
   an in on üz öz iç dil`.split(/\s+/),
);

export class Glossary {
  private byHead = new Map<string, GlossaryEntry[]>();
  private byPhrase = new Map<string, { text: string; gloss: string; entry: GlossaryEntry }>();

  constructor(entries: GlossaryEntry[]) {
    for (const e of entries) {
      for (const h of e.h) {
        const k = key(h);
        const list = this.byHead.get(k);
        if (!list) this.byHead.set(k, [e]);
        else if (!list.includes(e)) list.push(e);
      }
      for (const [text, gloss] of e.p ?? []) {
        if (!this.byPhrase.has(key(text))) this.byPhrase.set(key(text), { text, gloss, entry: e });
      }
    }
  }

  get size() {
    return this.byHead.size;
  }

  /**
   * A gloss that only points elsewhere («bax abi-zindəgani.») with what stands there, so the
   * reader is not sent on a second errand. The dictionary chains these; three steps are followed.
   */
  private resolved(text: string): string {
    let name = '';
    let gloss = text;
    for (let step = 0; step < 3; step++) {
      const ref = gloss.match(/^bax ([^.;:(]+?)\.?$/);
      if (!ref) break;
      const k = key(normalise(ref[1]));
      const target = this.byPhrase.get(k)?.gloss ?? this.byHead.get(k)?.[0].d ?? this.byHead.get(k.replace(/-/g, ''))?.[0].d;
      if (!target) break;
      [name, gloss] = [ref[1], target];
    }
    // A chain that never reaches a gloss is left as the book has it
    return !name || /^bax /.test(gloss) ? text : `${name}: ${gloss}`;
  }

  private head(k: string): GlossaryMatch | null {
    const entries = this.byHead.get(k);
    if (!entries) return null;
    const head = entries[0].h.find((h) => key(h) === k) ?? entries[0].h[0];
    return { head, senses: entries.map((e) => ({ origin: e.o, text: this.resolved(e.d) })) };
  }

  /** A single word: as written, or else on its stems; two stems where a word reads both ways («sərvin») */
  private word(k: string, part = false): GlossaryMatch[] {
    if (EVERYDAY.has(k)) return [];
    const exact = this.head(k);
    if (exact) return [exact];
    const out: GlossaryMatch[] = [];
    for (const stem of stems(k, part ? 2 : 3)) {
      if (NOT_A_STEM.has(stem) && !(part && stem === 'dil')) continue;
      const found = this.head(stem);
      if (found && !out.some((m) => m.head === found.head)) out.push(found);
      if (out.length === 2) break;
    }
    return out;
  }

  /**
   * What the dictionary has for a word as the reader tapped it. A compound the dictionary does
   * not list («dərdi-dil») is answered part by part.
   */
  lookup(raw: string): GlossaryMatch[] {
    const word = normalise(raw);
    if (word.length < 2 || word.length > 60) return [];
    const k = key(word);

    const phrase = this.byPhrase.get(k);
    if (phrase) {
      return [{
        head: phrase.entry.h[0],
        senses: [{ origin: phrase.entry.o, text: this.resolved(phrase.entry.d) }],
        phrase: { text: phrase.text, gloss: this.resolved(phrase.gloss) },
      }];
    }
    if (!k.includes('-')) return this.word(k);
    // «dərd-qəm» may be filed as one word or with a space
    const whole = this.head(k.replace(/-/g, '')) ?? this.head(k.replace(/-/g, ' '));
    if (whole) return [whole];
    const out: GlossaryMatch[] = [];
    const parts = k.split('-');
    for (const [i, part] of parts.entries()) {
      if (part.length < 2) continue;
      // Before the last part a closing vowel is the izafet: «səri-kuy» is «sər», not «səri’»
      const izafet = i < parts.length - 1 ? part.match(/^(.{2,}?)(?:yi|yü|i|ı|u|ü)$/) : null;
      // The best reading of each part is enough
      const found = (izafet && this.head(izafet[1])) || this.word(part, true)[0];
      if (found && !out.some((m) => m.head === found.head)) out.push(found);
    }
    return out;
  }
}
