import type { BookSummary } from '@/lib/api';

/** A work as the account endpoints return it */
export interface LibraryWork {
  id: string;
  slug: string;
  titleAz: string;
  titleRu: string | null;
  titleEn: string | null;
  genre: string;
  form: string | null;
  author: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null };
  collection: { id: string; slug: string; titleAz: string; titleRu: string | null; titleEn: string | null; genre: string } | null;
}

export type ShelfEntry =
  | { type: 'book'; book: BookSummary; status?: string; lastWorkId?: string | null; progress?: { done: number; total: number } | null }
  | { type: 'work'; work: LibraryWork; status?: string; progress?: number }
  | { type: 'author'; author: { id: string; slug: string; nameAz: string; nameRu: string | null; nameEn: string | null; bornYear: number | null; diedYear: number | null } };

export interface ContinueEntry {
  progress: number;
  updatedAt: string;
  work: LibraryWork;
  book: { done: number; total: number } | null;
}
