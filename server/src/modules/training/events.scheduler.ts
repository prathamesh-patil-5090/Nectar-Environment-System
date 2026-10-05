import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EventRsvp,
  EventRsvpDocument,
  TrainingEvent,
  TrainingEventDocument,
} from '../../../db/schemas/training';
import { NotificationsService } from '../notifications/notifications.service';
import { fmtIst } from './events.service';
import { PeopleService } from './people.service';

const MIN = 60_000;
/** Hosts get the complete attendee list this long before the start. */
const ROSTER_BEFORE = 48 * 60 * MIN;

/** Each reminder fires once, when "now" is inside its window before the start. */
const REMINDERS = [
  { key: '1d', before: 24 * 60 * MIN },
  { key: '1h', before: 60 * MIN },
  { key: 'start', before: 10 * MIN },
] as const;

/**
 * Event reminders, "starting now" alerts, auto-complete after the end and the feedback request.
 * Runs every minute in-process (no extra dependency).
 */
@Injectable()
export class EventsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectModel(TrainingEvent.name) private eventModel: Model<TrainingEventDocument>,
    @InjectModel(EventRsvp.name) private rsvpModel: Model<EventRsvpDocument>,
    private readonly notifications: NotificationsService,
    private readonly people: PeopleService,
  ) {}

  onModuleInit() {
    if (process.env.EVENT_SCHEDULER === 'off') return;
    this.timer = setInterval(() => void this.tick(), MIN);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = Date.now()) {
    if (this.running) return;
    this.running = true;
    try {
      const soon = new Date(now + ROSTER_BEFORE).toISOString();
      const events = await this.eventModel
        .find({ status: 'published', startsAt: { $lte: soon } })
        .lean()
        .exec();
      for (const ev of events) await this.handle(ev, now);
    } catch (err) {
      this.logger.error(`Event scheduler failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async handle(ev: TrainingEvent, now: number) {
    const start = Date.parse(ev.startsAt);
    const end = Date.parse(ev.endsAt);
    const sent = new Set(ev.remindersSent ?? []);
    const going = (await this.rsvpModel.find({ eventId: ev.id, status: 'going' }).lean().exec()).map((r) => r.employeeId);

    if (now >= end) {
      await this.eventModel.updateOne({ id: ev.id }, { status: 'completed', $addToSet: { remindersSent: 'feedback' } }).exec();
      if (!sent.has('feedback')) {
        await this.notifications.notifyMany(
          going.map((employeeId) => ({
            employeeId,
            kind: 'event_feedback_request',
            title: `How was ${ev.title}?`,
            body: 'Tell the host what helped and what to cover next time.',
            href: `/training/events/${ev.id}#feedback`,
            meta: { eventId: ev.id },
          })),
        );
      }
      return;
    }

    if (!sent.has('roster') && now >= start - ROSTER_BEFORE && now < start) {
      const people = await this.people.many(going);
      const names = going.map((id) => {
        const p = people.get(id);
        return p ? `${p.name}${p.designation ? ` (${p.designation})` : ''}` : id;
      });
      await this.notifications.notifyMany(
        ev.hostEmployeeIds.map((employeeId) => ({
          employeeId,
          kind: 'event_roster',
          title: `Attendee list: ${ev.title}`,
          body: `${going.length}/${ev.capacity} going · ${fmtIst(ev.startsAt)}${names.length ? `\n${names.join(', ')}` : '\nNobody has registered yet.'}`,
          href: `/training/mentor/events/${ev.id}`,
          meta: { eventId: ev.id },
        })),
      );
      await this.eventModel.updateOne({ id: ev.id }, { $addToSet: { remindersSent: 'roster' } }).exec();
    }

    if (now < start - 24 * 60 * MIN) return;

    for (const r of REMINDERS) {
      if (sent.has(r.key) || now < start - r.before || now >= start) continue;
      // Skip a longer reminder if a shorter one is already due (e.g. event created 30 min before start)
      const shorterDue = REMINDERS.some((o) => o.before < r.before && now >= start - o.before);
      if (shorterDue) {
        await this.eventModel.updateOne({ id: ev.id }, { $addToSet: { remindersSent: r.key } }).exec();
        continue;
      }
      const isStart = r.key === 'start';
      const mins = Math.max(1, Math.round((start - now) / MIN));
      const label = mins >= 120 ? `in ${Math.round(mins / 60)} hours` : mins >= 60 ? 'in 1 hour' : `in ${mins} minutes`;
      await this.notifications.notifyMany([
        ...going.map((employeeId) => ({
          employeeId,
          kind: isStart ? 'event_starting' : 'event_reminder',
          title: isStart ? `Starting soon: ${ev.title}` : `Reminder: ${ev.title} ${label}`,
          body: isStart && ev.format === 'online' ? 'The Join link is open now.' : fmtIst(ev.startsAt),
          href: `/training/events/${ev.id}`,
          meta: { eventId: ev.id },
        })),
        ...ev.hostEmployeeIds.map((employeeId) => ({
          employeeId,
          kind: 'event_reminder',
          title: `You're hosting ${ev.title} ${label}`,
          body: `${going.length}/${ev.capacity} going · ${fmtIst(ev.startsAt)}`,
          href: `/training/mentor/events/${ev.id}`,
          meta: { eventId: ev.id },
        })),
      ]);
      await this.eventModel.updateOne({ id: ev.id }, { $addToSet: { remindersSent: r.key } }).exec();
    }
  }
}
