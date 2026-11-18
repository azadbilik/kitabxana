import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TelegramService } from './telegram.service';

const dir = mkdtempSync(join(tmpdir(), 'kx-telegram-'));
let n = 0;

function setup(env: Record<string, string | undefined> = {}) {
  const state = join(dir, `state-${++n}.json`);
  const values: Record<string, string | undefined> = {
    TELEGRAM_BOT_TOKEN: '123:secret-token',
    TELEGRAM_CHANNEL: '@kitabxana',
    SITE_URL: 'https://kitabxana.az/',
    TELEGRAM_POST_HOUR: '9',
    TELEGRAM_STATE: state,
    ...env,
  };
  const poem = {
    date: '2026-11-18',
    slug: 'fuzuli-qezel-7',
    titleAz: 'Qəzəl 7',
    author: { nameAz: 'Məhəmməd Füzuli' },
    excerpt: ['Birinci misra', 'İkinci misra'],
  };
  const works = { dailyPoemOpening: vi.fn(async () => poem) };
  const fetchMock = vi.fn(async (_url: string, _init: { body: string }) => ({ ok: true, status: 200, text: async () => '' }));
  vi.stubGlobal('fetch', fetchMock);
  const make = () => new TelegramService({ get: (k: string) => values[k] } as any, works as any);
  return { service: make(), make, works, fetchMock, state, poem };
}

const at = (bakuHour: number) => new Date(Date.UTC(2026, 10, 18, bakuHour - 4, 5));

afterEach(() => vi.unstubAllGlobals());

describe('TelegramService', () => {
  it('is off, and calls nothing, unless both the token and the channel are set', async () => {
    for (const env of [{ TELEGRAM_BOT_TOKEN: undefined }, { TELEGRAM_CHANNEL: '' }]) {
      const { service, fetchMock, works } = setup(env);
      expect(service.enabled).toBe(false);
      expect(await service.tick(at(12))).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(works.dailyPoemOpening).not.toHaveBeenCalled();
    }
  });

  it('waits for the posting hour in Baku', async () => {
    const { service, fetchMock } = setup();
    expect(await service.tick(at(8))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await service.tick(at(9))).toBe(true);
  });

  it('posts the daily poem to the channel with a link to the unprefixed Azerbaijani URL', async () => {
    const { service, fetchMock, works } = setup();
    expect(await service.tick(at(10))).toBe(true);
    expect(works.dailyPoemOpening).toHaveBeenCalledWith('az', 8);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/bot123:secret-token/sendMessage');
    const body = JSON.parse(init.body);
    expect(body.chat_id).toBe('@kitabxana');
    expect(body.parse_mode).toBe('HTML');
    expect(body.text).toContain('<b>Qəzəl 7</b>');
    expect(body.text).toContain('href="https://kitabxana.az/works/fuzuli-qezel-7"');
  });

  it('posts once a day: not again at the next check, nor after a restart', async () => {
    const { service, make, fetchMock, state } = setup();
    expect(await service.tick(at(10))).toBe(true);
    expect(await service.tick(at(11))).toBe(false);
    expect(await make().tick(at(15))).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(state, 'utf8'))).toEqual({ lastPosted: '2026-11-18' });
  });

  it('posts again when the day changes', async () => {
    const { service, fetchMock, poem } = setup();
    await service.tick(at(10));
    poem.date = '2026-11-19';
    expect(await service.tick(new Date(Date.UTC(2026, 10, 19, 6)))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries after a failed post, and never puts the token in the log', async () => {
    const { service, fetchMock } = setup();
    const warn = vi.fn();
    (service as any).log = { warn, log: vi.fn(), error: vi.fn() };
    fetchMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED https://api.telegram.org/bot123:secret-token/sendMessage'));
    expect(await service.tick(at(10))).toBe(false);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => '{"description":"bot is not a member of the channel"}' });
    expect(await service.tick(at(10))).toBe(false);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-token');
    expect(warn.mock.calls[1][0]).toContain('403');
    expect(await service.tick(at(10))).toBe(true);
  });
});

process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
