/**
 * E-Permit clock + cross-module soft blocks, run inside the real Nest app against the TEST database:
 * 1 h warning, overdue alert (never auto-closes), approvals lapsing after 12 h, emergency post-review escalation,
 * and the Leave / Safety soft blocks on submit.
 *
 *   MONGODB_DB_NAME=nectar_enviro_test EPERMIT_SCHEDULER=off SAFETY_SCHEDULER=off EVENT_SCHEDULER=off \
 *     npx ts-node test/e-permits-clock.e2e.ts
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { EPermitsService } from '../src/modules/e-permits/e-permits.service';
import { EPermit } from '../db/schemas/e-permit.schema';
import { LeaveRequest } from '../db/schemas/leave-request.schema';
import { SafetyEvent } from '../db/schemas/safety-event.schema';
import { Notification } from '../db/schemas/notification.schema';
import { PermitLocation } from '../db/schemas/e-permit-master.schema';
import { FIRE_GAS_ITEMS, PPE_ITEMS, SAFETY_MEASURES, rotatingShiftAt } from '../src/modules/e-permits/e-permit-rules';

if (process.env.MONGODB_DB_NAME !== 'nectar_enviro_test') throw new Error('Run against MONGODB_DB_NAME=nectar_enviro_test only');
process.env.EPERMIT_SCHEDULER = 'off';
process.env.SAFETY_SCHEDULER = 'off';
process.env.EVENT_SCHEDULER = 'off';

let failures = 0;
let passes = 0;
const ok = (cond: unknown, msg: string, extra?: unknown) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && extra !== undefined ? `  → ${JSON.stringify(extra).slice(0, 300)}` : ''}`);
  if (cond) passes++;
  else failures++;
};

const HOUR = 3_600_000;
const SUP = { id: 'emp0125', name: 'Neetesh Diwathe', role: 'supervisor', siteId: 's-etp' };
const PM = { id: 'emp0123', name: 'Anand Dakave', role: 'manager', siteId: 's-etp' };
const SUP_MEE = { id: 'emp0141', name: 'Rushikesh Pawar', role: 'supervisor', siteId: 's-mee' };
const HOD_OPS = { id: 'user:hod.operations@nectarenviro.com', name: 'Rajendra Kulkarni', role: 'hod' };
const HOD_ELEC = { id: 'user:hod.electrical@nectarenviro.com', name: 'Vinod Deshmukh', role: 'hod' };
const DIRECTOR = 'user:director@nectarenviro.com';
const all = (defs: { key: string }[], yes: string[] = []) => defs.map((d) => ({ key: d.key, value: yes.includes(d.key) ? 'yes' : 'na' }));
/** Set once the app is up — puts back the locations' concerned departments, on success or failure. */
let restoreLocations: () => Promise<void> = async () => {};
const localDate = (ms: number) => new Date(ms + 330 * 60_000).toISOString().slice(0, 10);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const svc = app.get(EPermitsService);
  const permits = app.get<Model<EPermit>>(getModelToken(EPermit.name));
  const leaves = app.get<Model<LeaveRequest>>(getModelToken(LeaveRequest.name));
  const safety = app.get<Model<SafetyEvent>>(getModelToken(SafetyEvent.name));
  const notes = app.get<Model<Notification>>(getModelToken(Notification.name));
  const noteCount = (personId: string, permitId: string, kind: string) =>
    notes.countDocuments({ employeeId: personId, kind, 'meta.permitId': permitId }).exec();

  // These checks are about the clock, not who clears: run with no concerned departments, put them back at the end.
  const locations = app.get<Model<PermitLocation>>(getModelToken(PermitLocation.name));
  const concernedBefore = (await locations.find({}, { id: 1, concernedDepartmentIds: 1 }).lean().exec()) as any[];
  await locations.updateMany({}, { $set: { concernedDepartmentIds: [] } }).exec();
  restoreLocations = async () => {
    for (const l of concernedBefore) {
      await locations.updateOne({ id: l.id }, { $set: { concernedDepartmentIds: l.concernedDepartmentIds ?? [] } }).exec();
    }
  };

  const body = (actor: any, over: Record<string, unknown> = {}) => ({
    actor,
    siteId: 's-etp',
    locationId: 'loc-etp-clarifier',
    category: 'cold_work',
    subCategory: 'general_maintenance',
    shiftCode: rotatingShiftAt(Date.now()).shiftCode,
    description: 'Clock e2e',
    holderId: 'emp0126',
    workerIds: ['emp0126'],
    safetyMeasures: all(SAFETY_MEASURES),
    ppe: all(PPE_ITEMS),
    fireGas: [],
    certificates: [],
    ...over,
  });

  // ── Warning / overdue ──
  let p: any = await svc.create(body(SUP, { submit: true }));
  p = await svc.decide(p.id, { actor: HOD_OPS, kind: 'authoriser', departmentId: 'dept-operations', decision: 'approve' });
  p = await svc.acknowledge(p.id, { actor: { id: 'emp0126', name: 'Shilpa Hotkar', role: 'employee', siteId: 's-etp' } });
  ok(p.status === 'ACTIVE', 'permit active for the clock checks', p.status);
  const end = Date.parse(p.validTo);

  let c = await svc.tick(end - 2 * HOUR);
  ok(c.warned === 0 || !(await permits.findOne({ id: p.id }).lean())?.warnedForValidTo, 'no warning 2 h before the shift ends');
  c = await svc.tick(end - 30 * 60_000);
  let fresh: any = await permits.findOne({ id: p.id }).lean();
  ok(fresh.warnedForValidTo === p.validTo, '1 h warning sent 30 min before the end');
  ok((await noteCount('emp0126', p.id, 'e_permit_warning')) === 1, 'holder got the warning');
  ok((await noteCount(HOD_OPS.id, p.id, 'e_permit_warning')) === 1, 'Authoriser got the warning');
  await svc.tick(end - 20 * 60_000);
  ok((await noteCount('emp0126', p.id, 'e_permit_warning')) === 1, 'warning sent only once per shift end');

  await svc.tick(end + 10 * 60_000);
  fresh = await permits.findOne({ id: p.id }).lean();
  ok(fresh.status === 'ACTIVE', 'overdue permit is NOT closed automatically');
  ok(fresh.overdueNotifiedFor === p.validTo && fresh.timeline.some((t: any) => t.kind === 'overdue'), 'overdue recorded in the audit trail');
  ok((await noteCount('emp0123', p.id, 'e_permit_overdue')) === 1, 'Plant Manager alerted about the overdue permit');
  await svc.tick(end + 40 * 60_000);
  ok((await noteCount('emp0123', p.id, 'e_permit_overdue')) === 1, 'overdue alert sent once');
  await svc.cancel(p.id, { actor: PM, remark: 'clock e2e cleanup' });

  // ── Approvals lapse after 12 h ──
  let h: any = await svc.create({
    ...body(SUP_MEE),
    siteId: 's-mee',
    locationId: 'loc-mee-bay',
    category: 'hot_work',
    subCategory: 'welding',
    holderId: 'emp0143',
    workerIds: ['emp0143'],
    fireGas: all(FIRE_GAS_ITEMS, ['fire_watcher', 'fire_extinguishers']),
    gasReadings: [{ gas: 'oxygen', value: 20.9 }],
    submit: true,
  });
  h = await svc.decide(h.id, { actor: HOD_ELEC, kind: 'department', departmentId: 'dept-electrical', decision: 'approve' });
  ok(h.firstApprovalAt && h.status === 'PENDING_APPROVAL', 'one of two approvals in');
  await svc.tick(Date.parse(h.firstApprovalAt) + 11 * HOUR);
  fresh = await permits.findOne({ id: h.id }).lean();
  ok(fresh.approvals.some((a: any) => a.status === 'approved'), 'approval still valid after 11 h');
  await svc.tick(Date.parse(h.firstApprovalAt) + 13 * HOUR);
  fresh = await permits.findOne({ id: h.id }).lean();
  ok(fresh.approvals.every((a: any) => a.status === 'pending') && !fresh.firstApprovalAt, 'approvals lapse after 12 h and are re-requested');
  ok(fresh.timeline.some((t: any) => t.kind === 'lapse'), 'lapse is in the audit trail');
  await svc.cancel(h.id, { actor: SUP_MEE, remark: 'clock e2e cleanup' });

  // ── Emergency post-review escalation ──
  let e: any = await svc.create(body(SUP, { submit: true, emergency: true, locationId: 'loc-etp-workshop', subCategory: 'breakdown_repair', description: 'Clock e2e emergency' }));
  e = await svc.decide(e.id, { actor: PM, kind: 'emergency', decision: 'approve' });
  e = await svc.acknowledge(e.id, { actor: { id: 'emp0126', name: 'Shilpa Hotkar', role: 'employee', siteId: 's-etp' } });
  ok(e.status === 'ACTIVE' && e.postReviews.length === 1, 'emergency permit active with a post-review owed');
  await svc.tick(Date.parse(e.firstValidFrom) + 25 * HOUR);
  fresh = await permits.findOne({ id: e.id }).lean();
  ok(fresh.postReviewEscalatedAt, 'post-review overdue after 24 h → escalated');
  ok((await noteCount(DIRECTOR, e.id, 'e_permit_review')) >= 1, 'Director notified about the overdue review');
  await svc.cancel(e.id, { actor: PM, remark: 'clock e2e cleanup' });

  // ── Leave soft block ──
  const today = localDate(Date.now());
  await leaves.create({
    id: 'lv-epermit-e2e',
    employeeId: 'emp0130',
    employeeName: 'Sandip Ohol',
    siteId: 's-etp',
    leaveType: 'casual',
    status: 'APPROVED',
    startDate: today,
    endDate: today,
    reason: 'e2e',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
  const onLeave: any = await svc.create(body(SUP, { holderId: 'emp0130', workerIds: ['emp0130'], description: 'Leave soft block' }));
  let msg = '';
  try {
    await svc.submit(onLeave.id, { actor: SUP });
  } catch (err: any) {
    msg = JSON.stringify(err.getResponse?.() ?? err.message);
  }
  ok(/on approved leave/.test(msg), 'worker on approved leave soft-blocks the permit', msg);
  await leaves.deleteOne({ id: 'lv-epermit-e2e' });
  await svc.cancel(onLeave.id, { actor: SUP, remark: 'cleanup' });

  // ── Safety return-to-work soft block ──
  await safety.create({
    id: 'inc-epermit-e2e',
    type: 'incident',
    siteId: 's-etp',
    title: 'E2E clearance case',
    occurredAt: new Date().toISOString(),
    reportedAt: new Date().toISOString(),
    category: 'medical',
    severity: 'high',
    status: 'INVESTIGATING',
    reportedBy: { personId: 'emp0123', name: 'Anand Dakave', role: 'manager' },
    involved: ['emp0129'],
    requiresReturnClearance: true,
    clearance: [{ employeeId: 'emp0129', status: 'pending' }],
  } as any);
  const cleared: any = await svc.create(body(SUP, { holderId: 'emp0129', workerIds: ['emp0129'], description: 'Clearance soft block' }));
  msg = '';
  try {
    await svc.submit(cleared.id, { actor: SUP });
  } catch (err: any) {
    msg = JSON.stringify(err.getResponse?.() ?? err.message);
  }
  ok(/safety return-to-work clearance/.test(msg), 'worker awaiting safety clearance soft-blocks the permit', msg);
  const overridden: any = await svc.submit(cleared.id, { actor: PM, overrideSoftBlocks: true, overrideRemark: 'Cleared verbally by doctor' });
  ok(overridden.status === 'PENDING_APPROVAL' && overridden.overrides.length === 1, 'Plant Manager override recorded');
  await safety.deleteOne({ id: 'inc-epermit-e2e' });
  await svc.cancel(cleared.id, { actor: SUP, remark: 'cleanup' });

  await restoreLocations();
  await app.close();
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await restoreLocations().catch(() => {});
  process.exit(1);
});
