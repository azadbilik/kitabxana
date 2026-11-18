import { Injectable } from '@nestjs/common';
import { Language, Prisma } from '@prisma/client';
import { RTL_LANGUAGES } from '@irs-az/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTranslationDto, UpdateTranslationDto } from './dto/create-translation.dto';
import { renderMarkdown } from '../common/utils/markdown';
import { SearchService } from '../search/search.service';
import type { TranslationPayload } from '../submissions/dto/public-submission.dto';

/**
 * Translations of works. At most one per work and language is the default (also a partial
 * unique index in the database); every change to it happens in a transaction that first
 * locks the work's row, so two editors cannot leave two defaults or none.
 */
@Injectable()
export class TranslationsService {
  constructor(
    private prisma: PrismaService,
    private search: SearchService,
  ) {}

  /** A work's search entry holds its translations */
  private async reindex<T extends { workId: string }>(translation: T): Promise<T> {
    await this.search.reindexQuietly(translation.workId);
    return translation;
  }

  async findByWork(workId: string) {
    return this.prisma.translation.findMany({
      where: { workId, status: 'PUBLISHED', work: { status: 'PUBLISHED', author: { status: 'PUBLISHED' } } },
      orderBy: [{ isDefault: 'desc' }, { language: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findByWorkAndLang(workId: string, language: string) {
    return this.prisma.translation.findFirst({
      where: {
        workId,
        language: language as Language,
        status: 'PUBLISHED',
        work: { status: 'PUBLISHED', author: { status: 'PUBLISHED' } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  private lockWork(tx: Prisma.TransactionClient, workId: string) {
    return tx.$queryRaw`SELECT id FROM "Work" WHERE id = ${workId} FOR UPDATE`;
  }

  /** Takes the default away from the work's other translations into the language */
  private clearDefault(tx: Prisma.TransactionClient, workId: string, language: Language, exceptId?: string) {
    return tx.translation.updateMany({
      where: { workId, language, isDefault: true, ...(exceptId && { id: { not: exceptId } }) },
      data: { isDefault: false },
    });
  }

  /**
   * Inside a transaction: the row for a new translation. A work's first translation into a
   * language becomes its default; `wantDefault` makes this one the default over an earlier one.
   */
  private async insert(
    tx: Prisma.TransactionClient,
    data: Omit<Prisma.TranslationUncheckedCreateInput, 'isDefault' | 'bodyHtml'>,
    wantDefault?: boolean,
  ) {
    await this.lockWork(tx, data.workId);
    const first = (await tx.translation.count({ where: { workId: data.workId, language: data.language } })) === 0;
    const isDefault = wantDefault ?? first;
    if (isDefault) await this.clearDefault(tx, data.workId, data.language);
    return tx.translation.create({ data: { ...data, isDefault, bodyHtml: renderMarkdown(data.body) } });
  }

  async create(dto: CreateTranslationDto) {
    const translation = await this.prisma.$transaction((tx) =>
      this.insert(
        tx,
        {
          workId: dto.workId,
          language: dto.language,
          type: dto.type,
          scriptDirection: dto.scriptDirection,
          body: dto.body,
          translator: dto.translator,
          translatorNote: dto.translatorNote,
          year: dto.year,
          sourceNote: dto.sourceNote,
        },
        dto.isDefault,
      ),
    );
    return this.reindex(translation);
  }

  /** The work a translation belongs to is fixed; everything else an editor may change */
  async update(id: string, dto: UpdateTranslationDto) {
    const translation = await this.prisma.$transaction(async (tx) => {
      const current = await tx.translation.findUniqueOrThrow({ where: { id }, select: { workId: true, language: true, isDefault: true } });
      await this.lockWork(tx, current.workId);
      const language = dto.language ?? current.language;
      const isDefault = dto.isDefault ?? current.isDefault;
      if (isDefault) await this.clearDefault(tx, current.workId, language, id);
      return tx.translation.update({
        where: { id },
        data: {
          language: dto.language,
          type: dto.type,
          scriptDirection: dto.scriptDirection,
          body: dto.body,
          ...(dto.body && { bodyHtml: renderMarkdown(dto.body) }),
          translator: dto.translator,
          translatorNote: dto.translatorNote,
          year: dto.year,
          sourceNote: dto.sourceNote,
          isDefault: dto.isDefault,
        },
      });
    });
    return this.reindex(translation);
  }

  async setDefault(id: string) {
    const translation = await this.prisma.$transaction(async (tx) => {
      const current = await tx.translation.findUniqueOrThrow({ where: { id }, select: { workId: true, language: true } });
      await this.lockWork(tx, current.workId);
      await this.clearDefault(tx, current.workId, current.language, id);
      return tx.translation.update({ where: { id }, data: { isDefault: true } });
    });
    return this.reindex(translation);
  }

  /** A translation from an approved submission; `payload` has passed TranslationPayload validation */
  createFromPayload(
    payload: TranslationPayload,
    submissionId: string,
    { publish = true, sourceNote }: { publish?: boolean; sourceNote?: string | null } = {},
    tx: Prisma.TransactionClient,
  ) {
    return this.insert(tx, {
      workId: payload.workId,
      language: payload.language,
      type: payload.type,
      scriptDirection: RTL_LANGUAGES.includes(payload.language) ? 'RTL' : 'LTR',
      body: payload.body,
      translator: payload.translator,
      translatorNote: payload.translatorNote,
      year: payload.year,
      sourceNote,
      submissionId,
      status: publish ? 'PUBLISHED' : 'DRAFT',
    });
  }
}
