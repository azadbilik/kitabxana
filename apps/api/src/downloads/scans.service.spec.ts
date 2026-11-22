import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ScansService } from './scans.service';

describe('ScansService.keyOf', () => {
  it.each([
    ['anl-8283-t188', 'anl-8283'],
    ['anl-8283', 'anl-8283'],
    ['halle-32329-t4', 'halle-32329'],
    ['kxn-500-t12', 'kxn-500'],
    ['kxn-877-t1-9', 'kxn-877'],
    ['preslib-pvuC24cI-t1', 'preslib-pvuC24cI'],
    ['preslib-pvuC24cI-q-t2', 'preslib-pvuC24cI'],
    ['turuz-1474-1-t5', 'turuz-1474-1'],
    ['turuz-nebi-xezri-1-t3-2', 'turuz-nebi-xezri-1'],
    ['turuz-zelimxan-yaqub-eserleri-11-t9', 'turuz-zelimxan-yaqub-eserleri-11'],
  ])('%s → %s', (sourceId, key) => expect(ScansService.keyOf(sourceId)).toBe(key));

  it.each(['ganjoor-116713', 'wikisource-foo', null, 'kxn-abc-t1'])('%s has no scan', (sourceId) =>
    expect(ScansService.keyOf(sourceId)).toBeNull(),
  );
});

describe('ScansService.forWork', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scans-'));
  fs.writeFileSync(path.join(dir, 'kxn-500.pdf'), '%PDF-1.4');
  const config = { get: (k: string) => (k === 'SCANS_DIR' ? dir : undefined) } as any;
  // No page marks in the database: the layout is empty, the page comes from the source link
  const prisma = { $queryRaw: async () => [] } as any;
  const scans = new ScansService(config, prisma);

  it("opens a kitabxana.net book at the work's #page", async () => {
    const scan = await scans.forWork({
      sourceId: 'kxn-500-t12',
      sourceNote: 'https://www.kitabxana.net/files/books/file/1255959503.pdf#page=42',
    });
    expect(scan).toMatchObject({ key: 'kxn-500', page: 42 });
  });

  it('offers nothing without the file', async () => {
    expect(await scans.forWork({ sourceId: 'kxn-501-t1', sourceNote: null })).toBeNull();
  });
});
