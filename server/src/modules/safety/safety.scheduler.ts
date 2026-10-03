import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SafetyService } from './safety.service';
import { ESCALATE_AFTER, SafetySeverity, SafetyStatus, isReminderDue, meetingNudgesDue } from './safety-rules';

const TICK_MS = 5 * 60_000;

/**
 * "Notify until solved": re-notifies everyone following an open safety case at a
 * severity-based interval, and escalates to the Director after ESCALATE_AFTER reminders.
 * Runs in-process like the training EventsScheduler (no extra dependency).
 */
@Injectable()
export class SafetyScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SafetyScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly safety: SafetyService) {}

  onModuleInit() {
    if (process.env.SAFETY_SCHEDULER === 'off') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = Date.now()) {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.safety.openEvents();
      for (const ev of events) {
        const noShows = meetingNudgesDue({ ...ev, status: ev.status as SafetyStatus }, now);
        if (noShows.length) await this.safety.sendMeetingNudges(ev, noShows);
        const due = isReminderDue(
          {
            status: ev.status as SafetyStatus,
            severity: ev.severity as SafetySeverity,
            reportedAt: ev.reportedAt,
            lastNotifiedAt: ev.lastNotifiedAt,
          },
          now,
        );
        if (!due) continue;
        await this.safety.sendReminder(ev, (ev.notifyCount ?? 0) + 1 >= ESCALATE_AFTER);
      }
    } catch (err) {
      this.logger.error(`Safety scheduler failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
