import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';

export const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
/** Codes one address may be sent per hour */
export const MAX_CODES_PER_HOUR = 5;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class LoginCodeService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  /** Codes are stored as an HMAC bound to the address, so a leaked table reveals nothing usable */
  hash(email: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(`${email}:${code}`).digest('hex');
  }

  async start(rawEmail: string, locale: string) {
    const email = normalizeEmail(rawEmail);
    const recent = await this.prisma.loginCode.count({
      where: { email, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    });
    if (recent >= MAX_CODES_PER_HOUR) {
      throw new HttpException('Too many codes requested; try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.loginCode.create({
      data: { email, codeHash: this.hash(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    });
    await this.mail.sendCode(email, code, locale);
  }

  /**
   * Checks a code against the newest unused one for the address. Each wrong guess counts;
   * after MAX_ATTEMPTS the code is dead and a new one must be requested.
   * Returns the normalised address when the code is right.
   */
  async verify(rawEmail: string, code: string): Promise<string> {
    const email = normalizeEmail(rawEmail);
    const latest = await this.prisma.loginCode.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const invalid = new BadRequestException('Invalid or expired code');
    if (!latest || latest.expiresAt < new Date() || latest.attempts >= MAX_ATTEMPTS) throw invalid;

    const given = Buffer.from(this.hash(email, code.trim()));
    const stored = Buffer.from(latest.codeHash);
    const ok = given.length === stored.length && timingSafeEqual(given, stored);
    if (!ok) {
      await this.prisma.loginCode.update({ where: { id: latest.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }
    await this.prisma.loginCode.update({ where: { id: latest.id }, data: { usedAt: new Date() } });
    return email;
  }
}
