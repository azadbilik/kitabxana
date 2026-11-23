import { Injectable, NotFoundException, OnApplicationShutdown } from '@nestjs/common';
import { Language, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { ScansService } from '../downloads/scans.service';
import { CreateWorkDto, UpdateWorkDto } from './dto/create-work.dto';
import { QueryWorksDto } from './dto/query-works.dto';
import { safeWorkBase, slugify, uniqueSlug } from '../common/utils/slug';
import { renderMarkdown } from '../common/utils/markdown';
import { inReadingBand } from './reading-time';
import { paginationArgs, paginatedResult } from '../common/utils/pagination';
import { RTL_LANGUAGES } from '@irs-az/shared';
import type { WorkPayload } from '../submissions/dto/public-submission.dto';

/**
 * Poems offered by the randomizer and the poem of the day: ones an AZ/RU/EN reader can
 * actually read, i.e. written in Latin-script Azerbaijani or with an Azerbaijani translation.
 */
/** What readers may see: a published work of a published author */
export const VISIBLE_WORK = { status: 'PUBLISHED', author: { status: 'PUBLISHED' } } as const satisfies Prisma.WorkWhereInput;

const READABLE_POEM: Prisma.WorkWhereInput = {
  ...VISIBLE_WORK,
  genre: 'POEM',
  OR: [
    { originalLang: 'AZ_LATIN' },
    { translations: { some: { language: 'AZ_LATIN', status: 'PUBLISHED' } } },
  ],
};

export type UiLang = 'az' | 'ru' | 'en';

/**
 * Works a reader of this UI language can read entirely in it: Azerbaijani as before; Russian
 * and English need both a title and a published text (original or translation) in it.
 */
export function readableIn(lang: UiLang): Prisma.WorkWhereInput {
  if (lang === 'az') return { OR: READABLE_POEM.OR };
  const language: Language = lang === 'ru' ? 'RU' : 'EN';
  return {
    [lang === 'ru' ? 'titleRu' : 'titleEn']: { not: null },
    OR: [{ originalLang: language }, { translations: { some: { language, status: 'PUBLISHED' } } }],
  };
}

const readablePoem = (lang: UiLang): Prisma.WorkWhereInput => ({ ...VISIBLE_WORK, genre: 'POEM', ...readableIn(lang) });

/** Calendar day in Baku, the portal's home time zone (YYYY-MM-DD) */
function bakuDate(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Baku' });
}

/** FNV-1a, so every API instance picks the same poem for the same day */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Opening lines of a poem. Some imports put a blank line after every verse, so blanks are skipped. */
function excerpt(body: string, max = 4) {
  return body
    .split('\n')
    .map((line) => line.replace(/^[#>*\s-]+/, '').trim())
    .filter(Boolean)
    .slice(0, max);
}

const UI_LANGUAGE: Record<string, Language> = { az: 'AZ_LATIN', ru: 'RU', en: 'EN' };

/** Fields needed to pick a work's opening lines in a reader's language */
const INCIPIT_SOURCE = (language: Language) =>
  ({
    body: true,
    originalLang: true,
    translations: {
      where: { language, status: 'PUBLISHED' as const },
      orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'asc' as const }],
      take: 1,
      select: { body: true, language: true },
    },
  }) satisfies Prisma.WorkSelect;

/** First two lines in the reader's language when a translation exists, else in the original */
function withIncipit<T extends { body: string; originalLang: Language; translations: { body: string; language: Language }[] }>(
  work: T,
) {
  const { body, translations, ...rest } = work;
  const tr = translations[0];
  return {
    ...rest,
    incipit: { lines: excerpt(tr?.body ?? body, 2), lang: tr?.language ?? work.originalLang },
  };
}

/** Orders computed in memory (sort=title, sort=popular) are kept this long per filter */
const ORDER_TTL_MS = 5 * 60_000;
const ORDER_CACHE_MAX = 40;

/** The randomizer's pool of slugs is re-read this often */
const RANDOM_TTL_MS = 5 * 60_000;
/** Views are counted in memory and written together this often */
const VIEW_FLUSH_MS = 5 * 60_000;

@Injectable()
export class WorksService implements OnApplicationShutdown {
  constructor(
    private prisma: PrismaService,
    private search: SearchService,
    private scans: ScansService,
  ) {
    this.viewTimer = setInterval(() => void this.flushViews(), VIEW_FLUSH_MS);
    this.viewTimer.unref();
  }

  private randomPool = new Map<UiLang, { slugs: string[]; expires: number }>();
  private views = new Map<string, number>();
  private viewTimer: NodeJS.Timeout;

  async onApplicationShutdown() {
    clearInterval(this.viewTimer);
    await this.flushViews();
  }

  /**
   * viewCount feeds sort=popular. One UPDATE per page view was a write on the hottest read
   * path (and bumped updatedAt, so every read looked like an edit to the sitemap); views
   * are tallied here and written in one statement that leaves updatedAt alone.
   */
  async flushViews() {
    if (!this.views.size) return;
    const batch = [...this.views.entries()];
    this.views.clear();
    try {
      await this.prisma.$executeRaw`
        UPDATE "Work" AS w SET "viewCount" = w."viewCount" + v.n
        FROM (VALUES ${Prisma.join(batch.map(([id, n]) => Prisma.sql`(${id}, ${n}::int)`))}) AS v(id, n)
        WHERE w.id = v.id`;
    } catch (err) {
      console.warn(`View counts not saved: ${(err as Error).message}`);
    }
  }

  private orders = new Map<string, { ids: string[]; expires: number }>();

  /**
   * Every matching work's id in an order the database cannot produce itself:
   * - title: by the Azerbaijani alphabet (or the Russian/English one for titles in `titleLang`),
   *   leading quotes and dashes ignored, "Qəzəl 9" before "Qəzəl 10";
   * - popular: authors ranked by how much they are read (then by how much they wrote) take
   *   turns, each giving its most-read work not yet listed, in book order where reads tie —
   *   so the first page is thirty authors' best-read works, not thirty works of one author.
   */
  private async orderedIds(where: Prisma.WorkWhereInput, sort: 'title' | 'popular', titleLang: UiLang = 'az') {
    const key = `${sort}|${titleLang}|${JSON.stringify(where)}`;
    const hit = this.orders.get(key);
    if (hit && hit.expires > Date.now()) return hit.ids;

    let ids: string[];
    if (sort === 'title') {
      const field = ({ az: 'titleAz', ru: 'titleRu', en: 'titleEn' } as const)[titleLang];
      const rows = await this.prisma.work.findMany({ where, select: { id: true, titleAz: true, titleRu: true, titleEn: true } });
      const collator = new Intl.Collator(titleLang, { sensitivity: 'base', ignorePunctuation: true, numeric: true });
      ids = rows
        .map((r) => ({ id: r.id, title: r[field] || r.titleAz }))
        .sort((a, b) => collator.compare(a.title, b.title) || (a.id < b.id ? -1 : 1))
        .map((r) => r.id);
    } else {
      const [rows, collections] = await Promise.all([
        this.prisma.work.findMany({
          where,
          select: { id: true, authorId: true, viewCount: true, collectionId: true, order: true },
        }),
        this.prisma.collection.findMany({ select: { id: true, order: true } }),
      ]);
      const bookOrder = new Map(collections.map((c) => [c.id, c.order ?? 0]));
      const byAuthor = new Map<string, typeof rows>();
      for (const r of rows) {
        const list = byAuthor.get(r.authorId);
        if (list) list.push(r);
        else byAuthor.set(r.authorId, [r]);
      }
      const place = (r: (typeof rows)[number]) => (r.collectionId ? bookOrder.get(r.collectionId) ?? 0 : Number.MAX_SAFE_INTEGER);
      const authors = [...byAuthor.entries()]
        .map(([authorId, works]) => ({
          authorId,
          views: works.reduce((sum, w) => sum + w.viewCount, 0),
          works: works.sort(
            (a, b) =>
              b.viewCount - a.viewCount || place(a) - place(b) || (a.order ?? 0) - (b.order ?? 0) || (a.id < b.id ? -1 : 1),
          ),
        }))
        .sort((a, b) => b.views - a.views || b.works.length - a.works.length || (a.authorId < b.authorId ? -1 : 1));
      ids = [];
      for (let round = 0; ids.length < rows.length; round++) {
        for (const a of authors) if (a.works[round]) ids.push(a.works[round].id);
      }
    }

    if (this.orders.size >= ORDER_CACHE_MAX) this.orders.delete(this.orders.keys().next().value!);
    this.orders.set(key, { ids, expires: Date.now() + ORDER_TTL_MS });
    return ids;
  }

  private daily = new Map<UiLang, Awaited<ReturnType<WorksService['loadDaily']>>>();

  async findAll(query: QueryWorksDto) {
    const { skip, take, page, limit } = paginationArgs(query);

    const where: Prisma.WorkWhereInput = {
      ...(query.all !== 'true' && VISIBLE_WORK),
      ...(query.genre && { genre: query.genre }),
      ...(query.form && { form: query.form }),
      ...(query.lang && { originalLang: query.lang }),
      ...(query.yearFrom && { year: { gte: query.yearFrom } }),
      ...(query.yearTo && { year: { ...((query.yearFrom && { gte: query.yearFrom }) || {}), lte: query.yearTo } }),
      ...(query.authorSlug && {
        author: { slug: query.authorSlug, ...(query.all !== 'true' && { status: 'PUBLISHED' as const }) },
      }),
      ...(query.tag && { tags: { some: { tag: { slug: query.tag }, source: { not: 'REJECTED' } } } }),
      // Each brings its own OR, so they go side by side under AND
      ...((query.readableIn || query.time) && {
        AND: [...(query.readableIn ? [readableIn(query.readableIn)] : []), ...(query.time ? [inReadingBand(query.time)] : [])],
      }),
      ...(query.q && {
        OR: (['titleAz', 'titleRu', 'titleEn'] as const).map((field) => ({
          [field]: { contains: query.q, mode: 'insensitive' as const },
        })),
      }),
    };

    const incipitLanguage = query.incipit ? UI_LANGUAGE[query.incipit] : undefined;
    const select = {
      ...(incipitLanguage && INCIPIT_SOURCE(incipitLanguage)),
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
      status: true,
      wordCount: true,
      author: {
        select: { slug: true, nameAz: true, nameRu: true, nameEn: true },
      },
      collection: {
        select: { slug: true, titleAz: true, titleRu: true, titleEn: true },
      },
    } satisfies Prisma.WorkSelect;
    const withIncipits = (data: object[]): object[] =>
      incipitLanguage ? data.map((w) => withIncipit(w as Parameters<typeof withIncipit>[0])) : data;

    if (query.sort === 'title' || query.sort === 'popular') {
      const ids = await this.orderedIds(where, query.sort, query.titleLang);
      const pageIds = ids.slice(skip, skip + take);
      const found = await this.prisma.work.findMany({ where: { id: { in: pageIds } }, select });
      const byId = new Map(found.map((w) => [w.id, w]));
      const data = pageIds.map((id) => byId.get(id)).filter((w): w is (typeof found)[number] => !!w);
      return paginatedResult(withIncipits(data), ids.length, page, limit);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.work.findMany({
        where,
        skip,
        take,
        // id last: years repeat (and are often missing), and pages must not share works
        orderBy:
          query.sort === 'recent'
            ? [{ createdAt: 'desc' }, { id: 'asc' }]
            : [{ year: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
        select,
      }),
      this.prisma.work.count({ where }),
    ]);

    return paginatedResult(withIncipits(data), total, page, limit);
  }

  async findById(id: string) {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: {
        author: { select: { slug: true, nameAz: true } },
        collection: { select: { slug: true, titleAz: true } },
        tags: { select: { source: true, tag: { select: { slug: true } } } },
      },
    });
    if (!work) throw new NotFoundException('Work not found');
    return work;
  }

  /**
   * Editor changes to a work's tags. Adding marks the tag EDITOR (kept by the rules);
   * removing marks it REJECTED, so re-running the keyword rules won't bring it back.
   */
  async setTags(id: string, { add = [], remove = [] }: { add?: string[]; remove?: string[] }) {
    const work = await this.prisma.work.findUnique({ where: { id }, select: { id: true } });
    if (!work) throw new NotFoundException('Work not found');

    const slugs = [...new Set([...add, ...remove])];
    const tags = await this.prisma.tag.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
    const idOf = new Map(tags.map((t) => [t.slug, t.id]));
    const unknown = slugs.filter((s) => !idOf.has(s));
    if (unknown.length) throw new NotFoundException(`Unknown tags: ${unknown.join(', ')}`);

    const upsert = (slug: string, source: 'EDITOR' | 'REJECTED') =>
      this.prisma.workTag.upsert({
        where: { workId_tagId: { workId: id, tagId: idOf.get(slug)! } },
        create: { workId: id, tagId: idOf.get(slug)!, source },
        update: { source },
      });
    await this.prisma.$transaction([
      ...add.map((slug) => upsert(slug, 'EDITOR')),
      ...remove.filter((slug) => !add.includes(slug)).map((slug) => upsert(slug, 'REJECTED')),
    ]);

    return this.prisma.workTag.findMany({
      where: { workId: id },
      select: { source: true, tag: { select: { slug: true } } },
    });
  }

  /** Current slug for a work's current or previous slug, so old URLs can redirect. */
  /** Published works and books among these slugs: id, titles and author, nothing heavy */
  async brief(workSlugs: string[], bookSlugs: string[]) {
    const author = { select: { slug: true, nameAz: true, nameRu: true, nameEn: true } };
    const titles = { titleAz: true, titleRu: true, titleEn: true } as const;
    const [works, books] = await Promise.all([
      workSlugs.length
        ? this.prisma.work.findMany({
            where: { ...VISIBLE_WORK, slug: { in: workSlugs } },
            select: { id: true, slug: true, ...titles, author },
          })
        : [],
      bookSlugs.length
        ? this.prisma.collection.findMany({
            where: { status: 'PUBLISHED', author: { status: 'PUBLISHED' }, slug: { in: bookSlugs } },
            select: { id: true, slug: true, ...titles, author },
          })
        : [],
    ]);
    return { works, books };
  }

  async resolveSlug(slug: string) {
    const work = await this.prisma.work.findFirst({
      where: { ...VISIBLE_WORK, OR: [{ slug }, { previousSlugs: { has: slug } }] },
      select: { slug: true },
    });
    if (!work) throw new NotFoundException('Work not found');
    return work;
  }

  async findBySlug(slug: string) {
    const work = await this.prisma.work.findUnique({
      where: { slug, ...VISIBLE_WORK },
      include: {
        author: {
          select: {
            slug: true,
            nameAz: true,
            nameRu: true,
            nameEn: true,
            portraitUrl: true,
            wikidataId: true,
            // Decide whether downloads are offered (isPublicDomain)
            bornYear: true,
            diedYear: true,
            period: true,
          },
        },
        collection: {
          // id: the reader's marks on the book follow the reading of this work
          select: { id: true, slug: true, titleAz: true, titleRu: true },
        },
        translations: {
          where: { status: 'PUBLISHED' },
          orderBy: [{ isDefault: 'desc' }, { language: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            language: true,
            type: true,
            body: true,
            bodyHtml: true,
            translator: true,
            translatorNote: true,
            year: true,
            sourceNote: true,
            isDefault: true,
            scriptDirection: true,
          },
        },
        tags: {
          where: { source: { not: 'REJECTED' } },
          orderBy: [{ tag: { kind: 'asc' } }, { tag: { order: 'asc' } }],
          select: { tag: { select: { slug: true, kind: true, nameAz: true, nameRu: true, nameEn: true } } },
        },
      },
    });

    if (!work) throw new NotFoundException('Work not found');

    this.views.set(work.id, (this.views.get(work.id) ?? 0) + 1);

    // The scanned book the text was transcribed from, opened at the work's page
    return { ...work, scan: await this.scans.forWork(work) };
  }

  /** The prev/next navigation — most performance-critical query */
  async getNav(slug: string) {
    const work = await this.prisma.work.findFirst({
      where: { slug, ...VISIBLE_WORK },
      select: { id: true, collectionId: true, order: true },
    });

    if (!work?.collectionId || work.order == null) {
      return { prev: null, next: null };
    }

    const [prev, next] = await this.prisma.$transaction([
      this.prisma.work.findFirst({
        where: {
          collectionId: work.collectionId,
          order: { lt: work.order },
          status: 'PUBLISHED',
        },
        orderBy: { order: 'desc' },
        select: { slug: true, titleAz: true, titleRu: true, titleEn: true },
      }),
      this.prisma.work.findFirst({
        where: {
          collectionId: work.collectionId,
          order: { gt: work.order },
          status: 'PUBLISHED',
        },
        orderBy: { order: 'asc' },
        select: { slug: true, titleAz: true, titleRu: true, titleEn: true },
      }),
    ]);

    return { prev, next };
  }

  /** Slug of a random readable poem */
  async random(lang: UiLang = 'az') {
    let pool = this.randomPool.get(lang);
    if (!pool || pool.expires < Date.now()) {
      const rows = await this.prisma.work.findMany({ where: readablePoem(lang), select: { slug: true } });
      pool = { slugs: rows.map((r) => r.slug), expires: Date.now() + RANDOM_TTL_MS };
      this.randomPool.set(lang, pool);
    }
    if (!pool.slugs.length) throw new NotFoundException('No poems yet');
    return { slug: pool.slugs[Math.floor(Math.random() * pool.slugs.length)] };
  }

  /**
   * A handful of other works by the same author, with their opening lines.
   * The pick is stable per work (so the page caches well) but differs between works.
   */
  async moreByAuthor(slug: string, locale = 'az', take = 4) {
    const work = await this.prisma.work.findFirst({
      where: { slug, ...VISIBLE_WORK },
      select: { id: true, authorId: true },
    });
    if (!work) throw new NotFoundException('Work not found');

    const where: Prisma.WorkWhereInput = { authorId: work.authorId, status: 'PUBLISHED', id: { not: work.id } };
    const count = await this.prisma.work.count({ where });
    const works = await this.prisma.work.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: count > take ? hash(slug) % (count - take + 1) : 0,
      take,
      select: {
        slug: true,
        titleAz: true,
        titleRu: true,
        titleEn: true,
        genre: true,
        form: true,
        year: true,
        wordCount: true,
        ...INCIPIT_SOURCE(UI_LANGUAGE[locale] ?? 'AZ_LATIN'),
      },
    });
    return works.map(withIncipit);
  }

  /**
   * Poems by other poets, one per poet, preferring ones that share a theme with this work.
   * Stable per work (the slug seeds the order of poets and poems), so pages cache well.
   */
  async byOtherPoets(slug: string, locale = 'az', take = 4) {
    const work = await this.prisma.work.findFirst({
      where: { slug, ...VISIBLE_WORK },
      select: {
        id: true,
        authorId: true,
        tags: {
          where: { source: { not: 'REJECTED' }, tag: { kind: 'THEME' } },
          orderBy: { tag: { order: 'asc' } },
          select: { tag: { select: { id: true, slug: true, kind: true, nameAz: true, nameRu: true, nameEn: true } } },
        },
      },
    });
    if (!work) throw new NotFoundException('Work not found');

    /**
     * Up to `take` other poets in an order fixed by this work's slug, and one poem of each,
     * chosen the same way. Done in the database: poets first (an index probe each), then one
     * ordered pick per poet, instead of loading every other poet's poems to choose here.
     */
    const pickPerPoet = (tagId?: string) => {
      const tagged = tagId
        ? Prisma.sql`AND EXISTS (SELECT 1 FROM "WorkTag" wt WHERE wt."workId" = w.id AND wt."tagId" = ${tagId} AND wt.source <> 'REJECTED')`
        : Prisma.empty;
      return this.prisma.$queryRaw<{ authorId: string; id: string }[]>`
        WITH poets AS (
          SELECT a.id, md5(${slug} || a.id) AS place
          FROM "Author" a
          WHERE a.status = 'PUBLISHED' AND a.id <> ${work.authorId}
            AND EXISTS (
              SELECT 1 FROM "Work" w
              WHERE w."authorId" = a.id AND w.status = 'PUBLISHED' AND w.genre = 'POEM' ${tagged}
            )
          ORDER BY place, a.id
          LIMIT ${take}
        )
        SELECT p.id AS "authorId", pick.id
        FROM poets p
        CROSS JOIN LATERAL (
          SELECT w.id FROM "Work" w
          WHERE w."authorId" = p.id AND w.status = 'PUBLISHED' AND w.genre = 'POEM' ${tagged}
          ORDER BY md5(${slug} || w.id), w.id
          LIMIT 1
        ) pick
        ORDER BY p.place, p.id`;
    };

    // The work's first theme that other poets also wrote on
    let theme: (typeof work.tags)[number]['tag'] | null = null;
    let picks: { authorId: string; id: string }[] = [];
    for (const { tag } of work.tags) {
      picks = await pickPerPoet(tag.id);
      if (picks.length >= 2) {
        theme = tag;
        break;
      }
    }
    if (!theme) picks = await pickPerPoet();

    const ids = picks.slice(0, take).map((p) => p.id);
    const works = await this.prisma.work.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        slug: true,
        titleAz: true,
        titleRu: true,
        titleEn: true,
        genre: true,
        form: true,
        year: true,
        wordCount: true,
        author: { select: { slug: true, nameAz: true, nameRu: true, nameEn: true } },
        ...INCIPIT_SOURCE(UI_LANGUAGE[locale] ?? 'AZ_LATIN'),
      },
    });
    const order = new Map(ids.map((id, i) => [id, i]));
    const { id: _themeId, ...themeRef } = theme ?? { id: '' };
    return {
      theme: theme ? themeRef : null,
      works: works
        .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
        .map(({ id: _id, ...w }) => withIncipit(w)),
    };
  }

  /** Published counts for the homepage catalog: works by form and genre, authors by type */
  async catalog() {
    const pub = { status: 'PUBLISHED' as const };
    const [works, forms, genres, authors] = await Promise.all([
      this.prisma.work.count({ where: pub }),
      this.prisma.work.groupBy({ by: ['form'], where: pub, _count: { _all: true } }),
      this.prisma.work.groupBy({ by: ['genre'], where: pub, _count: { _all: true } }),
      // Only authors with published works: empty duplicate records don't count
      this.prisma.author.findMany({
        where: { ...pub, works: { some: pub } },
        select: { type: true },
      }),
    ]);
    const tally = <K extends string>(rows: { key: K | null; n: number }[]) =>
      Object.fromEntries(rows.filter((r) => r.key).map((r) => [r.key, r.n])) as Record<K, number>;
    return {
      works,
      forms: tally(forms.map((r) => ({ key: r.form, n: r._count._all }))),
      genres: tally(genres.map((r) => ({ key: r.genre, n: r._count._all }))),
      authors: authors.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.type]: (acc[a.type] ?? 0) + 1 }), {}),
    };
  }

  /**
   * Poem of the day: the same for everyone until midnight in Baku. Each UI language gets one
   * it can read in full (title and text in that language), with its opening lines from that text.
   */
  async poemOfTheDay(lang: UiLang = 'az') {
    return (await this.dailyPoem(lang)).work;
  }

  /** The poem of the day with a longer opening, for posting elsewhere (Telegram) */
  async dailyPoemOpening(lang: UiLang = 'az', lines = 8) {
    const { work, text } = await this.dailyPoem(lang);
    return { ...work, excerpt: excerpt(text, lines) };
  }

  private async dailyPoem(lang: UiLang) {
    const date = bakuDate();
    const cached = this.daily.get(lang);
    if (cached?.date === date) return cached;
    const daily = await this.loadDaily(lang, date);
    this.daily.set(lang, daily);
    return daily;
  }

  private async loadDaily(lang: UiLang, date: string) {
    const where = readablePoem(lang);
    const count = await this.prisma.work.count({ where });
    if (!count) throw new NotFoundException('No poems yet');
    const language = UI_LANGUAGE[lang];
    const work = await this.prisma.work.findFirstOrThrow({
      where,
      orderBy: { id: 'asc' },
      skip: hash(date) % count,
      select: {
        slug: true,
        titleAz: true,
        titleRu: true,
        titleEn: true,
        body: true,
        originalLang: true,
        form: true,
        year: true,
        author: { select: { slug: true, nameAz: true, nameRu: true, nameEn: true } },
        translations: {
          where: { language, status: 'PUBLISHED' },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          take: 1,
          select: { body: true },
        },
      },
    });

    const { body, translations, ...rest } = work;
    const text = rest.originalLang === language ? body : translations[0]?.body ?? body;
    return { date, work: { ...rest, date, lang, excerpt: excerpt(text) }, text };
  }

  /** Readable, unused slug from the title; titles in other scripts fall back to the author's slug */
  private async newSlug(titles: (string | null | undefined)[], authorId: string) {
    const author = await this.prisma.author.findUniqueOrThrow({
      where: { id: authorId },
      select: { slug: true },
    });
    const base = safeWorkBase(titles.map((t) => slugify(t ?? '')).find(Boolean) ?? `${author.slug}-eser`, author.slug);
    return uniqueSlug(
      base,
      async (slug) =>
        (await this.prisma.work.count({
          where: { OR: [{ slug }, { previousSlugs: { has: slug } }] },
        })) > 0,
      author.slug,
    );
  }

  async create(dto: CreateWorkDto) {
    const slug = await this.newSlug([dto.titleAz, dto.titleRu, dto.titleEn], dto.authorId);
    const work = await this.prisma.work.create({
      data: { ...workFields(dto), slug, bodyHtml: renderMarkdown(dto.body) } as Prisma.WorkUncheckedCreateInput,
    });
    await this.search.reindexQuietly(work.id);
    return work;
  }

  async update(id: string, dto: UpdateWorkDto) {
    const data: Prisma.WorkUncheckedUpdateInput = workFields(dto);
    if (dto.body) data.bodyHtml = renderMarkdown(dto.body);
    const work = await this.prisma.work.update({ where: { id }, data });
    await this.search.reindexQuietly(id);
    return work;
  }

  async reorder(id: string, order: number) {
    return this.prisma.work.update({
      where: { id },
      data: { order },
    });
  }

  /** A work from an approved submission; `payload` has passed WorkPayload validation */
  async createFromPayload(
    payload: WorkPayload,
    { publish = true, sourceNote }: { publish?: boolean; sourceNote?: string | null } = {},
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const slug = await this.newSlug([payload.titleAz, payload.titleRu, payload.titleEn], payload.authorId);
    return db.work.create({
      data: {
        authorId: payload.authorId,
        titleAz: payload.titleAz,
        titleRu: payload.titleRu,
        titleEn: payload.titleEn,
        originalLang: payload.originalLang,
        scriptDirection: RTL_LANGUAGES.includes(payload.originalLang) ? 'RTL' : 'LTR',
        genre: payload.genre,
        form: payload.form,
        year: payload.year,
        body: payload.body,
        bodyHtml: renderMarkdown(payload.body),
        sourceNote,
        slug,
        status: publish ? 'PUBLISHED' : 'DRAFT',
      },
    });
  }
}

const WORK_FIELDS = [
  'titleAz', 'titleRu', 'titleFa', 'titleEn', 'body', 'originalLang', 'scriptDirection', 'genre', 'form',
  'year', 'yearApprox', 'order', 'authorId', 'collectionId', 'sourceNote', 'status',
] as const satisfies readonly (keyof CreateWorkDto)[];

/** Only the columns an editor may set, whatever else the object carries */
function workFields(dto: Partial<CreateWorkDto>) {
  return Object.fromEntries(WORK_FIELDS.filter((k) => dto[k] !== undefined).map((k) => [k, dto[k]]));
}
