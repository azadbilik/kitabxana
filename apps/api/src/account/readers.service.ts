import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { GoogleProfile } from './google.service';
import { normalizeEmail } from './login-code.service';

const LOCALES = new Set(['az', 'ru', 'en']);
export const readerLocale = (l: unknown) => (typeof l === 'string' && LOCALES.has(l) ? l : 'az');

export const meSelect = { id: true, email: true, name: true, avatarUrl: true, locale: true, createdAt: true } as const;

/** Finding or creating the reader behind a verified sign-in */
@Injectable()
export class ReadersService {
  constructor(private prisma: PrismaService) {}

  /** An emailed code proves the address: sign in its account, or open one */
  byEmail(rawEmail: string, locale: string) {
    const email = normalizeEmail(rawEmail);
    return this.prisma.user.upsert({
      where: { email },
      update: { isVerified: true },
      create: { email, isVerified: true, locale: readerLocale(locale) },
      select: { id: true, isBanned: true },
    });
  }

  /**
   * Google: the account already linked to this Google subject; else the account with the same
   * address, when Google has verified it (then linked); else a new one.
   */
  async byGoogle(p: GoogleProfile) {
    const linked = await this.prisma.user.findUnique({ where: { googleSub: p.sub }, select: { id: true, isBanned: true } });
    if (linked) return linked;
    const email = normalizeEmail(p.email);
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true, googleSub: true } });
    if (existing) {
      if (!p.emailVerified || existing.googleSub) return null; // unverified address, or another Google account owns it
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { googleSub: p.sub, isVerified: true },
        select: { id: true, isBanned: true },
      });
    }
    return this.prisma.user.create({
      data: { email, googleSub: p.sub, name: p.name, avatarUrl: p.picture, isVerified: p.emailVerified },
      select: { id: true, isBanned: true },
    });
  }

  me(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: meSelect });
  }

  update(id: string, data: { name?: string | null; locale?: string }) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name?.trim().slice(0, 80) || null }),
        ...(data.locale !== undefined && { locale: readerLocale(data.locale) }),
      },
      select: meSelect,
    });
  }

  /** Deletes the account; sessions, saves, progress and lists go with it (cascade).
   *  Staff accounts are not deleted here. */
  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!user || user.role !== 'READER') return false;
    await this.prisma.user.delete({ where: { id } });
    return true;
  }
}
