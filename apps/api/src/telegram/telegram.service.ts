import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { WorksService } from '../works/works.service';
import { bakuHour, formatDailyPoem } from './message';

const FIRST_CHECK_DELAY_MS = 90_000;
const CHECK_INTERVAL_MS = 10 * 60_000;

/**
 * Posts the poem of the day (the one GET /works/daily gives Azerbaijani readers) to a Telegram
 * channel, once a day from TELEGRAM_POST_HOUR (Baku time, default 9).
 *
 * Off unless TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL (@name or numeric id; the bot must be an
 * admin of the channel) are set. The date last posted is kept in a file on the data volume, as
 * the IndexNow job keeps its state, so a restart does not post twice; a failed post is retried
 * at the next check.
 */
@Injectable()
export class TelegramService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(TelegramService.name);
  private readonly token: string | undefined;
  private readonly channel: string | undefined;
  private readonly site: string;
  private readonly hour: number;
  private readonly statePath: string;
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    config: ConfigService,
    private works: WorksService,
  ) {
    this.token = config.get<string>('TELEGRAM_BOT_TOKEN') || undefined;
    this.channel = config.get<string>('TELEGRAM_CHANNEL') || undefined;
    this.site = (config.get<string>('SITE_URL') || 'https://kitabxana.az').replace(/\/+$/, '');
    this.hour = Number(config.get('TELEGRAM_POST_HOUR') || 9);
    this.statePath = config.get<string>('TELEGRAM_STATE') || '/data/telegram-state.json';
  }

  get enabled() {
    return Boolean(this.token && this.channel);
  }

  onApplicationBootstrap() {
    if (!this.enabled) return;
    this.timers.push(
      setTimeout(() => void this.tick(), FIRST_CHECK_DELAY_MS),
      setInterval(() => void this.tick(), CHECK_INTERVAL_MS),
    );
    this.timers.forEach((t) => t.unref());
  }

  onApplicationShutdown() {
    this.timers.forEach(clearTimeout);
  }

  private async lastPosted(): Promise<string | null> {
    try {
      return JSON.parse(await readFile(this.statePath, 'utf8')).lastPosted ?? null;
    } catch {
      return null;
    }
  }

  private async remember(date: string) {
    await mkdir(dirname(this.statePath), { recursive: true });
    const tmp = `${this.statePath}.tmp`;
    await writeFile(tmp, JSON.stringify({ lastPosted: date }));
    await rename(tmp, this.statePath);
  }

  /** Posts today's poem if it is time and it has not gone out yet. Returns whether it posted. */
  async tick(now = new Date()): Promise<boolean> {
    if (!this.enabled || this.running || bakuHour(now) < this.hour) return false;
    this.running = true;
    try {
      const poem = await this.works.dailyPoemOpening('az', 8);
      if ((await this.lastPosted()) === poem.date) return false;
      await this.send(
        formatDailyPoem({
          title: poem.titleAz,
          author: poem.author.nameAz,
          lines: poem.excerpt,
          url: `${this.site}/works/${poem.slug}`,
        }),
      );
      await this.remember(poem.date).catch((e: Error) =>
        this.log.error(`Posted, but the state file could not be written (${e.message}): a restart today would post again`),
      );
      this.log.log(`Posted the poem of ${poem.date}: ${poem.slug}`);
      return true;
    } catch (e) {
      this.log.warn(`Poem of the day not posted: ${(e as Error).message}`);
      return false;
    } finally {
      this.running = false;
    }
  }

  private async send(text: string) {
    const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: this.channel, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(15_000),
    }).catch((e: Error) => {
      // fetch errors can quote the URL, which holds the token
      throw new Error(`request failed (${e.name})`);
    });
    if (!res.ok) throw new Error(`Telegram answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}
