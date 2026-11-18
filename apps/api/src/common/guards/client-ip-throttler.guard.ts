import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { isIP } from 'node:net';

const PRIVATE_V4 = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/;

/** Loopback, private and link-local peers: our own reverse proxy, never a visitor in production */
export function isPrivateAddress(address: string | undefined): boolean {
  if (!address) return false;
  const ip = address.replace(/^::ffff:/i, '');
  if (isIP(ip) === 4) return PRIVATE_V4.test(ip);
  const low = ip.toLowerCase();
  return low === '::1' || /^f[cd]/.test(low) || /^fe[89ab]/.test(low);
}

/** IPv6 hosts get a whole /64 and can rotate through it, so the bucket is the /64 */
export function ipBucket(address: string): string {
  const ip = address.trim().replace(/^::ffff:/i, '');
  if (isIP(ip) !== 6) return ip;
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

type Req = { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string }; ip?: string };

const header = (req: Req, name: string) => {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
};

/**
 * The visitor's address. Both deployments put the API behind Caddy on a private Docker
 * network, with Cloudflare (edge, or cloudflared on the laptop) in front of Caddy:
 * - forwarding headers count only when the connection comes from a private address (Caddy);
 *   a request that reaches the API directly is taken at its socket address;
 * - CF-Connecting-IP is set by Cloudflare, which overwrites whatever the visitor sent;
 * - otherwise the last X-Forwarded-For entry, the one Caddy itself appended (earlier
 *   entries are the visitor's to forge).
 * This holds as long as the origin is reachable only through Cloudflare: true for the
 * tunnel (Caddy listens on 127.0.0.1); on a server, firewall 80/443 to Cloudflare's ranges.
 */
export function clientIp(req: Req): string {
  const peer = req.socket?.remoteAddress ?? req.ip ?? '';
  if (!isPrivateAddress(peer)) return peer;
  const cf = header(req, 'cf-connecting-ip');
  if (cf && isIP(cf)) return cf;
  const forwarded = header(req, 'x-forwarded-for')?.split(',').at(-1)?.trim();
  return forwarded && isIP(forwarded) ? forwarded : peer;
}

/** Rate-limits by the visitor's IP (see clientIp), IPv6 by /64 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return ipBucket(clientIp(req as Req));
  }
}

/**
 * The same limit for visitors only. The web app renders pages by calling the API over the
 * internal network, where every reader would share the web container's address; those calls
 * (a private peer and no forwarding header) are not counted.
 */
@Injectable()
export class VisitorThrottlerGuard extends ClientIpThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Req>();
    return isPrivateAddress(req.socket?.remoteAddress) && !header(req, 'cf-connecting-ip') && !header(req, 'x-forwarded-for');
  }
}
