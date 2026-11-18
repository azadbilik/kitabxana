import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * The route's throttle counted per address being signed in to, next to the per-IP guard:
 * guesses at one reader's code from many IPs share a bucket.
 */
@Injectable()
export class EmailThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    return `email:${email}`;
  }
}
