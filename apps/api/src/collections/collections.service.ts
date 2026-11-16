import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { slugify } from '../common/utils/slug';
import { publishedArtworks } from '../common/utils/artwork';
import { ScansService } from '../downloads/scans.service';

@Injectable()
export class CollectionsService {
  constructor(
    private prisma: PrismaService,
    private scans: ScansService,
  ) {}

  async findBySlug(slug: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { slug, status: 'PUBLISHED' },
      include: {
        author: {
          select: { slug: true, nameAz: true, nameRu: true, bornYear: true, diedYear: true, period: true, wikidataId: true },
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
    const scans = this.scans.forWorks(collection.works);
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
