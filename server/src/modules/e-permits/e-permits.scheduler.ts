import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EPermitsService } from './e-permits.service';

const TICK_MS = 60_000;

/**
 * Permit clock: 1 h-before-shift-end warnings, overdue alerts (never auto-closes), lapsed approvals
 * and overdue emergency post-reviews. In-process like the Safety scheduler; EPERMIT_SCHEDULER=off disables it.
 */
@Injectable()
export class EPermitsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EPermitsScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly permits: EPermitsService) {}

  onModuleInit() {
    if (process.env.EPERMIT_SCHEDULER === 'off') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    // Permits waiting for approval pick up any change to their location's concerned departments (e.g. a re-seed).
    setTimeout(() => {
      this.permits
        .syncPendingApprovals()
        .then((n) => n && this.logger.log(`Updated the clearances on ${n} pending permit(s)`))
        .catch((err: Error) => this.logger.error(`Clearance sync failed: ${err.message}`));
    }, 0);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = Date.now()) {
    if (this.running) return;
    this.running = true;
    try {
      await this.permits.tick(now);
    } catch (err) {
      this.logger.error(`E-Permit scheduler failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
