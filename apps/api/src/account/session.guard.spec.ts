import { describe, expect, it, vi } from 'vitest';
import { CsrfGuard, SessionGuard } from './session.guard';
import { safeReturnTo } from './google.service';

const ctx = (req: object) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;
const user = { id: 'u1', email: 'a@b.az', name: null, role: 'READER', locale: 'az' };

describe('SessionGuard', () => {
  const guard = (resolved: typeof user | null) => {
    const sessions = { resolve: vi.fn(async () => resolved) };
    return { guard: new SessionGuard(sessions as any), sessions };
  };

  it('lets a signed-in reader read and sets req.user', async () => {
    const req: any = { method: 'GET', headers: {} };
    await expect(guard(user).guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.user).toEqual(user);
  });

  it('answers 401 without a session', async () => {
    await expect(guard(null).guard.canActivate(ctx({ method: 'GET', headers: {} }))).rejects.toMatchObject({ status: 401 });
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('refuses %s without the x-kitabxana header, before looking at the session', async (method) => {
    const { guard: g, sessions } = guard(user);
    await expect(g.canActivate(ctx({ method, headers: {} }))).rejects.toMatchObject({ status: 403 });
    expect(sessions.resolve).not.toHaveBeenCalled();
  });

  it('refuses a wrong header value and accepts "1"', async () => {
    await expect(guard(user).guard.canActivate(ctx({ method: 'POST', headers: { 'x-kitabxana': 'true' } }))).rejects.toMatchObject({ status: 403 });
    await expect(guard(user).guard.canActivate(ctx({ method: 'POST', headers: { 'x-kitabxana': '1' } }))).resolves.toBe(true);
  });
});

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();
  it('passes safe methods and state changes that carry the header', () => {
    expect(guard.canActivate(ctx({ method: 'GET', headers: {} }))).toBe(true);
    expect(guard.canActivate(ctx({ method: 'POST', headers: { 'x-kitabxana': '1' } }))).toBe(true);
  });
  it('refuses a state change without it', () => {
    expect(() => guard.canActivate(ctx({ method: 'POST', headers: {} }))).toThrowError(/header/);
  });
});

describe('safeReturnTo', () => {
  it('keeps same-site paths', () => {
    expect(safeReturnTo('/refim')).toBe('/refim');
    expect(safeReturnTo('/ru/works/fuzuli-qezel-7?tr=abc#x')).toBe('/ru/works/fuzuli-qezel-7?tr=abc#x');
  });
  it.each([
    ['https://evil.example/', 'absolute URL'],
    ['//evil.example', 'protocol-relative'],
    ['/\\evil.example', 'backslash trick'],
    ['javascript:alert(1)', 'script URL'],
    ['refim', 'relative path'],
    ['', 'empty'],
    [undefined, 'missing'],
    [['/a', '/b'], 'repeated parameter'],
    [`/${'a'.repeat(600)}`, 'over-long'],
  ] as [unknown, string][])('sends %j (%s) to the home page', (value, _why) => {
    expect(safeReturnTo(value)).toBe('/');
  });
});
