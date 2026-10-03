import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Community,
  CommunityDocument,
  EventPost,
  EventPostDocument,
  EventRsvp,
  EventRsvpDocument,
  RsvpStatus,
  TrainingEvent,
  TrainingEventDocument,
} from '../../../db/schemas/training';
import { NotificationsService, NotifyInput } from '../notifications/notifications.service';
import { PeopleService, Person } from './people.service';
import { CommunitiesService } from './communities.service';

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** "Thu, 8 Oct · 15:00 IST" */
export const fmtIst = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time} IST`;
};

const EDITABLE = [
  'title', 'type', 'description', 'agenda', 'topics', 'audience', 'coverUrl', 'communityId',
  'hostEmployeeIds', 'startsAt', 'endsAt', 'format', 'meetLink', 'venue', 'capacity',
  'waitlistEnabled', 'rsvpOpensAt', 'rsvpClosesAt', 'rsvpQuestion', 'recordingUrl',
] as const;
/** Changes to these notify everyone going / waitlisted. */
const LOGISTICS = ['startsAt', 'endsAt', 'format', 'venue', 'meetLink'] as const;

export type EventInput = Partial<Pick<TrainingEvent, (typeof EDITABLE)[number]>> & {
  publish?: boolean;
  repeat?: { every: 'week' | 'month'; count: number };
};

export type EventPostView = EventPost & { author?: Person };

export type EventListQuery = {
  viewerId?: string;
  view?: 'upcoming' | 'going' | 'past' | 'hosting';
  from?: string;
  to?: string;
  communityId?: string;
  hostId?: string;
  format?: string;
  topic?: string;
};

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(TrainingEvent.name) private eventModel: Model<TrainingEventDocument>,
    @InjectModel(EventRsvp.name) private rsvpModel: Model<EventRsvpDocument>,
    @InjectModel(EventPost.name) private postModel: Model<EventPostDocument>,
    @InjectModel(Community.name) private communityModel: Model<CommunityDocument>,
    private readonly people: PeopleService,
    private readonly communities: CommunitiesService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------------
  // Reads
  // ------------------------------------------------------------------

  private async load(id: string): Promise<TrainingEvent> {
    const ev = await this.eventModel.findOne({ id }).lean().exec();
    if (!ev) throw new NotFoundException(`Event ${id} not found`);
    return ev;
  }

  private assertHost(ev: TrainingEvent, actorId?: string) {
    if (!actorId || !ev.hostEmployeeIds.includes(actorId)) {
      throw new ForbiddenException('Only the event hosts can do this');
    }
  }

  /** Events + live counts + the viewer's RSVP. Meet link only for hosts and attendees. */
  private async decorate(events: TrainingEvent[], viewerId?: string) {
    const ids = events.map((e) => e.id);
    const [rsvps, communities] = await Promise.all([
      this.rsvpModel.find({ eventId: { $in: ids }, status: { $ne: 'cancelled' } }).lean().exec(),
      this.communityModel.find({ id: { $in: events.map((e) => e.communityId).filter(Boolean) } }).lean().exec(),
    ]);
    const communityById = new Map(communities.map((c) => [c.id, c]));
    const rows = events.map((ev) => {
      const mine = rsvps.filter((r) => r.eventId === ev.id);
      const goingRsvps = mine
        .filter((r) => r.status === 'going' || r.status === 'attended')
        .sort((a, b) => a.rsvpAt.localeCompare(b.rsvpAt));
      const my = viewerId ? mine.find((r) => r.employeeId === viewerId) : undefined;
      const isHost = Boolean(viewerId && ev.hostEmployeeIds.includes(viewerId));
      // Same rule as attendees(): only hosts and registered people see who is going
      const canSeeAttendees = isHost || ['going', 'waitlist', 'attended'].includes(my?.status ?? '');
      const previewIds = canSeeAttendees ? goingRsvps.slice(0, 3).map((r) => r.employeeId) : [];
      return { ev, mine, going: goingRsvps.length, my, isHost, previewIds };
    });
    const people = await this.people.many(
      rows.flatMap((r) => [...r.ev.hostEmployeeIds, ...r.previewIds]),
    );
    return rows.map(({ ev, mine, going, my, isHost, previewIds }) => {
      const waitlist = mine.filter((r) => r.status === 'waitlist').sort((a, b) => a.rsvpAt.localeCompare(b.rsvpAt));
      const canSeeLink = isHost || my?.status === 'going' || my?.status === 'attended';
      const community = ev.communityId ? communityById.get(ev.communityId) : undefined;
      const { remindersSent: _r, ...rest } = ev;
      return {
        ...rest,
        meetLink: canSeeLink ? ev.meetLink : undefined,
        hosts: ev.hostEmployeeIds.map((h) => people.get(h)).filter(Boolean) as Person[],
        attendeePreview: previewIds.map((p) => people.get(p)).filter(Boolean) as Person[],
        community: community ? { id: community.id, name: community.name, slug: community.slug } : undefined,
        goingCount: going,
        waitlistCount: waitlist.length,
        spotsLeft: Math.max(0, ev.capacity - going),
        isHost,
        myRsvp: my
          ? {
              id: my.id,
              status: my.status,
              answer: my.answer,
              waitlistPosition: my.status === 'waitlist' ? waitlist.findIndex((w) => w.id === my.id) + 1 : undefined,
            }
          : undefined,
      };
    });
  }

  async list(q: EventListQuery) {
    const now = new Date().toISOString();
    const filter: Record<string, unknown> = {};
    const and: Record<string, unknown>[] = [];

    if (q.view === 'hosting') {
      if (!q.viewerId) return [];
      filter.hostEmployeeIds = q.viewerId; // hosts see their drafts too
    } else {
      // Others see published / cancelled / completed, plus their own drafts if hosting
      and.push({ $or: [{ status: { $ne: 'draft' } }, ...(q.viewerId ? [{ hostEmployeeIds: q.viewerId }] : [])] });
    }
    if (q.view === 'upcoming') and.push({ endsAt: { $gte: now }, status: { $in: ['published', 'cancelled'] } });
    if (q.view === 'past') and.push({ $or: [{ endsAt: { $lt: now } }, { status: 'completed' }] });
    if (q.view === 'going') {
      if (!q.viewerId) return [];
      const mine = await this.rsvpModel
        .find({ employeeId: q.viewerId, status: { $in: ['going', 'waitlist', 'attended'] } })
        .lean()
        .exec();
      and.push({ id: { $in: mine.map((r) => r.eventId) } });
    }
    if (q.from) and.push({ startsAt: { $gte: q.from } });
    if (q.to) and.push({ startsAt: { $lte: q.to } });
    if (q.communityId) filter.communityId = q.communityId;
    if (q.hostId) and.push({ hostEmployeeIds: q.hostId });
    if (q.format) filter.format = q.format;
    if (q.topic) filter.topics = q.topic;
    if (and.length) filter.$and = and;

    const sort = q.view === 'past' ? { startsAt: -1 as const } : { startsAt: 1 as const };
    const events = await this.eventModel.find(filter).sort(sort).limit(200).lean().exec();
    return this.decorate(events, q.viewerId);
  }

  async get(id: string, viewerId?: string) {
    const ev = await this.load(id);
    if (ev.status === 'draft' && !(viewerId && ev.hostEmployeeIds.includes(viewerId))) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return (await this.decorate([ev], viewerId))[0];
  }

  /** Same community, host or topics; upcoming and published. */
  async similar(id: string, viewerId?: string, limit = 4) {
    const ev = await this.load(id);
    const events = await this.eventModel
      .find({
        id: { $ne: id },
        status: 'published',
        endsAt: { $gte: new Date().toISOString() },
        $or: [
          ...(ev.communityId ? [{ communityId: ev.communityId }] : []),
          { hostEmployeeIds: { $in: ev.hostEmployeeIds } },
          ...(ev.topics.length ? [{ topics: { $in: ev.topics } }] : []),
        ],
      })
      .sort({ startsAt: 1 })
      .limit(limit)
      .lean()
      .exec();
    return this.decorate(events, viewerId);
  }

  // ------------------------------------------------------------------
  // Host actions
  // ------------------------------------------------------------------

  private pick(input: EventInput): Partial<TrainingEvent> {
    const out: Record<string, unknown> = {};
    for (const k of EDITABLE) if (input[k] !== undefined) out[k] = input[k];
    return out as Partial<TrainingEvent>;
  }

  private validate(ev: Partial<TrainingEvent>) {
    if (!ev.title?.trim()) throw new BadRequestException('Title is required');
    if (!ev.startsAt || !ev.endsAt || isNaN(Date.parse(ev.startsAt)) || isNaN(Date.parse(ev.endsAt))) {
      throw new BadRequestException('Valid startsAt and endsAt are required');
    }
    if (ev.endsAt <= ev.startsAt) throw new BadRequestException('The event must end after it starts');
    if (!ev.capacity || ev.capacity < 1) throw new BadRequestException('Capacity must be at least 1');
    if (!ev.hostEmployeeIds?.length) throw new BadRequestException('At least one host is required');
    if (ev.format === 'in_person' && !ev.venue?.siteId) {
      throw new BadRequestException('In-plant events need the plant (venue.siteId)');
    }
    if (ev.format === 'online' && ev.venue) ev.venue = undefined;
  }

  async create(input: EventInput, actorId: string) {
    if (!(await this.people.isActiveMentor(actorId))) {
      throw new ForbiddenException('Only active mentors can create events');
    }
    const base: Partial<TrainingEvent> = {
      type: 'masterclass',
      format: 'online',
      waitlistEnabled: true,
      ...this.pick(input),
    };
    const hosts = base.hostEmployeeIds?.length ? base.hostEmployeeIds : [];
    base.hostEmployeeIds = [actorId, ...hosts.filter((h) => h !== actorId)];
    this.validate(base);

    const count = Math.min(Math.max(input.repeat?.count ?? 1, 1), 26);
    const seriesId = count > 1 ? newId('series') : undefined;
    const created: TrainingEvent[] = [];
    for (let i = 0; i < count; i++) {
      const shift = (iso?: string) => {
        if (!iso) return iso;
        const d = new Date(iso);
        if (input.repeat?.every === 'month') d.setMonth(d.getMonth() + i);
        else d.setDate(d.getDate() + 7 * i);
        return d.toISOString();
      };
      const doc = await this.eventModel.create({
        ...base,
        id: newId('evt'),
        seriesId,
        startsAt: shift(base.startsAt),
        endsAt: shift(base.endsAt),
        rsvpOpensAt: shift(base.rsvpOpensAt),
        rsvpClosesAt: shift(base.rsvpClosesAt),
        status: 'draft',
      });
      created.push(doc.toObject());
    }
    if (input.publish) for (const ev of created) await this.publish(ev.id, actorId);
    return this.decorate(await this.eventModel.find({ id: { $in: created.map((e) => e.id) } }).lean().exec(), actorId);
  }

  async update(id: string, input: EventInput, actorId: string) {
    const ev = await this.load(id);
    this.assertHost(ev, actorId);
    if (ev.status === 'cancelled' || ev.status === 'completed') {
      throw new BadRequestException(`A ${ev.status} event can't be edited`);
    }
    const patch = this.pick(input);
    if (patch.hostEmployeeIds && !patch.hostEmployeeIds.includes(actorId)) {
      throw new BadRequestException("You can't remove yourself as host");
    }
    const next = { ...ev, ...patch };
    this.validate(next);
    await this.eventModel.updateOne({ id }, patch).exec();

    const logisticsChanged = LOGISTICS.some((k) => JSON.stringify(ev[k]) !== JSON.stringify(next[k]));
    if (ev.status === 'published' && logisticsChanged) {
      // Re-arm reminders when the time moves
      if (ev.startsAt !== next.startsAt) await this.eventModel.updateOne({ id }, { remindersSent: [] }).exec();
      const ids = await this.rsvpEmployeeIds(id, ['going', 'waitlist']);
      const venue = await this.venueText(next);
      await this.notifications.notifyMany(
        ids.map((employeeId) => ({
          employeeId,
          kind: 'event_changed',
          title: `Updated: ${next.title}`,
          body: `The time or place has changed. Now: ${fmtIst(next.startsAt)}${next.format === 'in_person' ? ` · ${venue}` : ' · Online'}.`,
          href: `/training/events/${id}`,
          meta: { eventId: id },
        })),
      );
    }
    return this.get(id, actorId);
  }

  async publish(id: string, actorId: string) {
    const ev = await this.load(id);
    this.assertHost(ev, actorId);
    if (ev.status !== 'draft') throw new BadRequestException('Only drafts can be published');
    this.validate(ev);
    if (Date.parse(ev.startsAt) < Date.now()) throw new BadRequestException('This event is in the past');
    await this.eventModel.updateOne({ id }, { status: 'published' }).exec();

    // Community members + the matching audience, minus hosts
    const recipients = new Set<string>();
    if (ev.communityId) {
      for (const m of await this.communities.memberIds(ev.communityId)) recipients.add(m);
    }
    for (const p of await this.people.matching(ev.audience ?? {})) recipients.add(p.id);
    ev.hostEmployeeIds.forEach((h) => recipients.delete(h));
    const host = await this.people.one(ev.hostEmployeeIds[0]);
    await this.notifications.notifyMany(
      [...recipients].map((employeeId) => ({
        employeeId,
        kind: 'event_published',
        title: `New event: ${ev.title}`,
        body: `${host?.name ?? 'A mentor'} is hosting on ${fmtIst(ev.startsAt)}. ${ev.capacity} spots.`,
        href: `/training/events/${id}`,
        meta: { eventId: id },
      })),
    );
    return this.get(id, actorId);
  }

  async cancel(id: string, reason: string, actorId: string) {
    const ev = await this.load(id);
    this.assertHost(ev, actorId);
    if (!reason?.trim()) throw new BadRequestException('A reason is required');
    if (ev.status === 'cancelled' || ev.status === 'completed') {
      throw new BadRequestException(`This event is already ${ev.status}`);
    }
    await this.eventModel.updateOne({ id }, { status: 'cancelled', cancelReason: reason.trim() }).exec();
    if (ev.status === 'published') {
      const ids = await this.rsvpEmployeeIds(id, ['going', 'waitlist']);
      await this.notifications.notifyMany(
        ids.map((employeeId) => ({
          employeeId,
          kind: 'event_cancelled',
          title: `Cancelled: ${ev.title}`,
          body: `The event on ${fmtIst(ev.startsAt)} was cancelled. Reason: ${reason.trim()}`,
          href: `/training/events/${id}`,
          meta: { eventId: id },
        })),
      );
    }
    return this.get(id, actorId);
  }

  /** Copy as a new draft (same details, the host picks a new date before publishing). */
  async duplicate(id: string, actorId: string) {
    const ev = await this.load(id);
    this.assertHost(ev, actorId);
    const { id: _id, seriesId: _s, status: _st, cancelReason: _c, recordingUrl: _rec, remindersSent: _rs, ...rest } = ev as TrainingEvent & { _id?: unknown; createdAt?: unknown; updatedAt?: unknown };
    delete (rest as Record<string, unknown>)._id;
    delete (rest as Record<string, unknown>).createdAt;
    delete (rest as Record<string, unknown>).updatedAt;
    const doc = await this.eventModel.create({ ...rest, id: newId('evt'), status: 'draft', title: `${ev.title} (copy)` });
    return this.get(doc.id, actorId);
  }

  // ------------------------------------------------------------------
  // RSVP
  // ------------------------------------------------------------------

  private async rsvpEmployeeIds(eventId: string, statuses: RsvpStatus[]) {
    const rows = await this.rsvpModel.find({ eventId, status: { $in: statuses } }).lean().exec();
    return rows.map((r) => r.employeeId);
  }

  private async goingOrdered(eventId: string) {
    return this.rsvpModel
      .find({ eventId, status: { $in: ['going', 'attended'] } })
      .sort({ rsvpAt: 1, id: 1 })
      .lean()
      .exec();
  }

  private async notifyHosts(ev: TrainingEvent, input: Omit<NotifyInput, 'employeeId'>, exceptId?: string) {
    await this.notifications.notifyMany(
      ev.hostEmployeeIds.filter((h) => h !== exceptId).map((employeeId) => ({ ...input, employeeId })),
    );
  }

  private who(p?: Person) {
    if (!p) return 'An employee';
    const bits = [p.designation, p.siteName].filter(Boolean).join(', ');
    return bits ? `${p.name} (${bits})` : p.name;
  }

  async rsvp(id: string, employeeId: string, answer?: string) {
    if (!employeeId) throw new BadRequestException('employeeId is required');
    const ev = await this.load(id);
    const now = new Date().toISOString();
    if (ev.status !== 'published') throw new BadRequestException('This event is not open for registration');
    if (ev.endsAt < now) throw new BadRequestException('This event has ended');
    if (ev.rsvpOpensAt && now < ev.rsvpOpensAt) throw new BadRequestException(`Registration opens ${fmtIst(ev.rsvpOpensAt)}`);
    if (ev.rsvpClosesAt && now > ev.rsvpClosesAt) throw new BadRequestException('Registration is closed');
    if (ev.hostEmployeeIds.includes(employeeId)) throw new BadRequestException("Hosts don't need to RSVP");
    if (ev.rsvpQuestion && !answer?.trim()) throw new BadRequestException('Please answer the host’s question');

    const person = await this.people.one(employeeId);
    if (!person) throw new BadRequestException(`Employee ${employeeId} not found`);

    const existing = await this.rsvpModel.findOne({ eventId: id, employeeId }).exec();
    if (existing && ['going', 'waitlist', 'attended'].includes(existing.status)) {
      // Already in: only the answer can change
      if (answer !== undefined) {
        existing.answer = answer.trim();
        await existing.save();
      }
      return this.get(id, employeeId);
    }

    const goingNow = (await this.goingOrdered(id)).length;
    let status: RsvpStatus = goingNow < ev.capacity ? 'going' : 'waitlist';
    if (status === 'waitlist' && !ev.waitlistEnabled) throw new BadRequestException('This event is full');

    const rsvpAt = new Date().toISOString();
    let row: EventRsvpDocument;
    if (existing) {
      Object.assign(existing, { status, answer: answer?.trim(), rsvpAt });
      row = await existing.save();
    } else {
      row = await this.rsvpModel.create({ id: newId('rsvp'), eventId: id, employeeId, status, answer: answer?.trim(), rsvpAt });
    }

    // Two people may have taken the last seat at once: the later RSVP moves to the waitlist.
    if (status === 'going') {
      const ordered = await this.goingOrdered(id);
      const pos = ordered.findIndex((r) => r.id === row.id);
      if (pos >= ev.capacity) {
        if (ev.waitlistEnabled) {
          status = 'waitlist';
          await this.rsvpModel.updateOne({ id: row.id }, { status }).exec();
        } else {
          await this.rsvpModel.updateOne({ id: row.id }, { status: 'cancelled' }).exec();
          throw new BadRequestException('This event is full');
        }
      }
    }

    const goingCount = (await this.goingOrdered(id)).length;
    const when = fmtIst(ev.startsAt);
    if (status === 'going') {
      await this.notifyHosts(ev, {
        kind: 'event_rsvp_going',
        title: `${person.name} is going to ${ev.title}`,
        body: `${this.who(person)} is going to “${ev.title}” on ${when}. ${goingCount}/${ev.capacity} going.${answer?.trim() ? ` Answer: “${answer.trim()}”` : ''}`,
        href: `/training/mentor/events/${id}`,
        meta: { eventId: id, employeeId },
      });
      await this.notifications.notify({
        employeeId,
        kind: 'event_rsvp_confirmed',
        title: `You're going: ${ev.title}`,
        body: `${when}. ${ev.format === 'online' ? 'The Join link opens 10 minutes before the start.' : `At ${await this.venueText(ev)}.`}`,
        href: `/training/events/${id}`,
        meta: { eventId: id },
      });
    } else {
      await this.notifyHosts(ev, {
        kind: 'event_waitlist_joined',
        title: `${person.name} joined the waitlist`,
        body: `${this.who(person)} is on the waitlist for “${ev.title}” (${when}). The event is full (${ev.capacity}).`,
        href: `/training/mentor/events/${id}`,
        meta: { eventId: id, employeeId },
      });
    }
    return this.get(id, employeeId);
  }

  async cancelRsvp(id: string, employeeId: string) {
    const ev = await this.load(id);
    const row = await this.rsvpModel.findOne({ eventId: id, employeeId }).exec();
    if (!row || !['going', 'waitlist'].includes(row.status)) {
      throw new BadRequestException("You aren't registered for this event");
    }
    const wasGoing = row.status === 'going';
    row.status = 'cancelled';
    await row.save();

    if (ev.status === 'published') {
      const person = await this.people.one(employeeId);
      await this.notifyHosts(ev, {
        kind: 'event_rsvp_cancelled',
        title: `${person?.name ?? 'An employee'} can't make it`,
        body: `${this.who(person)} cancelled their RSVP for “${ev.title}” (${fmtIst(ev.startsAt)}).`,
        href: `/training/mentor/events/${id}`,
        meta: { eventId: id, employeeId },
      });
      if (wasGoing) await this.promoteFromWaitlist(ev);
    }
    return this.get(id, employeeId);
  }

  /** Fill free seats from the waitlist, oldest first. */
  private async promoteFromWaitlist(ev: TrainingEvent) {
    const going = (await this.goingOrdered(ev.id)).length;
    const free = ev.capacity - going;
    if (free <= 0) return;
    const next = await this.rsvpModel.find({ eventId: ev.id, status: 'waitlist' }).sort({ rsvpAt: 1, id: 1 }).limit(free).lean().exec();
    for (const w of next) {
      await this.rsvpModel.updateOne({ id: w.id, status: 'waitlist' }, { status: 'going' }).exec();
      await this.notifications.notify({
        employeeId: w.employeeId,
        kind: 'event_waitlist_promoted',
        title: `A spot opened: you're going to ${ev.title}`,
        body: `You moved off the waitlist for ${fmtIst(ev.startsAt)}.`,
        href: `/training/events/${ev.id}`,
        meta: { eventId: ev.id },
      });
    }
  }

  // ------------------------------------------------------------------
  // Attendees
  // ------------------------------------------------------------------

  /** Hosts: everyone with answers. Registered employees: people going. Nobody else. */
  async attendees(id: string, viewerId?: string) {
    const ev = await this.load(id);
    const isHost = Boolean(viewerId && ev.hostEmployeeIds.includes(viewerId));
    if (!isHost) {
      const mine = viewerId ? await this.rsvpModel.findOne({ eventId: id, employeeId: viewerId }).lean().exec() : null;
      if (!mine || !['going', 'waitlist', 'attended'].includes(mine.status)) {
        throw new ForbiddenException('Register for this event to see who is going');
      }
    }
    const rows = await this.rsvpModel
      .find({ eventId: id, ...(isHost ? {} : { status: { $in: ['going', 'attended'] } }) })
      .sort({ rsvpAt: 1 })
      .lean()
      .exec();
    const people = await this.people.many(rows.map((r) => r.employeeId));
    return rows.map((r) => ({
      ...(isHost ? { id: r.id, status: r.status, answer: r.answer, rsvpAt: r.rsvpAt } : {}),
      employee: people.get(r.employeeId) ?? { id: r.employeeId, name: r.employeeId, role: 'employee' },
    }));
  }

  /** Host: attended / no_show after the event, going (move off waitlist), cancelled (remove). */
  async updateAttendee(id: string, rsvpId: string, status: RsvpStatus, actorId: string) {
    const ev = await this.load(id);
    this.assertHost(ev, actorId);
    const row = await this.rsvpModel.findOne({ id: rsvpId, eventId: id }).exec();
    if (!row) throw new NotFoundException('RSVP not found');
    if ((status === 'attended' || status === 'no_show') && Date.parse(ev.startsAt) > Date.now()) {
      throw new BadRequestException('Attendance can be marked once the event has started');
    }
    const was = row.status;
    row.status = status;
    await row.save();

    if (was === 'waitlist' && status === 'going') {
      await this.notifications.notify({
        employeeId: row.employeeId,
        kind: 'event_waitlist_promoted',
        title: `You're going to ${ev.title}`,
        body: `The host moved you off the waitlist for ${fmtIst(ev.startsAt)}.`,
        href: `/training/events/${id}`,
        meta: { eventId: id },
      });
    }
    if (was === 'going' && status === 'cancelled') await this.promoteFromWaitlist(ev);
    return this.attendees(id, actorId);
  }

  async attendeesCsv(id: string, actorId: string) {
    const ev = await this.load(id);
    this.assertHost(ev, actorId);
    const rows = await this.attendees(id, actorId);
    const esc = (v?: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Name', 'Employee ID', 'Designation', 'Site', 'Status', 'RSVP at', 'Answer'].join(','),
      ...rows.map((r) =>
        [r.employee.name, r.employee.id, r.employee.designation, r.employee.siteName, r.status, r.rsvpAt, r.answer]
          .map((v) => esc(v as string | undefined))
          .join(','),
      ),
    ];
    return lines.join('\n');
  }

  // ------------------------------------------------------------------
  // Discussion
  // ------------------------------------------------------------------

  async posts(id: string): Promise<EventPostView[]> {
    await this.load(id);
    const posts = await this.postModel.find({ eventId: id }).sort({ pinned: -1, createdAt: -1 }).lean().exec();
    const authors = await this.people.many(posts.map((p) => p.authorEmployeeId));
    return posts.map((p) => ({ ...(p as EventPost), author: authors.get(p.authorEmployeeId) }));
  }

  async addPost(
    id: string,
    body: { authorEmployeeId: string; text: string; kind?: string; parentId?: string },
  ): Promise<EventPostView[]> {
    const ev = await this.load(id);
    const authorId = body.authorEmployeeId;
    const text = body.text?.trim();
    if (!authorId || !text) throw new BadRequestException('authorEmployeeId and text are required');
    const isHost = ev.hostEmployeeIds.includes(authorId);
    if (!isHost) {
      const r = await this.rsvpModel.findOne({ eventId: id, employeeId: authorId }).lean().exec();
      if (!r || !['going', 'attended'].includes(r.status)) {
        throw new ForbiddenException('Attend the event to join the discussion');
      }
    }
    const kind = body.kind === 'announcement' ? 'announcement' : body.kind === 'question' ? 'question' : 'comment';
    if (kind === 'announcement' && !isHost) throw new ForbiddenException('Only hosts can post announcements');

    await this.postModel.create({
      id: newId('post'),
      eventId: id,
      authorEmployeeId: authorId,
      text,
      kind,
      parentId: body.parentId,
      pinned: kind === 'announcement',
    });

    const author = await this.people.one(authorId);
    if (kind === 'announcement') {
      const ids = await this.rsvpEmployeeIds(id, ['going']);
      await this.notifications.notifyMany(
        ids.map((employeeId) => ({
          employeeId,
          kind: 'event_announcement',
          title: `${ev.title}: message from ${author?.name ?? 'the host'}`,
          body: text,
          href: `/training/events/${id}`,
          meta: { eventId: id },
        })),
      );
    } else if (!isHost && kind === 'question') {
      await this.notifyHosts(ev, {
        kind: 'event_post_question',
        title: `New question on ${ev.title}`,
        body: `${this.who(author)}: “${text}”`,
        href: `/training/events/${id}#discussion`,
        meta: { eventId: id, employeeId: authorId },
      });
    }
    return this.posts(id);
  }

  async pinPost(id: string, postId: string, pinned: boolean, actorId: string): Promise<EventPostView[]> {
    const ev = await this.load(id);
    this.assertHost(ev, actorId);
    const res = await this.postModel.updateOne({ id: postId, eventId: id }, { pinned }).exec();
    if (!res.matchedCount) throw new NotFoundException('Post not found');
    return this.posts(id);
  }

  /** "ETP Plant · Control room" */
  async venueText(ev: Pick<TrainingEvent, 'format' | 'venue'>): Promise<string> {
    if (ev.format !== 'in_person' || !ev.venue?.siteId) return 'Online';
    const site = await this.people.siteName(ev.venue.siteId);
    return [site ?? ev.venue.siteId, ev.venue.room].filter(Boolean).join(' · ');
  }

  /** Attendance report per event (Academic Records → Reports). */
  async attendanceReport(q: { from?: string; to?: string }) {
    const filter: Record<string, unknown> = { status: { $in: ['published', 'completed', 'cancelled'] } };
    if (q.from || q.to) filter.startsAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
    const events = await this.eventModel.find(filter).sort({ startsAt: -1 }).lean().exec();
    const rsvps = await this.rsvpModel.find({ eventId: { $in: events.map((e) => e.id) } }).lean().exec();
    const hosts = await this.people.many(events.flatMap((e) => e.hostEmployeeIds));
    const communities = await this.communityModel.find().lean().exec();
    return events.map((e) => {
      const rows = rsvps.filter((r) => r.eventId === e.id);
      const count = (s: string) => rows.filter((r) => r.status === s).length;
      return {
        id: e.id,
        title: e.title,
        status: e.status,
        startsAt: e.startsAt,
        format: e.format,
        capacity: e.capacity,
        host: hosts.get(e.hostEmployeeIds[0])?.name ?? e.hostEmployeeIds[0],
        community: communities.find((c) => c.id === e.communityId)?.name,
        going: count('going'),
        waitlist: count('waitlist'),
        attended: count('attended'),
        noShow: count('no_show'),
        cancelled: count('cancelled'),
      };
    });
  }

  /** Attended events count as a training stage (hours), not as a certificate stage. */
  async trainingHours(employeeId: string) {
    const rows = await this.rsvpModel.find({ employeeId, status: 'attended' }).lean().exec();
    const events = await this.eventModel.find({ id: { $in: rows.map((r) => r.eventId) } }).lean().exec();
    const hours = events.reduce((sum, e) => sum + (Date.parse(e.endsAt) - Date.parse(e.startsAt)) / 3_600_000, 0);
    return {
      employeeId,
      eventsAttended: events.length,
      hours: Math.round(hours * 10) / 10,
      events: events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt })),
    };
  }

  // ------------------------------------------------------------------
  // Calendar
  // ------------------------------------------------------------------

  async ics(id: string) {
    const ev = await this.load(id);
    const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
    const where = ev.format === 'online' ? 'Online (Google Meet)' : await this.venueText(ev);
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Nectar Enviro//Training Events//EN',
      'BEGIN:VEVENT',
      `UID:${ev.id}@nectarenviro`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(new Date(ev.startsAt).toISOString())}`,
      `DTEND:${stamp(new Date(ev.endsAt).toISOString())}`,
      `SUMMARY:${esc(ev.title)}`,
      `DESCRIPTION:${esc(ev.description ?? '')}`,
      `LOCATION:${esc(where)}`,
      ev.status === 'cancelled' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }
}
