import { Injectable } from '@nestjs/common';
import { workLocales } from '@irs-az/shared';
import { PrismaService } from '../prisma/prisma.service';

const select = { slug: true, updatedAt: true } as const;
const published = { status: 'PUBLISHED' } as const;
const byPublishedAuthor = { ...published, author: published } as const;
/** The full list is some 30,000 rows; crawlers and the hourly IndexNow job share one read */
const TTL_MS = 10 * 60_000;

@Injectable()
export class SitemapService {
  constructor(private prisma: PrismaService) {}

  private cached: { at: number; value: ReturnType<SitemapService['load']> } | null = null;

  /** Slugs + last-modified dates of every published entity, for the web sitemap. */
  entries() {
    if (!this.cached || Date.now() - this.cached.at > TTL_MS) {
      const value = this.load();
      this.cached = { at: Date.now(), value };
      // A failed read is not kept
      value.catch(() => {
        if (this.cached?.value === value) this.cached = null;
      });
    }
    return this.cached.value;
  }

  private async load() {
    const [authors, collections, works, blog] = await this.prisma.$transaction([
      this.prisma.author.findMany({
        where: published,
        select: { ...select, _count: { select: { works: { where: published } } } },
      }),
      this.prisma.collection.findMany({ where: byPublishedAuthor, select }),
      this.prisma.work.findMany({
        where: byPublishedAuthor,
        select: {
          ...select,
          originalLang: true,
          translations: { where: { ...published, language: { in: ['RU', 'EN'] } }, select: { language: true } },
        },
      }),
      this.prisma.blogPost.findMany({ where: published, select }),
    ]);
    return {
      // `works`: whether the author's filtered works page exists
      authors: authors.map(({ _count, ...a }) => ({ ...a, works: _count.works > 0 })),
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
