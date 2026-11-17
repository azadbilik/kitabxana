import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SessionService } from './session.service';

/** Header every state-changing account request must carry. A cross-site form cannot set it,
 *  and a cross-site fetch with it needs a CORS preflight the API only allows for its own site. */
export const CSRF_HEADER = 'x-kitabxana';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Requires a signed-in reader (session cookie) and sets req.user */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private sessions: SessionService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    if (!SAFE.has(req.method) && req.headers[CSRF_HEADER] !== '1') {
      throw new ForbiddenException('Missing request header');
    }
    const user = await this.sessions.resolve(req);
    if (!user) throw new UnauthorizedException('Not signed in');
    req.user = user;
    return true;
  }
}

/** For sign-in routes that change state without a session yet: only the CSRF check */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!SAFE.has(req.method) && req.headers[CSRF_HEADER] !== '1') {
      throw new ForbiddenException('Missing request header');
    }
    return true;
  }
}
