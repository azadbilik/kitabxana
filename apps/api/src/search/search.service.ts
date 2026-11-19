import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch } from 'meilisearch';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { foldAz, slugify } from '../common/utils/slug';
import { excerpt, highlight, matchStarts, opening, queryTerms } from './highlight';

const fold = (text: string | null | undefined) => (text ? foldAz(text) : text);

/** A filter value as a quoted Meilisearch string */
const quoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const INDEXED = {
  author: { select: { nameAz: true, nameRu: true, slug: true, status: true } },
  translations: {
    where: { status: 'PUBLISHED' },
    select: { language: true, body: true, isDefault: true },
  },
} satisfies Prisma.WorkInclude;

type IndexedWork = Prisma.WorkGetPayload<{ include: typeof INDEXED }>;

/** Only published works of published authors are searchable */
const searchable = (work: IndexedWork) => work.status === 'PUBLISHED' && work.author.status === 'PUBLISHED';

function document(work: IndexedWork) {
  // Texts go in whole, so a line deep inside a long one is found. Every published
  // translation in the language counts, the default first, so another translator's
  // wording is found too
  const translation = (language: string) =>
    work.translations
      .filter((t) => t.language === language)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
      .map((t) => t.body)
      .join('\n\n') || undefined;

  return {
    id: work.id,
    slug: work.slug,
    titleAz: work.titleAz,
    titleRu: work.titleRu,
    titleFa: work.titleFa,
    body: work.body,
    bodyPlain: fold(work.body),
    // Latin-script Azerbaijani, such as a transliteration of a Turkic poem in Arabic script
    bodyAz: translation('AZ_LATIN'),
    bodyAzPlain: fold(translation('AZ_LATIN')),
    bodyRu: translation('RU'),
    bodyEn: translation('EN'),
    titleEn: work.titleEn,
    titleAzPlain: fold(work.titleAz),
    authorNameAz: work.author.nameAz,
    authorNamePlain: fold(work.author.nameAz),
    authorNameRu: work.author.nameRu,
    authorSlug: work.author.slug,
    genre: work.genre,
    form: work.form,
    year: work.year,
    lang: work.originalLang,
    // For the "has a translation" filter
    translated: work.translations.length > 0,
  };
}

const FILTERABLE = ['authorSlug', 'genre', 'form', 'lang', 'year'];
// Filterable only once a full reindex has turned it on (see reindexAll): adding a filterable
// attribute makes Meilisearch reprocess every document, which must not happen on a mere restart
const TRANSLATED = 'translated';
const FACETS = ['authorSlug', 'genre', 'lang'] as const;
type Facet = (typeof FACETS)[number];
const FACET_AUTHORS = 12;
const GROUP_SIZE = 6;

const REINDEX_BATCH = 500;

export interface ReindexStatus {
  state: 'idle' | 'running' | 'done' | 'failed';
  indexed: number;
  total: number;
  removed: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly log = new Logger(SearchService.name);
  private client: MeiliSearch;
  private reindexing: Promise<void> | null = null;
  private status: ReindexStatus = { state: 'idle', indexed: 0, total: 0, removed: 0, startedAt: null, finishedAt: null, error: null };
  /** Whether the index can filter on `translated` yet */
  private translatedFilter = false;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.client = new MeiliSearch({
      host: this.config.get('MEILISEARCH_HOST', 'http://localhost:7700'),
      apiKey: this.config.get('MEILISEARCH_KEY', ''),
    });
  }

  async onModuleInit() {
    try {
      const index = this.client.index('works');
      this.translatedFilter = (await index.getFilterableAttributes()).includes(TRANSLATED);
      await index.updateSettings({
        // Meilisearch stops counting at 1,000 by default, which undercounts any big author
        // (Saib alone has 7,743 works); keep the count exact for the whole library
        pagination: { maxTotalHits: 100000 },
        // *Plain fields hold the same text without Azerbaijani letters (see foldAz), so
        // "qezel" finds "qəzəl". They are stripped from search responses.
        searchableAttributes: [
          'titleAz',
          'titleAzPlain',
          'titleRu',
          'titleEn',
          'titleFa',
          'authorNameAz',
          'authorNamePlain',
          'authorNameRu',
          'body',
          'bodyPlain',
          'bodyAz',
          'bodyAzPlain',
          'bodyRu',
          'bodyEn',
        ],
        filterableAttributes: [...FILTERABLE, ...(this.translatedFilter ? [TRANSLATED] : [])],
        sortableAttributes: ['year', 'titleAz'],
        displayedAttributes: [
          'id',
          'slug',
          'titleAz',
          'titleRu',
          'titleEn',
          'authorNameAz',
          'authorNameRu',
          'authorSlug',
          'genre',
          'form',
          'year',
          'lang',
          // For snippets and match positions (Meilisearch reports positions only for
          // returned attributes); stripped from search responses
          'body',
          'bodyAz',
          'bodyRu',
          'bodyEn',
          'titleAzPlain',
          'bodyPlain',
          'bodyAzPlain',
          'authorNamePlain',
        ],
      });
    } catch {
      console.warn('Meilisearch not available — search will be unavailable');
    }
  }

  async indexWork(workId: string) {
    const work = await this.prisma.work.findUnique({ where: { id: workId }, include: INDEXED });

    // Anything not searchable comes out of the index
    if (!work || !searchable(work)) {
      await this.client.index('works').deleteDocument(workId);
      return;
    }
    await this.client.index('works').addDocuments([document(work)]);
  }

  /** Search is secondary: an unreachable Meilisearch must not fail a save that already happened */
  async reindexQuietly(workId: string) {
    await this.indexWork(workId).catch((err) => {
      this.log.warn(`Reindex failed for work ${workId}: ${err.message}`);
    });
  }

  /** After an author's name, slug or status changes: every work's entry carries them */
  async reindexAuthorQuietly(authorId: string) {
    try {
      await this.indexWhere({ authorId });
    } catch (err) {
      this.log.warn(`Reindex failed for author ${authorId}: ${(err as Error).message}`);
    }
  }

  /** (Re)indexes matching works in batches, removing the ones that are not searchable */
  private async indexWhere(where: Prisma.WorkWhereInput, progress?: (n: number) => void) {
    const index = this.client.index('works');
    for (let cursor: string | undefined; ; ) {
      const works = await this.prisma.work.findMany({
        where,
        include: INDEXED,
        orderBy: { id: 'asc' },
        take: REINDEX_BATCH,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });
      if (!works.length) break;
      cursor = works[works.length - 1].id;
      const live = works.filter(searchable);
      const gone = works.filter((w) => !searchable(w)).map((w) => w.id);
      if (live.length) await index.addDocuments(live.map(document));
      if (gone.length) await index.deleteDocuments(gone);
      progress?.(works.length);
    }
  }

  async search(dto: SearchQueryDto) {
    const active = this.activeFilters(dto);
    const filters = Object.values(active);

    const limit = Math.min(Math.max(dto.limit ?? 20, 1), 100);
    const offset = ((dto.page ?? 1) - 1) * limit;

    try {
      const result = await this.client.index('works').search(dto.q, {
        filter: filters.length ? filters : undefined,
        limit,
        offset,
        showMatchesPosition: true,
        ...(dto.facets && { facets: [...FACETS, ...(this.translatedFilter ? [TRANSLATED] : [])] }),
      });

      // Highlights are built here rather than by Meilisearch, so that matches in the hidden
      // *Plain fields and typo matches show up on the original text (see highlight.ts)
      const terms = queryTerms(dto.q ?? '');
      const hits = result.hits.map(
        // The *Plain fields and full bodies are only fetched to build highlights
        ({
          body,
          bodyAz,
          bodyRu,
          bodyEn,
          titleAzPlain,
          bodyPlain,
          bodyAzPlain,
          authorNamePlain,
          _matchesPosition: mp = {},
          ...hit
        }) => {
          const title: string = hit.titleAz ?? '';
          const titleStarts = [...matchStarts(title, mp.titleAz), ...matchStarts(title, mp.titleAzPlain, true)];
          const bodyStarts = body ? [...matchStarts(body, mp.body), ...matchStarts(body, mp.bodyPlain, true)] : [];
          const bodyAzStarts = bodyAz
            ? [...matchStarts(bodyAz, mp.bodyAz), ...matchStarts(bodyAz, mp.bodyAzPlain, true)]
            : [];
          const author: string = hit.authorNameAz ?? '';
          const authorStarts = [
            ...matchStarts(author, mp.authorNameAz),
            ...matchStarts(author, mp.authorNamePlain, true),
          ];
          return {
            ...hit,
            _formatted: {
              titleAz: highlight(title, terms, titleStarts),
              authorNameAz: highlight(author, terms, authorStarts),
              // The text that shows most of the query, the original first on a tie
              body:
                [
                  body && excerpt(body, terms, bodyStarts),
                  bodyAz && excerpt(bodyAz, terms, bodyAzStarts),
                  bodyRu && excerpt(bodyRu, terms, matchStarts(bodyRu, mp.bodyRu)),
                  bodyEn && excerpt(bodyEn, terms, matchStarts(bodyEn, mp.bodyEn)),
                ].reduce<{ html: string; score: number } | null>(
                  (best, e) => (e && (!best || e.score > best.score) ? e : best),
                  null,
                )?.html ?? (body ? opening(body) : null),
            },
          };
        },
      );
      const { facetDistribution, facetStats, ...rest } = result;
      const slugOf = (hit: object) => (hit as { authorSlug?: string }).authorSlug ?? '';
      // The index has no English author names; the page shows them in English
      const english = await this.prisma.author.findMany({
        where: { slug: { in: [...new Set(hits.map(slugOf).filter(Boolean))] } },
        select: { slug: true, nameEn: true },
      });
      const nameEn = new Map(english.map((a) => [a.slug, a.nameEn]));
      // Word counts (for the reading time) come from the database, not the index: they stay
      // right without a reindex, and it is one indexed lookup for a page of hits
      const idOf = (hit: object) => (hit as { id?: string }).id ?? '';
      const counted = await this.prisma.work.findMany({
        where: { id: { in: hits.map(idOf).filter(Boolean) } },
        select: { id: true, wordCount: true },
      });
      const wordCount = new Map(counted.map((w) => [w.id, w.wordCount]));
      return {
        ...rest,
        hits: hits.map((h) => ({ ...h, authorNameEn: nameEn.get(slugOf(h)) ?? null, wordCount: wordCount.get(idOf(h)) ?? null })),
        ...(dto.facets && { facets: await this.facetCounts(dto, active, facetDistribution ?? {}, result.estimatedTotalHits ?? 0) }),
      };
    } catch (err) {
      // An empty 200 would say "nothing found" and be cached as such
      this.log.error(`Search failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Search is unavailable');
    }
  }

  /** The filters a query asks for, by the attribute each one narrows */
  private activeFilters(dto: SearchQueryDto): Record<string, string> {
    const active: Record<string, string> = {};
    if (dto.authorSlug) active.authorSlug = `authorSlug = ${quoted(dto.authorSlug)}`;
    if (dto.genre) active.genre = `genre = "${dto.genre}"`;
    if (dto.lang) active.lang = `lang = "${dto.lang}"`;
    if (dto.yearFrom) active.yearFrom = `year >= ${dto.yearFrom}`;
    if (dto.yearTo) active.yearTo = `year <= ${dto.yearTo}`;
    if (dto.translated && this.translatedFilter) active[TRANSLATED] = `${TRANSLATED} = true`;
    return active;
  }

  /**
   * Counts by author, genre and original language. A facet that is itself filtered on is
   * counted without its own filter, so the reader who chose one author still sees the others
   * to switch to. `translated` is null while the index can't filter on it (before a reindex).
   */
  private async facetCounts(
    dto: SearchQueryDto,
    active: Record<string, string>,
    own: Record<string, Record<string, number>>,
    total: number,
  ) {
    const index = this.client.index('works');
    const counts = async (facet: Facet) => {
      if (!active[facet]) return own[facet] ?? {};
      const others = Object.entries(active).filter(([key]) => key !== facet).map(([, filter]) => filter);
      const result = await index.search(dto.q, { filter: others.length ? others : undefined, limit: 0, facets: [facet] });
      return result.facetDistribution?.[facet] ?? {};
    };
    const [bySlug, genre, lang] = await Promise.all(FACETS.map(counts));

    // Meilisearch lists at most 100 values a facet, alphabetically; the busiest of those are shown
    const top = Object.entries(bySlug).sort((a, b) => b[1] - a[1]).slice(0, FACET_AUTHORS);
    if (dto.authorSlug && !top.some(([slug]) => slug === dto.authorSlug)) top.push([dto.authorSlug, bySlug[dto.authorSlug] ?? 0]);
    const names = await this.prisma.author.findMany({
      where: { slug: { in: top.map(([slug]) => slug) } },
      select: { slug: true, nameAz: true, nameRu: true, nameEn: true },
    });
    const byName = new Map(names.map((a) => [a.slug, a]));

    return {
      authors: top.map(([slug, count]) => ({ ...(byName.get(slug) ?? { slug, nameAz: slug, nameRu: null, nameEn: null }), count })),
      genre,
      lang,
      translated: !this.translatedFilter ? null : active[TRANSLATED] ? total : (own[TRANSLATED]?.true ?? 0),
    };
  }

  /**
   * Authors and books whose name or title holds the query, a few of each, the fullest first.
   * Straight from the database: names and titles are short, and typing without Azerbaijani
   * letters ("fuzuli") is matched through the slug.
   */
  async groups(q: string) {
    const text = q.trim();
    if (text.length < 2) return { authors: [], books: [] };
    const slug = slugify(text);
    const holds = <F extends string>(fields: readonly F[]) => [
      ...fields.map((field) => ({ [field]: { contains: text, mode: 'insensitive' as const } }) as Record<F, { contains: string; mode: 'insensitive' }>),
      ...(slug.length >= 3 ? [{ slug: { contains: slug } }] : []),
    ];
    const published = { some: { status: 'PUBLISHED' as const } };
    const [authors, books] = await Promise.all([
      this.prisma.author.findMany({
        where: { status: 'PUBLISHED', works: published, OR: holds(['nameAz', 'nameRu', 'nameEn', 'nameFa'] as const) },
        orderBy: [{ works: { _count: 'desc' } }, { slug: 'asc' }],
        take: GROUP_SIZE,
        select: { slug: true, nameAz: true, nameRu: true, nameEn: true, type: true, period: true },
      }),
      this.prisma.collection.findMany({
        where: {
          status: 'PUBLISHED',
          author: { status: 'PUBLISHED' },
          works: published,
          // By its own title or its author's name, so "Füzuli" lists his books as "fuzuli" does
          OR: [...holds(['titleAz', 'titleRu', 'titleEn', 'titleFa'] as const), { author: { OR: holds(['nameAz', 'nameRu', 'nameEn'] as const) } }],
        },
        orderBy: [{ works: { _count: 'desc' } }, { slug: 'asc' }],
        take: GROUP_SIZE,
        select: {
          id: true,
          slug: true,
          titleAz: true,
          titleRu: true,
          titleEn: true,
          titleFa: true,
          genre: true,
          author: { select: { slug: true, nameAz: true, nameRu: true, nameEn: true } },
        },
      }),
    ]);
    return { authors, books };
  }

  reindexStatus(): ReindexStatus {
    return this.status;
  }

  /** Starts a full reindex in the background (one at a time) and returns its status at once */
  startReindex(): ReindexStatus {
    if (!this.reindexing) {
      this.reindexing = this.reindexAll()
        .catch(() => {})
        .finally(() => {
          this.reindexing = null;
        });
    }
    return this.status;
  }

  /** The whole index rebuilt from the database, in batches. Resolves when Meilisearch has every batch. */
  async reindexAll() {
    const where: Prisma.WorkWhereInput = { status: 'PUBLISHED', author: { status: 'PUBLISHED' } };
    this.status = { state: 'running', indexed: 0, total: 0, removed: 0, startedAt: new Date().toISOString(), finishedAt: null, error: null };
    const status = this.status;
    try {
      status.total = await this.prisma.work.count({ where });
      // A full reindex is the one place the "has a translation" filter is switched on
      if (!this.translatedFilter) {
        const task = await this.client.index('works').updateFilterableAttributes([...FILTERABLE, TRANSLATED]);
        // Searches ask for the facet as soon as the flag is set, so the setting must be in place first
        await this.client.waitForTask(task.taskUid, { timeOutMs: 15 * 60_000 });
        this.translatedFilter = true;
      }
      await this.indexWhere(where, (n) => (status.indexed += n));

      // Adding never removes, so drop documents for works that were unpublished or deleted
      const ids = await this.prisma.work.findMany({ where, select: { id: true } });
      const published = new Set(ids.map((w) => w.id));
      const stale: string[] = [];
      const index = this.client.index('works');
      for (let offset = 0; ; offset += 1000) {
        const page = await index.getDocuments<{ id: string }>({ fields: ['id'], limit: 1000, offset });
        stale.push(...page.results.map((d) => d.id).filter((id) => !published.has(id)));
        if (offset + page.results.length >= page.total || !page.results.length) break;
      }
      if (stale.length) await index.deleteDocuments(stale);
      status.removed = stale.length;
      status.state = 'done';
      this.log.log(`Reindexed ${status.indexed} works, removed ${stale.length} stale entries`);
    } catch (err) {
      status.state = 'failed';
      status.error = (err as Error).message;
      this.log.error(`Reindex failed: ${status.error}`);
      throw err;
    } finally {
      status.finishedAt = new Date().toISOString();
    }
  }
}
