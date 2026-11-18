import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';
import { SCAN_STARTS, SCAN_TEXT_END } from './scan-starts';

const run = promisify(execFile);

/** A run of pages in a scanned book, 1-based and inclusive */
export interface PageRange {
  from: number;
  to: number;
  /** Estimated size of the cut-out PDF, in bytes */
  bytes: number;
}

/** A scanned source book, stored as `<SCANS_DIR>/<key>.pdf` */
export interface Scan {
  key: string;
  /** Size in bytes */
  bytes: number;
  /** 1-based PDF page the work starts on, when known */
  page?: number;
  /** Just the pages of this work or collection, offered instead of the whole book */
  range?: PageRange;
}

/** Books the texts were transcribed from: National Library (bibid) and Halle MENAdoc (handle) */
const KEY = /^(anl-\d+|halle-\d+)$/;
const SOURCE_KEY = /^(anl-\d+|halle-\d+)(?:-|$)/;
const TTL = 5 * 60_000;

/** Where each work of a book sits in its scan */
interface Layout {
  pages: number;
  bytes: number;
  works: Map<string, { from: number; to: number }>;
  collections: Map<string, { from: number; to: number }>;
}

/**
 * A work's pages read off the scan by hand, where the page marks can't tell: a book's only work
 * imported from it runs "to the end" otherwise, into whatever else the volume prints.
 */
const KNOWN_PAGES: Record<string, { from: number; to: number }> = {
  // Seçilmiş əsərləri III (2005): «Geriyə baxma, qoca» follows from p. 94
  'anl-8529-t1': { from: 4, to: 93 },
};

/**
 * Starts read off the scan by hand where `parse scan-starts` couldn't place a work (its opening is
 * a short stage direction the OCR matches poorly). They join SCAN_STARTS, so a re-run keeps them.
 */
const KNOWN_STARTS: Record<string, number> = {
  // Əsərləri (235376): the act and scene headings ("Üçüncü pərdə", "İkinci şəkil") on these pages
  'anl-235376-t1-3': 14,
  'anl-235376-t2-3': 31,
  'anl-235376-t3-1': 40,
  'anl-235376-t3-2': 47,
  'anl-235376-t5-2': 102,
  'anl-235376-t5-6': 125,
  'anl-235376-t6-3': 140,
  'anl-235376-t6-7': 157,
  'anl-235376-t6-8': 159,
};
const STARTS: Record<string, number> = { ...SCAN_STARTS, ...KNOWN_STARTS };

const naturalCompare = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

/**
 * The scanned PDFs of the books works were transcribed from. A book is offered once its file
 * is in SCANS_DIR — no database rows: dropping a PDF in the folder is enough. Works map to a book
 * through their sourceId (`anl-8283-t188` → `anl-8283`) and to a page through the National
 * Library reader link in their sourceNote (`…&pno=172`).
 *
 * A work's own pages run from its page to the page the next work starts on (inclusive: the
 * next one may begin mid-page). Some books carry one page for a whole run of works (every
 * chapter of a novel marked at the novel's first page); there each work's start found in the
 * scan (SCAN_STARTS) is used, and failing that the run's pages are shared out by text length,
 * a page of margin either side, since a reader would rather get a page too many than lose the
 * end of a chapter.
 */
@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);
  private dir: string | null;
  private slicesDir: string;
  private cache = new Map<string, { bytes: number | null; at: number }>();
  private layouts = new Map<string, { layout: Promise<Layout | null>; at: number }>();
  private slicing = new Map<string, Promise<string>>();

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    const dir = config.get<string>('SCANS_DIR');
    this.dir = dir ? path.resolve(dir) : null;
    this.slicesDir = config.get<string>('SCAN_SLICES_DIR') ?? path.join(os.tmpdir(), 'kitabxana-scan-slices');
  }

  /** Book key of a work's sourceId, e.g. `anl-8283` */
  static keyOf(sourceId: string | null | undefined) {
    return sourceId?.match(SOURCE_KEY)?.[1] ?? null;
  }

  /** Absolute path of a book's PDF, or null when the key is malformed or the file is missing */
  file(key: string) {
    if (!this.dir || !KEY.test(key)) return null;
    return this.size(key) == null ? null : path.join(this.dir, `${key}.pdf`);
  }

  private size(key: string): number | null {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.bytes;
    let bytes: number | null = null;
    try {
      const stat = fs.statSync(path.join(this.dir!, `${key}.pdf`));
      if (stat.isFile()) bytes = stat.size;
    } catch {
      // not there
    }
    this.cache.set(key, { bytes, at: Date.now() });
    return bytes;
  }

  private layout(key: string): Promise<Layout | null> {
    const hit = this.layouts.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.layout;
    const layout = this.buildLayout(key).catch((err) => {
      this.logger.warn(`No page layout for ${key}: ${err?.message ?? err}`);
      return null;
    });
    this.layouts.set(key, { layout, at: Date.now() });
    return layout;
  }

  private async buildLayout(key: string): Promise<Layout | null> {
    // Only the National Library's reader links carry a page
    const file = this.file(key);
    if (!file || !key.startsWith('anl-')) return null;
    const rows = await this.prisma.$queryRaw<
      { sourceId: string; collectionId: string | null; pno: number | null; chars: number }[]
    >`select "sourceId", "collectionId",
             nullif(substring("sourceNote" from '[?&]pno=(\\d+)'), '')::int as pno,
             length(body)::int as chars
        from "Work" where "sourceId" like ${`${key}-%`}`;
    const placed = rows.filter((r) => r.pno && r.pno > 0) as (typeof rows[number] & { pno: number })[];
    if (!placed.length) return null;
    const { stdout } = await run('qpdf', ['--show-npages', file]);
    const pages = Number(stdout.trim());
    if (!(pages > 0)) return null;

    placed.sort((a, b) => a.pno - b.pno || naturalCompare(a.sourceId, b.sourceId));
    // Runs of works marked at the same page
    const groups: { start: number; works: typeof placed; chars: number }[] = [];
    for (const row of placed) {
      const last = groups.at(-1);
      if (last && last.start === row.pno) {
        last.works.push(row);
        last.chars += row.chars;
      } else groups.push({ start: row.pno, works: [row], chars: row.chars });
    }
    // Pages per character, from the runs whose end is known, to bound the last run
    let knownChars = 0;
    let knownPages = 0;
    for (let i = 0; i < groups.length - 1; i++) {
      knownChars += groups[i].chars;
      knownPages += groups[i + 1].start - groups[i].start;
    }
    const perChar = knownChars > 0 && knownPages > 0 ? knownPages / knownChars : null;

    const works = new Map<string, { from: number; to: number }>();
    groups.forEach((group, i) => {
      const next = groups[i + 1];
      const end = Math.min(
        pages,
        next
          ? next.start
          : perChar
            ? Math.max(group.start, group.start + Math.ceil(group.chars * perChar * 1.15) + 1)
            : pages,
      );
      if (group.works.length === 1) {
        works.set(group.works[0].sourceId, { from: Math.min(group.start, pages), to: end });
        return;
      }
      const span = end - group.start;
      let before = 0;
      for (const work of group.works) {
        const f0 = group.chars ? before / group.chars : 0;
        before += work.chars;
        const f1 = group.chars ? before / group.chars : 1;
        works.set(work.sourceId, {
          from: Math.max(group.start, group.start + Math.floor(f0 * span) - 1),
          to: Math.min(end, group.start + Math.ceil(f1 * span) + 1),
        });
      }
    });

    // Exact starts, where a run's works were found in the scan: each runs to the page the next
    // work (or run) starts on, inclusive since it may start mid-page
    const exact = placed.filter((r) => STARTS[r.sourceId] != null);
    if (exact.length) {
      const bounds = [...new Set([...groups.map((g) => g.start), ...exact.map((r) => STARTS[r.sourceId])])].sort(
        (a, b) => a - b,
      );
      for (const row of exact) {
        const from = Math.min(STARTS[row.sourceId], pages);
        const next = bounds.find((page) => page > from);
        const to = next ?? SCAN_TEXT_END[key] ?? works.get(row.sourceId)?.to ?? pages;
        works.set(row.sourceId, { from, to: Math.min(Math.max(to, from), pages) });
      }
    }
    for (const [sourceId, range] of Object.entries(KNOWN_PAGES)) {
      if (works.has(sourceId)) works.set(sourceId, { from: range.from, to: Math.min(range.to, pages) });
    }

    const collections = new Map<string, { from: number; to: number }>();
    for (const row of rows) {
      const range = works.get(row.sourceId);
      if (!range || !row.collectionId) continue;
      const seen = collections.get(row.collectionId);
      collections.set(row.collectionId, seen
        ? { from: Math.min(seen.from, range.from), to: Math.max(seen.to, range.to) }
        : { ...range });
    }
    return { pages, bytes: this.size(key)!, works, collections };
  }

  private withBytes(layout: Layout, range: { from: number; to: number }): PageRange {
    return { ...range, bytes: Math.round((layout.bytes * (range.to - range.from + 1)) / layout.pages) };
  }

  /** The scan a work was transcribed from, opened at its page, with just its pages to save */
  async forWork(work: { sourceId: string | null; sourceNote: string | null }): Promise<Scan | null> {
    const key = ScansService.keyOf(work.sourceId);
    if (!key || !this.file(key)) return null;
    const pno = key.startsWith('anl-') ? Number(work.sourceNote?.match(/[?&]pno=(\d+)/)?.[1]) : NaN;
    const layout = await this.layout(key);
    const own = layout?.works.get(work.sourceId!);
    const range = own && layout ? this.withBytes(layout, own) : undefined;
    const page = range?.from ?? (pno > 0 ? pno : undefined);
    return { key, bytes: this.size(key)!, ...(page ? { page } : {}), ...(range ? { range } : {}) };
  }

  /** The scans of a collection's works, in order of first appearance, each cut to the collection's pages */
  async forWorks(collectionId: string, works: { sourceId: string | null }[]): Promise<Scan[]> {
    const keys = [...new Set(works.map((w) => ScansService.keyOf(w.sourceId)).filter((k): k is string => !!k))];
    const scans = await Promise.all(
      keys
        .filter((k) => this.file(k))
        .map(async (key): Promise<Scan> => {
          const layout = await this.layout(key);
          const own = layout?.collections.get(collectionId);
          // A collection that is the whole book needs no cutting
          const range = own && layout && (own.from > 1 || own.to < layout.pages) ? this.withBytes(layout, own) : undefined;
          return { key, bytes: this.size(key)!, ...(range ? { page: range.from, range } : {}) };
        }),
    );
    return scans;
  }

  /** Path for the download route; 404 when the book has no scan */
  require(key: string) {
    const file = this.file(key);
    if (!file) throw new NotFoundException('Scan not found');
    return file;
  }

  /**
   * A PDF of just the given pages, cut once with qpdf and kept in the slices folder. Only ranges
   * the site offers (a work's or a collection's) are cut, so the folder can't be filled at will.
   */
  async slice(key: string, from: number, to: number): Promise<string> {
    const source = this.require(key);
    const layout = await this.layout(key);
    const offered =
      !!layout &&
      [...layout.works.values(), ...layout.collections.values()].some((r) => r.from === from && r.to === to);
    if (!offered) throw new NotFoundException('No such pages');
    const out = path.join(this.slicesDir, `${key}-p${from}-${to}.pdf`);
    if (fs.existsSync(out)) return out;
    let pending = this.slicing.get(out);
    if (!pending) {
      pending = (async () => {
        await fs.promises.mkdir(this.slicesDir, { recursive: true });
        const tmp = `${out}.${process.pid}.tmp`;
        await run('qpdf', [source, '--pages', '.', `${from}-${to}`, '--', tmp]);
        await fs.promises.rename(tmp, out);
        return out;
      })().finally(() => this.slicing.delete(out));
      this.slicing.set(out, pending);
    }
    return pending;
  }
}
