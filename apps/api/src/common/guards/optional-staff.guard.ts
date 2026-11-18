import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

const STAFF = new Set(['EDITOR', 'SUPERADMIN']);

/**
 * For public routes that show more to staff (`?all=true` lists drafts): never refuses a
 * request, only notes on it whether it carries a valid editor or admin token.
 */
@Injectable()
export class OptionalStaffGuard implements CanActivate {
  private jwt: JwtService;

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.jwt = new JwtService({ secret: config.getOrThrow<string>('JWT_SECRET') });
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; isStaff?: boolean }>();
    req.isStaff = false;
    const match = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '');
    if (!match) return true;
    try {
      const { sub } = this.jwt.verify<{ sub: string }>(match[1]);
      const user = await this.prisma.user.findUnique({ where: { id: String(sub) }, select: { role: true, isBanned: true } });
      req.isStaff = Boolean(user && !user.isBanned && STAFF.has(user.role));
    } catch {
      // An expired or forged token, or an unreachable database, is simply not staff
    }
    return true;
  }
}

/** `all=true` counts only from staff; for anyone else the query is the public one */
export function staffOnlyAll<T extends { all?: string }>(query: T, req: { isStaff?: boolean }): T {
  if (!req.isStaff) query.all = undefined;
  return query;
}
