import { describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { OptionalStaffGuard, staffOnlyAll } from './optional-staff.guard';
import { clientIp, ipBucket, isPrivateAddress } from './client-ip-throttler.guard';

const SECRET = 'test-secret-test-secret-test-secret';
const jwt = new JwtService({ secret: SECRET });
const config = { getOrThrow: () => SECRET } as any;
const users: Record<string, { role: string; isBanned: boolean }> = {
  editor: { role: 'EDITOR', isBanned: false },
  admin: { role: 'SUPERADMIN', isBanned: false },
  contributor: { role: 'CONTRIBUTOR', isBanned: false },
  reader: { role: 'READER', isBanned: false },
  banned: { role: 'EDITOR', isBanned: true },
  demoted: { role: 'READER', isBanned: false },
};
const prisma = { user: { findUnique: async ({ where }: any) => users[where.id] ?? null } } as any;

async function isStaff(authorization?: string) {
  const req: any = { headers: authorization ? { authorization } : {} };
  const allowed = await new OptionalStaffGuard(config, prisma).canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any);
  expect(allowed).toBe(true); // the route stays public whatever the token
  return req.isStaff as boolean;
}

describe('OptionalStaffGuard (who may use ?all=true)', () => {
  it('is not staff without a token', async () => {
    expect(await isStaff()).toBe(false);
  });
  it.each(['editor', 'admin'])('recognises %s', async (id) => {
    expect(await isStaff(`Bearer ${jwt.sign({ sub: id, role: users[id].role })}`)).toBe(true);
  });
  it.each(['contributor', 'reader'])('does not count %s as staff', async (id) => {
    expect(await isStaff(`Bearer ${jwt.sign({ sub: id, role: users[id].role })}`)).toBe(false);
  });
  it('goes by the account now, not the role written in the token', async () => {
    expect(await isStaff(`Bearer ${jwt.sign({ sub: 'demoted', role: 'SUPERADMIN' })}`)).toBe(false);
    expect(await isStaff(`Bearer ${jwt.sign({ sub: 'banned', role: 'EDITOR' })}`)).toBe(false);
    expect(await isStaff(`Bearer ${jwt.sign({ sub: 'deleted', role: 'EDITOR' })}`)).toBe(false);
  });
  it('rejects forged, expired and malformed tokens quietly', async () => {
    expect(await isStaff(`Bearer ${new JwtService({ secret: 'other' }).sign({ sub: 'admin', role: 'SUPERADMIN' })}`)).toBe(false);
    expect(await isStaff(`Bearer ${jwt.sign({ sub: 'admin', role: 'SUPERADMIN' }, { expiresIn: -10 })}`)).toBe(false);
    expect(await isStaff('Bearer nonsense')).toBe(false);
    expect(await isStaff('Basic YWRtaW46YWRtaW4=')).toBe(false);
  });
  it('rejects an unsigned token (alg none)', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    expect(await isStaff(`Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'admin', role: 'SUPERADMIN' })}.`)).toBe(false);
  });
});

describe('staffOnlyAll', () => {
  it('drops all=true for the public and keeps it for staff', () => {
    expect(staffOnlyAll({ all: 'true', limit: 5 }, { isStaff: false })).toEqual({ all: undefined, limit: 5 });
    expect(staffOnlyAll({ all: 'true' }, {})).toEqual({ all: undefined });
    expect(staffOnlyAll({ all: 'true' }, { isStaff: true })).toEqual({ all: 'true' });
  });
});

describe('clientIp', () => {
  const req = (peer: string, headers: Record<string, string> = {}) => ({ socket: { remoteAddress: peer }, headers });

  it('takes CF-Connecting-IP when the request comes from our proxy', () => {
    expect(clientIp(req('172.18.0.5', { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '1.2.3.4, 172.18.0.1' }))).toBe('203.0.113.9');
    expect(clientIp(req('::ffff:172.18.0.5', { 'cf-connecting-ip': '2001:db8::1' }))).toBe('2001:db8::1');
  });
  it('ignores forwarding headers on a request that reaches the API directly from outside', () => {
    expect(clientIp(req('198.51.100.7', { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '203.0.113.9' }))).toBe('198.51.100.7');
  });
  it('without Cloudflare\'s header, trusts only the entry the proxy appended', () => {
    expect(clientIp(req('172.18.0.5', { 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }))).toBe('203.0.113.9');
  });
  it('falls back to the peer when a header is not an address', () => {
    expect(clientIp(req('127.0.0.1', { 'cf-connecting-ip': 'not-an-ip' }))).toBe('127.0.0.1');
    expect(clientIp(req('127.0.0.1'))).toBe('127.0.0.1');
  });
});

describe('ipBucket', () => {
  it('keeps IPv4 addresses apart', () => {
    expect(ipBucket('203.0.113.9')).toBe('203.0.113.9');
    expect(ipBucket('::ffff:203.0.113.9')).toBe('203.0.113.9');
  });
  it('puts a whole IPv6 /64 in one bucket', () => {
    expect(ipBucket('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
    expect(ipBucket('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(ipBucket('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
    expect(ipBucket('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ipBucket('2001:db8:1:3::1')).not.toBe(ipBucket('2001:db8:1:2::1'));
  });
});

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.18.0.5', '192.168.1.4', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])('%s is private', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });
  it.each(['8.8.8.8', '172.32.0.1', '2001:db8::1', '', undefined])('%s is not', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});
