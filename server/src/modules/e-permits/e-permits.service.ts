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
  EPermit,
  EPermitAck,
  EPermitApproval,
  EPermitChecklistAnswer,
  EPermitDocument,
  EPermitGasReading,
  EPermitRenewal,
  EPermitTimelineEntry,
} from '../../../db/schemas/e-permit.schema';
import {
  Department,
  DepartmentDocument,
  EPermitSequence,
  EPermitSequenceDocument,
  PermitLocation,
  PermitLocationDocument,
  SiteEmergencyContact,
  SiteEmergencyContactDocument,
} from '../../../db/schemas/e-permit-master.schema';
import { Employee, EmployeeDocument } from '../../../db/schemas/employee.schema';
import { Leader, LeaderDocument } from '../../../db/schemas/leader.schema';
import { LeaveRequest, LeaveRequestDocument } from '../../../db/schemas/leave-request.schema';
import { SafetyEvent, SafetyEventDocument } from '../../../db/schemas/safety-event.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  APPROVAL_KIND_LABELS,
  CERTIFICATE_TYPES,
  EPERMIT_POLICY,
  EPERMIT_STATUS_LABELS,
  EPermitCategory,
  EPermitStatus,
  EPermitSubCategory,
  FIRE_GAS_ITEMS,
  GAS_LIMITS,
  GasKey,
  LEAVE_BLOCKING_STATUSES,
  LIVE_STATUSES,
  MAX_CUSTOM_PPE,
  OCCUPYING_STATUSES,
  PERMIT_RULES,
  PERMIT_SHIFTS,
  PLANT_UTC_OFFSET_MINUTES,
  PPE_ITEMS,
  PermitShiftCode,
  PermitViewer,
  RETURN_OUTCOME_LABELS,
  ReturnOutcome,
  SAFETY_MEASURES,
  TERMINAL_STATUSES,
  ackViaFor,
  activationValidity,
  actualHours,
  approvalsLapsed,
  assertPermitTransition,
  canActAsAuthoriser,
  canDecideApproval,
  canEditLocationDepartments,
  canIssuePermits,
  canManageAsIssuer,
  canOverrideSoftBlocks,
  canRaisePermitOt,
  canSuspend,
  canSuspendSite,
  canViewPermit,
  emergencyPostReviews,
  findConflicts,
  formatPermitNo,
  financialYear,
  isGasReadingOk,
  isOverdue,
  isValidSubCategory,
  normalizePermitRole,
  postReviewOverdue,
  renewalBlocker,
  renewalRef,
  renewalWindow,
  requiredApprovals,
  requiresFireGas,
  shiftWindow,
  shouldNotifyOverdue,
  shouldWarn,
  validateForSubmit,
  validatePlannedSchedule,
  validateGasReadings,
} from './e-permit-rules';

/** Who is acting. `id` = employee id, or "user:<email>" for logins without one (Director, HoDs, Safety). */
export type EPermitActorInput = { id: string; name: string; role: string; siteId?: string };

type Viewer = EPermitActorInput & { departmentIds: string[] };
type Lean<T> = T & { _id?: unknown; createdAt?: string; updatedAt?: string };
type Permit = Lean<EPermit>;

const ISSUER_CATEGORIES = ['supervisor', 'shift_incharge', 'manager'];
const SYSTEM: EPermitActorInput = { id: 'system', name: 'System', role: 'system' };

const newId = () => `ep-${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
const nowIso = () => new Date().toISOString();
const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const idList = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()))] : [];
const optIso = (v: unknown) => {
  const s = str(v, 40);
  return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : undefined;
};

/** "YYYY-MM-DD" plant-local date of a moment (leave records use local dates). */
const localDate = (ms: number) =>
  new Date(ms + PLANT_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);

const fmtLocal = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(Date.parse(iso) + PLANT_UTC_OFFSET_MINUTES * 60_000);
  return `${d.toISOString().slice(11, 16)} ${d.toISOString().slice(0, 10)}`;
};

function checklist(raw: unknown, defs: { key: string }[], withRef = false): EPermitChecklistAnswer[] {
  const rows = Array.isArray(raw) ? raw : [];
  return defs.map((d) => {
    const hit = rows.find((r: any) => r && r.key === d.key) as any;
    const value = hit?.value === 'yes' || hit?.value === 'na' ? hit.value : '';
    const out: EPermitChecklistAnswer = { key: d.key, value };
    if (withRef && value === 'yes' && str(hit?.refNo, 80)) out.refNo = str(hit.refNo, 80);
    return out;
  });
}

function customPpe(raw: unknown): EPermitChecklistAnswer[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((r: any, i: number) => ({
      key: `custom_${i + 1}`,
      label: str(r?.label, 80),
      value: (r?.value === 'yes' || r?.value === 'na' ? r.value : 'yes') as 'yes' | 'na',
    }))
    .filter((r) => r.label)
    .slice(0, MAX_CUSTOM_PPE);
}

/**
 * E-Permits (Permit to Work): issue → approvals → acknowledgements → ACTIVE (one shift) →
 * renewal (re-approval, max 2 / 24 h) → return (Holder → Issuer → Authoriser).
 * Every write takes `actor { id, name, role, siteId }`; role, site and department scope are checked here
 * with the same rules the client uses (e-permit-rules.ts).
 */
@Injectable()
export class EPermitsService {
  constructor(
    @InjectModel(EPermit.name) private permitModel: Model<EPermitDocument>,
    @InjectModel(Department.name) private deptModel: Model<DepartmentDocument>,
    @InjectModel(PermitLocation.name) private locationModel: Model<PermitLocationDocument>,
    @InjectModel(SiteEmergencyContact.name) private contactModel: Model<SiteEmergencyContactDocument>,
    @InjectModel(EPermitSequence.name) private seqModel: Model<EPermitSequenceDocument>,
    @InjectModel(Employee.name) private employeeModel: Model<EmployeeDocument>,
    @InjectModel(Leader.name) private leaderModel: Model<LeaderDocument>,
    @InjectModel(LeaveRequest.name) private leaveModel: Model<LeaveRequestDocument>,
    @InjectModel(SafetyEvent.name) private safetyModel: Model<SafetyEventDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Identity ─────────────────────────────────────────────────────────────

  private actor(raw: unknown): EPermitActorInput {
    const a = (raw ?? {}) as Partial<EPermitActorInput>;
    if (!a.id || !a.name || !a.role) throw new BadRequestException('actor { id, name, role } is required');
    return { id: String(a.id), name: String(a.name), role: normalizePermitRole(a.role), siteId: a.siteId || undefined };
  }

  /** Actor + the departments they head or deputise (HoDs). */
  private async viewer(raw: unknown): Promise<Viewer> {
    const a = this.actor(raw);
    if (a.role !== 'hod') return { ...a, departmentIds: [] };
    const depts = await this.deptModel
      .find({ $or: [{ headUserId: a.id }, { deputyUserIds: a.id }] }, { id: 1 })
      .lean()
      .exec();
    return { ...a, departmentIds: depts.map((d) => d.id) };
  }

  private entry(actor: EPermitActorInput, kind: string, title: string, detail?: string): EPermitTimelineEntry {
    return { at: nowIso(), actorId: actor.id, actorName: actor.name, actorRole: actor.role, kind, title, detail };
  }

  private async load(id: string): Promise<Permit> {
    const p = await this.permitModel.findOne({ id }).lean().exec();
    if (!p) throw new NotFoundException(`Permit ${id} not found`);
    return p as Permit;
  }

  private requireView(viewer: PermitViewer, p: Permit) {
    if (!canViewPermit(viewer, p)) throw new ForbiddenException('You are not concerned with this permit');
  }

  /** Optimistic write: only applies when the permit is still in `expect` status. */
  private async apply(
    p: Permit,
    set: Record<string, unknown>,
    timeline: EPermitTimelineEntry[],
    extra: { unset?: Record<string, ''>; push?: Record<string, unknown> } = {},
  ): Promise<Permit> {
    const update: Record<string, unknown> = { $set: set, $push: { timeline: { $each: timeline }, ...(extra.push ?? {}) } };
    if (extra.unset && Object.keys(extra.unset).length) update.$unset = extra.unset;
    const updated = await this.permitModel
      .findOneAndUpdate({ id: p.id, status: p.status }, update, { new: true })
      .lean()
      .exec();
    if (!updated) throw new ConflictException('The permit changed meanwhile — reload and try again');
    return updated as Permit;
  }

  private transition(p: Permit, to: EPermitStatus) {
    try {
      assertPermitTransition(p.status as EPermitStatus, to);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  // ── People ───────────────────────────────────────────────────────────────

  private async employeesById(ids: string[]) {
    if (!ids.length) return new Map<string, { id: string; name: string; siteId: string; employeeCategory?: string; employmentStatus?: string }>();
    const rows = await this.employeeModel
      .find({ id: { $in: ids } }, { id: 1, name: 1, siteId: 1, employeeCategory: 1, employmentStatus: 1 })
      .lean()
      .exec();
    return new Map(rows.map((r) => [r.id, r as any]));
  }

  private async nameOf(id: string): Promise<string> {
    if (!id) return '';
    const emp = await this.employeeModel.findOne({ id }, { name: 1 }).lean().exec();
    if (emp) return emp.name;
    const leader = await this.leaderModel.findOne({ id }, { name: 1 }).lean().exec();
    return leader?.name ?? id;
  }

  /** People who decide an approval kind for this permit (HoD, deputies when HoD unavailable, Safety, PM, Director). */
  private async approverIds(p: Permit, a: { kind: string; departmentId?: string }): Promise<string[]> {
    if (a.kind === 'authoriser' || a.kind === 'department') {
      const d = await this.deptModel.findOne({ id: a.departmentId }).lean().exec();
      if (!d) return [];
      const unavailable = d.headUnavailableUntil && Date.parse(d.headUnavailableUntil) > Date.now();
      return unavailable ? [d.headUserId, ...d.deputyUserIds] : [d.headUserId];
    }
    if (a.kind === 'safety') {
      const rows = await this.leaderModel.find({ active: true, role: 'safety_incharge' }, { id: 1 }).lean().exec();
      return rows.map((r) => r.id);
    }
    if (a.kind === 'emergency') return this.siteManagerIds(p.siteId);
    return [];
  }

  private async siteManagerIds(siteId: string): Promise<string[]> {
    const rows = await this.employeeModel
      .find({ siteId, employeeCategory: 'manager', employmentStatus: { $ne: 'inactive' } }, { id: 1 })
      .lean()
      .exec();
    return rows.map((r) => r.id);
  }

  private async directorIds(): Promise<string[]> {
    const rows = await this.leaderModel.find({ active: true, role: 'director' }, { id: 1 }).lean().exec();
    return rows.map((r) => r.id);
  }

  private async authoriserIds(p: Permit): Promise<string[]> {
    return this.approverIds(p, { kind: 'authoriser', departmentId: p.authoriserDepartmentId });
  }

  private crew(p: Permit): string[] {
    return [...new Set([p.issuerId, p.holderId, ...(p.workerIds ?? [])].filter(Boolean))];
  }

  private async notify(personIds: string[], exclude: string | undefined, kind: string, title: string, body: string, p: Permit) {
    const targets = [...new Set(personIds)].filter((x) => x && x !== exclude && x !== 'system');
    if (!targets.length) return;
    await this.notifications.notifyMany(
      targets.map((employeeId) => ({
        employeeId,
        kind,
        title,
        body,
        href: `/e-permits/${p.id}`,
        meta: { permitId: p.id, permitNo: p.permitNo, siteId: p.siteId },
      })),
    );
  }

  private label(p: Permit) {
    return `${p.permitNo} · ${p.locationName}`;
  }

  // ── Masters ──────────────────────────────────────────────────────────────

  async masters() {
    const [departments, locations, contacts] = await Promise.all([
      this.deptModel.find({}).sort({ name: 1 }).lean().exec(),
      this.locationModel.find({ active: { $ne: false } }).sort({ siteId: 1, name: 1 }).lean().exec(),
      this.contactModel.find({}).sort({ siteId: 1, extension: 1 }).lean().exec(),
    ]);
    return { departments, locations, contacts };
  }

  policy() {
    return {
      policy: EPERMIT_POLICY,
      shifts: PERMIT_SHIFTS,
      gasLimits: GAS_LIMITS,
      rules: PERMIT_RULES,
      checklists: { safetyMeasures: SAFETY_MEASURES, ppe: PPE_ITEMS, fireGas: FIRE_GAS_ITEMS, certificates: CERTIFICATE_TYPES },
    };
  }

  /** HoD marks themselves unavailable (approval requests then also reach the deputies). Body: { actor, until | null }. */
  async setHeadAvailability(departmentId: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const d = await this.deptModel.findOne({ id: departmentId }).lean().exec();
    if (!d) throw new NotFoundException(`Department ${departmentId} not found`);
    if (actor.id !== d.headUserId && actor.role !== 'director') {
      throw new ForbiddenException('Only the Head of Department (or the Director) can change this');
    }
    const until = optIso(body.until);
    const update = until ? { $set: { headUnavailableUntil: until } } : { $unset: { headUnavailableUntil: '' } };
    return this.deptModel.findOneAndUpdate({ id: departmentId }, update, { new: true }).lean().exec();
  }

  /**
   * Director (any plant) or the plant's Plant Manager sets which other departments are concerned with a location.
   * Body: { actor, departmentIds }. Applies to permits submitted from now on; earlier permits keep their approvals.
   */
  async setLocationDepartments(locationId: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const loc = await this.locationModel.findOne({ id: locationId }).lean().exec();
    if (!loc) throw new NotFoundException(`Location ${locationId} not found`);
    if (!canEditLocationDepartments(actor, loc.siteId)) {
      throw new ForbiddenException("Only the Director or this plant's Plant Manager can change the concerned departments");
    }
    if (!Array.isArray(body.departmentIds)) throw new BadRequestException('departmentIds must be a list');
    const wanted = [...new Set(body.departmentIds.map((d: unknown) => String(d)))].filter((d) => d !== loc.ownerDepartmentId);
    const known = await this.deptModel.find({ id: { $in: wanted } }, { id: 1 }).lean().exec();
    const unknown = wanted.filter((d) => !known.some((k) => k.id === d));
    if (unknown.length) throw new BadRequestException(`Unknown department: ${unknown.join(', ')}`);
    const updated = await this.locationModel
      .findOneAndUpdate({ id: locationId }, { $set: { concernedDepartmentIds: wanted } }, { new: true })
      .lean()
      .exec();
    await this.syncPendingApprovals(locationId, actor);
    return updated;
  }

  /**
   * Bring permits still waiting for approval in line with their location's concerned departments (and the
   * policy rules): add the clearances now required — and ask those HoDs — and drop pending ones no longer
   * required. Decisions already made are kept; permits that are live or closed are never touched.
   * Runs after a location's list is edited, and once at server start (catches changes made by the seed).
   */
  async syncPendingApprovals(locationId?: string, actor: EPermitActorInput = SYSTEM): Promise<number> {
    const filter: Record<string, unknown> = { status: 'PENDING_APPROVAL', emergency: { $ne: true } };
    if (locationId) filter.locationId = locationId;
    const waiting = (await this.permitModel.find(filter).lean().exec()) as Permit[];
    const key = (a: { kind: string; departmentId?: string }) => `${a.kind}:${a.departmentId ?? ''}`;
    let changed = 0;
    for (const p of waiting) {
      const location = await this.locationModel.findOne({ id: p.locationId }).lean().exec();
      if (!location) continue;
      const required = requiredApprovals(location, p.category, p.subCategory, false);
      const have = new Set(p.approvals.map(key));
      const need = new Set(required.map(key));
      const added: EPermitApproval[] = required
        .filter((a) => !have.has(key(a)))
        .map((a) => ({ kind: a.kind, ...(a.departmentId ? { departmentId: a.departmentId } : {}), status: 'pending' }) as EPermitApproval);
      const dropped = p.approvals.filter((a) => a.kind === 'department' && a.status === 'pending' && !need.has(key(a)));
      if (!added.length && !dropped.length) continue;

      const names = async (list: EPermitApproval[]) =>
        (
          await Promise.all(
            list.map(async (a) =>
              a.departmentId ? ((await this.deptModel.findOne({ id: a.departmentId }).lean().exec())?.name ?? a.departmentId) : APPROVAL_KIND_LABELS[a.kind],
            ),
          )
        ).join(', ');
      const why = "The location's concerned departments changed";
      const timeline: EPermitTimelineEntry[] = [];
      if (added.length) timeline.push(this.entry(actor, 'clearance', `Clearances added: ${await names(added)}`, why));
      if (dropped.length) timeline.push(this.entry(actor, 'clearance', `Clearances no longer needed: ${await names(dropped)}`, why));
      const approvals = [...p.approvals.filter((a) => !dropped.includes(a)), ...added];
      const updated = await this.apply(p, { approvals }, timeline);
      for (const a of added) {
        await this.notify(await this.approverIds(updated, a), actor.id, 'e_permit_approval', `Approval needed: ${this.label(updated)}`,
          `${APPROVAL_KIND_LABELS[a.kind]} — ${updated.description.slice(0, 160)}`, updated);
      }
      await this.tryActivate(updated, actor);
      changed++;
    }
    return changed;
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  async list(q: { siteId?: string; status?: string; safetyEventId?: string }, viewerRaw: unknown) {
    const viewer = await this.viewer(viewerRaw);
    const filter: Record<string, unknown> = {};
    if (q.siteId) filter.siteId = q.siteId;
    if (q.status) filter.status = q.status;
    if (q.safetyEventId) filter.safetyEventId = q.safetyEventId;
    const rows = (await this.permitModel.find(filter).sort({ updatedAt: -1 }).limit(1000).lean().exec()) as Permit[];
    return rows.filter((p) => canViewPermit(viewer, p)).slice(0, 500);
  }

  async get(id: string, viewerRaw: unknown) {
    const viewer = await this.viewer(viewerRaw);
    const p = await this.load(id);
    this.requireView(viewer, p);
    return p;
  }

  // ── Soft blocks ──────────────────────────────────────────────────────────

  /** Clashing permits at the location, workers on approved leave that day, workers awaiting safety clearance. */
  async softBlocks(p: Pick<Permit, 'id' | 'locationId' | 'category' | 'subCategory' | 'workerIds' | 'windowStart' | 'windowEnd'>): Promise<string[]> {
    const out: string[] = [];
    const others = (await this.permitModel
      .find({ locationId: p.locationId, status: { $in: OCCUPYING_STATUSES }, id: { $ne: p.id } })
      .lean()
      .exec()) as Permit[];
    for (const c of findConflicts(
      { id: p.id, locationId: p.locationId, category: p.category, subCategory: p.subCategory, status: 'PENDING_APPROVAL' },
      others.map((o) => ({ id: o.id, locationId: o.locationId, category: o.category, subCategory: o.subCategory, status: o.status as EPermitStatus })),
    )) {
      const o = others.find((x) => x.id === c.id)!;
      out.push(`Clashing work at this location: ${o.permitNo} (${o.subCategory.replace(/_/g, ' ')}, ${EPERMIT_STATUS_LABELS[o.status as EPermitStatus]})`);
    }
    const workers = p.workerIds ?? [];
    if (workers.length) {
      // The C shift runs across midnight, so check every plant-local date the shift touches
      const firstDay = localDate(Date.parse(p.windowStart));
      const lastDay = localDate(Date.parse(p.windowEnd) - 1);
      const leaves = await this.leaveModel
        .find({
          employeeId: { $in: workers },
          status: { $in: LEAVE_BLOCKING_STATUSES },
          startDate: { $lte: lastDay },
          endDate: { $gte: firstDay },
        })
        .lean()
        .exec();
      const names = await this.employeesById(workers);
      const span = firstDay === lastDay ? firstDay : `${firstDay} – ${lastDay}`;
      for (const l of leaves) out.push(`${names.get((l as any).employeeId)?.name ?? (l as any).employeeId} is on approved leave on ${span}`);
      const cases = await this.safetyModel
        .find({ clearance: { $elemMatch: { employeeId: { $in: workers }, status: 'pending' } } }, { id: 1, title: 1, clearance: 1 })
        .lean()
        .exec();
      for (const ev of cases) {
        for (const c of ev.clearance.filter((x) => x.status === 'pending' && workers.includes(x.employeeId))) {
          out.push(`${names.get(c.employeeId)?.name ?? c.employeeId} has a pending safety return-to-work clearance (${ev.title})`);
        }
      }
    }
    return out;
  }

  // ── Create / edit draft ──────────────────────────────────────────────────

  private async nextPermitNo(siteId: string, now: number) {
    const key = `${siteId}:${financialYear(now)}`;
    const row = await this.seqModel
      .findOneAndUpdate({ key }, { $inc: { lastSeq: 1 } }, { new: true, upsert: true })
      .lean()
      .exec();
    return formatPermitNo(siteId, now, row!.lastSeq);
  }

  /** Validated draft fields from a request body (create and edit). */
  private async draftFields(body: Record<string, any>, actor: EPermitActorInput, existing?: Permit) {
    const siteId = existing?.siteId ?? str(body.siteId, 64);
    if (!siteId) throw new BadRequestException('siteId is required');
    const role = normalizePermitRole(actor.role);
    if (role !== 'director' && actor.siteId !== siteId) throw new ForbiddenException('You can only issue permits for your own plant');

    const locationId = str(body.locationId ?? existing?.locationId, 80);
    const location = await this.locationModel.findOne({ id: locationId, active: { $ne: false } }).lean().exec();
    if (!location) throw new BadRequestException('Choose a seeded location');
    if (location.siteId !== siteId) throw new BadRequestException('That location is at another plant');

    const category = str(body.category ?? existing?.category, 20) as EPermitCategory;
    const subCategory = str(body.subCategory ?? existing?.subCategory, 40) as EPermitSubCategory;
    if (!isValidSubCategory(category, subCategory)) throw new BadRequestException('Choose Hot Work / Cold Work and the type of work');

    const shiftCode = str(body.shiftCode ?? existing?.shiftCode, 2) as PermitShiftCode;
    if (!PERMIT_SHIFTS[shiftCode]) throw new BadRequestException('Choose the shift');
    const window = shiftWindow(shiftCode, Date.now());

    const workerIds = Array.isArray(body.workerIds) ? idList(body.workerIds) : existing?.workerIds ?? [];
    if (workerIds.length > 50) throw new BadRequestException('Too many workers on one permit');
    const people = await this.employeesById(workerIds);
    const unknown = workerIds.filter((w) => !people.has(w));
    if (unknown.length) throw new BadRequestException(`Unknown employee id(s): ${unknown.join(', ')}`);
    const elsewhere = workerIds.filter((w) => people.get(w)!.siteId !== siteId);
    if (elsewhere.length) throw new BadRequestException(`Workers must be from this plant: ${elsewhere.join(', ')}`);
    const inactive = workerIds.filter((w) => people.get(w)!.employmentStatus === 'inactive');
    if (inactive.length) throw new BadRequestException(`Inactive employee(s): ${inactive.join(', ')}`);
    const holderId = str(body.holderId ?? existing?.holderId, 40);

    const readings = Array.isArray(body.gasReadings)
      ? body.gasReadings
          .filter((r: any) => r && GAS_LIMITS[r.gas as GasKey] && r.value !== '' && r.value !== null && r.value !== undefined)
          .map((r: any) => ({ gas: r.gas as GasKey, value: Number(r.value) }))
      : undefined;
    const now = nowIso();
    const gasReadings: EPermitGasReading[] | undefined = readings?.map((r) => ({
      gas: r.gas,
      value: r.value,
      unit: GAS_LIMITS[r.gas].unit,
      ok: isGasReadingOk(r),
      round: 0,
      by: actor.id,
      byName: actor.name,
      at: now,
    }));

    const emergency = typeof body.emergency === 'boolean' ? body.emergency : existing?.emergency ?? false;
    const fields: Partial<Permit> = {
      siteId,
      locationId,
      locationName: location.name,
      category,
      subCategory,
      emergency,
      authoriserDepartmentId: location.ownerDepartmentId,
      shiftCode,
      windowStart: window.start,
      windowEnd: window.end,
      plannedFrom: optIso(body.plannedFrom) ?? (body.plannedFrom === null ? undefined : existing?.plannedFrom),
      plannedTo: optIso(body.plannedTo) ?? (body.plannedTo === null ? undefined : existing?.plannedTo),
      description: typeof body.description === 'string' ? str(body.description, 2000) : existing?.description ?? '',
      hazardsText: typeof body.hazardsText === 'string' ? str(body.hazardsText, 2000) : existing?.hazardsText ?? '',
      jsaRef: typeof body.jsaRef === 'string' ? str(body.jsaRef, 80) : existing?.jsaRef ?? '',
      holderId,
      workerIds,
      safetyMeasures: body.safetyMeasures ? checklist(body.safetyMeasures, SAFETY_MEASURES) : existing?.safetyMeasures ?? checklist([], SAFETY_MEASURES),
      ppe: body.ppe ? checklist(body.ppe, PPE_ITEMS) : existing?.ppe ?? checklist([], PPE_ITEMS),
      customPpe: body.customPpe ? customPpe(body.customPpe) : existing?.customPpe ?? [],
      fireGas: body.fireGas ? checklist(body.fireGas, FIRE_GAS_ITEMS) : existing?.fireGas ?? checklist([], FIRE_GAS_ITEMS),
      certificates: body.certificates ? checklist(body.certificates, CERTIFICATE_TYPES, true) : existing?.certificates ?? checklist([], CERTIFICATE_TYPES, true),
      gasReadings: gasReadings ?? existing?.gasReadings ?? [],
    };
    // A past start is refused only when this request sets the plan; editing other fields of an old draft still works.
    // The wizard always sends both fields, so compare with what is stored rather than checking for presence.
    const instant = (iso?: string) => (iso ? Date.parse(iso) : null);
    const settingPlan =
      instant(fields.plannedFrom) !== instant(existing?.plannedFrom) || instant(fields.plannedTo) !== instant(existing?.plannedTo);
    const planErrors = validatePlannedSchedule(fields.plannedFrom, fields.plannedTo, window, settingPlan ? Date.now() : undefined);
    if (planErrors.length) throw new BadRequestException(planErrors[0]);
    return fields;
  }

  async create(body: Record<string, any>) {
    const actor = this.actor(body.actor);
    if (!canIssuePermits(actor)) throw new ForbiddenException('Only a Supervisor, Shift In-Charge or Plant Manager issues permits');
    const fields = await this.draftFields(body, actor);

    const parentPermitId = str(body.parentPermitId, 80) || undefined;
    if (parentPermitId) {
      const parent = await this.permitModel.findOne({ id: parentPermitId }).lean().exec();
      if (!parent) throw new BadRequestException(`Parent permit ${parentPermitId} not found`);
    }
    const safetyEventId = str(body.safetyEventId, 80) || undefined;
    if (safetyEventId) {
      const ev = await this.safetyModel.findOne({ id: safetyEventId }, { id: 1, type: 1, siteId: 1 }).lean().exec();
      if (!ev || ev.type !== 'breakdown') throw new BadRequestException('Linked safety case must be a breakdown');
      if (ev.siteId !== fields.siteId) throw new BadRequestException('Linked breakdown is at another plant');
    }

    const now = Date.now();
    const doc: Partial<Permit> = {
      id: newId(),
      permitNo: await this.nextPermitNo(fields.siteId!, now),
      ...fields,
      status: 'DRAFT',
      policyVersion: EPERMIT_POLICY.version,
      issuerId: actor.id,
      issuerName: actor.name,
      previousIssuerIds: [],
      approvals: [],
      postReviews: [],
      renewalCount: 0,
      renewals: [],
      parentPermitId,
      safetyEventId,
      acks: [],
      overrides: [],
      otDecisionIds: [],
      timeline: [this.entry(actor, 'created', 'Permit drafted', parentPermitId ? `Continues permit ${parentPermitId}` : undefined)],
      createdBy: actor.id,
    };
    const created = (await this.permitModel.create(doc)).toObject() as Permit;
    if (body.submit) return this.submit(created.id, body);
    return created;
  }

  async updateDraft(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const p = await this.load(id);
    if (p.status !== 'DRAFT') throw new BadRequestException('Only a draft can be edited — revise a rejected permit first');
    if (!canManageAsIssuer(actor, p)) throw new ForbiddenException('Only the issuer edits the draft');
    const fields = await this.draftFields(body, actor, p);
    return this.apply(p, fields, [this.entry(actor, 'edit', 'Draft updated')]);
  }

  // ── Submit & approvals ───────────────────────────────────────────────────

  async submit(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const p = await this.load(id);
    if (!canManageAsIssuer(actor, p)) throw new ForbiddenException('Only the issuer submits the permit');
    this.transition(p, 'PENDING_APPROVAL');

    const errors = validateForSubmit(p as any);
    if (errors.length) throw new BadRequestException(errors.join('; '));

    const blocks = await this.softBlocks(p);
    const timeline: EPermitTimelineEntry[] = [];
    const overrides = [...(p.overrides ?? [])];
    if (blocks.length) {
      const remark = str(body.overrideRemark, 500);
      if (!body.overrideSoftBlocks || !remark) {
        throw new ConflictException({ message: blocks.join('; '), softBlocks: blocks, canOverride: canOverrideSoftBlocks(actor, p.siteId) });
      }
      if (!canOverrideSoftBlocks(actor, p.siteId)) {
        throw new ForbiddenException('Only the Plant Manager or Director can override these blocks');
      }
      overrides.push({ kind: 'soft_block', by: actor.id, byName: actor.name, remark, at: nowIso() });
      timeline.push(this.entry(actor, 'override', 'Soft blocks overridden', `${blocks.join('\n')}\n— ${remark}`));
    }

    const location = await this.locationModel.findOne({ id: p.locationId }).lean().exec();
    if (!location) throw new BadRequestException('The permit location no longer exists');
    const approvals: EPermitApproval[] = requiredApprovals(location, p.category, p.subCategory, p.emergency).map((a) => ({
      kind: a.kind,
      ...(a.departmentId ? { departmentId: a.departmentId } : {}),
      status: 'pending',
    }));
    const issuerAck: EPermitAck = {
      personId: p.issuerId,
      personName: p.issuerName,
      role: 'issuer',
      context: 'issue',
      round: 0,
      via: actor.id === p.issuerId ? 'self' : 'issuer',
      by: actor.id,
      at: nowIso(),
    };
    timeline.push(this.entry(actor, 'submit', 'Submitted for approval', approvals.map((a) => APPROVAL_KIND_LABELS[a.kind]).join(', ')));
    timeline.push(this.entry(actor, 'ack', `${p.issuerName} acknowledged as issuer`));

    const updated = await this.apply(
      p,
      {
        status: 'PENDING_APPROVAL',
        authoriserDepartmentId: location.ownerDepartmentId,
        approvals,
        acks: [issuerAck],
        overrides,
        policyVersion: EPERMIT_POLICY.version,
      },
      timeline,
      { unset: { firstApprovalAt: '' } },
    );

    for (const a of approvals) {
      await this.notify(await this.approverIds(updated, a), actor.id, 'e_permit_approval', `Approval needed: ${this.label(updated)}`,
        `${APPROVAL_KIND_LABELS[a.kind]} — ${updated.description.slice(0, 160)}${updated.emergency ? ' (EMERGENCY)' : ''}`, updated);
    }
    await this.notify([updated.holderId, ...updated.workerIds], actor.id, 'e_permit_ack', `Acknowledge permit ${updated.permitNo}`,
      `You are on permit ${this.label(updated)}. Acknowledge before work starts.`, updated);
    return this.tryActivate(updated, actor);
  }

  /** Activate once every approval and the issue acknowledgements (issuer, holder, workers) are in. */
  private async tryActivate(p: Permit, actor: EPermitActorInput): Promise<Permit> {
    if (p.status !== 'PENDING_APPROVAL') return p;
    if (!p.approvals.length || p.approvals.some((a) => a.status !== 'approved')) return p;
    const acked = new Set(p.acks.filter((a) => a.context === 'issue' && a.round === 0).map((a) => a.personId));
    if (!this.crew(p).every((x) => acked.has(x))) return p;

    const now = Date.now();
    const v = activationValidity(
      { shiftCode: p.shiftCode as PermitShiftCode, windowStart: p.windowStart, windowEnd: p.windowEnd },
      now,
      p.emergency,
    );
    const set: Record<string, unknown> = {
      status: 'ACTIVE',
      shiftCode: v.shiftCode,
      validFrom: v.validFrom,
      validTo: v.validTo,
      firstValidFrom: v.validFrom,
    };
    if (p.emergency) {
      const location = await this.locationModel.findOne({ id: p.locationId }).lean().exec();
      set.postReviews = location
        ? emergencyPostReviews(location, p.category, p.subCategory).map((a) => ({
            kind: a.kind,
            ...(a.departmentId ? { departmentId: a.departmentId } : {}),
            status: 'pending',
          }))
        : [];
    }
    const detail = `Valid ${fmtLocal(v.validFrom)} → ${fmtLocal(v.validTo)} (shift ${v.shiftCode})${v.rolled ? ' — chosen shift had ended, moved to the shift running now' : ''}`;
    const updated = await this.apply(p, set, [this.entry(actor, 'activate', 'Permit active', detail)]);
    await this.notify([...this.crew(updated), ...(await this.authoriserIds(updated))], actor.id, 'e_permit_active',
      `Permit active: ${this.label(updated)}`, detail, updated);
    if (updated.emergency) {
      for (const r of updated.postReviews) {
        await this.notify(await this.approverIds(updated, r), actor.id, 'e_permit_review', `Post-review due: ${this.label(updated)}`,
          `Emergency permit approved by the Plant Manager — review within ${EPERMIT_POLICY.emergency.postReviewWithinHours} h.`, updated);
      }
    }
    return updated;
  }

  /** Approve or reject one approval. Body: { actor, kind, departmentId?, decision: approve|reject, remark? } */
  async decide(id: string, body: Record<string, any>) {
    const viewer = await this.viewer(body.actor);
    const p = await this.load(id);
    if (p.status !== 'PENDING_APPROVAL') throw new BadRequestException('This permit is not waiting for approval');
    const kind = str(body.kind, 20);
    const departmentId = str(body.departmentId, 80) || undefined;
    const idx = p.approvals.findIndex((a) => a.kind === kind && (a.departmentId ?? undefined) === departmentId);
    if (idx === -1) throw new BadRequestException('No such approval on this permit');
    const approval = p.approvals[idx];
    if (approval.status !== 'pending') throw new BadRequestException('Already decided');
    if (!canDecideApproval(viewer, approval, p)) throw new ForbiddenException('You cannot decide this approval');

    const decision = body.decision === 'reject' ? 'rejected' : body.decision === 'approve' ? 'approved' : null;
    if (!decision) throw new BadRequestException('decision must be approve or reject');
    const remark = str(body.remark, 1000);
    if (decision === 'rejected' && !remark) throw new BadRequestException('Say why it is rejected');

    let onBehalfOf: string | undefined;
    let deptLabel = '';
    if (approval.departmentId && (approval.kind === 'authoriser' || approval.kind === 'department')) {
      const d = await this.deptModel.findOne({ id: approval.departmentId }).lean().exec();
      if (d && d.headUserId !== viewer.id) onBehalfOf = d.headName || d.headUserId;
      // Several departments can clear one permit — say which one in the audit trail.
      if (d && approval.kind === 'department') deptLabel = ` — ${d.name}`;
    }
    const at = nowIso();
    const approvals = p.approvals.map((a, i) =>
      i === idx ? { ...a, status: decision, decidedBy: viewer.id, decidedByName: viewer.name, at, ...(onBehalfOf ? { onBehalfOf } : {}), ...(remark ? { remark } : {}) } : a,
    ) as EPermitApproval[];
    const what = `${APPROVAL_KIND_LABELS[approval.kind]}${deptLabel}${onBehalfOf ? ` (on behalf of ${onBehalfOf})` : ''}`;

    if (decision === 'rejected') {
      const updated = await this.apply(p, { status: 'REJECTED', approvals }, [this.entry(viewer, 'approval', `${what} rejected`, remark)]);
      await this.notify([updated.issuerId], viewer.id, 'e_permit_rejected', `Permit rejected: ${this.label(updated)}`, `${what}: ${remark}`, updated);
      return updated;
    }
    const set: Record<string, unknown> = { approvals };
    if (!p.firstApprovalAt) set.firstApprovalAt = at;
    const updated = await this.apply(p, set, [this.entry(viewer, 'approval', `${what} approved`, remark || undefined)]);
    await this.notify([updated.issuerId], viewer.id, 'e_permit_approved', `${what} approved: ${updated.permitNo}`, remark || this.label(updated), updated);
    return this.tryActivate(updated, viewer);
  }

  /** Rejected → back to draft. Approvals and acknowledgements reset. */
  async revise(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const p = await this.load(id);
    if (!canManageAsIssuer(actor, p)) throw new ForbiddenException('Only the issuer revises the permit');
    this.transition(p, 'DRAFT');
    return this.apply(p, { status: 'DRAFT', approvals: [], acks: [] }, [this.entry(actor, 'edit', 'Revised after rejection — approvals reset')], {
      unset: { firstApprovalAt: '' },
    });
  }

  // ── Acknowledgements ─────────────────────────────────────────────────────

  /** Acknowledge (issue or renewal). Body: { actor, personId?, lat?, lng? } — personId defaults to the actor. */
  async acknowledge(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const p = await this.load(id);
    const personId = str(body.personId, 80) || actor.id;

    let context: 'issue' | 'renewal';
    let round = 0;
    const pendingRenewal = p.renewals.find((r) => r.status === 'pending');
    if (p.status === 'RENEWAL_PENDING' && pendingRenewal) {
      context = 'renewal';
      round = pendingRenewal.n;
    } else if (p.status === 'PENDING_APPROVAL' || LIVE_STATUSES.includes(p.status as EPermitStatus)) {
      context = 'issue';
    } else {
      throw new BadRequestException('Nothing to acknowledge on this permit right now');
    }

    const issuerId = context === 'renewal' && pendingRenewal?.newIssuerId ? pendingRenewal.newIssuerId : p.issuerId;
    const holderId = context === 'renewal' && pendingRenewal?.newHolderId ? pendingRenewal.newHolderId : p.holderId;
    const role = personId === holderId ? 'holder' : p.workerIds.includes(personId) ? 'worker' : personId === issuerId ? 'issuer' : null;
    if (!role) throw new BadRequestException('That person is not on this permit');
    const via = ackViaFor(actor.id, personId, { issuerId: p.issuerId, holderId: p.holderId });
    if (!via) throw new ForbiddenException('Acknowledge for yourself, or in person on the holder’s / issuer’s device');
    if (p.acks.some((a) => a.personId === personId && a.context === context && a.round === round)) return p;

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const ack: EPermitAck = {
      personId,
      personName: await this.nameOf(personId),
      role,
      context,
      round,
      via,
      by: actor.id,
      at: nowIso(),
      ...(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : {}),
    };
    const title = `${ack.personName} acknowledged${context === 'renewal' ? ` renewal ${round}` : ''} as ${role}${via !== 'self' ? ` (on the ${via}'s device)` : ''}`;
    const updated = await this.apply(p, {}, [this.entry(actor, 'ack', title)], { push: { acks: ack } });
    return this.tryActivate(updated, actor);
  }

  // ── Renewal ──────────────────────────────────────────────────────────────

  /** Body: { actor, newIssuerId?, newHolderId?, gasReadings?, remark? } */
  async requestRenewal(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const p = await this.load(id);
    if (!canManageAsIssuer(actor, p)) throw new ForbiddenException('Only the issuer requests a renewal');
    if (p.status !== 'ACTIVE') throw new BadRequestException('Only an active permit can be renewed');
    if (p.renewals.some((r) => r.status === 'pending')) throw new BadRequestException('A renewal is already pending');
    const blocker = renewalBlocker(p);
    if (blocker) throw new BadRequestException(blocker);

    const newIssuerId = str(body.newIssuerId, 80) || undefined;
    if (newIssuerId && newIssuerId !== p.issuerId) {
      const emp = await this.employeeModel.findOne({ id: newIssuerId }).lean().exec();
      if (!emp || emp.siteId !== p.siteId || !ISSUER_CATEGORIES.includes(emp.employeeCategory)) {
        throw new BadRequestException('The incoming issuer must be a Supervisor, Shift In-Charge or Plant Manager at this plant');
      }
    }
    const newHolderId = str(body.newHolderId, 80) || undefined;
    if (newHolderId && !p.workerIds.includes(newHolderId)) throw new BadRequestException('The new holder must be one of the workers');

    const n = p.renewalCount + 1;
    const set: Record<string, unknown> = { status: 'RENEWAL_PENDING' };
    const push: Record<string, unknown> = {};
    const timeline: EPermitTimelineEntry[] = [];
    if (requiresFireGas(p.category)) {
      const readings = (Array.isArray(body.gasReadings) ? body.gasReadings : [])
        .filter((r: any) => r && GAS_LIMITS[r.gas as GasKey])
        .map((r: any) => ({ gas: r.gas as GasKey, value: Number(r.value) }));
      if (!readings.some((r) => r.gas === 'oxygen')) throw new BadRequestException('Hot work: take a fresh oxygen reading for the renewal');
      const bad = validateGasReadings(readings);
      if (bad.length) throw new BadRequestException(bad.join('; '));
      push.gasReadings = { $each: readings.map((r) => ({ ...r, unit: GAS_LIMITS[r.gas].unit, ok: true, round: n, by: actor.id, byName: actor.name, at: nowIso() })) };
      timeline.push(this.entry(actor, 'gas', `Gas readings for renewal ${n}`, readings.map((r) => `${GAS_LIMITS[r.gas].label} ${r.value} ${GAS_LIMITS[r.gas].unit}`).join(', ')));
    }
    const w = renewalWindow(p);
    const renewal: EPermitRenewal = {
      n,
      ref: renewalRef(p.permitNo, n),
      status: 'pending',
      shiftCode: w.shiftCode,
      validFrom: w.validFrom,
      validTo: w.validTo,
      requestedBy: actor.id,
      requestedByName: actor.name,
      requestedAt: nowIso(),
      ...(newIssuerId && newIssuerId !== p.issuerId ? { newIssuerId } : {}),
      ...(newHolderId && newHolderId !== p.holderId ? { newHolderId } : {}),
      ...(str(body.remark, 500) ? { remark: str(body.remark, 500) } : {}),
    };
    push.renewals = renewal;
    timeline.push(this.entry(actor, 'renewal', `Renewal ${n} requested (shift ${w.shiftCode})`,
      `${fmtLocal(w.validFrom)} → ${fmtLocal(w.validTo)}${renewal.newIssuerId ? ` · incoming issuer ${await this.nameOf(renewal.newIssuerId)}` : ''}${renewal.newHolderId ? ` · new holder ${await this.nameOf(renewal.newHolderId)}` : ''}`));
    const updated = await this.apply(p, set, timeline, { push });
    await this.notify(await this.authoriserIds(updated), actor.id, 'e_permit_renewal', `Renewal ${n} to approve: ${this.label(updated)}`,
      `Next shift ${w.shiftCode}, ${fmtLocal(w.validFrom)} → ${fmtLocal(w.validTo)}.`, updated);
    await this.notify([...updated.workerIds, renewal.newIssuerId ?? ''], actor.id, 'e_permit_ack', `Acknowledge renewal ${n}: ${updated.permitNo}`,
      `The permit continues into shift ${w.shiftCode}. Acknowledge to keep working.`, updated);
    return updated;
  }

  /** Authoriser approves / rejects the pending renewal. Body: { actor, decision: approve|reject, remark? } */
  async decideRenewal(id: string, body: Record<string, any>) {
    const viewer = await this.viewer(body.actor);
    const p = await this.load(id);
    if (p.status !== 'RENEWAL_PENDING') throw new BadRequestException('No renewal is pending');
    if (!canActAsAuthoriser(viewer, p)) throw new ForbiddenException('Only the Authoriser approves a renewal');
    const r = p.renewals.find((x) => x.status === 'pending');
    if (!r) throw new BadRequestException('No renewal is pending');
    const remark = str(body.remark, 1000);
    const at = nowIso();

    if (body.decision === 'reject') {
      if (!remark) throw new BadRequestException('Say why the renewal is rejected');
      const renewals = p.renewals.map((x) => (x.n === r.n && x.status === 'pending' ? { ...x, status: 'rejected', decidedBy: viewer.id, decidedByName: viewer.name, decidedAt: at, remark } : x));
      const updated = await this.apply(p, { status: 'ACTIVE', renewals }, [this.entry(viewer, 'renewal', `Renewal ${r.n} rejected`, remark)]);
      await this.notify(this.crew(updated), viewer.id, 'e_permit_renewal', `Renewal ${r.n} rejected: ${updated.permitNo}`,
        `${remark}. Work must stop at ${fmtLocal(updated.validTo)} — return the permit.`, updated);
      return updated;
    }
    if (body.decision !== 'approve') throw new BadRequestException('decision must be approve or reject');

    const issuerId = r.newIssuerId ?? p.issuerId;
    const holderId = r.newHolderId ?? p.holderId;
    const needed = [...new Set([holderId, ...p.workerIds, ...(r.newIssuerId ? [r.newIssuerId] : [])])];
    const acked = new Set(p.acks.filter((a) => a.context === 'renewal' && a.round === r.n).map((a) => a.personId));
    const missing = needed.filter((x) => !acked.has(x));
    if (missing.length) {
      const names = await Promise.all(missing.map((m) => this.nameOf(m)));
      throw new BadRequestException(`Waiting for acknowledgements: ${names.join(', ')}`);
    }

    const renewals = p.renewals.map((x) => (x.n === r.n && x.status === 'pending' ? { ...x, status: 'approved', decidedBy: viewer.id, decidedByName: viewer.name, decidedAt: at, ...(remark ? { remark } : {}) } : x));
    const set: Record<string, unknown> = {
      status: 'ACTIVE',
      renewals,
      renewalCount: r.n,
      validFrom: r.validFrom,
      validTo: r.validTo,
      shiftCode: r.shiftCode,
      holderId,
    };
    if (issuerId !== p.issuerId) {
      set.issuerId = issuerId;
      set.issuerName = await this.nameOf(issuerId);
      set.previousIssuerIds = [...new Set([...(p.previousIssuerIds ?? []), p.issuerId])];
    }
    const updated = await this.apply(p, set, [this.entry(viewer, 'renewal', `Renewal ${r.n} approved (${r.ref})`, `Valid to ${fmtLocal(r.validTo)} · shift ${r.shiftCode}`)]);
    await this.notify(this.crew(updated), viewer.id, 'e_permit_renewal', `Renewal ${r.n} approved: ${updated.permitNo}`,
      `Valid to ${fmtLocal(r.validTo)} (shift ${r.shiftCode}).`, updated);
    return updated;
  }

  // ── Suspend / resume ─────────────────────────────────────────────────────

  async suspend(id: string, body: Record<string, any>) {
    const viewer = await this.viewer(body.actor);
    const p = await this.load(id);
    if (!canSuspend(viewer, p)) throw new ForbiddenException('You cannot suspend this permit');
    const reason = str(body.reason, 500);
    if (!reason) throw new BadRequestException('Say why work is being suspended');
    return this.doSuspend(p, viewer, reason);
  }

  private async doSuspend(p: Permit, actor: EPermitActorInput, reason: string) {
    if (!LIVE_STATUSES.includes(p.status as EPermitStatus)) throw new BadRequestException('Only live permits can be suspended');
    this.transition(p, 'SUSPENDED');
    const updated = await this.apply(
      p,
      { status: 'SUSPENDED', suspension: { by: actor.id, byName: actor.name, at: nowIso(), reason, fromStatus: p.status } },
      [this.entry(actor, 'suspend', 'Work suspended', reason)],
    );
    await this.notify([...this.crew(updated), ...(await this.authoriserIds(updated))], actor.id, 'e_permit_suspended',
      `STOP WORK — permit suspended: ${this.label(updated)}`, reason, updated);
    return updated;
  }

  /** Site emergency / alarm: suspend every live permit at the site. Body: { actor, reason } */
  async suspendSite(siteId: string, body: Record<string, any>) {
    const viewer = await this.viewer(body.actor);
    if (!canSuspendSite(viewer, siteId)) throw new ForbiddenException('Only the Plant Manager, Safety In-charge or Director can stop all work at a site');
    const reason = str(body.reason, 500);
    if (!reason) throw new BadRequestException('Say why all work is being stopped');
    return this.suspendAllAtSite(siteId, viewer, reason);
  }

  /** Also called by Safety when an emergency is raised at the site. */
  async suspendAllAtSite(siteId: string, actor: EPermitActorInput = SYSTEM, reason = 'Site emergency') {
    const live = (await this.permitModel.find({ siteId, status: { $in: LIVE_STATUSES } }).lean().exec()) as Permit[];
    const out: string[] = [];
    for (const p of live) {
      try {
        await this.doSuspend(p, actor, reason);
        out.push(p.id);
      } catch {
        /* changed meanwhile — skip */
      }
    }
    return { suspended: out };
  }

  /** Authoriser re-validates. Body: { actor, gasReadings? (hot work), remark? } — the validity clock does not extend. */
  async resume(id: string, body: Record<string, any>) {
    const viewer = await this.viewer(body.actor);
    const p = await this.load(id);
    if (p.status !== 'SUSPENDED') throw new BadRequestException('This permit is not suspended');
    if (!canActAsAuthoriser(viewer, p)) throw new ForbiddenException('Only the Authoriser re-validates a suspended permit');
    const back = (p.suspension?.fromStatus as EPermitStatus) || 'ACTIVE';
    const push: Record<string, unknown> = {};
    const timeline: EPermitTimelineEntry[] = [];
    if (requiresFireGas(p.category)) {
      const readings = (Array.isArray(body.gasReadings) ? body.gasReadings : [])
        .filter((r: any) => r && GAS_LIMITS[r.gas as GasKey])
        .map((r: any) => ({ gas: r.gas as GasKey, value: Number(r.value) }));
      if (!readings.some((r) => r.gas === 'oxygen')) throw new BadRequestException('Hot work: take a fresh oxygen reading before resuming');
      const bad = validateGasReadings(readings);
      if (bad.length) throw new BadRequestException(bad.join('; '));
      push.gasReadings = { $each: readings.map((r) => ({ ...r, unit: GAS_LIMITS[r.gas].unit, ok: true, round: -1, by: viewer.id, byName: viewer.name, at: nowIso() })) };
      timeline.push(this.entry(viewer, 'gas', 'Gas readings before resuming', readings.map((r) => `${GAS_LIMITS[r.gas].label} ${r.value} ${GAS_LIMITS[r.gas].unit}`).join(', ')));
    }
    timeline.push(this.entry(viewer, 'resume', 'Re-validated — work may resume', str(body.remark, 500) || undefined));
    const updated = await this.apply(p, { status: back }, timeline, { unset: { suspension: '' }, push });
    await this.notify(this.crew(updated), viewer.id, 'e_permit_resumed', `Work may resume: ${this.label(updated)}`,
      `Valid to ${fmtLocal(updated.validTo)}.`, updated);
    return updated;
  }

  // ── Return ───────────────────────────────────────────────────────────────

  /** Step 1 — the Holder declares site & equipment safe. Body: { actor } (holder, or issuer in person). */
  async declareSiteSafe(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const p = await this.load(id);
    if (![...LIVE_STATUSES, 'SUSPENDED'].includes(p.status)) throw new BadRequestException('This permit is not in progress');
    const via = ackViaFor(actor.id, p.holderId, p);
    if (!via) throw new ForbiddenException('The Permit Holder declares the site safe (or the issuer, in person)');
    const at = nowIso();
    const holderName = await this.nameOf(p.holderId);
    const ack: EPermitAck = { personId: p.holderId, personName: holderName, role: 'holder', context: 'return', round: p.renewalCount, via, by: actor.id, at };
    return this.apply(
      p,
      { returnInfo: { ...(p.returnInfo ?? {}), outcome: p.returnInfo?.outcome ?? 'complete', holderAt: at, holderBy: p.holderId, holderName } },
      [this.entry(actor, 'return', `${holderName} declared site & equipment safe`, via !== 'self' ? `On the ${via}'s device` : undefined)],
      { push: { acks: ack } },
    );
  }

  /** Step 2 — the Issuer returns the permit. Body: { actor, outcome: complete|incomplete|cancelled, note? } */
  async returnPermit(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const p = await this.load(id);
    if (!canManageAsIssuer(actor, p)) throw new ForbiddenException('Only the issuer returns the permit');
    if (![...LIVE_STATUSES, 'SUSPENDED'].includes(p.status)) throw new BadRequestException('This permit is not in progress');
    if (!p.returnInfo?.holderAt) throw new BadRequestException('The Permit Holder must first declare the site safe');
    const outcome = body.outcome as ReturnOutcome;
    if (!RETURN_OUTCOME_LABELS[outcome]) throw new BadRequestException('outcome must be complete, incomplete or cancelled');
    const note = str(body.note, 1000);
    if (outcome !== 'complete' && !note) throw new BadRequestException('Add a note saying what is left / why');
    this.transition(p, 'RETURN_PENDING');
    const at = nowIso();
    const set: Record<string, unknown> = {
      status: 'RETURN_PENDING',
      returnInfo: {
        ...p.returnInfo,
        outcome,
        ...(note ? { note } : {}),
        issuerAt: at,
        issuerBy: actor.id,
        issuerName: actor.name,
        returnedFrom: p.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
      },
    };
    const timeline = [this.entry(actor, 'return', `Returned — ${RETURN_OUTCOME_LABELS[outcome]}`, note || undefined)];
    if (p.renewals.some((r) => r.status === 'pending')) {
      // A pending renewal is withdrawn once the permit is handed back
      set.renewals = p.renewals.map((r) =>
        r.status === 'pending' ? { ...r, status: 'rejected', decidedBy: actor.id, decidedByName: actor.name, decidedAt: at, remark: 'Withdrawn — permit returned' } : r,
      );
      timeline.push(this.entry(actor, 'renewal', 'Pending renewal withdrawn — permit returned'));
    }
    const updated = await this.apply(p, set, timeline);
    await this.notify(await this.authoriserIds(updated), actor.id, 'e_permit_return', `Return to accept: ${this.label(updated)}`,
      `${RETURN_OUTCOME_LABELS[outcome]}${note ? ` — ${note}` : ''}`, updated);
    return updated;
  }

  /** Step 3 — the Authoriser accepts (closes) or sends it back. Body: { actor, decision: accept|send_back, remark? } */
  async acceptReturn(id: string, body: Record<string, any>) {
    const viewer = await this.viewer(body.actor);
    const p = await this.load(id);
    if (p.status !== 'RETURN_PENDING') throw new BadRequestException('No return is waiting');
    if (!canActAsAuthoriser(viewer, p)) throw new ForbiddenException('Only the Authoriser accepts the return');
    const remark = str(body.remark, 1000);
    if (body.decision === 'send_back') {
      if (!remark) throw new BadRequestException('Say why it is sent back');
      const back: EPermitStatus = p.returnInfo?.returnedFrom === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
      this.transition(p, back);
      const updated = await this.apply(
        p,
        { status: back },
        [this.entry(viewer, 'return', back === 'SUSPENDED' ? 'Return sent back — permit stays suspended' : 'Return sent back — work continues', remark)],
        { unset: { returnInfo: '' } },
      );
      await this.notify(this.crew(updated), viewer.id, 'e_permit_return', `Return sent back: ${updated.permitNo}`, remark, updated);
      return updated;
    }
    if (body.decision !== 'accept') throw new BadRequestException('decision must be accept or send_back');
    const outcome = (p.returnInfo?.outcome ?? 'complete') as ReturnOutcome;
    const to: EPermitStatus = outcome === 'complete' ? 'COMPLETED' : outcome === 'incomplete' ? 'RETURNED_INCOMPLETE' : 'CANCELLED';
    this.transition(p, to);
    const at = nowIso();
    const hours = actualHours(p.firstValidFrom, at);
    const updated = await this.apply(
      p,
      {
        status: to,
        completedAt: at,
        actualHours: hours,
        returnInfo: { ...p.returnInfo, authoriserAt: at, authoriserBy: viewer.id, authoriserName: viewer.name },
      },
      [this.entry(viewer, 'return', `Return accepted — ${RETURN_OUTCOME_LABELS[outcome]}`, `${hours} h on permit${remark ? ` · ${remark}` : ''}`)],
    );
    await this.notify(this.crew(updated), viewer.id, 'e_permit_closed', `Permit closed: ${this.label(updated)}`,
      `${RETURN_OUTCOME_LABELS[outcome]} at ${fmtLocal(at)} · ${hours} h`, updated);
    return updated;
  }

  // ── Cancel ───────────────────────────────────────────────────────────────

  /** Before work: issuer (or PM / Director). During work: Plant Manager / Director only — otherwise use the return flow. */
  async cancel(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const p = await this.load(id);
    if (TERMINAL_STATUSES.includes(p.status as EPermitStatus)) throw new BadRequestException('This permit is already closed');
    const remark = str(body.remark, 1000);
    if (!remark) throw new BadRequestException('Say why the permit is cancelled');
    const beforeWork = ['DRAFT', 'PENDING_APPROVAL', 'REJECTED'].includes(p.status);
    if (beforeWork) {
      if (!canManageAsIssuer(actor, p)) throw new ForbiddenException('Only the issuer cancels this permit');
    } else if (!canOverrideSoftBlocks(actor, p.siteId)) {
      throw new ForbiddenException('Work has started — return the permit with outcome "Cancelled", or ask the Plant Manager');
    }
    this.transition(p, 'CANCELLED');
    const at = nowIso();
    const set: Record<string, unknown> = { status: 'CANCELLED', completedAt: at };
    if (p.firstValidFrom) set.actualHours = actualHours(p.firstValidFrom, at);
    const updated = await this.apply(p, set, [this.entry(actor, 'cancel', 'Permit cancelled', remark)]);
    await this.notify([...this.crew(updated), ...(await this.authoriserIds(updated))], actor.id, 'e_permit_closed',
      `Permit cancelled: ${this.label(updated)}`, remark, updated);
    return updated;
  }

  // ── Emergency post-review ────────────────────────────────────────────────

  /** Body: { actor, kind, departmentId?, decision: approve|reject, remark } — reject = concern raised. */
  async postReview(id: string, body: Record<string, any>) {
    const viewer = await this.viewer(body.actor);
    const p = await this.load(id);
    if (!p.emergency) throw new BadRequestException('Only emergency permits have post-reviews');
    const kind = str(body.kind, 20);
    const departmentId = str(body.departmentId, 80) || undefined;
    const idx = p.postReviews.findIndex((a) => a.kind === kind && (a.departmentId ?? undefined) === departmentId);
    if (idx === -1) throw new BadRequestException('No such review on this permit');
    if (p.postReviews[idx].status !== 'pending') throw new BadRequestException('Already reviewed');
    if (!canDecideApproval(viewer, p.postReviews[idx], p)) throw new ForbiddenException('You cannot review this');
    const remark = str(body.remark, 1000);
    const decision = body.decision === 'reject' ? 'rejected' : 'approved';
    if (decision === 'rejected' && !remark) throw new BadRequestException('Describe the concern');
    const postReviews = p.postReviews.map((a, i) =>
      i === idx ? { ...a, status: decision, decidedBy: viewer.id, decidedByName: viewer.name, at: nowIso(), ...(remark ? { remark } : {}) } : a,
    );
    const what = `${APPROVAL_KIND_LABELS[p.postReviews[idx].kind]} post-review`;
    const updated = await this.apply(p, { postReviews }, [this.entry(viewer, 'review', decision === 'approved' ? `${what}: OK` : `${what}: concern raised`, remark || undefined)]);
    if (decision === 'rejected') {
      await this.notify([...(await this.siteManagerIds(p.siteId)), ...(await this.directorIds())], viewer.id, 'e_permit_review',
        `Concern on emergency permit ${updated.permitNo}`, remark, updated);
    }
    return updated;
  }

  // ── OT link ──────────────────────────────────────────────────────────────

  async linkOt(id: string, body: Record<string, any>) {
    const actor = this.actor(body.actor);
    const p = await this.load(id);
    if (!canRaisePermitOt(actor, p)) throw new ForbiddenException('Only the Plant Manager or Director links OT');
    const otDecisionId = str(body.otDecisionId, 80);
    if (!otDecisionId) throw new BadRequestException('otDecisionId is required');
    if (p.otDecisionIds.includes(otDecisionId)) return p;
    return this.apply(p, { otDecisionIds: [...p.otDecisionIds, otDecisionId] }, [
      this.entry(actor, 'ot', `OT decision ${otDecisionId} raised`, str(body.note, 300) || undefined),
    ]);
  }

  // ── Scheduler ────────────────────────────────────────────────────────────

  /** One pass: 1 h warnings, overdue alerts, lapsed approvals, overdue emergency post-reviews. */
  async tick(now = Date.now()) {
    const open = (await this.permitModel
      .find({ status: { $in: ['PENDING_APPROVAL', ...LIVE_STATUSES, 'SUSPENDED'] } })
      .lean()
      .exec()) as Permit[];
    const counts = { warned: 0, overdue: 0, lapsed: 0, escalated: 0 };
    for (const p of open) {
      try {
        if (shouldWarn(p as any, now)) {
          await this.permitModel.updateOne({ id: p.id }, { $set: { warnedForValidTo: p.validTo }, $push: { timeline: this.entry(SYSTEM, 'warning', '1 hour left on this permit') } }).exec();
          await this.notify([...this.crew(p), ...(await this.authoriserIds(p))], undefined, 'e_permit_warning', `1 hour left: ${this.label(p)}`,
            `Valid to ${fmtLocal(p.validTo)}. Return the permit or request a renewal.`, p);
          counts.warned++;
        }
        if (shouldNotifyOverdue(p as any, now)) {
          await this.permitModel.updateOne({ id: p.id }, { $set: { overdueNotifiedFor: p.validTo }, $push: { timeline: this.entry(SYSTEM, 'overdue', 'Overdue — past the end of the shift') } }).exec();
          await this.notify([...this.crew(p), ...(await this.authoriserIds(p)), ...(await this.siteManagerIds(p.siteId))], undefined, 'e_permit_overdue',
            `OVERDUE: ${this.label(p)}`, `Ended ${fmtLocal(p.validTo)} and is still open. Return it, renew it, or raise OT for the extra hours.`, p);
          counts.overdue++;
        }
        if (approvalsLapsed(p as any, now)) {
          const approvals = p.approvals.map((a) => ({ kind: a.kind, ...(a.departmentId ? { departmentId: a.departmentId } : {}), status: 'pending' as const }));
          await this.permitModel.updateOne(
            { id: p.id, status: 'PENDING_APPROVAL' },
            { $set: { approvals }, $unset: { firstApprovalAt: '' }, $push: { timeline: this.entry(SYSTEM, 'lapse', `Approvals lapsed (not active within ${EPERMIT_POLICY.clearanceValidityHours} h) — re-requested`) } },
          ).exec();
          for (const a of approvals) {
            await this.notify(await this.approverIds(p, a), undefined, 'e_permit_approval', `Approval needed again: ${this.label(p)}`,
              `Earlier approvals lapsed after ${EPERMIT_POLICY.clearanceValidityHours} h.`, p);
          }
          await this.notify([p.issuerId], undefined, 'e_permit_lapse', `Approvals lapsed: ${p.permitNo}`, 'Approvals were re-requested.', p);
          counts.lapsed++;
        }
        if (postReviewOverdue(p as any, now) && !p.postReviewEscalatedAt) {
          await this.permitModel.updateOne({ id: p.id }, { $set: { postReviewEscalatedAt: new Date(now).toISOString() } }).exec();
          await this.notify(await this.directorIds(), undefined, 'e_permit_review', `Emergency post-review overdue: ${this.label(p)}`,
            `Reviews were due within ${EPERMIT_POLICY.emergency.postReviewWithinHours} h of activation.`, p);
          counts.escalated++;
        }
      } catch {
        /* one bad permit must not stop the others */
      }
    }
    // Closed emergency permits can still owe reviews
    const owing = (await this.permitModel
      .find({ emergency: true, 'postReviews.status': 'pending', postReviewEscalatedAt: { $exists: false }, status: { $in: TERMINAL_STATUSES } })
      .lean()
      .exec()) as Permit[];
    for (const p of owing) {
      if (!postReviewOverdue(p as any, now)) continue;
      await this.permitModel.updateOne({ id: p.id }, { $set: { postReviewEscalatedAt: new Date(now).toISOString() } }).exec();
      await this.notify(await this.directorIds(), undefined, 'e_permit_review', `Emergency post-review overdue: ${this.label(p)}`,
        `Reviews were due within ${EPERMIT_POLICY.emergency.postReviewWithinHours} h of activation.`, p);
      counts.escalated++;
    }
    return counts;
  }

  /** Overdue permits right now (for dashboards). */
  async overdueCount(siteId?: string) {
    const rows = (await this.permitModel.find({ status: { $in: LIVE_STATUSES }, ...(siteId ? { siteId } : {}) }, { status: 1, validTo: 1 }).lean().exec()) as Permit[];
    return rows.filter((p) => isOverdue(p as any, Date.now())).length;
  }
}
