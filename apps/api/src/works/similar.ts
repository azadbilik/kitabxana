import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * "Works like this one": for each work, up to ten works by other authors whose text reads most
 * alike (BAAI/bge-m3 embeddings, nearest in the full space), from the literature galaxy on
 * azadbilik.org. Written to nearest.json by `pnpm --dir apps/api similar`; held in memory, no table.
 */
export class SimilarIndex {
  private readonly next = new Map<string, string[]>();

  constructor(data?: { ids: (string | null)[]; nn: number[][] }) {
    if (!data) return;
    data.ids.forEach((id, i) => {
      if (!id) return;
      const near = (data.nn[i] ?? []).map((j) => data.ids[j]).filter((x): x is string => !!x && x !== id);
      if (near.length) this.next.set(id, near);
    });
  }

  get size() {
    return this.next.size;
  }

  /** Nearest first; empty when the work isn't in the index (newer than the last build) */
  of(workId: string): string[] {
    return this.next.get(workId) ?? [];
  }

  static load(file = path.join(__dirname, 'nearest.json')): SimilarIndex {
    const logger = new Logger('SimilarIndex');
    try {
      const index = new SimilarIndex(JSON.parse(fs.readFileSync(file, 'utf8')));
      logger.log(`${index.size} works with similar works`);
      return index;
    } catch (err) {
      // The page still shows other poets' works, picked the old way
      logger.warn(`No similar-works index at ${file}: ${(err as Error).message}`);
      return new SimilarIndex();
    }
  }
}

/**
 * Of the nearest works (nearest first), the first `take` by different authors.
 * `authorOf` holds only the works that may be shown.
 */
export function pickSimilar(near: string[], authorOf: Map<string, string>, take: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of near) {
    const author = authorOf.get(id);
    if (!author || seen.has(author)) continue;
    seen.add(author);
    out.push(id);
    if (out.length === take) break;
  }
  return out;
}
