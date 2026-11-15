import { Injectable } from '@nestjs/common';
import { workLocales } from '@irs-az/shared';
import { PrismaService } from '../prisma/prisma.service';

const select = { slug: true, updatedAt: true } as const;
const published = { status: 'PUBLISHED' } as const;

@Injectable()
export class SitemapService {
  constructor(private prisma: PrismaService) {}

  /** Slugs + last-modified dates of every published entity, for the web sitemap. */
  async entries() {
    const [authors, collections, works, blog] = await this.prisma.$transaction([
      this.prisma.author.findMany({ where: published, select }),
      this.prisma.collection.findMany({ where: published, select }),
      this.prisma.work.findMany({
        where: published,
        select: {
          ...select,
          originalLang: true,
          translations: { where: { ...published, language: { in: ['RU', 'EN'] } }, select: { language: true } },
        },
      }),
      this.prisma.blogPost.findMany({ where: published, select }),
    ]);
    return {
      authors,
      collections,
      // Each work lists the locales whose page has text in that language
      works: works.map(({ originalLang, translations, ...w }) => ({
        ...w,
        locales: workLocales(originalLang, translations.map((t) => t.language)),
      })),
      blog,
    };
  }
}
