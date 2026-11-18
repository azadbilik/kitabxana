import { applyDecorators, CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata, UseInterceptors } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

const PUBLIC_CACHE = 'publicCache';

/**
 * Cache-Control for public reads whose answer is the same for everyone. Set only when the
 * handler succeeds, so errors are not cached, and never for a request that identifies
 * someone (staff token, reader cookie): those answers may differ and stay private.
 */
@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const value = this.reflector.get<string>(PUBLIC_CACHE, ctx.getHandler());
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        if (!value || res.headersSent) return;
        const personal = Boolean(req.headers.authorization || req.headers.cookie);
        res.setHeader('Cache-Control', personal ? 'private, no-store' : value);
      }),
    );
  }
}

/** Browsers may reuse the answer for `maxAge` seconds, shared caches for `sharedMaxAge` */
export const PublicCache = (maxAge = 60, sharedMaxAge = 300) =>
  applyDecorators(
    SetMetadata(PUBLIC_CACHE, `public, max-age=${maxAge}, s-maxage=${sharedMaxAge}`),
    UseInterceptors(PublicCacheInterceptor),
  );
