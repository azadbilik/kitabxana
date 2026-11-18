import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { Glossary, normalise, stems, type GlossaryEntry } from './lookup';

const small = new Glossary([
  { h: ['dərd'], o: 'f', d: '1) ağrı; 2) kədər.', p: [['dərdi-dil', 'ürək dərdi']] },
  { h: ['ab'], o: 'f', d: 'su.', p: [['abi-həyat', 'dirilik suyu']] },
  { h: ['həyat'], o: 'ə', d: 'yaşayış.' },
  { h: ['mə’na'], o: 'ə', d: 'anlam.' },
  { h: ['fəraq'], o: 'ə', d: 'ayrılıq.' },
  { h: ['bar'], o: 'f', d: 'yük.' },
  { h: ['bar'], o: 'f', d: 'meyvə.' },
  { h: ['bargah', 'bargəh'], o: 'f', d: 'saray.' },
  { h: ['abü tab'], o: 'f', d: 'təzəlik.' },
]);
const heads = (w: string) => small.lookup(w).map((m) => m.head);

describe('normalise', () => {
  it('lower-cases by Azerbaijani rules and trims punctuation', () => {
    expect(normalise('«DƏRDİM!»')).toBe('dərdim');
    expect(normalise('IŞIQ,')).toBe('ışıq');
    expect(normalise("mə'na")).toBe('mə’na');
  });
});

describe('stems', () => {
  it('takes suffixes off one after another, nearest stem first', () => {
    expect(stems('dərdimdən')).toContain('dərd');
    expect(stems('dərdlərinə').indexOf('dərdləri')).toBeLessThan(stems('dərdlərinə').indexOf('dərd'));
  });
  it('never leaves a stem under three letters', () => {
    expect(stems('ana')).toEqual([]);
  });
});

describe('Glossary.lookup', () => {
  it('finds a word as written, whatever its case and apostrophes', () => {
    expect(heads('Dərd')).toEqual(['dərd']);
    expect(heads('məna')).toEqual(['mə’na']);
    expect(heads('Mə’na,')).toEqual(['mə’na']);
  });
  it('finds a word under its suffixes', () => {
    expect(heads('dərdimdən')).toEqual(['dərd']);
    expect(heads('fərağı')).toEqual(['fəraq']);
    expect(heads('bargəhində')).toEqual(['bargəh']);
  });
  it('gathers homonyms under one head', () => {
    expect(small.lookup('bar')[0].senses).toHaveLength(2);
  });
  it('answers a listed set phrase with its own gloss', () => {
    const [m] = small.lookup('Abi-həyat');
    expect(m.phrase).toEqual({ text: 'abi-həyat', gloss: 'dirilik suyu' });
    expect(m.head).toBe('ab');
  });
  it('answers an unlisted compound part by part', () => {
    expect(heads('abi-fəraq')).toEqual(['ab', 'fəraq']);
    expect(heads('abü-tab')).toEqual(['abü tab']);
    // «bari-» before another word is «bar» with its izafet, whatever «bari» may be on its own
    expect(new Glossary([{ h: ['bar'], o: 'f', d: 'yük.' }, { h: ['bari'], o: 'ə', d: 'yaradan.' }, { h: ['giran'], o: 'f', d: 'ağır.' }]).lookup('bari-giran').map((m) => m.head)).toEqual(['bar', 'giran']);
  });
  it('reads suffixes only in the order the language hangs them', () => {
    // «cahan» is not «cah» + a + n: a case ending cannot stand before «whose»
    expect(stems('cahan')).not.toContain('cah');
    expect(stems('ləbini')).toContain('ləb');
    expect(stems('validlərinin')).toContain('valid');
  });
  it('leaves everyday words alone', () => {
    const g = new Glossary([{ h: ['bi’r'], o: 'ə', d: 'quyu.' }, { h: ['sal'], o: 'f', d: 'il.' }]);
    expect(g.lookup('bir')).toEqual([]);
    expect(g.lookup('birdən')).toEqual([]);
    expect(g.lookup('saldı')).toEqual([]);
    expect(g.lookup('sal')).toHaveLength(1);
  });
  it('follows a gloss that only points elsewhere', () => {
    const g = new Glossary([
      { h: ['nigahdar'], o: 'f', d: 'bax nigəhdar.' },
      { h: ['nigəhdar'], o: 'f', d: 'bax nigəhban.' },
      { h: ['nigəhban'], o: 'f', d: 'gözətçi.' },
      { h: ['yetim'], o: 'ə', d: 'bax yoxdur.' },
    ]);
    expect(g.lookup('nigahdar')[0].senses[0].text).toBe('nigəhban: gözətçi.');
    expect(g.lookup('yetim')[0].senses[0].text).toBe('bax yoxdur.');
  });
  it('finds nothing for a word it does not have', () => {
    expect(heads('gəlirəm')).toEqual([]);
    expect(heads('')).toEqual([]);
    expect(heads('a')).toEqual([]);
  });
});

describe('the dictionary file', () => {
  const entries = JSON.parse(fs.readFileSync(path.join(__dirname, 'efsl.json'), 'utf8')) as GlossaryEntry[];
  const glossary = new Glossary(entries);

  it('holds both volumes, A to Z', () => {
    expect(entries.length).toBeGreaterThan(19000);
    const letters = new Set(entries.map((e) => e.h[0][0]));
    for (const l of 'abcçdeəfghxijkqlmnöprsştuüvyz') expect(letters.has(l), l).toBe(true);
  });
  it('carries no noise of the Arabic column and no merged articles', () => {
    const noisy = entries.filter((e) => /[\x00-\x1f؀-ۿ]|[A-ZÇƏĞİÖŞÜ]{4,}/.test(e.d));
    expect(noisy.length).toBeLessThan(10);
  });
  it('glosses the words classical verse leans on', () => {
    for (const w of ['saqi', 'meyxanə', 'hicran', 'vüsal', 'rüxsar', 'zülf', 'əğyar', 'canan', 'bülbül', 'pərvanə']) {
      expect(glossary.lookup(w).length, w).toBeGreaterThan(0);
    }
    expect(glossary.lookup('rüxsarına')[0].head).toBe('rüxsar');
  });
});
