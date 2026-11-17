import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookStatus, Prisma, ReadingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { cleanProgress, FINISHED_AT, statusOnPartDone, statusOnPartOpened } from './rules';

export type FavoriteKind = 'work' | 'book' | 'author';
const FAVORITE_FIELD = { work: 'workId', book: 'collectionId', author: 'authorId' } as const;

const bookSelect = {
  id: true,
  slug: true,
  titleAz: true,
  titleRu: true,
  titleEn: true,
  titleFa: true,
  genre: true,
  year: true,
  yearApprox: true,
  author: { select: { slug: true, nameAz: true, nameRu: true, nameEn: true } },
  _count: { select: { works: { where: { status: 'PUBLISHED' } } } },
} satisfies Prisma.CollectionSelect;

const workSelect = {
  id: true,
  slug: true,
  titleAz: true,
  titleRu: true,
  titleEn: true,
  genre: true,
  form: true,
  author: { select: { slug: true, nameAz: true, nameRu: true, nameEn: true } },
  collection: { select: { id: true, slug: true, titleAz: true, titleRu: true, titleEn: true, genre: true } },
} satisfies Prisma.WorkSelect;

type BookRow = Prisma.CollectionGetPayload<{ select: typeof bookSelect }>;
const book = ({ _count, ...b }: BookRow) => ({ ...b, workCount: _count.works });

/** Everything a reader keeps: saved items, read marks, reading positions, book statuses */
@Injectable()
export class LibraryService {
  constructor(private prisma: PrismaService) {}

  /** The reader's marks on whatever a page shows, in one request */
  async state(userId: string, ids: { workIds?: string[]; collectionIds?: string[]; authorIds?: string[] }) {
    const workIds = (ids.workIds ?? []).slice(0, 1000);
    const collectionIds = (ids.collectionIds ?? []).slice(0, 200);
    const authorIds = (ids.authorIds ?? []).slice(0, 200);

    const [favorites, reading, books] = await Promise.all([
      this.prisma.favorite.findMany({
        where: {
          userId,
          OR: [
            ...(workIds.length ? [{ workId: { in: workIds } }] : []),
            ...(collectionIds.length ? [{ collectionId: { in: collectionIds } }] : []),
            ...(authorIds.length ? [{ authorId: { in: authorIds } }] : []),
          ],
        },
        select: { workId: true, collectionId: true, authorId: true },
      }),
      workIds.length
        ? this.prisma.readingState.findMany({
            where: { userId, workId: { in: workIds } },
            select: { workId: true, status: true, progress: true, updatedAt: true },
          })
        : [],
      collectionIds.length
        ? this.prisma.bookState.findMany({
            where: { userId, collectionId: { in: collectionIds } },
            select: { collectionId: true, status: true, lastWorkId: true },
          })
        : [],
    ]);

    return {
      saved: {
        works: favorites.flatMap((f) => (f.workId ? [f.workId] : [])),
        books: favorites.flatMap((f) => (f.collectionId ? [f.collectionId] : [])),
        authors: favorites.flatMap((f) => (f.authorId ? [f.authorId] : [])),
      },
      works: Object.fromEntries(reading.map((r) => [r.workId, { status: r.status, progress: r.progress, updatedAt: r.updatedAt }])),
      books: Object.fromEntries(books.map((b) => [b.collectionId, { status: b.status, lastWorkId: b.lastWorkId }])),
    };
  }

  async setFavorite(userId: string, kind: FavoriteKind, id: string, on: boolean) {
    const field = FAVORITE_FIELD[kind];
    if (!on) {
      await this.prisma.favorite.deleteMany({ where: { userId, [field]: id } });
      return { saved: false };
    }
    await this.assertExists(kind, id);
    await this.prisma.favorite.upsert({
      where: kind === 'work' ? { userId_workId: { userId, workId: id } }
        : kind === 'book' ? { userId_collectionId: { userId, collectionId: id } }
        : { userId_authorId: { userId, authorId: id } },
      update: {},
      create: { userId, [field]: id },
    });
    return { saved: true };
  }

  private async assertExists(kind: FavoriteKind, id: string) {
    const found =
      kind === 'work' ? await this.prisma.work.findFirst({ where: { id, status: 'PUBLISHED' }, select: { id: true } })
      : kind === 'book' ? await this.prisma.collection.findFirst({ where: { id, status: 'PUBLISHED' }, select: { id: true } })
      : await this.prisma.author.findFirst({ where: { id, status: 'PUBLISHED' }, select: { id: true } });
    if (!found) throw new NotFoundException();
  }

  /**
   * Opening, advancing or marking a work. `status: null` clears it (unread).
   * Reaching the end of the text marks it read. The work's book follows the rules in rules.ts.
   */
  async setReading(userId: string, workId: string, body: { status?: ReadingStatus | null; progress?: number; translationId?: string | null }) {
    const work = await this.prisma.work.findFirst({
      where: { id: workId, status: 'PUBLISHED' },
      select: { id: true, collectionId: true, collection: { select: { genre: true } } },
    });
    if (!work) throw new NotFoundException();

    if (body.status === null) {
      await this.prisma.readingState.deleteMany({ where: { userId, workId } });
      return { status: null, progress: 0 };
    }

    const existing = await this.prisma.readingState.findUnique({ where: { userId_workId: { userId, workId } } });
    const progress = body.progress === undefined ? existing?.progress ?? 0 : cleanProgress(body.progress);
    let status: ReadingStatus = body.status ?? existing?.status ?? 'READING';
    if (progress >= FINISHED_AT) status = 'DONE';
    // Scrolling back through a finished text doesn't unmark it; only an explicit status does
    if (existing?.status === 'DONE' && body.status === undefined) status = 'DONE';

    const saved = await this.prisma.readingState.upsert({
      where: { userId_workId: { userId, workId } },
      update: { status, progress, ...(body.translationId !== undefined && { translationId: body.translationId }) },
      create: { userId, workId, status, progress, translationId: body.translationId ?? null },
      select: { status: true, progress: true },
    });

    if (work.collectionId && work.collection) {
      await this.followBook(userId, work.collectionId, work.collection.genre, workId, status === 'DONE' && existing?.status !== 'DONE');
    }
    return saved;
  }

  /** Keeps the book's status and "last opened part" in step with the reading of one of its parts */
  private async followBook(userId: string, collectionId: string, genre: string, workId: string, justFinished: boolean) {
    const current = await this.prisma.bookState.findUnique({ where: { userId_collectionId: { userId, collectionId } } });
    let next = statusOnPartOpened((current?.status as BookStatus | undefined) ?? null, genre);

    if (justFinished) {
      const [done, total] = await Promise.all([
        this.prisma.readingState.count({ where: { userId, status: 'DONE', work: { collectionId, status: 'PUBLISHED' } } }),
        this.prisma.work.count({ where: { collectionId, status: 'PUBLISHED' } }),
      ]);
      next = statusOnPartDone(next ?? (current?.status as BookStatus | undefined) ?? null, genre, done, total) ?? next;
    }

    if (!current && !next) return;
    await this.prisma.bookState.upsert({
      where: { userId_collectionId: { userId, collectionId } },
      update: { lastWorkId: workId, ...(next && { status: next }) },
      create: { userId, collectionId, status: next ?? 'READING', lastWorkId: workId },
    });
  }

  /** The three-way switch on a book page. "Read" marks every part read; null takes it off the shelf. */
  async setBook(userId: string, collectionId: string, status: BookStatus | null) {
    const collection = await this.prisma.collection.findFirst({ where: { id: collectionId, status: 'PUBLISHED' }, select: { id: true } });
    if (!collection) throw new NotFoundException();
    if (status === null) {
      await this.prisma.bookState.deleteMany({ where: { userId, collectionId } });
      return { status: null };
    }
    if (status === 'DONE') {
      const works = await this.prisma.work.findMany({ where: { collectionId, status: 'PUBLISHED' }, select: { id: true } });
      await this.prisma.$transaction([
        this.prisma.readingState.updateMany({ where: { userId, workId: { in: works.map((w) => w.id) } }, data: { status: 'DONE' } }),
        this.prisma.readingState.createMany({
          data: works.map((w) => ({ userId, workId: w.id, status: 'DONE' as const, progress: 1 })),
          skipDuplicates: true,
        }),
      ]);
    }
    return this.prisma.bookState.upsert({
      where: { userId_collectionId: { userId, collectionId } },
      update: { status },
      create: { userId, collectionId, status },
      select: { status: true, lastWorkId: true },
    });
  }

  /**
   * Places kept in this browser before signing in (localStorage, by slug). Only works the
   * account has no position for are taken, so nothing on the server is overwritten.
   */
  async importPositions(userId: string, items: { slug: string; progress: number }[]) {
    const bySlug = new Map(items.slice(0, 500).map((i) => [i.slug, cleanProgress(i.progress)]));
    if (!bySlug.size) return { imported: 0 };
    const works = await this.prisma.work.findMany({
      where: { slug: { in: [...bySlug.keys()] }, status: 'PUBLISHED' },
      select: { id: true, slug: true },
    });
    const known = new Set(
      (await this.prisma.readingState.findMany({ where: { userId, workId: { in: works.map((w) => w.id) } }, select: { workId: true } })).map((r) => r.workId),
    );
    const fresh = works.filter((w) => !known.has(w.id));
    for (const w of fresh) await this.setReading(userId, w.id, { progress: bySlug.get(w.slug) });
    return { imported: fresh.length };
  }

  /** "Continue reading": the work the reader was in most recently, with its book's progress */
  async continueReading(userId: string) {
    const last = await this.prisma.readingState.findFirst({
      where: { userId, status: 'READING', work: { status: 'PUBLISHED' } },
      orderBy: { updatedAt: 'desc' },
      select: { progress: true, updatedAt: true, work: { select: workSelect } },
    });
    if (!last) return null;
    const collectionId = last.work.collection?.id;
    const bookProgress = collectionId ? await this.bookProgress(userId, [collectionId]) : {};
    return { ...last, book: collectionId ? bookProgress[collectionId] ?? null : null };
  }

  /** Read parts out of all parts, per book */
  private async bookProgress(userId: string, collectionIds: string[]) {
    if (!collectionIds.length) return {} as Record<string, { done: number; total: number }>;
    const [done, total] = await Promise.all([
      this.prisma.work.groupBy({
        by: ['collectionId'],
        where: { collectionId: { in: collectionIds }, status: 'PUBLISHED', readingState: { some: { userId, status: 'DONE' } } },
        _count: { _all: true },
      }),
      this.prisma.work.groupBy({
        by: ['collectionId'],
        where: { collectionId: { in: collectionIds }, status: 'PUBLISHED' },
        _count: { _all: true },
      }),
    ]);
    const doneBy = new Map(done.map((d) => [d.collectionId, d._count._all]));
    return Object.fromEntries(total.map((t) => [t.collectionId!, { done: doneBy.get(t.collectionId) ?? 0, total: t._count._all }]));
  }

  /**
   * The reader's shelf, one tab at a time:
   * reading — books in progress, then loose works in progress (not part of a shelved book);
   * want — books to read; done — read books, then read works; saved — saved books, works, authors.
   */
  async shelf(userId: string, tab: string, page = 1) {
    const take = 48;
    const skip = (Math.max(1, page) - 1) * take;

    if (tab === 'saved') {
      const [rows, total] = await Promise.all([
        this.prisma.favorite.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          select: {
            createdAt: true,
            work: { select: workSelect },
            collection: { select: bookSelect },
            author: { select: { id: true, slug: true, nameAz: true, nameRu: true, nameEn: true, bornYear: true, diedYear: true, period: true } },
          },
        }),
        this.prisma.favorite.count({ where: { userId } }),
      ]);
      return {
        total,
        items: rows.map((r) =>
          r.collection ? { type: 'book' as const, book: book(r.collection) }
          : r.work ? { type: 'work' as const, work: r.work }
          : { type: 'author' as const, author: r.author },
        ),
      };
    }

    const statuses: Record<string, BookStatus> = { reading: 'READING', want: 'WANT', done: 'DONE' };
    const status = statuses[tab];
    if (!status) throw new BadRequestException('Unknown tab');

    const books = await this.prisma.bookState.findMany({
      where: { userId, status, collection: { status: 'PUBLISHED' } },
      orderBy: { updatedAt: 'desc' },
      select: { status: true, lastWorkId: true, updatedAt: true, collection: { select: bookSelect } },
    });
    const progress = await this.bookProgress(userId, books.map((b) => b.collection.id));
    const bookItems = books.map((b) => ({
      type: 'book' as const,
      status: b.status,
      lastWorkId: b.lastWorkId,
      book: book(b.collection),
      progress: progress[b.collection.id] ?? null,
    }));

    if (tab === 'want') return { total: bookItems.length, items: bookItems.slice(skip, skip + take) };

    // Works on their own: read or in progress, and not inside a book already on this tab
    const shelvedIds = books.map((b) => b.collection.id);
    const works = await this.prisma.readingState.findMany({
      where: {
        userId,
        status: tab === 'reading' ? 'READING' : 'DONE',
        work: { status: 'PUBLISHED', OR: [{ collectionId: null }, { collectionId: { notIn: shelvedIds } }] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: { progress: true, status: true, work: { select: workSelect } },
    });
    const items = [...bookItems, ...works.map((w) => ({ type: 'work' as const, status: w.status, progress: w.progress, work: w.work }))];
    return { total: items.length, items: items.slice(skip, skip + take) };
  }

  /** Counts for the shelf tabs */
  async counts(userId: string) {
    const [reading, want, done, saved, readingWorks, doneWorks] = await Promise.all([
      this.prisma.bookState.count({ where: { userId, status: 'READING' } }),
      this.prisma.bookState.count({ where: { userId, status: 'WANT' } }),
      this.prisma.bookState.count({ where: { userId, status: 'DONE' } }),
      this.prisma.favorite.count({ where: { userId } }),
      this.prisma.readingState.count({ where: { userId, status: 'READING' } }),
      this.prisma.readingState.count({ where: { userId, status: 'DONE' } }),
    ]);
    return { reading, want, done, saved, readingWorks, doneWorks };
  }
}
