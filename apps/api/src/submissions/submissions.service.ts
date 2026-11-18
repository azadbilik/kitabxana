import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { Language, Prisma, SubmissionStatus, SubmissionType } from '@prisma/client';
import { ClassConstructor, instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorsService } from '../authors/authors.service';
import { WorksService } from '../works/works.service';
import { TranslationsService } from '../translations/translations.service';
import { SearchService } from '../search/search.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { RTL_LANGUAGES } from '@irs-az/shared';
import {
  AuthorPayload,
  PublicSubmissionDto,
  TranslationPayload,
  WorkPayload,
} from './dto/public-submission.dto';
import { paginationArgs, paginatedResult } from '../common/utils/pagination';

const payloadClasses: Record<SubmissionType, ClassConstructor<object>> = {
  WORK: WorkPayload,
  TRANSLATION: TranslationPayload,
  AUTHOR: AuthorPayload,
};

interface Payloads {
  WORK: WorkPayload;
  TRANSLATION: TranslationPayload;
  AUTHOR: AuthorPayload;
}

const REVIEWABLE: SubmissionStatus[] = ['PENDING', 'CHANGES_REQUESTED'];

@Injectable()
export class SubmissionsService {
  constructor(
    private prisma: PrismaService,
    private authors: AuthorsService,
    private works: WorksService,
    private translations: TranslationsService,
    private search: SearchService,
  ) {}

  /**
   * Submissions are untrusted, signed in or not: the payload must fit a strict per-type
   * shape. `strict` (when one is sent) refuses unknown keys; at approval the stored payload
   * is checked again and unknown keys are only dropped, since older rows carry derived ones.
   */
  private async cleanPayload<T extends SubmissionType>(type: T, raw: unknown, strict: boolean): Promise<Payloads[T]> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('payload must be an object');
    const instance = plainToInstance(payloadClasses[type], raw);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: strict });
    if (errors.length) {
      throw new BadRequestException(
        errors.flatMap((e) => Object.values(e.constraints ?? {}).map((m) => `payload.${m}`)),
      );
    }
    return instance as Payloads[T];
  }

  /** The payload as stored: validated fields, plus what the review screen shows alongside */
  private async storedPayload(dto: { type: SubmissionType; payload: unknown; sourceNote?: string }) {
    const payload: Record<string, unknown> = instanceToPlain(await this.cleanPayload(dto.type, dto.payload, true));
    if (dto.type === 'WORK') {
      await this.assertExists('author', payload.authorId as string);
      payload.scriptDirection = RTL_LANGUAGES.includes(payload.originalLang as Language) ? 'RTL' : 'LTR';
    }
    if (dto.type === 'TRANSLATION') {
      await this.assertExists('work', payload.workId as string);
      payload.scriptDirection = RTL_LANGUAGES.includes(payload.language as Language) ? 'RTL' : 'LTR';
    }
    if (dto.type !== 'AUTHOR' && dto.sourceNote) payload.sourceNote = dto.sourceNote;
    return payload as Prisma.InputJsonValue;
  }

  async create(dto: CreateSubmissionDto, userId: string) {
    return this.prisma.submission.create({
      data: {
        type: dto.type,
        payload: await this.storedPayload(dto),
        sourceNote: dto.sourceNote,
        userId,
      },
    });
  }

  async createPublic(dto: PublicSubmissionDto) {
    return this.prisma.submission.create({
      data: {
        type: dto.type,
        payload: await this.storedPayload(dto),
        sourceNote: dto.sourceNote,
        contactName: dto.contactName.trim(),
        contactEmail: dto.contactEmail.trim().toLowerCase(),
      },
      select: { id: true },
    });
  }

  private async assertExists(model: 'author' | 'work', id: string) {
    const where = { id, status: 'PUBLISHED' as const };
    const found =
      model === 'author'
        ? await this.prisma.author.findFirst({ where, select: { id: true } })
        : await this.prisma.work.findFirst({ where, select: { id: true } });
    if (!found) throw new BadRequestException(`Unknown ${model}`);
  }

  async findAll(query: { page?: number; limit?: number; status?: SubmissionStatus; type?: string }) {
    const { skip, take, page, limit } = paginationArgs(query);

    const where: Prisma.SubmissionWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type as any }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.submission.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, name: true } },
        },
      }),
      this.prisma.submission.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.submission.findUniqueOrThrow({
      where: { id },
      include: {
        user: { select: { id: true, username: true, name: true, email: true } },
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.submission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Approving publishes the new author, work or translation right away: the review is
   * the editorial check. Pass `publish: false` to create it as a draft instead.
   *
   * One transaction: the submission is first claimed with a conditional UPDATE, so of two
   * approvals sent at once only one creates anything, and a failed create releases the claim.
   */
  async approve(id: string, reviewerId: string, { publish = true } = {}) {
    const sub = await this.assertReviewable(id);
    const reviewed = { status: 'APPROVED' as const, reviewedById: reviewerId, reviewedAt: new Date() };

    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.submission.updateMany({ where: { id, status: { in: REVIEWABLE } }, data: reviewed });
      if (claimed.count !== 1) throw new ConflictException('Submission was already reviewed');
      const options = { publish, sourceNote: sub.sourceNote };

      switch (sub.type) {
        case 'AUTHOR': {
          const author = await this.authors.createFromPayload(await this.cleanPayload('AUTHOR', sub.payload, false), options, tx);
          await tx.submission.update({ where: { id }, data: { authorId: author.id } });
          return { type: sub.type, slug: author.slug, published: publish };
        }
        case 'WORK': {
          const work = await this.works.createFromPayload(await this.cleanPayload('WORK', sub.payload, false), options, tx);
          await tx.submission.update({ where: { id }, data: { workId: work.id } });
          return { type: sub.type, slug: work.slug, published: publish, reindex: work.id };
        }
        case 'TRANSLATION': {
          const payload = await this.cleanPayload('TRANSLATION', sub.payload, false);
          const translation = await this.translations.createFromPayload(payload, id, options, tx);
          const work = await tx.work.findUniqueOrThrow({ where: { id: translation.workId }, select: { slug: true } });
          // The work's search entry includes its published translations
          return { type: sub.type, slug: work.slug, translationId: translation.id, published: publish, reindex: translation.workId };
        }
      }
    });

    const { reindex, ...answer } = result as typeof result & { reindex?: string };
    if (publish && reindex) await this.search.reindexQuietly(reindex);
    return answer;
  }

  private async assertReviewable(id: string) {
    const sub = await this.prisma.submission.findUniqueOrThrow({ where: { id } });
    if (sub.status !== 'PENDING' && sub.status !== 'CHANGES_REQUESTED') {
      throw new BadRequestException('Submission is not reviewable');
    }
    return sub;
  }

  /** A review decision, applied only while the submission is still open (an approval may have just landed) */
  private async review(id: string, data: Prisma.SubmissionUncheckedUpdateManyInput) {
    const done = await this.prisma.submission.updateMany({ where: { id, status: { in: REVIEWABLE } }, data });
    if (done.count !== 1) throw new ConflictException('Submission was already reviewed');
    return this.prisma.submission.findUniqueOrThrow({ where: { id } });
  }

  private cleanNote(reviewNote: unknown) {
    const note = typeof reviewNote === 'string' ? reviewNote.trim() : '';
    if (note.length > 2000) throw new BadRequestException('Review note is too long');
    return note || null;
  }

  async reject(id: string, reviewerId: string, reviewNote?: unknown) {
    await this.assertReviewable(id);
    const note = this.cleanNote(reviewNote);
    return this.review(id, {
      status: 'REJECTED',
      // Without a new note, keep the one from an earlier "request changes"
      ...(note && { reviewNote: note }),
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    });
  }

  /** The note is what the contributor needs to fix, so it's required here. */
  async requestChanges(id: string, reviewerId: string, reviewNote?: unknown) {
    await this.assertReviewable(id);
    const note = this.cleanNote(reviewNote);
    if (!note) throw new BadRequestException('A review note is required when requesting changes');
    return this.review(id, {
      status: 'CHANGES_REQUESTED',
      reviewNote: note,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    });
  }
}
