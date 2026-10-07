/**
 * End-to-end check of E-Permits (Permit to Work): issue → approvals → acknowledgements → active (one shift) →
 * renewal (re-approval, max 2) → suspend / resume → 3-step return, plus emergency permits, the Safety gate,
 * conflicts / overrides, site-wide stop, the Safety-emergency hook, visibility and permissions.
 * Run against a server pointed at a TEST database (never the main one):
 *
 *   npx ts-node db/scripts/copy-to-test-db.ts
 *   MONGODB_DB_NAME=nectar_enviro_test npx ts-node db/seeds/e-permit-only.ts
 *   PORT=3011 MONGODB_DB_NAME=nectar_enviro_test EPERMIT_SCHEDULER=off SAFETY_SCHEDULER=off EVENT_SCHEDULER=off node dist/src/main.js
 *   API=http://localhost:3011/api npx ts-node test/e-permits.e2e.ts
 */
import {
  EPERMIT_POLICY,
  FIRE_GAS_ITEMS,
  PPE_ITEMS,
  SAFETY_MEASURES,
  financialYear,
  renewalWindow,
  rotatingShiftAt,
  shiftWindow,
} from '../src/modules/e-permits/e-permit-rules';

const API = process.env.API ?? 'http://localhost:3011/api';
if (/localhost:3001/.test(API)) throw new Error('Point API at the test server, not the main one');

let failures = 0;
let passes = 0;
const ok = (cond: unknown, msg: string, extra?: unknown) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && extra !== undefined ? `  → ${JSON.stringify(extra).slice(0, 400)}` : ''}`);
  if (cond) passes++;
  else failures++;
};

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* text */
  }
  return { status: res.status, data };
}

type Actor = { id: string; name: string; role: string; siteId?: string };
const A = (id: string, name: string, role: string, siteId?: string): Actor => ({ id, name, role, siteId });

// ETP (Thane)
const PM_ETP = A('emp0123', 'Anand Dakave', 'manager', 's-etp');
const SIC_ETP = A('emp0124', 'Bidhichand Rajbhar', 'shift_incharge', 's-etp');
const SUP_ETP = A('emp0125', 'Neetesh Diwathe', 'supervisor', 's-etp');
const W1 = A('emp0126', 'Shilpa Hotkar', 'employee', 's-etp'); // holder
const W2 = A('emp0127', 'Rohit Kumar Singh', 'employee', 's-etp');
const W3 = A('emp0128', 'Mohee Vinchu', 'employee', 's-etp'); // not on the first permit
const W4 = A('emp0129', 'Sanket Jagadale', 'employee', 's-etp');
// RO / MEE
const SUP_RO = A('emp0133', 'Vikas Dabade', 'supervisor', 's-ro');
const PM_MEE = A('emp0139', 'Sanjay Waghaskar', 'manager', 's-mee');
const SUP_MEE = A('emp0141', 'Rushikesh Pawar', 'supervisor', 's-mee');
const M1 = A('emp0142', 'Abhinandan Sanjay Pawane', 'employee', 's-mee');
const M2 = A('emp0143', 'Bhairavi Kadu', 'employee', 's-mee');
// Org
const HR = A('emp0147', 'Swati Ingle', 'hr');
const DIRECTOR = A('user:director@nectarenviro.com', 'Prashant Rohidas Adsul', 'director');
const SAFETY = A('user:safety@nectarenviro.com', 'Safety In-Charge', 'safety_incharge', 's-etp');
const HOD_OPS = A('user:hod.operations@nectarenviro.com', 'Rajendra Kulkarni', 'hod');
const DY_OPS = A('user:dy.operations@nectarenviro.com', 'Meera Joshi', 'hod');
const HOD_ELEC = A('user:hod.electrical@nectarenviro.com', 'Vinod Deshmukh', 'hod');
const HOD_MECH = A('user:hod.mechanical@nectarenviro.com', 'Suresh Gaikwad', 'hod');
const HOD_CHEM = A('user:hod.chemical@nectarenviro.com', 'Archana Mehta', 'hod');

const all = (defs: { key: string }[], yes: string[] = []) => defs.map((d) => ({ key: d.key, value: yes.includes(d.key) ? 'yes' : 'na' }));
const viewerQ = (v: Actor) => `viewerId=${encodeURIComponent(v.id)}&viewerRole=${v.role}${v.siteId ? `&viewerSiteId=${v.siteId}` : ''}`;
const get = (id: string, v: Actor) => call('GET', `/e-permits/${id}?${viewerQ(v)}`);
const list = async (v: Actor, extra = '') => (await call('GET', `/e-permits?${viewerQ(v)}${extra}`)).data as any[];
const notes = async (personId: string) => (await call('GET', `/notifications?employeeId=${encodeURIComponent(personId)}`)).data as any[];
const hasNote = async (personId: string, permitId: string, kind: string) =>
  (await notes(personId)).some((n) => n.kind === kind && n.meta?.permitId === permitId);

/** The rotating shift running now — permits issued on it are valid until its end. */
const currentShift = () => rotatingShiftAt(Date.now()).shiftCode;

function coldBody(actor: Actor, over: Record<string, unknown> = {}) {
  return {
    actor,
    siteId: 's-etp',
    locationId: 'loc-etp-clarifier',
    category: 'cold_work',
    subCategory: 'general_maintenance',
    shiftCode: currentShift(),
    description: 'E2E: replace clarifier scraper bearing',
    hazardsText: 'Pinch points — gloves',
    jsaRef: 'JSA/E2E/1',
    holderId: W1.id,
    workerIds: [W1.id, W2.id],
    safetyMeasures: all(SAFETY_MEASURES, ['drained_cleaned']),
    ppe: all(PPE_ITEMS, ['head', 'leg_apron']),
    fireGas: [],
    certificates: [{ key: 'tool_box_talk', value: 'yes', refNo: 'TBT/E2E/1' }],
    ...over,
  };
}

/** Drive a submitted permit to ACTIVE: approvals by `approvers`, acknowledgements by everyone. */
async function activate(id: string, approvers: { actor: Actor; kind: string; departmentId?: string }[], crew: Actor[]) {
  for (const a of approvers) {
    const r = await call('POST', `/e-permits/${id}/decide`, { actor: a.actor, kind: a.kind, departmentId: a.departmentId, decision: 'approve' });
    if (r.status >= 300) console.log('   approve failed', a.kind, r.data?.message);
  }
  let last: any;
  for (const c of crew) last = (await call('POST', `/e-permits/${id}/ack`, { actor: c })).data;
  return last;
}

/** Rerunnable: clear return-to-work clearances an earlier run left on the workers this suite uses. */
async function clearLeftoverClearances() {
  for (const w of [W1, W2, W3, W4, M1, M2]) {
    const pending = (await call('GET', `/safety/clearance/pending?employeeId=${w.id}`)).data as any[];
    for (const c of Array.isArray(pending) ? pending : []) {
      await call('POST', `/safety/events/${c.eventId}/clearance/${w.id}`, { actor: SAFETY, decision: 'cleared', remark: 'E2E reset' });
    }
  }
}

/**
 * Each location's concerned departments, as found. The main flow runs with every list cleared (so each section
 * tests just the rule it is about); the concerned-departments section sets its own; `restoreLocations` puts them back.
 */
let locationSnapshot: { id: string; ids: string[] }[] = [];
async function restoreLocations() {
  for (const l of locationSnapshot) {
    await call('PATCH', `/e-permits/locations/${l.id}/departments`, { actor: DIRECTOR, departmentIds: l.ids });
  }
}

async function main() {
  console.log(`E-Permits e2e → ${API}\n`);
  await clearLeftoverClearances();

  // ── Masters & policy ──
  const masters = (await call('GET', '/e-permits/masters')).data;
  ok(masters.departments?.length === 4, 'four departments seeded', masters.departments?.length);
  ok(masters.locations?.length >= 13, 'seeded locations present', masters.locations?.length);
  ok(masters.contacts?.some((c: any) => c.siteId === 's-etp'), 'ETP emergency contacts present');
  locationSnapshot = (masters.locations as any[]).map((l) => ({ id: l.id, ids: l.concernedDepartmentIds ?? [] }));
  ok(locationSnapshot.find((l) => l.id === 'loc-etp-aeration')?.ids.length === 3, 'Aeration tank seeded with 3 concerned departments');
  for (const l of locationSnapshot) {
    await call('PATCH', `/e-permits/locations/${l.id}/departments`, { actor: DIRECTOR, departmentIds: [] });
  }
  const ops = masters.departments.find((d: any) => d.id === 'dept-operations');
  ok(ops?.headUserId === HOD_OPS.id && ops.deputyUserIds.includes(DY_OPS.id), 'Operations HoD + deputy');
  const pol = (await call('GET', '/e-permits/policy')).data;
  ok(pol.policy?.version === EPERMIT_POLICY.version && pol.policy.maxRenewals === 2, 'policy endpoint returns v1 with 2 renewals');

  // ── Who may issue ──
  ok((await call('POST', '/e-permits', coldBody(W1))).status === 403, 'employee cannot issue');
  ok((await call('POST', '/e-permits', coldBody(HOD_OPS))).status === 403, 'HoD cannot issue');
  ok((await call('POST', '/e-permits', coldBody(SUP_RO))).status === 403, 'RO supervisor cannot issue for ETP');
  ok((await call('POST', '/e-permits', coldBody(SUP_ETP, { locationId: 'loc-ro-skid' }))).status === 400, 'location must be at the same plant');
  ok((await call('POST', '/e-permits', coldBody(SUP_ETP, { workerIds: [W1.id, M1.id] }))).status === 400, 'workers must be from the plant');
  ok((await call('POST', '/e-permits', coldBody(SUP_ETP, { subCategory: 'welding' }))).status === 400, 'type of work must match category');

  // ── Draft → submit ──
  const draftRes = await call('POST', '/e-permits', coldBody(SUP_ETP, { ppe: [] }));
  const P1 = draftRes.data;
  ok(draftRes.status === 201 && P1.status === 'DRAFT', 'supervisor drafts a permit', draftRes.data);
  const fy = String(financialYear(Date.now()) % 100).padStart(2, '0');
  ok(new RegExp(`^ETP/FY${fy}/\\d{5}$`).test(P1.permitNo), `permit number ETP/FY${fy}/nnnnn`, P1.permitNo);
  ok(P1.authoriserDepartmentId === 'dept-operations' && P1.policyVersion === 1, 'authoriser = owner dept, policy v1 stored');
  const bad = await call('POST', `/e-permits/${P1.id}/submit`, { actor: SUP_ETP });
  ok(bad.status === 400 && /PPE/.test(bad.data.message), 'submit blocked until every PPE line is answered', bad.data);
  ok((await call('PATCH', `/e-permits/${P1.id}`, { actor: SIC_ETP, ppe: all(PPE_ITEMS) })).status === 403, 'only the issuer edits the draft');
  ok((await call('PATCH', `/e-permits/${P1.id}`, { actor: SUP_ETP, ppe: all(PPE_ITEMS, ['head']) })).status === 200, 'issuer completes the draft');
  const sub = await call('POST', `/e-permits/${P1.id}/submit`, { actor: SUP_ETP });
  ok(sub.status === 201 && sub.data.status === 'PENDING_APPROVAL', 'submitted → pending approval', sub.data);
  ok(sub.data.approvals?.length === 1 && sub.data.approvals[0].kind === 'authoriser', 'needs only the Authoriser');
  ok(sub.data.acks?.some((a: any) => a.personId === SUP_ETP.id && a.role === 'issuer'), 'issuer acknowledged on submit');
  ok(await hasNote(HOD_OPS.id, P1.id, 'e_permit_approval'), 'HoD notified to approve');
  ok(await hasNote(W2.id, P1.id, 'e_permit_ack'), 'worker notified to acknowledge');

  // ── Visibility ──
  ok((await get(P1.id, W2)).status === 200, 'worker on the permit sees it');
  ok((await get(P1.id, W3)).status === 403, 'employee not on it does not');
  ok((await get(P1.id, SUP_RO)).status === 403, 'other plant supervisor does not');
  ok((await get(P1.id, HOD_ELEC)).status === 403, 'unconcerned HoD does not');
  ok((await get(P1.id, HOD_OPS)).status === 200, 'Authoriser HoD sees it');
  ok((await get(P1.id, HR)).status === 403, 'HR does not');
  ok((await get(P1.id, SIC_ETP)).status === 200 && (await get(P1.id, DIRECTOR)).status === 200, 'plant SIC and Director see it');
  ok((await list(W3)).every((p) => p.id !== P1.id) && (await list(W2)).some((p) => p.id === P1.id), 'list is scoped to concerned people');

  // ── Approvals ──
  ok((await call('POST', `/e-permits/${P1.id}/decide`, { actor: HOD_ELEC, kind: 'authoriser', departmentId: 'dept-operations', decision: 'approve' })).status === 403, 'wrong HoD cannot approve');
  ok((await call('POST', `/e-permits/${P1.id}/decide`, { actor: PM_ETP, kind: 'authoriser', departmentId: 'dept-operations', decision: 'approve' })).status === 403, 'Plant Manager is not the Authoriser');
  const dep = await call('POST', `/e-permits/${P1.id}/decide`, { actor: DY_OPS, kind: 'authoriser', departmentId: 'dept-operations', decision: 'approve' });
  ok(dep.status === 201 && dep.data.approvals[0].status === 'approved' && dep.data.approvals[0].onBehalfOf === 'Rajendra Kulkarni', 'deputy approves on behalf of the HoD', dep.data.approvals?.[0]);
  ok(dep.data.status === 'PENDING_APPROVAL', 'still pending until the crew acknowledges');

  // ── Acknowledgements ──
  ok((await call('POST', `/e-permits/${P1.id}/ack`, { actor: W3, personId: W2.id })).status === 403, 'outsider cannot acknowledge for a worker');
  ok((await call('POST', `/e-permits/${P1.id}/ack`, { actor: W2, personId: W3.id })).status === 400, 'cannot acknowledge for someone not on the permit');
  const viaHolder = await call('POST', `/e-permits/${P1.id}/ack`, { actor: W1, personId: W2.id, lat: 19.2, lng: 72.97 });
  ok(viaHolder.data.acks?.some((a: any) => a.personId === W2.id && a.via === 'holder' && a.lat === 19.2), 'worker acknowledged on the holder’s device, geo-stamped');
  const act = await call('POST', `/e-permits/${P1.id}/ack`, { actor: W1 });
  ok(act.data.status === 'ACTIVE', 'holder acknowledges → ACTIVE', act.data.status);
  const win = shiftWindow(currentShift(), Date.now());
  ok(act.data.validTo === win.end && act.data.firstValidFrom, 'valid until the end of the current shift', { validTo: act.data.validTo, end: win.end });
  ok(await hasNote(W2.id, P1.id, 'e_permit_active'), 'crew notified that the permit is active');

  // ── Reject → revise → cancel ──
  const P2 = (await call('POST', '/e-permits', coldBody(SIC_ETP, { submit: true, locationId: 'loc-etp-workshop', description: 'E2E: reject path' }))).data;
  ok(P2.status === 'PENDING_APPROVAL' && P2.approvals[0].departmentId === 'dept-mechanical', 'workshop permit → Mechanical authoriser');
  ok((await call('POST', `/e-permits/${P2.id}/decide`, { actor: HOD_MECH, kind: 'authoriser', departmentId: 'dept-mechanical', decision: 'reject' })).status === 400, 'rejecting needs a reason');
  const rej = await call('POST', `/e-permits/${P2.id}/decide`, { actor: HOD_MECH, kind: 'authoriser', departmentId: 'dept-mechanical', decision: 'reject', remark: 'Isolation not confirmed' });
  ok(rej.data.status === 'REJECTED', 'HoD rejects → REJECTED');
  ok(await hasNote(SIC_ETP.id, P2.id, 'e_permit_rejected'), 'issuer told why');
  const rev = await call('POST', `/e-permits/${P2.id}/revise`, { actor: SIC_ETP });
  ok(rev.data.status === 'DRAFT' && rev.data.approvals.length === 0 && rev.data.acks.length === 0, 'revise → draft, approvals + acks reset');
  ok((await call('POST', `/e-permits/${P2.id}/cancel`, { actor: SIC_ETP })).status === 400, 'cancel needs a reason');
  ok((await call('POST', `/e-permits/${P2.id}/cancel`, { actor: SIC_ETP, remark: 'Job dropped' })).data.status === 'CANCELLED', 'issuer cancels a draft');

  // ── Renewal = re-approval, max 2 ──
  ok((await call('POST', `/e-permits/${P1.id}/renewal`, { actor: W1 })).status === 403, 'worker cannot request renewal');
  const r1 = await call('POST', `/e-permits/${P1.id}/renewal`, { actor: SUP_ETP, newIssuerId: SIC_ETP.id });
  const exp1 = renewalWindow({ renewalCount: 0, firstValidFrom: act.data.firstValidFrom, validTo: act.data.validTo });
  ok(r1.data.status === 'RENEWAL_PENDING' && r1.data.renewals[0].validTo === exp1.validTo && r1.data.renewals[0].ref.endsWith('/R1'), 'renewal 1 requested for the next shift', r1.data.renewals?.[0]);
  ok((await call('POST', `/e-permits/${P1.id}/renewal/decide`, { actor: HOD_OPS, decision: 'approve' })).status === 400, 'cannot approve before the crew acknowledges');
  for (const c of [W1, W2]) await call('POST', `/e-permits/${P1.id}/ack`, { actor: c });
  const notYet = await call('POST', `/e-permits/${P1.id}/renewal/decide`, { actor: HOD_OPS, decision: 'approve' });
  ok(notYet.status === 400 && /Bidhichand/.test(notYet.data.message), 'incoming issuer must acknowledge too', notYet.data);
  await call('POST', `/e-permits/${P1.id}/ack`, { actor: SIC_ETP });
  ok((await call('POST', `/e-permits/${P1.id}/renewal/decide`, { actor: HOD_ELEC, decision: 'approve' })).status === 403, 'only the Authoriser approves the renewal');
  const r1ok = await call('POST', `/e-permits/${P1.id}/renewal/decide`, { actor: HOD_OPS, decision: 'approve' });
  ok(r1ok.data.status === 'ACTIVE' && r1ok.data.renewalCount === 1 && r1ok.data.validTo === exp1.validTo, 'renewal 1 approved — valid into the next shift');
  ok(r1ok.data.issuerId === SIC_ETP.id && r1ok.data.previousIssuerIds.includes(SUP_ETP.id), 'handover: SIC is now the issuer, supervisor kept in history');
  ok((await get(P1.id, SUP_ETP)).status === 200, 'previous issuer still sees the permit');
  ok((await call('POST', `/e-permits/${P1.id}/renewal`, { actor: SUP_ETP })).status === 403, 'previous issuer can no longer renew');

  await call('POST', `/e-permits/${P1.id}/renewal`, { actor: SIC_ETP, newHolderId: W2.id });
  for (const c of [W1, W2]) await call('POST', `/e-permits/${P1.id}/ack`, { actor: c });
  const r2 = await call('POST', `/e-permits/${P1.id}/renewal/decide`, { actor: HOD_OPS, decision: 'approve' });
  ok(r2.data.renewalCount === 2 && r2.data.holderId === W2.id, 'renewal 2 approved, holder changed');
  const span = Date.parse(r2.data.validTo) - Date.parse(r2.data.firstValidFrom);
  ok(span <= 24 * 3_600_000, 'never more than 24 h in total', span / 3_600_000);
  const r3 = await call('POST', `/e-permits/${P1.id}/renewal`, { actor: SIC_ETP });
  ok(r3.status === 400 && /Renewal limit|24 h/.test(r3.data.message), 'third renewal refused — new permit needed', r3.data);

  // ── Suspend / resume ──
  ok((await call('POST', `/e-permits/${P1.id}/suspend`, { actor: W1, reason: 'x' })).status === 403, 'worker cannot suspend');
  ok((await call('POST', `/e-permits/${P1.id}/suspend`, { actor: SAFETY })).status === 400, 'suspension needs a reason');
  const sus = await call('POST', `/e-permits/${P1.id}/suspend`, { actor: SAFETY, reason: 'Gas alarm nearby' });
  ok(sus.data.status === 'SUSPENDED' && sus.data.suspension?.fromStatus === 'ACTIVE', 'Safety In-charge suspends work');
  ok(await hasNote(W2.id, P1.id, 'e_permit_suspended'), 'crew told to stop work');
  ok((await call('POST', `/e-permits/${P1.id}/resume`, { actor: SIC_ETP })).status === 403, 'issuer cannot resume — Authoriser re-validates');
  const res = await call('POST', `/e-permits/${P1.id}/resume`, { actor: HOD_OPS, remark: 'Area re-checked' });
  ok(res.data.status === 'ACTIVE' && res.data.validTo === r2.data.validTo, 'Authoriser resumes; validity not extended');

  // ── Return: Holder → Issuer → Authoriser ──
  ok((await call('POST', `/e-permits/${P1.id}/return`, { actor: SIC_ETP, outcome: 'complete' })).status === 400, 'issuer cannot return before the holder declares safe');
  ok((await call('POST', `/e-permits/${P1.id}/site-safe`, { actor: W3 })).status === 403, 'only the holder (or issuer in person) declares safe');
  const safe = await call('POST', `/e-permits/${P1.id}/site-safe`, { actor: W2 });
  ok(safe.data.returnInfo?.holderAt && safe.data.returnInfo.holderBy === W2.id, 'holder declares site & equipment safe');
  ok((await call('POST', `/e-permits/${P1.id}/return`, { actor: SIC_ETP, outcome: 'incomplete' })).status === 400, 'work-not-complete needs a note');
  const ret = await call('POST', `/e-permits/${P1.id}/return`, { actor: SIC_ETP, outcome: 'complete' });
  ok(ret.data.status === 'RETURN_PENDING' && ret.data.returnInfo.issuerAt, 'issuer returns → return pending');
  ok(await hasNote(HOD_OPS.id, P1.id, 'e_permit_return'), 'Authoriser asked to accept the return');
  const back = await call('POST', `/e-permits/${P1.id}/return/accept`, { actor: HOD_OPS, decision: 'send_back', remark: 'Guard not refitted' });
  ok(back.data.status === 'ACTIVE' && !back.data.returnInfo, 'sent back → active again');
  await call('POST', `/e-permits/${P1.id}/site-safe`, { actor: SIC_ETP });
  await call('POST', `/e-permits/${P1.id}/return`, { actor: SIC_ETP, outcome: 'complete', note: 'Guard refitted' });
  ok((await call('POST', `/e-permits/${P1.id}/return/accept`, { actor: HOD_ELEC, decision: 'accept' })).status === 403, 'wrong HoD cannot accept the return');
  const done = await call('POST', `/e-permits/${P1.id}/return/accept`, { actor: HOD_OPS, decision: 'accept' });
  ok(done.data.status === 'COMPLETED' && done.data.completedAt && typeof done.data.actualHours === 'number', 'Authoriser accepts → COMPLETED with time and hours', done.data);
  ok(done.data.returnInfo.holderAt && done.data.returnInfo.issuerAt && done.data.returnInfo.authoriserAt, 'all three return steps time-stamped');
  ok((await call('POST', `/e-permits/${P1.id}/suspend`, { actor: SAFETY, reason: 'x' })).status === 400, 'closed permit is read-only');
  ok(done.data.timeline.length >= 15, 'audit trail recorded every step', done.data.timeline.length);

  // ── Hot work: fire & gas, extra Electrical clearance near MEE ──
  const hot = (over: Record<string, unknown> = {}) =>
    coldBody(SUP_MEE, {
      siteId: 's-mee',
      locationId: 'loc-mee-bay',
      category: 'hot_work',
      subCategory: 'welding',
      holderId: M1.id,
      workerIds: [M1.id, M2.id],
      description: 'E2E: weld evaporator support bracket',
      fireGas: all(FIRE_GAS_ITEMS, ['fire_watcher', 'fire_extinguishers', 'oxygen_test']),
      ...over,
    });
  const noGas = (await call('POST', '/e-permits', hot({ submit: true }))).data;
  ok(/oxygen reading/.test(noGas.message ?? ''), 'hot work refused without an oxygen reading', noGas);
  const lowO2 = await call('POST', '/e-permits', hot({ submit: true, gasReadings: [{ gas: 'oxygen', value: 18 }] }));
  ok(lowO2.status === 400 && /below the safe limit/.test(lowO2.data.message), 'oxygen 18 % is refused', lowO2.data);
  const H = (await call('POST', '/e-permits', hot({ submit: true, gasReadings: [{ gas: 'oxygen', value: 20.9 }, { gas: 'carbon_monoxide', value: 5 }] }))).data;
  ok(H.status === 'PENDING_APPROVAL', 'hot work with good readings submitted', H);
  ok(
    H.approvals?.map((a: any) => `${a.kind}:${a.departmentId}`).join(',') === 'authoriser:dept-operations,department:dept-electrical',
    'welding near MEE → Operations authoriser + Electrical clearance',
    H.approvals,
  );
  ok((await get(H.id, HOD_ELEC)).status === 200, 'Electrical HoD sees the permit it clears');
  const Hact = await activate(H.id, [
    { actor: HOD_ELEC, kind: 'department', departmentId: 'dept-electrical' },
    { actor: HOD_OPS, kind: 'authoriser', departmentId: 'dept-operations' },
  ], [M1, M2]);
  ok(Hact?.status === 'ACTIVE', 'hot work active after both approvals + acks', Hact?.status);
  ok((await call('POST', `/e-permits/${H.id}/renewal`, { actor: SUP_MEE })).status === 400, 'hot-work renewal needs fresh gas readings');
  const Hr = await call('POST', `/e-permits/${H.id}/renewal`, { actor: SUP_MEE, gasReadings: [{ gas: 'oxygen', value: 20.8 }] });
  ok(Hr.data.status === 'RENEWAL_PENDING' && Hr.data.gasReadings.some((g: any) => g.round === 1), 'renewal gas readings recorded as round 1');

  // ── Safety emergency stops permitted work at the site ──
  const inc = await call('POST', '/safety/events', {
    actor: PM_MEE,
    type: 'incident',
    siteId: 's-mee',
    title: 'E2E: steam leak at evaporator',
    category: 'other',
    categoryOther: 'Steam leak',
    severity: 'high',
    involved: [M1.id],
    isEmergency: true,
  });
  ok(inc.status === 201, 'MEE manager raises a safety emergency', inc.data?.message);
  const Hs = (await get(H.id, SUP_MEE)).data;
  ok(Hs.status === 'SUSPENDED' && /Safety emergency/.test(Hs.suspension?.reason ?? ''), 'safety emergency suspended the MEE permit', Hs.status);
  ok((await call('POST', `/e-permits/${H.id}/resume`, { actor: HOD_OPS })).status === 400, 'hot-work resume needs fresh gas readings');
  const Hres = await call('POST', `/e-permits/${H.id}/resume`, { actor: HOD_OPS, gasReadings: [{ gas: 'oxygen', value: 20.9 }] });
  // The incident put M1 on return-to-work clearance — clear it so the suite can run again
  await call('POST', `/safety/events/${inc.data.id}/clearance/${M1.id}`, { actor: SAFETY, decision: 'cleared', remark: 'E2E' });
  ok(Hres.data.status === 'RENEWAL_PENDING', 'resumes to where it was (renewal still pending)', Hres.data.status);
  await call('POST', `/e-permits/${H.id}/site-safe`, { actor: M1 });
  const Hret = await call('POST', `/e-permits/${H.id}/return`, { actor: SUP_MEE, outcome: 'incomplete', note: 'Leak repair first' });
  ok(Hret.data.status === 'RETURN_PENDING' && Hret.data.renewals.every((r: any) => r.status !== 'pending'), 'returning withdraws the pending renewal');
  const Hdone = await call('POST', `/e-permits/${H.id}/return/accept`, { actor: HOD_OPS, decision: 'accept' });
  ok(Hdone.data.status === 'RETURNED_INCOMPLETE', 'closed as Work Not Complete');

  // ── Safety gate + clashing work + override ──
  const tank = (await call('POST', '/e-permits', coldBody(SUP_ETP, {
    submit: true,
    locationId: 'loc-etp-aeration',
    subCategory: 'tank_entry',
    description: 'E2E: aeration tank diffuser inspection',
    holderId: W3.id,
    workerIds: [W3.id],
  }))).data;
  ok(
    tank.approvals?.map((a: any) => a.kind).join(',') === 'authoriser,department,safety',
    'tank entry → Authoriser + Mechanical + Safety gate',
    tank.approvals,
  );
  ok((await call('POST', `/e-permits/${tank.id}/decide`, { actor: HOD_OPS, kind: 'safety', decision: 'approve' })).status === 403, 'HoD cannot clear the Safety gate');
  ok((await call('POST', `/e-permits/${tank.id}/decide`, { actor: SAFETY, kind: 'safety', decision: 'approve' })).status === 201, 'Safety In-charge clears the gate');
  const grind = (await call('POST', '/e-permits', coldBody(SUP_ETP, {
    locationId: 'loc-etp-aeration',
    category: 'hot_work',
    subCategory: 'grinding',
    description: 'E2E: grind railing at aeration tank',
    holderId: W4.id,
    workerIds: [W4.id],
    fireGas: all(FIRE_GAS_ITEMS, ['fire_watcher', 'fire_extinguishers']),
    gasReadings: [{ gas: 'oxygen', value: 20.9 }],
  }))).data;
  const clash = await call('POST', `/e-permits/${grind.id}/submit`, { actor: SUP_ETP });
  ok(clash.status === 409 && clash.data.softBlocks?.some((b: string) => /Clashing work/.test(b)) && clash.data.canOverride === false, 'hot work clashes with tank entry → soft block', clash.data);
  ok((await call('POST', `/e-permits/${grind.id}/submit`, { actor: SUP_ETP, overrideSoftBlocks: true, overrideRemark: 'ok' })).status === 403, 'supervisor cannot override');
  const over = await call('POST', `/e-permits/${grind.id}/submit`, { actor: PM_ETP, overrideSoftBlocks: true, overrideRemark: 'Tank entry crew stood down for 1 h' });
  ok(over.data.status === 'PENDING_APPROVAL' && over.data.overrides?.length === 1, 'Plant Manager overrides with a remark (audited)', over.data);

  // ── Emergency breakdown permit ──
  ok((await call('POST', '/e-permits', coldBody(SUP_ETP, { submit: true, emergency: true }))).status === 400, 'emergency only for breakdown repair');
  const E = (await call('POST', '/e-permits', coldBody(SUP_ETP, {
    submit: true,
    emergency: true,
    locationId: 'loc-etp-workshop',
    subCategory: 'breakdown_repair',
    description: 'E2E: sludge pump seal failure',
    holderId: W4.id,
    workerIds: [W4.id],
  }))).data;
  ok(E.approvals?.length === 1 && E.approvals[0].kind === 'emergency', 'emergency permit needs only the Plant Manager', E.approvals);
  ok((await call('POST', `/e-permits/${E.id}/decide`, { actor: HOD_MECH, kind: 'emergency', decision: 'approve' })).status === 403, 'HoD cannot approve the emergency step');
  ok((await call('POST', `/e-permits/${E.id}/decide`, { actor: PM_MEE, kind: 'emergency', decision: 'approve' })).status === 403, 'other plant manager cannot');
  const Eact = await activate(E.id, [{ actor: PM_ETP, kind: 'emergency' }], [W4]);
  ok(Eact?.status === 'ACTIVE', 'emergency permit active', Eact?.status);
  const Ehours = (Date.parse(Eact.validTo) - Date.parse(Eact.validFrom)) / 3_600_000;
  ok(Ehours <= EPERMIT_POLICY.emergency.maxHours + 1e-6, `emergency validity ≤ ${EPERMIT_POLICY.emergency.maxHours} h`, Ehours);
  ok(Eact.postReviews?.length === 1 && Eact.postReviews[0].departmentId === 'dept-mechanical', 'Mechanical HoD owes a post-review');
  ok(await hasNote(HOD_MECH.id, E.id, 'e_permit_review'), 'post-review requested');
  ok((await get(E.id, HOD_MECH)).status === 200, 'reviewing HoD sees the emergency permit');
  const rv = await call('POST', `/e-permits/${E.id}/post-review`, { actor: HOD_MECH, kind: 'authoriser', departmentId: 'dept-mechanical', decision: 'approve', remark: 'Isolation was correct' });
  ok(rv.data.postReviews?.[0].status === 'approved', 'HoD completes the post-review');

  // ── OT link & cancel during work ──
  ok((await call('POST', `/e-permits/${E.id}/ot`, { actor: SUP_ETP, otDecisionId: 'otd-e2e' })).status === 403, 'supervisor cannot link OT');
  ok((await call('POST', `/e-permits/${E.id}/ot`, { actor: PM_ETP, otDecisionId: 'otd-e2e' })).data.otDecisionIds?.includes('otd-e2e'), 'Plant Manager links an OT decision');
  ok((await call('POST', `/e-permits/${E.id}/cancel`, { actor: SUP_ETP, remark: 'x' })).status === 403, 'issuer cannot cancel once work started');

  // ── Site-wide stop ──
  ok((await call('POST', '/e-permits/sites/s-etp/suspend', { actor: SUP_ETP, reason: 'x' })).status === 403, 'supervisor cannot stop the whole plant');
  const stop = await call('POST', '/e-permits/sites/s-etp/suspend', { actor: PM_ETP, reason: 'E2E: chlorine alarm drill' });
  ok(stop.data.suspended?.includes(E.id), 'Plant Manager stops all live ETP permits', stop.data);
  ok((await get(E.id, PM_ETP)).data.status === 'SUSPENDED', 'emergency permit suspended by the site stop');
  const Ecancel = await call('POST', `/e-permits/${E.id}/cancel`, { actor: PM_ETP, remark: 'Pump replaced instead' });
  ok(Ecancel.data.status === 'CANCELLED' && typeof Ecancel.data.actualHours === 'number', 'Plant Manager cancels during work (hours kept)');

  // ── HoD availability → deputies get requests ──
  ok((await call('PATCH', '/e-permits/departments/dept-operations/availability', { actor: DY_OPS, until: new Date(Date.now() + 86_400_000).toISOString() })).status === 403, 'deputy cannot mark the HoD away');
  const away = await call('PATCH', '/e-permits/departments/dept-operations/availability', { actor: HOD_OPS, until: new Date(Date.now() + 86_400_000).toISOString() });
  ok(away.data.headUnavailableUntil, 'HoD marks themselves away');
  const P5 = (await call('POST', '/e-permits', coldBody(SUP_ETP, { submit: true, description: 'E2E: deputy routing' }))).data;
  ok(await hasNote(DY_OPS.id, P5.id, 'e_permit_approval'), 'deputy now gets the approval request');
  await call('PATCH', '/e-permits/departments/dept-operations/availability', { actor: HOD_OPS, until: null });
  await call('POST', `/e-permits/${P5.id}/cancel`, { actor: SUP_ETP, remark: 'E2E cleanup' });
  await call('POST', `/e-permits/${tank.id}/cancel`, { actor: SUP_ETP, remark: 'E2E cleanup' });
  await call('POST', `/e-permits/${grind.id}/cancel`, { actor: SUP_ETP, remark: 'E2E cleanup' });

  // ── Concerned departments: every department at a location clears its permits ──
  const setLoc = (actor: Actor, departmentIds: string[]) => call('PATCH', '/e-permits/locations/loc-etp-aeration/departments', { actor, departmentIds });
  ok((await setLoc(SUP_ETP, [])).status === 403, 'supervisor cannot change concerned departments');
  ok((await setLoc(HOD_OPS, [])).status === 403, 'HoD cannot change concerned departments');
  ok((await setLoc(PM_MEE, [])).status === 403, "another plant's manager cannot change them");
  ok((await setLoc(PM_ETP, ['dept-nope'])).status === 400, 'unknown department rejected');
  const kindsOf = (x: any) => (x.approvals ?? []).map((a: any) => `${a.kind}:${a.departmentId ?? ''}`).join();
  const waiting = (await call('POST', '/e-permits', coldBody(SUP_ETP, { submit: true, locationId: 'loc-etp-aeration', description: 'E2E: waiting when the list changes' }))).data;
  ok(kindsOf(waiting) === 'authoriser:dept-operations', 'with no concerned departments the permit needs only the Authoriser', kindsOf(waiting));
  const setRes = await setLoc(PM_ETP, ['dept-mechanical', 'dept-electrical', 'dept-chemical', 'dept-operations']);
  ok(
    setRes.status === 200 && setRes.data.concernedDepartmentIds?.join() === 'dept-mechanical,dept-electrical,dept-chemical',
    'Plant Manager sets Aeration tank → Mechanical, Electrical, Chemical (owner dropped)',
    setRes.data,
  );
  const synced = (await get(waiting.id, PM_ETP)).data;
  ok(
    kindsOf(synced) === 'authoriser:dept-operations,department:dept-mechanical,department:dept-electrical,department:dept-chemical',
    'a permit already waiting picks up the new clearances',
    kindsOf(synced),
  );
  ok(synced.timeline?.some((t: any) => t.title === 'Clearances added: Mechanical, Electrical, Chemical'), 'audit trail records the added clearances');
  ok(await hasNote(HOD_MECH.id, waiting.id, 'e_permit_approval'), 'Mechanical HoD asked to clear the waiting permit');
  const C = (await call('POST', '/e-permits', coldBody(SUP_ETP, { submit: true, locationId: 'loc-etp-aeration', description: 'E2E: aeration diffuser check' }))).data;
  const kinds = (C.approvals ?? []).map((a: any) => `${a.kind}:${a.departmentId ?? ''}`).join();
  ok(
    kinds === 'authoriser:dept-operations,department:dept-mechanical,department:dept-electrical,department:dept-chemical',
    'Aeration tank permit needs Operations (Authoriser) + Mechanical + Electrical + Chemical',
    kinds,
  );
  ok(await hasNote(HOD_CHEM.id, C.id, 'e_permit_approval'), 'Chemical HoD asked to clear');
  ok((await get(C.id, HOD_CHEM)).status === 200, 'every concerned HoD can open the permit');
  const partial = await activate(
    C.id,
    [
      { actor: HOD_OPS, kind: 'authoriser', departmentId: 'dept-operations' },
      { actor: HOD_MECH, kind: 'department', departmentId: 'dept-mechanical' },
      { actor: HOD_ELEC, kind: 'department', departmentId: 'dept-electrical' },
    ],
    [W1, W2],
  );
  ok(partial?.status === 'PENDING_APPROVAL', 'not active while one concerned department has not cleared', partial?.status);
  const last = await call('POST', `/e-permits/${C.id}/decide`, { actor: HOD_CHEM, kind: 'department', departmentId: 'dept-chemical', decision: 'approve' });
  ok(last.data.status === 'ACTIVE', 'active once the last concerned department clears', last.data);
  ok((await setLoc(PM_ETP, ['dept-mechanical', 'dept-electrical'])).status === 200, 'Plant Manager removes Chemical from the Aeration tank');
  const trimmed = (await get(waiting.id, PM_ETP)).data;
  ok(!kindsOf(trimmed).includes('dept-chemical'), 'the waiting permit drops the pending Chemical clearance', kindsOf(trimmed));
  ok(kindsOf((await get(C.id, PM_ETP)).data).includes('dept-chemical'), 'an active permit keeps the clearances it went live with');
  await call('POST', `/e-permits/${waiting.id}/cancel`, { actor: SUP_ETP, remark: 'E2E cleanup' });
  await call('POST', `/e-permits/${C.id}/cancel`, { actor: PM_ETP, remark: 'E2E cleanup' });

  await restoreLocations();
  const after = (await call('GET', '/e-permits/masters')).data.locations.find((l: any) => l.id === 'loc-etp-aeration');
  ok(after?.concernedDepartmentIds?.length === 3, 'concerned departments restored after the run');

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await restoreLocations().catch(() => {});
  process.exit(1);
});
