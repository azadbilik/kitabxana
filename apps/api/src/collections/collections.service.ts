import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Language, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionDto, UpdateCollectionDto } from './dto/create-collection.dto';
import { QueryCollectionsDto } from './dto/query-collections.dto';
import { paginatedResult, paginationArgs } from '../common/utils/pagination';
import { slugify, uniqueSlug } from '../common/utils/slug';
import { publishedArtworks } from '../common/utils/artwork';
import { ScansService } from '../downloads/scans.service';

/**
 * A book's opening, from its first work's markdown: up to four lines of verse, or the first
 * paragraph of prose cut at a sentence end near 320 characters. Headings, stage directions
 * in brackets and markdown marks are left out; null when nothing readable remains.
 */
export function openingLines(body: string, verse: boolean): { text: string; verse: boolean } | null {
  const clean = (s: string) =>
    s
      .replace(/^#+\s.*$/gm, '')
      .replace(/[*_`>]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .trim();
  const blocks = body.split(/\n{2,}/).map(clean).filter((b) => b && !/^\[.*\]$/s.test(b));
  if (!blocks.length) return null;
  if (verse) {
    const lines = blocks.join('\n').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4);
    return lines.length ? { text: lines.join('\n'), verse: true } : null;
  }
  const para = blocks[0].replace(/\s+/g, ' ');
  if (para.length <= 360) return { text: para, verse: false };
  const cut = para.slice(0, 360);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return { text: end > 120 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`, verse: false };
}

const INCIPIT_MAX_WORKS = 1000;

const UI_LANGUAGE = { az: 'AZ_LATIN', ru: 'RU', en: 'EN' } as const satisfies Record<string, Language>;

/** A work's first readable line from the start of its markdown; headings, bracketed stage directions and marks are skipped */
export function firstLine(head: string): string | null {
  for (const raw of head.split('\n')) {
    if (/^\s*#/.test(raw)) continue;
    const line = raw
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/^[>*\s-]+/, '')
      .replace(/[*_`]/g, '')
      .trim();
    if (!line || /^\[.*\]$/.test(line) || !/[\p{L}\p{N}]/u.test(line)) continue;
    return line.length > 140 ? `${line.slice(0, line.lastIndexOf(' ', 140) > 60 ? line.lastIndexOf(' ', 140) : 140)}…` : line;
  }
  return null;
}

@Injectable()
export class CollectionsService {
  constructor(
    private prisma: PrismaService,
    private scans: ScansService,
  ) {}

  /** Published collections that hold at least one published work: the site's "books" */
  async findAll(query: QueryCollectionsDto) {
    const { skip, take, page, limit } = paginationArgs(query);

    const born: Prisma.IntNullableFilter = {
      ...(query.century && { gte: (query.century - 1) * 100 + 1, lte: query.century * 100 }),
      ...(query.bornBefore && { lt: query.bornBefore }),
    };
    const author: Prisma.AuthorWhereInput = {
      ...(query.authorSlug && { slug: query.authorSlug }),
      ...(Object.keys(born).length && { bornYear: born }),
    };
    const where: Prisma.CollectionWhereInput = {
      status: 'PUBLISHED',
      works: { some: { status: 'PUBLISHED' } },
      ...(query.genre && { genre: query.genre }),
      author: { ...author, status: 'PUBLISHED' },
      ...(query.titledIn === 'ru' && { titleRu: { not: null } }),
      ...(query.titledIn === 'en' && { titleEn: { not: null } }),
    };

    const orderBy: Prisma.CollectionOrderByWithRelationInput[] =
      query.sort === 'title' ? [{ titleAz: 'asc' }]
      : query.sort === 'year' ? [{ year: { sort: 'asc', nulls: 'last' } }, { titleAz: 'asc' }]
      : query.sort === 'size' ? [{ works: { _count: 'desc' } }, { titleAz: 'asc' }]
      : [{ createdAt: 'desc' }, { order: 'asc' }];

    const [data, total] = await Promise.all([
      this.prisma.collection.findMany({
        where,
        orderBy,
        skip,
        take,
        ...(query.onePerAuthor && { distinct: ['authorId'] as Prisma.CollectionScalarFieldEnum[] }),
        select: {
          id: true,
          slug: true,
          titleAz: true,
          titleRu: true,
          titleEn: true,
          titleFa: true,
          genre: true,
          year: true,
          yearApprox: true,
          originalLang: true,
          createdAt: true,
          author: { select: { slug: true, nameAz: true, nameRu: true, nameEn: true } },
          _count: { select: { works: { where: { status: 'PUBLISHED' } } } },
        },
      }),
      query.onePerAuthor
        ? this.prisma.collection.groupBy({ by: ['authorId'], where }).then((g) => g.length)
        : this.prisma.collection.count({ where }),
    ]);

    return paginatedResult(
      data.map(({ _count, ...c }) => ({ ...c, workCount: _count.works })),
      total,
      page,
      limit,
    );
  }

  /** Every published artwork of a book, for the gallery's "show all" */
  async artworksOf(slug: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { slug, status: 'PUBLISHED', author: { status: 'PUBLISHED' } },
      select: { artworks: publishedArtworks },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection.artworks;
  }

  /**
   * `lang`: the reader's UI language. With it every work carries its first line (`incipit`), from
   * the default translation into that language where there is one, else from the original; and
   * the book's opening comes with `openingTranslated` when its first work is translated.
   */
  async findBySlug(slug: string, lang?: keyof typeof UI_LANGUAGE) {
    const collection = await this.prisma.collection.findUnique({
      where: { slug, status: 'PUBLISHED', author: { status: 'PUBLISHED' } },
      include: {
        author: {
          select: { slug: true, nameAz: true, nameRu: true, nameEn: true, bornYear: true, diedYear: true, period: true, wikidataId: true, portraitUrl: true },
        },
        works: {
          where: { status: 'PUBLISHED' },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            slug: true,
            titleAz: true,
            titleRu: true,
            titleEn: true,
            genre: true,
            form: true,
            year: true,
            originalLang: true,
            order: true,
            sourceId: true,
          },
        },
        artworks: publishedArtworks,
      },
    });

    if (!collection) throw new NotFoundException('Collection not found');
    // The scanned books the collection was transcribed from
    const scans = await this.scans.forWorks(collection.id, collection.works);
    // The book's first lines, shown on its page where it has no description
    const language = lang ? UI_LANGUAGE[lang] : undefined;
    const first = collection.works[0]
      ? await this.prisma.work.findUnique({
          where: { id: collection.works[0].id },
          select: {
            body: true,
            genre: true,
            originalLang: true,
            ...(language && {
              translations: {
                where: { language, status: 'PUBLISHED' as const },
                orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'asc' as const }],
                take: 1,
                select: { body: true, language: true },
              },
            }),
          },
        })
      : null;
    // Plays open on a cast list, which says little: they get no opening
    const readable = first && first.genre !== 'PLAY' ? first : null;
    const verse = readable?.genre === 'POEM';
    const original = readable ? openingLines(readable.body, verse) : null;
    const opening = original && { ...original, lang: readable!.originalLang };
    const translations = (readable as { translations?: { body: string; language: Language }[] } | null)?.translations;
    const translation = readable?.originalLang !== language ? translations?.[0] : undefined;
    const translated = translation ? openingLines(translation.body, verse) : null;
    const openingTranslated = translated && { ...translated, lang: translation!.language };

    // A few divans run to thousands of poems; their contents stay titles only
    const incipits =
      language && collection.works.length <= INCIPIT_MAX_WORKS ? await this.incipits(collection.id, language) : null;
    return {
      ...collection,
      works: collection.works.map(({ sourceId: _, ...w }) => (incipits ? { ...w, incipit: incipits.get(w.id) ?? null } : w)),
      scans,
      opening,
      openingTranslated,
    };
  }

  /**
   * First line of each work, in `language` where a published translation exists, else in the
   * original. Only the head of each text is read: a book can hold hundreds of long works.
   */
  private async incipits(collectionId: string, language: Language) {
    const out = new Map<string, { line: string; lang: Language }>();
    const HEAD = 600;
    const [originals, translations] = await Promise.all([
      this.prisma.$queryRaw<{ id: string; lang: Language; head: string }[]>`
        SELECT id, "originalLang" AS lang, left(body, ${HEAD}::int) AS head
        FROM "Work" WHERE "collectionId" = ${collectionId} AND status = 'PUBLISHED'`,
      this.prisma.$queryRaw<{ id: string; lang: Language; head: string }[]>`
        SELECT DISTINCT ON (t."workId") t."workId" AS id, t.language AS lang, left(t.body, ${HEAD}::int) AS head
        FROM "Translation" t JOIN "Work" w ON w.id = t."workId"
        WHERE w."collectionId" = ${collectionId} AND w.status = 'PUBLISHED'
          AND t.language = ${language}::"Language" AND t.status = 'PUBLISHED'
        ORDER BY t."workId", t."isDefault" DESC, t."createdAt" ASC`,
    ]);
    for (const row of [...originals, ...translations]) {
      const line = firstLine(row.head);
      // Translations come second and replace the original's line
      if (line) out.set(row.id, { line, lang: row.lang });
    }
    return out;
  }

  async create(dto: CreateCollectionDto) {
    const author = await this.prisma.author.findUnique({ where: { id: dto.authorId }, select: { slug: true } });
    if (!author) throw new BadRequestException('Unknown author');
    const slug = await uniqueSlug(
      slugify(dto.titleAz) || `${author.slug}-kitab`,
      async (candidate) => (await this.prisma.collection.count({ where: { slug: candidate } })) > 0,
      author.slug,
    );
    return this.prisma.collection.create({
      data: { ...collectionFields(dto), slug } as Prisma.CollectionUncheckedCreateInput,
    });
  }

  async update(id: string, dto: UpdateCollectionDto) {
    return this.prisma.collection.update({
      where: { id },
      data: collectionFields(dto),
    });
  }
}

const COLLECTION_FIELDS = [
  'titleAz', 'titleRu', 'titleFa', 'titleEn', 'authorId', 'year', 'yearApprox', 'originalLang', 'genre',
  'descriptionAz', 'descriptionRu', 'order',
] as const satisfies readonly (keyof CreateCollectionDto)[];

/** Only the columns an editor may set, whatever else the object carries */
function collectionFields(dto: Partial<CreateCollectionDto>) {
  return Object.fromEntries(COLLECTION_FIELDS.filter((k) => dto[k] !== undefined).map((k) => [k, dto[k]]));
}
