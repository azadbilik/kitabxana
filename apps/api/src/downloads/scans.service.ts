import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** A scanned source book, stored as `<SCANS_DIR>/<key>.pdf` */
export interface Scan {
  key: string;
  /** Size in bytes */
  bytes: number;
  /** 1-based PDF page the work starts on, when known */
  page?: number;
}

/** Books the texts were transcribed from: National Library (bibid) and Halle MENAdoc (handle) */
const KEY = /^(anl-\d+|halle-\d+)$/;
const SOURCE_KEY = /^(anl-\d+|halle-\d+)(?:-|$)/;
const TTL = 5 * 60_000;

/**
 * The scanned PDFs of the books works were transcribed from. A book is offered once its file
 * is in SCANS_DIR — no database rows: dropping a PDF in the folder is enough. Works map to a book
 * through their sourceId (`anl-8283-t188` → `anl-8283`) and to a page through the National
 * Library reader link in their sourceNote (`…&pno=172`).
 */
@Injectable()
export class ScansService {
  private dir: string | null;
  private cache = new Map<string, { bytes: number | null; at: number }>();

  constructor(config: ConfigService) {
    const dir = config.get<string>('SCANS_DIR');
    this.dir = dir ? path.resolve(dir) : null;
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

  /** The scan a work was transcribed from, opened at its page */
  forWork(work: { sourceId: string | null; sourceNote: string | null }): Scan | null {
    const key = ScansService.keyOf(work.sourceId);
    if (!key || !this.file(key)) return null;
    const pno = key.startsWith('anl-') ? Number(work.sourceNote?.match(/[?&]pno=(\d+)/)?.[1]) : NaN;
    return { key, bytes: this.size(key)!, ...(pno > 0 ? { page: pno } : {}) };
  }

  /** The scans of a collection's works, in order of first appearance */
  forWorks(works: { sourceId: string | null }[]): Scan[] {
    const keys = [...new Set(works.map((w) => ScansService.keyOf(w.sourceId)).filter((k): k is string => !!k))];
    return keys.filter((k) => this.file(k)).map((key) => ({ key, bytes: this.size(key)! }));
  }

  /** Path for the download route; 404 when the book has no scan */
  require(key: string) {
    const file = this.file(key);
    if (!file) throw new NotFoundException('Scan not found');
    return file;
  }
}
