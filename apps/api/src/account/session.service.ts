import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/** The reader's session cookie. Scoped to /api so page requests never carry it. */
export const SESSION_COOKIE = 'kx_session';
const SESSION_DAYS = 90;
/** Sliding expiry is renewed at most this often, so a busy reader costs one write a day */
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  locale: string | null;
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** One cookie out of a Cookie header (no cookie library needed for one name) */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

@Injectable()
export class SessionService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /** Cookies are Secure everywhere except plain-http local development */
  private get secure() {
    return !String(this.config.get('SITE_URL') ?? 'https://').startsWith('http://');
  }

  async create(userId: string, req: Request, res: Response) {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
        userAgent: req.headers['user-agent']?.slice(0, 200),
      },
    });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/api',
      maxAge: SESSION_DAYS * 86_400_000,
    });
  }

  /** The signed-in reader, or null. Renews the session's expiry once a day. */
  async resolve(req: Request): Promise<SessionUser | null> {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, email: true, name: true, role: true, locale: true, isBanned: true } } },
    });
    if (!session || session.expiresAt < new Date() || session.user.isBanned) return null;
    if (Date.now() - session.lastSeenAt.getTime() > RENEW_AFTER_MS) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) },
      });
    }
    const { isBanned: _, ...user } = session.user;
    return user;
  }

  async destroy(req: Request, res: Response) {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) await this.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    res.clearCookie(SESSION_COOKIE, { path: '/api', httpOnly: true, secure: this.secure, sameSite: 'lax' });
  }
}
