import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const FIRST_RUN_DELAY_MS = 60_000;
const INTERVAL_MS = 60 * 60_000;
/** Sign-in codes are kept an hour past expiry: the hourly cap counts recent ones */
const CODE_GRACE_MS = 60 * 60_000;

/** Hourly: drops expired reader sessions and spent sign-in codes, which nothing else removes */
@Injectable()
export class CleanupService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(CleanupService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(private prisma: PrismaService) {}

  onApplicationBootstrap() {
    this.timers.push(
      setTimeout(() => void this.run(), FIRST_RUN_DELAY_MS),
      setInterval(() => void this.run(), INTERVAL_MS),
    );
    this.timers.forEach((t) => t.unref());
  }

  onApplicationShutdown() {
    this.timers.forEach(clearTimeout);
  }

  async run(now = new Date()) {
    try {
      const [sessions, codes] = await Promise.all([
        this.prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
        this.prisma.loginCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - CODE_GRACE_MS) } } }),
      ]);
      if (sessions.count || codes.count) this.log.log(`Removed ${sessions.count} expired sessions, ${codes.count} old sign-in codes`);
      return { sessions: sessions.count, codes: codes.count };
    } catch (e) {
      this.log.warn(`Cleanup failed: ${(e as Error).message}`);
      return null;
    }
  }
}
