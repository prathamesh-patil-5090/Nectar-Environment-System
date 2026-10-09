import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  SafetyEvent,
  SafetyEventDocument,
  SafetyPersonRef,
  SafetyTimelineEntry,
} from '../../../db/schemas/safety-event.schema';
import {
  SafetyProtocol,
  SafetyProtocolDocument,
} from '../../../db/schemas/safety-protocol.schema';
import { Employee, EmployeeDocument } from '../../../db/schemas/employee.schema';
import { Leader, LeaderDocument } from '../../../db/schemas/leader.schema';
import {
  LeaveRequest,
  LeaveRequestDocument,
} from '../../../db/schemas/leave-request.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { EPermitsService } from '../e-permits/e-permits.service';
import {
  SAFETY_CATEGORY_LABELS,
  SAFETY_STATUSES,
  SAFETY_STATUS_LABELS,
  SAFETY_TYPE_LABELS,
  SafetyAction,
  SafetyCategory,
  SafetyEventType,
  SafetySeverity,
  SafetyStatus,
  OPEN_STATUSES,
  actionForStatus,
  assertSafetyTransition,
  canJoinSafetyCall,
  canActOnSafetyCase,
  clearanceAction,
  closeBlocker,
  defaultRequiresClearance,
  effectiveSeverity,
  normalizeSafetyRole,
  reportActionFor,
  resolveBlocker,
  safetyCan,
} from './safety-rules';

/** Who is acting. `id` = employee id, or "user:<email>" for logins without one. */
export type SafetyActorInput = { id: string; name: string; role: string; siteId?: string };

const TYPES: SafetyEventType[] = ['incident', 'near_miss', 'breakdown'];
const CATEGORIES = Object.keys(SAFETY_CATEGORY_LABELS) as SafetyCategory[];
const SEVERITIES: SafetySeverity[] = ['low', 'medium', 'high', 'critical'];

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;

const nowIso = () => new Date().toISOString();

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const idList = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()))] : [];

const EMPLOYEE_ROLE: Record<string, string> = {
  manager: 'manager',
  shift_incharge: 'shift_incharge',
  supervisor: 'supervisor',
  hr: 'hr',
};

@Injectable()
export class SafetyService {
  constructor(
    @InjectModel(SafetyEvent.name) private eventModel: Model<SafetyEventDocument>,
    @InjectModel(SafetyProtocol.name) private protocolModel: Model<SafetyProtocolDocument>,
    @InjectModel(Employee.name) private employeeModel: Model<EmployeeDocument>,
    @InjectModel(Leader.name) private leaderModel: Model<LeaderDocument>,
    @InjectModel(LeaveRequest.name) private leaveModel: Model<LeaveRequestDocument>,
    private readonly notifications: NotificationsService,
    private readonly ePermits: EPermitsService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private actor(raw: unknown): SafetyActorInput {
    const a = (raw ?? {}) as Partial<SafetyActorInput>;
    if (!a.id || !a.name || !a.role) {
      throw new BadRequestException('actor { id, name, role } is required');
    }
    return { id: String(a.id), name: String(a.name), role: normalizeSafetyRole(a.role), siteId: a.siteId || undefined };
  }

  private require(actor: SafetyActorInput, action: SafetyAction, siteId?: string) {
    if (!safetyCan(action, actor, siteId)) {
      throw new ForbiddenException(`Your role (${actor.role}) cannot perform "${action}" on this site`);
    }
  }

  /** Anyone can read a case, but only people on it act on it — plain employees only on cases they are named on. */
  private requireOnCase(actor: SafetyActorInput, ev: SafetyEvent) {
    if (!canActOnSafetyCase(actor, ev)) throw new ForbiddenException('You are not on this safety case');
  }

  /** The meeting link only goes to people who may join it. */
  private present<T extends SafetyEvent>(ev: T, viewer: SafetyActorInput): T {
    return canJoinSafetyCall(viewer, ev) ? ev : { ...ev, meetLink: undefined };
  }

  private entry(
    actor: SafetyActorInput,
    kind: SafetyTimelineEntry['kind'],
    title: string,
    detail?: string,
  ): SafetyTimelineEntry {
    return { at: nowIso(), actorId: actor.id, actorName: actor.name, actorRole: actor.role, kind, title, detail };
  }

  private async load(id: string): Promise<SafetyEvent> {
    const ev = await this.eventModel.findOne({ id }).lean().exec();
    if (!ev) throw new NotFoundException(`Safety event ${id} not found`);
    return ev;
  }

  private async apply(id: string, set: Record<string, unknown>, timeline: SafetyTimelineEntry[]) {
    const updated = await this.eventModel
      .findOneAndUpdate({ id }, { $set: set, $push: { timeline: { $each: timeline } } }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(`Safety event ${id} not found`);
    return updated;
  }

  /**
   * Responsible for every case: the site's manager, supervisor (Site Manager) and shift in-charge,
   * plus HR, the Director and the Safety In-charge. From the DB.
   */
  async stakeholdersFor(siteId: string): Promise<SafetyPersonRef[]> {
    const [siteLeads, hr, leaders] = await Promise.all([
      this.employeeModel
        .find({ siteId, employeeCategory: { $in: ['manager', 'supervisor', 'shift_incharge'] }, employmentStatus: { $ne: 'inactive' } })
        .lean()
        .exec(),
      this.employeeModel.find({ employeeCategory: 'hr', employmentStatus: { $ne: 'inactive' } }).lean().exec(),
      this.leaderModel.find({ active: true, role: { $in: ['director', 'safety_incharge', 'hr'] } }).lean().exec(),
    ]);
    const out = new Map<string, SafetyPersonRef>();
    for (const e of [...siteLeads, ...hr]) {
      out.set(e.id, { personId: e.id, name: e.name, role: EMPLOYEE_ROLE[(e as any).employeeCategory] ?? 'employee' });
    }
    for (const l of leaders) out.set(l.id, { personId: l.id, name: l.name, role: l.role });
    return [...out.values()];
  }

  private async siteEmployeeIds(siteId: string): Promise<string[]> {
    const rows = await this.employeeModel
      .find({ siteId, employmentStatus: { $ne: 'inactive' } }, { id: 1 })
      .lean()
      .exec();
    return rows.map((r) => r.id);
  }

  /** Everyone who follows this event: stakeholders + involved + informers + reporter. */
  private followers(ev: SafetyEvent): string[] {
    return [
      ...new Set([
        ...ev.stakeholders.map((s) => s.personId),
        ...ev.involved,
        ...ev.informedBy,
        ev.reportedBy?.personId,
      ].filter(Boolean)),
    ];
  }

  private async notify(
    personIds: string[],
    exclude: string | undefined,
    kind: string,
    title: string,
    body: string,
    ev: SafetyEvent,
  ) {
    const targets = [...new Set(personIds)].filter((p) => p && p !== exclude);
    if (!targets.length) return;
    await this.notifications.notifyMany(
      targets.map((employeeId) => ({
        employeeId,
        kind,
        title,
        body,
        href: `/safety/incidents/${ev.id}`,
        meta: { eventId: ev.id, siteId: ev.siteId, severity: ev.severity },
      })),
    );
  }

  private label(ev: SafetyEvent) {
    return `${SAFETY_TYPE_LABELS[ev.type as SafetyEventType]} · ${ev.title}`;
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  /** Every case is visible to everyone; only the meeting link is kept from people not on the case. */
  async list(q: { siteId?: string; type?: string; status?: string; employeeId?: string }, viewerRaw: unknown) {
    const viewer = this.actor(viewerRaw);
    const filter: Record<string, unknown> = {};
    if (q.siteId) filter.siteId = q.siteId;
    if (q.type) filter.type = q.type;
    if (q.status) filter.status = q.status;
    if (q.employeeId) filter.$or = [{ involved: q.employeeId }, { informedBy: q.employeeId }];
    const rows = await this.eventModel.find(filter).sort({ reportedAt: -1 }).limit(500).lean().exec();
    return rows.map((ev) => this.present(ev, viewer));
  }

  async get(id: string, viewerRaw: unknown) {
    return this.present(await this.load(id), this.actor(viewerRaw));
  }

  /** Employees with a pending return-to-work clearance (used by the leave close gate). */
  async pendingClearances(employeeId?: string) {
    const match: Record<string, unknown> = { status: 'pending' };
    if (employeeId) match.employeeId = employeeId;
    const events = await this.eventModel
      .find({ clearance: { $elemMatch: match } }, { id: 1, title: 1, type: 1, siteId: 1, clearance: 1 })
      .lean()
      .exec();
    return events.flatMap((ev) =>
      ev.clearance
        .filter((c) => c.status === 'pending' && (!employeeId || c.employeeId === employeeId))
        .map((c) => ({ eventId: ev.id, title: ev.title, siteId: ev.siteId, employeeId: c.employeeId })),
    );
  }

  /** Open emergency broadcasts this person has not acknowledged yet. */
  async activeEmergencies(personId: string) {
    if (!personId) return [];
    return this.eventModel
      .find({
        isEmergency: true,
        status: { $nin: ['RESOLVED', 'CLOSED'] },
        emergencyRecipients: personId,
        emergencyAcks: { $ne: personId },
      })
      .sort({ reportedAt: -1 })
      .lean()
      .exec();
  }

  // ── Create ───────────────────────────────────────────────────────────────

  async create(body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const type = body.type as SafetyEventType;
    if (!TYPES.includes(type)) throw new BadRequestException('type must be incident, near_miss or breakdown');
    const siteId = str(body.siteId, 64);
    if (!siteId) throw new BadRequestException('siteId is required');
    this.require(actor, reportActionFor(type), siteId);

    const title = str(body.title, 200);
    if (!title) throw new BadRequestException('title is required');
    const category = (CATEGORIES.includes(body.category) ? body.category : type === 'breakdown' ? 'plant_problem' : 'other') as SafetyCategory;
    const severity = effectiveSeverity(
      category,
      (SEVERITIES.includes(body.severity) ? body.severity : 'medium') as SafetySeverity,
    );

    const categoryOther = category === 'other' ? str(body.categoryOther, 120) : '';

    // involved = people it happened to (or nearly happened to); informedBy = people who saw it or informed. Both can be many.
    const involved = idList(body.involved);
    const informedBy = idList(body.informedBy);
    if (type !== 'breakdown' && !involved.length) {
      throw new BadRequestException('Choose at least one person it happened to (or nearly happened to)');
    }
    if (involved.length > 100 || informedBy.length > 100) throw new BadRequestException('Too many people on one report');
    const known = await this.employeeModel.find({ id: { $in: [...involved, ...informedBy] } }, { id: 1 }).lean().exec();
    const knownIds = new Set(known.map((k) => k.id));
    const unknown = [...involved, ...informedBy].filter((p) => !knownIds.has(p));
    if (unknown.length) throw new BadRequestException(`Unknown employee id(s): ${unknown.join(', ')}`);

    const requiresReturnClearance =
      typeof body.requiresReturnClearance === 'boolean'
        ? body.requiresReturnClearance && type === 'incident'
        : defaultRequiresClearance(type, category, severity);

    const stakeholders = await this.stakeholdersFor(siteId);
    const isEmergency = Boolean(body.isEmergency);
    const now = nowIso();
    const id = newId(type === 'breakdown' ? 'bd' : type === 'near_miss' ? 'nm' : 'inc');

    const doc: Partial<SafetyEvent> = {
      id,
      type,
      siteId,
      title,
      description: str(body.description),
      location: str(body.location, 200),
      occurredAt: str(body.occurredAt, 40) || now,
      reportedAt: now,
      category,
      ...(categoryOther ? { categoryOther } : {}),
      severity,
      status: 'REPORTED',
      reportedBy: { personId: actor.id, name: actor.name, role: actor.role },
      informedBy,
      involved,
      stakeholders,
      media: [],
      rootCause: '',
      correctiveActions: [],
      timeline: [this.entry(actor, 'created', `${SAFETY_TYPE_LABELS[type]} reported`, isEmergency ? 'Emergency broadcast sent' : undefined)],
      isEmergency,
      emergencyRecipients: [],
      emergencyAcks: [],
      lastNotifiedAt: now,
      notifyCount: 0,
      linkedLeaveIds: [],
      requiresReturnClearance,
      clearance: requiresReturnClearance ? involved.map((employeeId) => ({ employeeId, status: 'pending' as const })) : [],
      otEntries: [],
      otDecisionIds: [],
    };
    if (type === 'breakdown') {
      doc.equipment = str(body.equipment, 200);
      doc.whatFailed = str(body.whatFailed, 1000);
      doc.why = str(body.why, 2000);
      doc.how = str(body.how, 2000);
      doc.failedAt = str(body.failedAt, 40) || doc.occurredAt;
      doc.restoredAt = str(body.restoredAt, 40) || undefined;
    }
    if (isEmergency) {
      doc.emergencyRecipients = [
        ...new Set([...stakeholders.map((s) => s.personId), ...involved, ...informedBy, ...(await this.siteEmployeeIds(siteId))]),
      ];
      doc.emergencyAcks = [actor.id];
    }

    const created = (await this.eventModel.create(doc)).toObject() as SafetyEvent;

    const what = `${SAFETY_CATEGORY_LABELS[category]}${categoryOther ? ` — ${categoryOther}` : ''} · ${severity}`;
    if (isEmergency) {
      // Permits are not valid in an emergency: stop all permitted work at the site until the Authoriser re-validates
      await this.ePermits.suspendAllAtSite(siteId, actor, `Safety emergency: ${title}`).catch(() => undefined);
      await this.notify(created.emergencyRecipients, actor.id, 'safety_emergency', `EMERGENCY: ${title}`,
        `${what}. Reported by ${actor.name}${created.location ? ` at ${created.location}` : ''}. Open and acknowledge.`, created);
    } else {
      await this.notify(this.followers(created), actor.id, `safety_${type}`, `${SAFETY_TYPE_LABELS[type]} reported: ${title}`,
        `${what}. Reported by ${actor.name}.`, created);
    }
    return created;
  }

  // ── Updates ──────────────────────────────────────────────────────────────

  async updateDetails(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const ev = await this.load(id);
    this.requireOnCase(actor, ev);
    this.require(actor, ev.type === 'breakdown' ? 'updateBreakdown' : 'investigate', ev.siteId);

    const set: Record<string, unknown> = {};
    const changed: string[] = [];
    const text = (key: string, max = 4000) => {
      if (typeof body[key] === 'string' && body[key].trim() !== (ev as any)[key]) {
        set[key] = str(body[key], max);
        changed.push(key);
      }
    };
    text('title', 200);
    text('description');
    text('location', 200);
    text('rootCause');
    if (ev.type === 'breakdown') {
      text('equipment', 200);
      text('whatFailed', 1000);
      text('why', 2000);
      text('how', 2000);
      text('failedAt', 40);
      if (typeof body.restoredAt === 'string') {
        set.restoredAt = str(body.restoredAt, 40) || null;
        changed.push('restoredAt');
      }
      if (Array.isArray(body.otEntries)) {
        const entries = body.otEntries
          .filter((e: any) => e && typeof e.employeeId === 'string' && Number(e.hours) > 0)
          .map((e: any) => ({
            employeeId: e.employeeId,
            hours: Math.min(24 * 31, Number(e.hours)),
            date: str(e.date, 40) || undefined,
            otDecisionId: str(e.otDecisionId, 80) || undefined,
          }));
        set.otEntries = entries;
        set.otDecisionIds = [
          ...new Set([...(ev.otDecisionIds ?? []), ...entries.map((e: any) => e.otDecisionId).filter(Boolean)]),
        ];
        changed.push('otEntries');
      }
      const linkOt = str(body.linkOtDecisionId, 80);
      if (linkOt && !(ev.otDecisionIds ?? []).includes(linkOt)) {
        const base = (set.otDecisionIds as string[] | undefined) ?? ev.otDecisionIds ?? [];
        set.otDecisionIds = [...new Set([...base, linkOt])];
        changed.push(`OT decision ${linkOt} raised`);
      }
    }
    let category = ev.category as SafetyCategory;
    let severity = ev.severity as SafetySeverity;
    if (CATEGORIES.includes(body.category) && body.category !== ev.category) {
      category = body.category;
      set.category = category;
      changed.push('category');
    }
    if (SEVERITIES.includes(body.severity) && body.severity !== ev.severity) {
      severity = body.severity;
      changed.push('severity');
    }
    severity = effectiveSeverity(category, severity);
    if (severity !== ev.severity) set.severity = severity;

    const unset: Record<string, ''> = {};
    if (category === 'other') {
      if (typeof body.categoryOther === 'string' && str(body.categoryOther, 120) !== (ev.categoryOther ?? '')) {
        set.categoryOther = str(body.categoryOther, 120);
        changed.push('hazard');
      }
    } else if (ev.categoryOther) {
      unset.categoryOther = '';
    }

    // People it happened to / who saw it — can be added after the report is filed
    let involved = ev.involved;
    const people: string[] = [];
    if (Array.isArray(body.involved)) {
      const next = idList(body.involved);
      if (ev.type !== 'breakdown' && !next.length) {
        throw new BadRequestException('Keep at least one person it happened to');
      }
      if (next.join(',') !== ev.involved.join(',')) {
        involved = next;
        set.involved = next;
        people.push(...next);
        changed.push('people affected');
      }
    }
    if (Array.isArray(body.informedBy)) {
      const next = idList(body.informedBy);
      if (next.join(',') !== ev.informedBy.join(',')) {
        set.informedBy = next;
        people.push(...next);
        changed.push('witnesses');
      }
    }
    if (people.length) {
      if (involved.length > 100 || ((set.informedBy as string[] | undefined)?.length ?? 0) > 100) {
        throw new BadRequestException('Too many people on one report');
      }
      const known = await this.employeeModel.find({ id: { $in: people } }, { id: 1 }).lean().exec();
      const knownIds = new Set(known.map((k) => k.id));
      const unknown = [...new Set(people)].filter((p) => !knownIds.has(p));
      if (unknown.length) throw new BadRequestException(`Unknown employee id(s): ${unknown.join(', ')}`);
    }

    // Turning a case serious adds pending clearance for involved people (never silently removes it);
    // people added to a case that already needs clearance get it too.
    const needsClearance =
      ev.requiresReturnClearance || defaultRequiresClearance(ev.type as SafetyEventType, category, severity);
    if (needsClearance) {
      const have = new Set(ev.clearance.map((c) => c.employeeId));
      const added = involved.filter((e) => !have.has(e));
      if (!ev.requiresReturnClearance) set.requiresReturnClearance = true;
      if (added.length || !ev.requiresReturnClearance) {
        set.clearance = [...ev.clearance, ...added.map((employeeId) => ({ employeeId, status: 'pending' }))];
      }
    }
    if (!changed.length) return ev;
    const updated = await this.eventModel
      .findOneAndUpdate(
        { id },
        {
          $set: set,
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
          $push: { timeline: this.entry(actor, 'edit', 'Details updated', changed.join(', ')) },
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(`Safety event ${id} not found`);
    const newcomers = people.filter((p) => !this.followers(ev).includes(p));
    if (newcomers.length) {
      await this.notify(newcomers, actor.id, `safety_${ev.type}`, `Added to ${this.label(ev)}`,
        `${actor.name} added you to this safety case.`, updated);
    }
    return updated;
  }

  async changeStatus(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const next = body.status as SafetyStatus;
    if (!SAFETY_STATUSES.includes(next)) throw new BadRequestException('Unknown status');
    const ev = await this.load(id);
    this.requireOnCase(actor, ev);
    this.require(actor, actionForStatus(next), ev.siteId);
    try {
      assertSafetyTransition(ev.status as SafetyStatus, next);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const remark = str(body.remark, 2000);
    if (next === 'RESOLVED') {
      const blocker = resolveBlocker(ev);
      if (blocker) throw new ConflictException(`Cannot resolve: ${blocker}`);
    }
    if (next === 'CLOSED') {
      const blocker = closeBlocker(ev);
      if (blocker) throw new ConflictException(`Cannot close: ${blocker}`);
    }
    if (next === 'REOPENED' && !remark) throw new BadRequestException('A reason is required to reopen');

    const set: Record<string, unknown> = { status: next };
    if (next === 'REOPENED') {
      set.lastNotifiedAt = nowIso();
      set.notifyCount = 0;
      set.escalatedAt = null;
    }
    const updated = await this.apply(id, set, [
      this.entry(actor, 'status', `${SAFETY_STATUS_LABELS[ev.status as SafetyStatus]} → ${SAFETY_STATUS_LABELS[next]}`, remark || undefined),
    ]);
    await this.notify(this.followers(updated), actor.id, 'safety_status', `${SAFETY_STATUS_LABELS[next]}: ${updated.title}`,
      `${actor.name} moved ${this.label(updated)} to ${SAFETY_STATUS_LABELS[next]}${remark ? ` — ${remark}` : ''}.`, updated);
    return updated;
  }

  async comment(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const text = str(body.text, 2000);
    if (!text) throw new BadRequestException('text is required');
    const ev = await this.load(id);
    this.requireOnCase(actor, ev);
    this.require(actor, 'comment', ev.siteId);
    return this.apply(id, {}, [this.entry(actor, 'comment', 'Comment', text)]);
  }

  async addAction(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const text = str(body.text, 1000);
    if (!text) throw new BadRequestException('text is required');
    const ev = await this.load(id);
    this.requireOnCase(actor, ev);
    this.require(actor, 'investigate', ev.siteId);
    if (!['ACKNOWLEDGED', 'INVESTIGATING', 'ACTION_PENDING', 'REOPENED'].includes(ev.status)) {
      throw new ConflictException('Corrective actions can be added while the case is being worked on');
    }
    const action = {
      id: newId('ca'),
      text,
      ownerId: str(body.ownerId, 80) || undefined,
      dueDate: str(body.dueDate, 40) || undefined,
      done: false,
    };
    const updated = await this.eventModel
      .findOneAndUpdate(
        { id },
        { $push: { correctiveActions: action, timeline: this.entry(actor, 'action', 'Corrective action added', text) } },
        { new: true },
      )
      .lean()
      .exec();
    if (action.ownerId) {
      await this.notify([action.ownerId], actor.id, 'safety_action', `Corrective action assigned: ${ev.title}`,
        `${text}${action.dueDate ? ` · due ${action.dueDate}` : ''}`, updated);
    }
    return updated;
  }

  async setActionDone(id: string, actionId: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const ev = await this.load(id);
    this.requireOnCase(actor, ev);
    const action = ev.correctiveActions.find((a) => a.id === actionId);
    if (!action) throw new NotFoundException('Corrective action not found');
    // The owner may tick their own action; otherwise investigation roles
    if (action.ownerId !== actor.id) this.require(actor, 'investigate', ev.siteId);
    const done = Boolean(body.done);
    const actions = ev.correctiveActions.map((a) =>
      a.id === actionId ? { ...a, done, doneAt: done ? nowIso() : undefined, doneBy: done ? actor.name : undefined } : a,
    );
    return this.apply(id, { correctiveActions: actions }, [
      this.entry(actor, 'action', done ? 'Corrective action done' : 'Corrective action reopened', action.text),
    ]);
  }

  /** Near-miss → incident. The near-miss is closed and points to the new incident. */
  async promote(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const ev = await this.load(id);
    if (ev.type !== 'near_miss') throw new BadRequestException('Only near-misses can be promoted');
    if (ev.promotedTo) throw new ConflictException(`Already promoted to ${ev.promotedTo}`);
    if (ev.status === 'CLOSED') throw new ConflictException('Closed near-misses cannot be promoted');
    this.requireOnCase(actor, ev);
    this.require(actor, 'reportIncident', ev.siteId);

    const incident = await this.create({
      actor,
      type: 'incident',
      siteId: ev.siteId,
      title: str(body.title, 200) || ev.title,
      description: ev.description,
      location: ev.location,
      occurredAt: ev.occurredAt,
      category: body.category ?? (ev.category === 'other' ? 'other' : ev.category),
      categoryOther: typeof body.categoryOther === 'string' ? body.categoryOther : ev.categoryOther,
      severity: body.severity ?? ev.severity,
      involved: ev.involved,
      informedBy: ev.informedBy,
      isEmergency: Boolean(body.isEmergency),
    });
    await this.eventModel.updateOne(
      { id: incident.id },
      {
        $set: { promotedFrom: ev.id, media: ev.media },
        $push: { timeline: this.entry(actor, 'promote', `Promoted from near-miss ${ev.id}`) },
      },
    ).exec();
    await this.apply(id, { status: 'CLOSED', promotedTo: incident.id }, [
      this.entry(actor, 'promote', `Promoted to incident ${incident.id}`, str(body.remark, 1000) || undefined),
    ]);
    return this.load(incident.id);
  }

  async decideClearance(id: string, employeeId: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const decision = body.decision === 'waived' ? 'waived' : 'cleared';
    const remark = str(body.remark, 1000);
    const ev = await this.load(id);
    this.requireOnCase(actor, ev);
    this.require(actor, clearanceAction(ev.category as SafetyCategory, ev.severity as SafetySeverity, decision), ev.siteId);
    if (decision === 'waived' && !remark) throw new BadRequestException('A remark is required to waive clearance');
    const row = ev.clearance.find((c) => c.employeeId === employeeId);
    if (!row) throw new NotFoundException(`${employeeId} has no clearance entry on this case`);
    if (row.status !== 'pending') throw new ConflictException(`Clearance already ${row.status}`);

    const clearance = ev.clearance.map((c) =>
      c.employeeId === employeeId
        ? { ...c, status: decision, clearedBy: actor.name, clearedByRole: actor.role, at: nowIso(), remark: remark || undefined }
        : c,
    );
    const person = (await this.employeeModel.findOne({ id: employeeId }, { name: 1 }).lean().exec())?.name ?? employeeId;
    const updated = await this.apply(id, { clearance }, [
      this.entry(actor, 'clearance', `Return-to-work ${decision} for ${person}`, remark || undefined),
    ]);
    await this.notify([employeeId, ...ev.stakeholders.map((s) => s.personId)], actor.id, 'safety_clearance',
      `Return-to-work ${decision}: ${ev.title}`, `${actor.name} ${decision} ${person} to return to duty.`, updated);
    return updated;
  }

  async linkLeave(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const leaveId = str(body.leaveId, 80);
    if (!leaveId) throw new BadRequestException('leaveId is required');
    const ev = await this.load(id);
    this.requireOnCase(actor, ev);
    this.require(actor, 'linkLeave', ev.siteId);
    const leave = await this.leaveModel.findOne({ id: leaveId }).lean().exec();
    if (!leave) throw new NotFoundException(`Leave ${leaveId} not found`);
    if (!ev.involved.includes(leave.employeeId)) {
      throw new BadRequestException('Leave must belong to a person involved in this case');
    }
    if (ev.linkedLeaveIds.includes(leaveId)) return ev;
    await this.leaveModel.updateOne({ id: leaveId }, { $addToSet: { linkedSafetyEventIds: ev.id } }).exec();
    return this.apply(id, { linkedLeaveIds: [...ev.linkedLeaveIds, leaveId] }, [
      this.entry(actor, 'leave', `Leave ${leaveId} linked`, `${leave.employeeName ?? leave.employeeId} · ${leave.leaveType ?? ''}`),
    ]);
  }

  /** Jitsi room (no infra) — logged and pushed to everyone following the case. */
  async startCall(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const ev = await this.load(id);
    this.requireOnCase(actor, ev);
    this.require(actor, 'startCall', ev.siteId);
    const meetLink = ev.meetLink ?? `https://meet.jit.si/neipl-safety-${ev.id}-${randomBytes(3).toString('hex')}`;
    // Everyone on the case is called; whoever starts it has joined
    const invited = this.followers(ev).filter((p) => p !== actor.id);
    const updated = await this.apply(
      id,
      { meetLink, callStartedAt: nowIso(), callInvited: invited, callJoined: [actor.id], callNudgedAt: {} },
      [this.entry(actor, 'call', 'Safety meeting called', `${invited.length} people called · ${meetLink}`)],
    );
    await this.notify(invited, actor.id, 'safety_call', `Safety meeting: ${ev.title}`,
      `${actor.name} called a safety meeting. Open the case and join.`, updated);
    return updated;
  }

  /** Someone on the case joins the meeting — stops their no-show reminders. */
  async joinCall(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const ev = await this.load(id);
    if (!ev.callStartedAt) throw new BadRequestException('No meeting has been called on this case');
    if (!canJoinSafetyCall(actor, ev)) throw new ForbiddenException('Only people on this case can join its safety meeting');
    if ((ev.callJoined ?? []).includes(actor.id)) return ev;
    const updated = await this.eventModel
      .findOneAndUpdate(
        { id },
        { $addToSet: { callJoined: actor.id }, $push: { timeline: this.entry(actor, 'call', 'Joined the safety meeting') } },
        { new: true },
      )
      .lean()
      .exec();
    return updated;
  }

  /** Called people who have not joined: reminded every 4 h (in-app now; email + WhatsApp coming soon). */
  async sendMeetingNudges(ev: SafetyEvent, personIds: string[]) {
    if (!personIds.length) return;
    await this.notify(personIds, undefined, 'safety_meeting_reminder', `You haven't joined the safety meeting: ${ev.title}`,
      `You were called to the safety meeting on ${this.label(ev)}. Open the case and join. This repeats every 4 hours until you join.`, ev);
    const people = await this.employeeModel.find({ id: { $in: personIds } }, { id: 1, name: 1 }).lean().exec();
    const leaders = await this.leaderModel.find({ id: { $in: personIds } }, { id: 1, name: 1 }).lean().exec();
    const names = new Map([...people, ...leaders].map((p) => [p.id, p.name]));
    const at = nowIso();
    const nudged = { ...(ev.callNudgedAt ?? {}) };
    for (const p of personIds) nudged[p] = at;
    await this.eventModel.updateOne(
      { id: ev.id },
      {
        $set: { callNudgedAt: nudged },
        $push: {
          timeline: {
            at,
            actorId: 'system',
            actorName: 'System',
            actorRole: 'system',
            kind: 'notify',
            title: 'Meeting reminder sent',
            detail: `${personIds.map((p) => names.get(p) ?? p).join(', ')} · in-app sent · email & WhatsApp: coming soon`,
          },
        },
      },
    ).exec();
  }

  async ackEmergency(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const ev = await this.load(id);
    if (!ev.isEmergency) throw new BadRequestException('Not an emergency');
    if (!ev.emergencyRecipients.includes(actor.id)) throw new ForbiddenException('This emergency was not sent to you');
    if (ev.emergencyAcks.includes(actor.id)) return ev;
    const updated = await this.eventModel
      .findOneAndUpdate(
        { id },
        { $addToSet: { emergencyAcks: actor.id }, $push: { timeline: this.entry(actor, 'notify', 'Emergency acknowledged') } },
        { new: true },
      )
      .lean()
      .exec();
    return updated;
  }

  async addMedia(id: string, actorRaw: unknown, media: { id: string; url: string; kind: 'image' | 'video'; name: string; size: number }) {
    const actor = this.actor(actorRaw);
    const ev = await this.load(id);
    this.requireOnCase(actor, ev);
    this.require(actor, 'comment', ev.siteId);
    const row = { ...media, uploadedBy: actor.name, at: nowIso() };
    return this.eventModel
      .findOneAndUpdate(
        { id },
        { $push: { media: row, timeline: this.entry(actor, 'media', `${media.kind === 'video' ? 'Video' : 'Photo'} added`, media.name) } },
        { new: true },
      )
      .lean()
      .exec();
  }

  async assertCanAddMedia(id: string, actorRaw: unknown) {
    const actor = this.actor(actorRaw);
    const ev = await this.load(id);
    this.requireOnCase(actor, ev);
    this.require(actor, 'comment', ev.siteId);
  }

  // ── Reminders (called by SafetyScheduler) ───────────────────────────────

  /** Every case the Director has not closed yet (RESOLVED still waits for the Director). */
  async openEvents() {
    return this.eventModel.find({ status: { $in: OPEN_STATUSES } }).lean().exec();
  }

  async sendReminder(ev: SafetyEvent, escalate: boolean) {
    const count = (ev.notifyCount ?? 0) + 1;
    const status = SAFETY_STATUS_LABELS[ev.status as SafetyStatus];
    await this.notify(this.followers(ev), undefined, 'safety_reminder', `Still open (${status}): ${ev.title}`,
      `${this.label(ev)} · ${ev.severity} · reminder #${count}. It will keep notifying until the Director closes it.`, ev);
    const set: Record<string, unknown> = { lastNotifiedAt: nowIso(), notifyCount: count };
    if (escalate && !ev.escalatedAt) {
      const directors = await this.leaderModel.find({ active: true, role: 'director' }, { id: 1 }).lean().exec();
      await this.notify(directors.map((d) => d.id), undefined, 'safety_escalation', `Escalation: ${ev.title} unresolved`,
        `${this.label(ev)} has had ${count} reminders and is still ${status}.`, ev);
      set.escalatedAt = nowIso();
    }
    await this.eventModel.updateOne({ id: ev.id }, { $set: set }).exec();
  }

  // ── Protocols ────────────────────────────────────────────────────────────

  async listProtocols(siteId?: string) {
    const filter: Record<string, unknown> = { archivedAt: { $exists: false } };
    if (siteId) filter.$or = [{ siteIds: { $size: 0 } }, { siteIds: siteId }];
    return this.protocolModel.find(filter).sort({ category: 1, title: 1 }).lean().exec();
  }

  private protocolFields(body: Record<string, any>) {
    const set: Record<string, unknown> = {};
    if (typeof body.title === 'string') set.title = str(body.title, 200);
    if (typeof body.category === 'string') set.category = str(body.category, 60);
    if (typeof body.summary === 'string') set.summary = str(body.summary, 2000);
    if (Array.isArray(body.steps)) set.steps = body.steps.map((s: unknown) => str(s, 1000)).filter(Boolean);
    if (Array.isArray(body.siteIds)) set.siteIds = idList(body.siteIds);
    if (Array.isArray(body.emergencyContacts)) {
      set.emergencyContacts = body.emergencyContacts
        .filter((c: any) => c && str(c.label, 100) && str(c.phone, 40))
        .map((c: any) => ({ label: str(c.label, 100), phone: str(c.phone, 40) }));
    }
    return set;
  }

  async createProtocol(body: Record<string, any>) {
    const actor = this.actor(body.actor);
    this.require(actor, 'editProtocols');
    const fields = this.protocolFields(body);
    if (!fields.title || !fields.category) throw new BadRequestException('title and category are required');
    const doc = await this.protocolModel.create({
      id: newId('sp'),
      steps: [],
      emergencyContacts: [],
      siteIds: [],
      ...fields,
      version: 1,
      updatedBy: actor.name,
      updatedAtIso: nowIso(),
    });
    return doc.toObject();
  }

  async updateProtocol(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    this.require(actor, 'editProtocols');
    const fields = this.protocolFields(body);
    if (fields.title === '' || fields.category === '') throw new BadRequestException('title and category cannot be empty');
    const updated = await this.protocolModel
      .findOneAndUpdate(
        { id, archivedAt: { $exists: false } },
        { $set: { ...fields, updatedBy: actor.name, updatedAtIso: nowIso() }, $inc: { version: 1 } },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(`Protocol ${id} not found`);
    return updated;
  }

  /** Soft delete — sites stop seeing it; the record stays for history. */
  async deleteProtocol(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    this.require(actor, 'editProtocols');
    const at = nowIso();
    const archived = await this.protocolModel
      .findOneAndUpdate(
        { id, archivedAt: { $exists: false } },
        { $set: { archivedAt: at, archivedBy: actor.name, updatedBy: actor.name, updatedAtIso: at } },
        { new: true },
      )
      .lean()
      .exec();
    if (!archived) throw new NotFoundException(`Protocol ${id} not found`);
    return archived;
  }
}
