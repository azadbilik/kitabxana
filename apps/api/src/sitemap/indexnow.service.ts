import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SitemapService } from './sitemap.service';

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const LOCALES = ['az', 'ru', 'en'] as const;
/** IndexNow takes at most 10,000 URLs per request */
const BATCH = 10_000;
const FIRST_RUN_DELAY_MS = 2 * 60_000;
const INTERVAL_MS = 60 * 60_000;

type Snapshot = Record<string, string>; // url → updatedAt

/**
 * Tells IndexNow engines (Bing, Yandex, Seznam, Naver…) which pages changed.
 *
 * Every hour it compares the sitemap's URLs and their updatedAt with the last snapshot it
 * submitted, kept in a file on a volume, and submits new, changed and removed URLs. A diff
 * rather than "updated since the last run", because data reaches the live database by
 * dump copies whose updatedAt values can predate the last run. With no snapshot it
 * submits everything once. A failed batch stays out of the snapshot, so it is retried.
 *
 * Off unless SITE_URL and INDEXNOW_KEY are set; the web app serves the key at
 * /indexnow-key.txt, which must sit at the site root to cover every URL.
 */
@Injectable()
export class IndexNowService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(IndexNowService.name);
  private readonly site = process.env.SITE_URL?.replace(/\/$/, '');
  private readonly key = process.env.INDEXNOW_KEY;
  private readonly statePath = process.env.INDEXNOW_STATE ?? '/data/indexnow-state.json';
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(private sitemap: SitemapService) {}

  onApplicationBootstrap() {
    if (!this.site || !this.key) return;
    this.timers.push(
      setTimeout(() => void this.run(), FIRST_RUN_DELAY_MS),
      setInterval(() => void this.run(), INTERVAL_MS),
    );
  }

  onApplicationShutdown() {
    this.timers.forEach(clearTimeout);
  }

  /** Every public URL and its last change */
  private async current(): Promise<Snapshot> {
    const { authors, collections, works } = await this.sitemap.entries();
    const out: Snapshot = {};
    const add = (path: string, updatedAt: Date, locales: readonly string[] = LOCALES) => {
      for (const l of locales) out[`${this.site}/${l}${path}`] = new Date(updatedAt).toISOString();
    };
    for (const a of authors) add(`/authors/${a.slug}`, a.updatedAt);
    for (const c of collections) add(`/collections/${c.slug}`, c.updatedAt);
    for (const w of works) add(`/works/${w.slug}`, w.updatedAt, w.locales);
    return out;
  }

  private async load(): Promise<Snapshot> {
    try {
      return JSON.parse(await readFile(this.statePath, 'utf8'));
    } catch {
      return {};
    }
  }

  private async save(snapshot: Snapshot) {
    await mkdir(dirname(this.statePath), { recursive: true });
    const tmp = `${this.statePath}.tmp`;
    await writeFile(tmp, JSON.stringify(snapshot));
    await rename(tmp, this.statePath);
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      const [before, now] = await Promise.all([this.load(), this.current()]);
      const changed = Object.keys(now).filter((u) => before[u] !== now[u]);
      const removed = Object.keys(before).filter((u) => !(u in now));
      const urls = [...changed, ...removed];
      if (!urls.length) return;

      const next: Snapshot = { ...before };
      let sent = 0;
      for (let i = 0; i < urls.length; i += BATCH) {
        const batch = urls.slice(i, i + BATCH);
        if (!(await this.submit(batch))) break; // retry the rest next run
        for (const u of batch) {
          if (u in now) next[u] = now[u];
          else delete next[u];
        }
        sent += batch.length;
        await this.save(next);
      }
      this.log.log(`Submitted ${sent} of ${urls.length} URLs (${changed.length} new or changed, ${removed.length} removed)`);
    } catch (e) {
      this.log.warn(`IndexNow run failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async submit(urlList: string[]): Promise<boolean> {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(this.site!).host,
        key: this.key,
        keyLocation: `${this.site}/indexnow-key.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(60_000),
    }).catch((e: Error) => {
      this.log.warn(`IndexNow request failed: ${e.message}`);
      return null;
    });
    if (!res) return false;
    // 200 OK, 202 Accepted (key validation pending)
    if (res.ok) return true;
    this.log.warn(`IndexNow answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return false;
  }
}
