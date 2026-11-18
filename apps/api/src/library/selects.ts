import { Prisma } from '@prisma/client';

/** A book (collection) as the shelf and lists show it */
export const bookSelect = {
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

/** A work as the shelf and lists show it */
export const workSelect = {
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
export type Book = Omit<BookRow, '_count'> & { workCount: number };
export type WorkRow = Prisma.WorkGetPayload<{ select: typeof workSelect }>;

export const toBook = ({ _count, ...b }: BookRow): Book => ({ ...b, workCount: _count.works });
