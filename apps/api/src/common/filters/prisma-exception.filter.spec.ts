import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter, prismaErrorResponse } from './prisma-exception.filter';

const known = (code: string) => new Prisma.PrismaClientKnownRequestError(`db says ${code} on "User"."email"`, { code, clientVersion: 'test' });

describe('prismaErrorResponse', () => {
  it.each([
    ['P2002', 409],
    ['P2025', 404],
    ['P2003', 400],
    ['P2000', 400],
  ])('%s → %i', (code, status) => {
    expect(prismaErrorResponse(known(code))?.status).toBe(status);
  });

  it('maps input Prisma refuses (an unknown enum value) to 400', () => {
    const e = new Prisma.PrismaClientValidationError('Invalid value for argument `status`. Expected SubmissionStatus.', { clientVersion: 'test' });
    expect(prismaErrorResponse(e)?.status).toBe(400);
  });

  it('leaves anything else a server error', () => {
    expect(prismaErrorResponse(known('P1001'))).toBeNull();
  });
});

describe('PrismaExceptionFilter', () => {
  const run = (e: Parameters<PrismaExceptionFilter['catch']>[0]) => {
    const json = vi.fn();
    const status = vi.fn((_code: number) => ({ json }));
    const filter = new PrismaExceptionFilter();
    (filter as any).log = { error: vi.fn() };
    filter.catch(e, { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as any);
    return { status: status.mock.calls[0][0], body: json.mock.calls[0][0], logged: (filter as any).log.error.mock.calls.length };
  };

  it('answers a duplicate with 409 and no database detail', () => {
    const { status, body, logged } = run(known('P2002'));
    expect(status).toBe(409);
    expect(body).toEqual({ statusCode: 409, message: 'Already exists' });
    expect(JSON.stringify(body)).not.toContain('email');
    expect(logged).toBe(0);
  });

  it('answers a missing row with 404', () => {
    expect(run(known('P2025')).status).toBe(404);
  });

  it('answers an unexpected database error with 500, logs it, and still hides the detail', () => {
    const { status, body, logged } = run(known('P1001'));
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(logged).toBe(1);
  });
});
