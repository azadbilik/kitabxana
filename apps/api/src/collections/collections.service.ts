import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { QueryCollectionsDto } from './dto/query-collections.dto';
import { paginatedResult, paginationArgs } from '../common/utils/pagination';
import { slugify } from '../common/utils/slug';
import { publishedArtworks } from '../common/utils/artwork';
import { ScansService } from '../downloads/scans.service';

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
      ...(Object.keys(author).length && { author }),
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

  async findBySlug(slug: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { slug, status: 'PUBLISHED' },
      include: {
        author: {
          select: { slug: true, nameAz: true, nameRu: true, nameEn: true, bornYear: true, diedYear: true, period: true, wikidataId: true },
        },
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
    return { ...collection, works: collection.works.map(({ sourceId: _, ...w }) => w), scans };
  }

  async create(dto: CreateCollectionDto) {
    const slug = slugify(dto.titleAz);
    return this.prisma.collection.create({
      data: { ...dto, slug },
    });
  }

  async update(id: string, dto: Partial<CreateCollectionDto>) {
    return this.prisma.collection.update({
      where: { id },
      data: dto,
    });
  }
}
