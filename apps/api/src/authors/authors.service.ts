import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { readableIn, type UiLang } from '../works/works.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuthorsDto } from './dto/query-authors.dto';
import { CreateAuthorDto, UpdateAuthorDto } from './dto/create-author.dto';
import { SearchService } from '../search/search.service';
import type { AuthorPayload } from '../submissions/dto/public-submission.dto';
import { safeAuthorBase, slugify, uniqueSlug } from '../common/utils/slug';
import { renderMarkdown } from '../common/utils/markdown';
import { publishedArtworks } from '../common/utils/artwork';
import {
  paginationArgs,
  paginatedResult,
} from '../common/utils/pagination';

/** Names in the order of the Azerbaijani alphabet (ICU's "az" collation) */
const AZ_COLLATOR = new Intl.Collator('az', { sensitivity: 'base' });

@Injectable()
export class AuthorsService {
  constructor(
    private prisma: PrismaService,
    private search: SearchService,
  ) {}

  /** Lean list of every published author for the literature tree; one query, no bios */
  async tree() {
    const authors = await this.prisma.author.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true, slug: true, nameAz: true, nameRu: true, nameEn: true,
        bornYear: true, bornYearApprox: true, diedYear: true, diedYearApprox: true,
        type: true, period: true, writingLangs: true,
        _count: { select: { works: { where: { status: 'PUBLISHED' } } } },
      },
    });
    return authors.map(({ _count, ...a }) => ({ ...a, works: _count.works }));
  }

  async findAll(query: QueryAuthorsDto) {
    const { skip, take, page, limit } = paginationArgs(query);

    const where: Prisma.AuthorWhereInput = {
      ...(query.all !== 'true' && { status: 'PUBLISHED' }),
      ...(query.type && { type: query.type }),
      ...(query.period && { period: query.period }),
      ...(query.lang && { writingLangs: { has: query.lang } }),
      ...(query.century && {
        bornYear: {
          gte: (query.century - 1) * 100 + 1,
          lte: query.century * 100,
        },
      }),
      ...(query.letter && {
        nameAz: { startsWith: query.letter, mode: 'insensitive' },
      }),
      ...(query.q?.trim() && {
        OR: (['nameAz', 'nameRu', 'nameEn'] as const).map((field) => ({
          [field]: { contains: query.q!.trim(), mode: 'insensitive' as const },
        })),
      }),
    };

    // "Recently added" means something to read: catalogue-only authors (no works yet) stay out of it.
    // readableIn narrows that to authors with a name and a work readable in the reader's language.
    const listWhere: Prisma.AuthorWhereInput = query.readableIn
      ? {
          ...where,
          ...(query.readableIn !== 'az' && { [query.readableIn === 'ru' ? 'nameRu' : 'nameEn']: { not: null } }),
          works: { some: { status: 'PUBLISHED', ...readableIn(query.readableIn) } },
        }
      : query.sort === 'recent' ? { ...where, works: { some: {} } } : where;

    const select = {
      id: true,
      slug: true,
      nameAz: true,
      nameRu: true,
      nameEn: true,
      bornYear: true,
      bornYearApprox: true,
      diedYear: true,
      diedYearApprox: true,
      type: true,
      period: true,
      portraitUrl: true,
      writingLangs: true,
      status: true,
      // Readers are shown what they can open; the admin list (all=true) counts drafts too
      _count: { select: { works: query.all === 'true' ? true : { where: { status: 'PUBLISHED' as const } } } },
    } satisfies Prisma.AuthorSelect;

    if (query.sort === 'recent') {
      const [data, total] = await this.prisma.$transaction([
        this.prisma.author.findMany({ where: listWhere, skip, take, orderBy: { createdAt: 'desc' }, select }),
        this.prisma.author.count({ where: listWhere }),
      ]);
      return paginatedResult(data, total, page, limit);
    }

    // By name in the Azerbaijani alphabet (… g ğ h x ı i … k q …): the database's collation
    // sorts by code point and puts "Ağa" after "Aslan", so order the names here, then page
    const all = await this.prisma.author.findMany({
      where: listWhere,
      select: { id: true, nameAz: true, _count: { select: { works: { where: { status: 'PUBLISHED' } } } } },
    });
    const names = query.minWorks ? all.filter((a) => a._count.works >= query.minWorks!) : all;
    names.sort(
      (a, b) =>
        (query.sort === 'works' ? b._count.works - a._count.works : 0) || AZ_COLLATOR.compare(a.nameAz, b.nameAz),
    );
    const ids = names.slice(skip, skip + take).map((a) => a.id);
    const rows = await this.prisma.author.findMany({ where: { id: { in: ids } }, select });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const data = ids.map((id) => byId.get(id)!).filter(Boolean);

    return paginatedResult(data, names.length, page, limit);
  }

  async findById(id: string) {
    const author = await this.prisma.author.findUnique({
      where: { id },
    });
    if (!author) throw new NotFoundException('Author not found');
    return author;
  }

  async findBySlug(slug: string) {
    const author = await this.prisma.author.findUnique({
      where: { slug, status: 'PUBLISHED' },
      include: {
        collections: {
          where: { status: 'PUBLISHED' },
          orderBy: { order: 'asc' },
          include: {
            works: {
              where: { status: 'PUBLISHED' },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                slug: true,
                titleAz: true,
                titleRu: true,
                genre: true,
                form: true,
                year: true,
                yearApprox: true,
                order: true,
              },
            },
          },
        },
        works: {
          where: { status: 'PUBLISHED', collectionId: null },
          orderBy: { year: 'asc' },
          select: {
            id: true,
            slug: true,
            titleAz: true,
            titleRu: true,
            genre: true,
            form: true,
            year: true,
            yearApprox: true,
          },
        },
        tags: { include: { tag: true } },
        artworks: publishedArtworks,
      },
    });

    if (!author) throw new NotFoundException('Author not found');

    return {
      ...author,
      bioAz: author.bioAz ? renderMarkdown(author.bioAz) : null,
      bioRu: author.bioRu ? renderMarkdown(author.bioRu) : null,
      bioEn: author.bioEn ? renderMarkdown(author.bioEn) : null,
    };
  }

  /** Name, dates and portrait: for pages that only mention the author (a filtered list's heading, a share card) */
  async findBrief(slug: string) {
    const author = await this.prisma.author.findUnique({
      where: { slug, status: 'PUBLISHED' },
      select: {
        slug: true,
        nameAz: true,
        nameRu: true,
        nameEn: true,
        bornYear: true,
        diedYear: true,
        type: true,
        period: true,
        portraitUrl: true,
      },
    });
    if (!author) throw new NotFoundException('Author not found');
    return author;
  }

  /**
   * The author page: the profile, the author's books with how many works each holds (their
   * contents live on the book pages), and the first works that belong to no book.
   */
  async findPage(slug: string, standaloneLimit = 30) {
    const published = { status: 'PUBLISHED' as const };
    const author = await this.prisma.author.findUnique({
      where: { slug, ...published },
      include: {
        collections: {
          where: { ...published, works: { some: published } },
          orderBy: { order: 'asc' },
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
            _count: { select: { works: { where: published } } },
          },
        },
        works: {
          where: { ...published, collectionId: null },
          orderBy: [{ viewCount: 'desc' }, { year: { sort: 'asc', nulls: 'last' } }, { titleAz: 'asc' }],
          take: standaloneLimit,
          select: {
            id: true,
            slug: true,
            titleAz: true,
            titleRu: true,
            titleEn: true,
            genre: true,
            form: true,
            year: true,
            yearApprox: true,
            originalLang: true,
          },
        },
        artworks: publishedArtworks,
        _count: { select: { works: { where: published } } },
      },
    });
    if (!author) throw new NotFoundException('Author not found');

    const standaloneCount =
      author.works.length < standaloneLimit
        ? author.works.length
        : await this.prisma.work.count({ where: { authorId: author.id, ...published, collectionId: null } });
    const { _count, collections, artworks, ...rest } = author;
    return {
      ...rest,
      // The page shows a few; the gallery asks for the rest (artworksOf)
      artworks: artworks.slice(0, 24),
      artworksCount: artworks.length,
      bioAz: author.bioAz ? renderMarkdown(author.bioAz) : null,
      bioRu: author.bioRu ? renderMarkdown(author.bioRu) : null,
      bioEn: author.bioEn ? renderMarkdown(author.bioEn) : null,
      collections: collections.map(({ _count: n, ...c }) => ({ ...c, workCount: n.works })),
      worksCount: _count.works,
      standaloneCount,
    };
  }

  /** Every published artwork of an author, for the gallery's "show all" */
  async artworksOf(slug: string) {
    const author = await this.prisma.author.findUnique({
      where: { slug, status: 'PUBLISHED' },
      select: { artworks: publishedArtworks },
    });
    if (!author) throw new NotFoundException('Author not found');
    return author.artworks;
  }

  /**
   * Poet of the week for a UI language. Azerbaijani: the editor's pick, else the author with
   * the most works. Russian and English show nothing in another language, so the pick must
   * have a bio in it; failing that, the author with the most works readable in it, sent
   * without a bio when there is none in that language.
   */
  async findFeatured(lang: UiLang = 'az') {
    const bioField = ({ az: 'bioAz', ru: 'bioRu', en: 'bioEn' } as const)[lang];
    const nameField = ({ az: 'nameAz', ru: 'nameRu', en: 'nameEn' } as const)[lang];
    const select = {
      id: true,
      slug: true,
      nameAz: true,
      nameRu: true,
      nameEn: true,
      bornYear: true,
      diedYear: true,
      type: true,
      period: true,
      portraitUrl: true,
      [bioField]: true,
      bioSources: true,
      _count: { select: { works: true } },
    } as const;
    const hasBio: Prisma.AuthorWhereInput =
      lang === 'az' ? {} : { [bioField]: { not: null }, NOT: { [bioField]: '' }, [nameField]: { not: null } };
    const readable: Prisma.AuthorWhereInput = { works: { some: { status: 'PUBLISHED', ...readableIn(lang) } } };

    const picks: Prisma.AuthorFindFirstArgs[] = [
      { where: { featuredAt: { not: null }, status: 'PUBLISHED', ...hasBio }, orderBy: { featuredAt: 'desc' } },
      { where: { status: 'PUBLISHED', ...hasBio, ...(lang !== 'az' && readable) }, orderBy: { works: { _count: 'desc' } } },
      { where: { status: 'PUBLISHED', ...hasBio }, orderBy: { works: { _count: 'desc' } } },
      ...(lang === 'az'
        ? []
        : [{ where: { status: 'PUBLISHED', [nameField]: { not: null }, ...readable }, orderBy: { works: { _count: 'desc' } } } as Prisma.AuthorFindFirstArgs]),
    ];
    for (const pick of picks) {
      const author = await this.prisma.author.findFirst({ ...pick, select });
      if (author) return author;
    }
    return null;
  }

  private newSlug(names: (string | null | undefined)[]) {
    const base = safeAuthorBase(names.map((n) => slugify(n ?? '')).find(Boolean) ?? 'muellif');
    return uniqueSlug(base, async (slug) => (await this.prisma.author.count({ where: { slug } })) > 0);
  }

  async create(dto: CreateAuthorDto) {
    const slug = await this.newSlug([dto.nameAz, dto.nameEn, dto.nameRu]);
    return this.prisma.author.create({
      data: { ...authorFields(dto), slug } as Prisma.AuthorUncheckedCreateInput,
    });
  }

  async update(id: string, dto: UpdateAuthorDto) {
    const author = await this.prisma.author.update({
      where: { id },
      data: authorFields(dto),
    });
    // Each work's search entry carries its author's name, and is there only while the author is published
    if (INDEXED_FIELDS.some((k) => dto[k] !== undefined)) await this.search.reindexAuthorQuietly(id);
    return author;
  }

  async setFeatured(id: string) {
    return this.prisma.author.update({
      where: { id },
      data: { featuredAt: new Date() },
    });
  }

  /** An author from an approved submission; `payload` has passed AuthorPayload validation */
  async createFromPayload(payload: AuthorPayload, { publish = true } = {}, db: Prisma.TransactionClient = this.prisma) {
    const slug = await this.newSlug([payload.nameAz, payload.nameEn, payload.nameRu]);
    return db.author.create({
      data: {
        nameAz: payload.nameAz,
        nameRu: payload.nameRu,
        nameEn: payload.nameEn,
        type: payload.type,
        bornYear: payload.bornYear,
        diedYear: payload.diedYear,
        bioAz: payload.bioAz,
        slug,
        status: publish ? 'PUBLISHED' : 'DRAFT',
      },
    });
  }
}

const AUTHOR_FIELDS = [
  'nameAz', 'nameRu', 'nameFa', 'nameEn', 'bornYear', 'bornYearApprox', 'diedYear', 'diedYearApprox', 'bornPlace', 'diedPlace',
  'type', 'period', 'writingLangs', 'bioAz', 'bioRu', 'bioEn', 'portraitUrl', 'status',
] as const satisfies readonly (keyof CreateAuthorDto)[];

const INDEXED_FIELDS = ['nameAz', 'nameRu', 'status'] as const;

/** Only the columns an editor may set, whatever else the object carries */
function authorFields(dto: Partial<CreateAuthorDto>) {
  return Object.fromEntries(AUTHOR_FIELDS.filter((k) => dto[k] !== undefined).map((k) => [k, dto[k]]));
}
