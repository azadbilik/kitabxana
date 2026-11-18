import { describe, expect, it, vi } from 'vitest';
import { LoginCodeService, MAX_ATTEMPTS, MAX_CODES_PER_HOUR } from './login-code.service';

interface Row {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
  createdAt: Date;
}

/** The few loginCode calls the service makes, over an array, with Prisma's where semantics */
function fakePrisma(rows: Row[] = []) {
  let seq = 0;
  const matches = (r: Row, where: any) =>
    (where.id === undefined || r.id === where.id) &&
    (where.email === undefined || r.email === where.email) &&
    (where.usedAt === undefined || r.usedAt === where.usedAt) &&
    (where.expiresAt?.gt === undefined || r.expiresAt > where.expiresAt.gt) &&
    (where.attempts?.lt === undefined || r.attempts < where.attempts.lt) &&
    (where.createdAt?.gt === undefined || r.createdAt > where.createdAt.gt);
  return {
    rows,
    loginCode: {
      count: async ({ where }: any) => rows.filter((r) => matches(r, where)).length,
      create: async ({ data }: any) => {
        const row: Row = { id: `c${++seq}`, attempts: 0, usedAt: null, createdAt: new Date(Date.now() + seq), ...data };
        rows.push(row);
        return row;
      },
      findFirst: async ({ where }: any) =>
        [...rows].filter((r) => matches(r, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
      updateMany: async ({ where, data }: any) => {
        const hit = rows.filter((r) => matches(r, where));
        for (const r of hit) {
          if (data.attempts?.increment) r.attempts += data.attempts.increment;
          if (data.usedAt) r.usedAt = data.usedAt;
        }
        return { count: hit.length };
      },
      deleteMany: async ({ where }: any) => {
        const before = rows.length;
        rows.splice(0, rows.length, ...rows.filter((r) => !matches(r, where)));
        return { count: before - rows.length };
      },
    },
  };
}

function setup({ canDeliver = true, sendFails = false } = {}) {
  const prisma = fakePrisma();
  const sent: { to: string; code: string }[] = [];
  const mail = {
    canDeliver,
    sendCode: vi.fn(async (to: string, code: string) => {
      if (sendFails) throw new Error('smtp down');
      sent.push({ to, code });
    }),
  };
  const config = { getOrThrow: () => 'test-secret-test-secret-test-secret' };
  const service = new LoginCodeService(prisma as any, mail as any, config as any);
  return { service, prisma, sent, mail };
}

const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

describe('LoginCodeService.start', () => {
  it('stores only a hash of the code and mails the code', async () => {
    const { service, prisma, sent } = setup();
    await service.start(' Reader@Example.com ', 'az');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('reader@example.com');
    expect(sent[0].code).toMatch(/^\d{6}$/);
    expect(prisma.rows[0].codeHash).not.toContain(sent[0].code);
    expect(prisma.rows[0].codeHash).toBe(service.hash('reader@example.com', sent[0].code));
  });

  it('refuses a sixth code within the hour', async () => {
    const { service } = setup();
    for (let i = 0; i < MAX_CODES_PER_HOUR; i++) await service.start('a@b.az', 'az');
    await expect(service.start('a@b.az', 'az')).rejects.toMatchObject({ status: 429 });
  });

  it('drops the code when the mail fails, so retries do not use up the hourly cap', async () => {
    const { service, prisma } = setup({ sendFails: true });
    for (let i = 0; i < MAX_CODES_PER_HOUR + 3; i++) {
      await expect(service.start('a@b.az', 'az')).rejects.toMatchObject({ status: 503 });
    }
    expect(prisma.rows).toHaveLength(0);
  });

  it('is unavailable, and creates nothing, when no code could reach the reader', async () => {
    const { service, prisma, mail } = setup({ canDeliver: false });
    await expect(service.start('a@b.az', 'az')).rejects.toMatchObject({ status: 503 });
    expect(prisma.rows).toHaveLength(0);
    expect(mail.sendCode).not.toHaveBeenCalled();
  });
});

describe('LoginCodeService.verify', () => {
  it('accepts the right code once, for the normalised address', async () => {
    const { service, sent } = setup();
    await service.start('a@b.az', 'az');
    await expect(service.verify(' A@B.az', sent[0].code)).resolves.toBe('a@b.az');
    await expect(service.verify('a@b.az', sent[0].code)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a wrong code and counts the attempt', async () => {
    const { service, prisma, sent } = setup();
    await service.start('a@b.az', 'az');
    await expect(service.verify('a@b.az', wrong(sent[0].code))).rejects.toMatchObject({ status: 400 });
    expect(prisma.rows[0].attempts).toBe(1);
    expect(prisma.rows[0].usedAt).toBeNull();
  });

  it('kills the code after MAX_ATTEMPTS guesses, even for the right code', async () => {
    const { service, sent } = setup();
    await service.start('a@b.az', 'az');
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await expect(service.verify('a@b.az', wrong(sent[0].code))).rejects.toMatchObject({ status: 400 });
    }
    await expect(service.verify('a@b.az', sent[0].code)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an expired code without spending an attempt', async () => {
    const { service, prisma, sent } = setup();
    await service.start('a@b.az', 'az');
    prisma.rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(service.verify('a@b.az', sent[0].code)).rejects.toMatchObject({ status: 400 });
    expect(prisma.rows[0].attempts).toBe(0);
  });

  it('does not accept a code sent to another address', async () => {
    const { service, sent } = setup();
    await service.start('a@b.az', 'az');
    await service.start('c@d.az', 'az');
    await expect(service.verify('c@d.az', sent[0].code === sent[1].code ? wrong(sent[0].code) : sent[0].code)).rejects.toMatchObject({ status: 400 });
  });

  it('claims attempts atomically: parallel guesses cannot exceed the cap or share the last attempt', async () => {
    const { service, prisma, sent } = setup();
    await service.start('a@b.az', 'az');
    const guesses = Array.from({ length: 30 }, () => service.verify('a@b.az', wrong(sent[0].code)).catch(() => 'rejected'));
    expect(await Promise.all(guesses)).toEqual(Array(30).fill('rejected'));
    expect(prisma.rows[0].attempts).toBe(MAX_ATTEMPTS);
  });

  it('lets only one of two parallel requests with the right code through', async () => {
    const { service, sent } = setup();
    await service.start('a@b.az', 'az');
    const results = await Promise.allSettled([service.verify('a@b.az', sent[0].code), service.verify('a@b.az', sent[0].code)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('uses a key of its own, not JWT_SECRET itself', async () => {
    const { service } = setup();
    const { createHmac } = await import('node:crypto');
    const direct = createHmac('sha256', 'test-secret-test-secret-test-secret').update('a@b.az:123456').digest('hex');
    expect(service.hash('a@b.az', '123456')).not.toBe(direct);
  });
});
