import { BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { deriveKey } from '../common/utils/keys';
import { MailService } from './mail.service';

export const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
/** Codes one address may be sent per hour */
export const MAX_CODES_PER_HOUR = 5;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class LoginCodeService {
  private readonly key: Buffer;

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    config: ConfigService,
  ) {
    this.key = deriveKey(config.getOrThrow<string>('JWT_SECRET'), 'login-code');
  }

  /** Codes are stored as an HMAC bound to the address, so a leaked table reveals nothing usable */
  hash(email: string, code: string) {
    return createHmac('sha256', this.key).update(`${email}:${code}`).digest('hex');
  }

  async start(rawEmail: string, locale: string) {
    if (!this.mail.canDeliver) throw new ServiceUnavailableException('Sign-in by email is not available');
    const email = normalizeEmail(rawEmail);
    const recent = await this.prisma.loginCode.count({
      where: { email, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    });
    if (recent >= MAX_CODES_PER_HOUR) {
      throw new HttpException('Too many codes requested; try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const row = await this.prisma.loginCode.create({
      data: { email, codeHash: this.hash(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
      select: { id: true },
    });
    try {
      await this.mail.sendCode(email, code, locale);
    } catch {
      // A code nobody received must not count towards the hourly cap
      await this.prisma.loginCode.deleteMany({ where: { id: row.id } });
      throw new ServiceUnavailableException('The code could not be sent; please try again');
    }
  }

  /**
   * Checks a code against the newest unused one for the address. Every guess, right or wrong,
   * first takes one of the code's MAX_ATTEMPTS in a single conditional UPDATE, so parallel
   * guesses cannot share an attempt; after the last one the code is dead and a new one must
   * be requested. Returns the normalised address when the code is right.
   */
  async verify(rawEmail: string, code: string): Promise<string> {
    const email = normalizeEmail(rawEmail);
    const invalid = new BadRequestException('Invalid or expired code');
    const latest = await this.prisma.loginCode.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) throw invalid;

    const claimed = await this.prisma.loginCode.updateMany({
      where: { id: latest.id, usedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) throw invalid;

    const given = Buffer.from(this.hash(email, code.trim()));
    const stored = Buffer.from(latest.codeHash);
    if (given.length !== stored.length || !timingSafeEqual(given, stored)) throw invalid;

    // Two requests with the right code: only one may turn it into a session
    const used = await this.prisma.loginCode.updateMany({
      where: { id: latest.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count !== 1) throw invalid;
    return email;
  }
}
