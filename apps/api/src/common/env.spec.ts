import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';
import { localePath } from '../sitemap/indexnow.service';

const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40) };

describe('validateEnv', () => {
  it('passes a complete development environment through', () => {
    expect(validateEnv({ ...base })).toEqual(base);
  });
  it('names every missing variable at once', () => {
    expect(() => validateEnv({})).toThrowError(/DATABASE_URL is not set[\s\S]*JWT_SECRET is not set[\s\S]*JWT_REFRESH_SECRET is not set/);
  });
  it('requires SITE_URL and CORS_ORIGIN only in production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrowError(/SITE_URL is not set[\s\S]*CORS_ORIGIN is not set/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', SITE_URL: 'https://kitabxana.az', CORS_ORIGIN: 'https://kitabxana.az' })).not.toThrow();
  });
  it('refuses placeholder or short secrets in production', () => {
    const prod = { ...base, NODE_ENV: 'production', SITE_URL: 'https://kitabxana.az', CORS_ORIGIN: 'https://kitabxana.az' };
    expect(() => validateEnv({ ...prod, JWT_SECRET: 'change-me-in-production' })).toThrowError(/JWT_SECRET must be a random secret/);
    expect(() => validateEnv({ ...prod, JWT_REFRESH_SECRET: 'short' })).toThrowError(/JWT_REFRESH_SECRET must be a random secret/);
  });
  it('checks the Telegram hour', () => {
    expect(() => validateEnv({ ...base, TELEGRAM_POST_HOUR: '25' })).toThrowError(/TELEGRAM_POST_HOUR/);
    expect(() => validateEnv({ ...base, TELEGRAM_POST_HOUR: '9' })).not.toThrow();
  });
});

describe('IndexNow localePath', () => {
  it('leaves Azerbaijani unprefixed, like the web app', () => {
    expect(localePath('az', '/works/fuzuli-qezel-7')).toBe('/works/fuzuli-qezel-7');
    expect(localePath('ru', '/works/fuzuli-qezel-7')).toBe('/ru/works/fuzuli-qezel-7');
    expect(localePath('en', '/authors/nizami')).toBe('/en/authors/nizami');
    expect(localePath('az')).toBe('/');
  });
});
