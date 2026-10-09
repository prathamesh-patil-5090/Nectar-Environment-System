import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EPERMIT_POLICY,
  EPERMIT_STATUSES,
  FIRE_GAS_ITEMS,
  PERMIT_SHIFTS,
  PPE_ITEMS,
  SAFETY_MEASURES,
  ackViaFor,
  activationValidity,
  actualHours,
  approvalsLapsed,
  canActAsAuthoriser,
  canDecideApproval,
  canIssuePermits,
  canManageAsIssuer,
  canEditLocationDepartments,
  canOverrideSoftBlocks,
  canSuspend,
  canSuspendSite,
  canTransition,
  canViewPermit,
  extraClearances,
  financialYear,
  findConflicts,
  formatPermitNo,
  isOverdue,
  minutesLeft,
  nextShiftWindow,
  postReviewOverdue,
  renewalBlocker,
  renewalRef,
  renewalWindow,
  requiredApprovals,
  rotatingShiftAt,
  shiftChoices,
  shiftWindow,
  shouldNotifyOverdue,
  shouldWarn,
  validateForSubmit,
  validatePlannedSchedule,
  validateGasReadings,
  type ChecklistAnswer,
  type LocationRef,
  type PermitFormRef,
} from "./rules";
// Load order matters: the overtime data module reads the shift master while the shift store is loading.
import "@/lib/reliever/pool";
import { shiftMaster } from "@/lib/shift/store";
import { canIssueEPermit, canViewEPermitsNav, ePermitViewerOf } from "@/lib/rbac";
import { DEMO_USERS, type SessionUser, type UserRole } from "@/lib/auth";
// HoD logins live only in the database — read the same seed the server inserts.
import { hodUsersSeed } from "../../../server/db/seeds/e-permit.seed";

const HOD_USERS = hodUsersSeed.map((u) => ({ ...u, role: u.role as UserRole, siteId: undefined, employeeId: undefined }));

/** Plant-local (IST) wall clock → epoch ms. */
const ist = (iso: string) => Date.parse(`${iso}+05:30`);
const at = (ms: number) => new Date(ms).toISOString();
const HOUR = 3_600_000;

const all = (defs: { key: string }[], value: "yes" | "na" = "na"): ChecklistAnswer[] =>
  defs.map((d) => ({ key: d.key, value }));

const coldForm = (over: Partial<PermitFormRef> = {}): PermitFormRef => ({
  siteId: "s-etp",
  locationId: "loc-etp-clarifier",
  category: "cold_work",
  subCategory: "general_maintenance",
  description: "Replace clarifier scraper bearing",
  shiftCode: "A",
  workerIds: ["emp0126", "emp0127"],
  holderId: "emp0126",
  safetyMeasures: all(SAFETY_MEASURES),
  ppe: all(PPE_ITEMS),
  fireGas: [],
  certificates: [],
  gasReadings: [],
  ...over,
});

const hotForm = (over: Partial<PermitFormRef> = {}): PermitFormRef =>
  coldForm({
    category: "hot_work",
    subCategory: "welding",
    fireGas: FIRE_GAS_ITEMS.map((d) => ({
      key: d.key,
      value: d.key === "fire_watcher" || d.key === "fire_extinguishers" ? "yes" : "na",
    })),
    gasReadings: [{ gas: "oxygen", value: 20.9 }],
    ...over,
  });

const LOC = {
  clarifier: { id: "loc-etp-clarifier", siteId: "s-etp", ownerDepartmentId: "dept-operations", tags: [] },
  aeration: { id: "loc-etp-aeration", siteId: "s-etp", ownerDepartmentId: "dept-operations", tags: ["tank"] },
  dosing: { id: "loc-etp-dosing", siteId: "s-etp", ownerDepartmentId: "dept-chemical", tags: ["chemical"] },
  mcc: { id: "loc-etp-mcc", siteId: "s-etp", ownerDepartmentId: "dept-electrical", tags: ["electrical"] },
  meeBay: { id: "loc-mee-bay", siteId: "s-mee", ownerDepartmentId: "dept-operations", tags: ["mee"] },
} satisfies Record<string, LocationRef>;

const session = (u: (typeof DEMO_USERS)[number]): SessionUser => ({
  email: u.email,
  name: u.name,
  role: u.role,
  siteId: u.siteId,
  employeeId: u.employeeId,
});
const byEmail = (email: string) => [...DEMO_USERS, ...HOD_USERS].find((u) => u.email === email)!;

describe("planned schedule", () => {
  const shift = { start: "2026-10-08T00:30:00.000Z", end: "2026-10-08T08:30:00.000Z" }; // 06:00–14:00 IST
  it("accepts a forward window inside the shift, including the shift edges", () => {
    expect(validatePlannedSchedule(shift.start, shift.end, shift)).toEqual([]);
  });
  it("rejects start equal to or after end", () => {
    expect(validatePlannedSchedule("2026-10-08T02:00:00.000Z", "2026-10-08T02:00:00.000Z", shift)).toContain("Planned end must be after the planned start");
    expect(validatePlannedSchedule("2026-10-08T03:00:00.000Z", "2026-10-08T02:00:00.000Z", shift)).toContain("Planned end must be after the planned start");
  });
  it("rejects a start before or an end after the shift", () => {
    expect(validatePlannedSchedule("2026-10-07T18:30:00.000Z", "2026-10-08T02:00:00.000Z", shift)).toEqual(["Planned schedule must be inside the chosen shift"]);
    expect(validatePlannedSchedule("2026-10-08T02:00:00.000Z", "2026-10-08T09:00:00.000Z", shift)).toEqual(["Planned schedule must be inside the chosen shift"]);
  });
  it("ignores an empty or half-filled schedule", () => {
    expect(validatePlannedSchedule(undefined, undefined, shift)).toEqual([]);
    expect(validatePlannedSchedule("2026-10-08T02:00:00.000Z", undefined, shift)).toEqual([]);
  });
  it("with `now`, refuses a start that has passed, allowing one 15-minute slot of slack", () => {
    const now = Date.parse("2026-10-08T03:28:00.000Z"); // 08:58 IST
    expect(validatePlannedSchedule("2026-10-08T03:30:00.000Z", "2026-10-08T04:30:00.000Z", shift, now)).toEqual([]);
    expect(validatePlannedSchedule("2026-10-08T03:15:00.000Z", "2026-10-08T04:30:00.000Z", shift, now)).toEqual([]);
    expect(validatePlannedSchedule("2026-10-08T02:00:00.000Z", "2026-10-08T04:30:00.000Z", shift, now)).toEqual(["Planned start has already passed"]);
    // Without `now` (editing other fields of an old draft) a past start is not re-checked.
    expect(validatePlannedSchedule("2026-10-08T02:00:00.000Z", "2026-10-08T04:30:00.000Z", shift)).toEqual([]);
  });
});

describe("e-permit rules — shared with server", () => {
  it("client and server rule files are identical", () => {
    const client = readFileSync(path.resolve(__dirname, "rules.ts"), "utf8");
    const server = readFileSync(
      path.resolve(__dirname, "../../../server/src/modules/e-permits/e-permit-rules.ts"),
      "utf8",
    );
    expect(client.replace(/\r\n/g, "\n")).toBe(server.replace(/\r\n/g, "\n"));
  });

  it("permit shifts match the shift master", () => {
    for (const code of ["A", "B", "C", "G"] as const) {
      const m = shiftMaster.find((s) => s.code === code)!;
      expect(PERMIT_SHIFTS[code]).toEqual({ start: m.startTime, end: m.endTime });
    }
  });

  it("status machine only allows the documented moves", () => {
    const allowed = EPERMIT_STATUSES.flatMap((from) =>
      EPERMIT_STATUSES.filter((to) => canTransition(from, to)).map((to) => `${from}→${to}`),
    );
    expect(allowed).toEqual([
      "DRAFT→PENDING_APPROVAL",
      "DRAFT→CANCELLED",
      "PENDING_APPROVAL→REJECTED",
      "PENDING_APPROVAL→ACTIVE",
      "PENDING_APPROVAL→CANCELLED",
      "REJECTED→DRAFT",
      "REJECTED→CANCELLED",
      "ACTIVE→RENEWAL_PENDING",
      "ACTIVE→SUSPENDED",
      "ACTIVE→RETURN_PENDING",
      "ACTIVE→CANCELLED",
      "RENEWAL_PENDING→ACTIVE",
      "RENEWAL_PENDING→SUSPENDED",
      "RENEWAL_PENDING→RETURN_PENDING",
      "RENEWAL_PENDING→CANCELLED",
      "SUSPENDED→ACTIVE",
      "SUSPENDED→RENEWAL_PENDING",
      "SUSPENDED→RETURN_PENDING",
      "SUSPENDED→CANCELLED",
      "RETURN_PENDING→ACTIVE",
      "RETURN_PENDING→SUSPENDED",
      "RETURN_PENDING→COMPLETED",
      "RETURN_PENDING→RETURNED_INCOMPLETE",
      "RETURN_PENDING→CANCELLED",
    ]);
  });
});

describe("shift validity", () => {
  it("A shift running at 10:00 IST ends at 14:00 IST", () => {
    const w = shiftWindow("A", ist("2026-10-08T10:00:00"));
    expect(w.start).toBe(at(ist("2026-10-08T06:00:00")));
    expect(w.end).toBe(at(ist("2026-10-08T14:00:00")));
  });

  it("C shift crosses midnight — 02:00 belongs to the C shift that started at 22:00 the day before", () => {
    const w = shiftWindow("C", ist("2026-10-09T02:00:00"));
    expect(w.start).toBe(at(ist("2026-10-08T22:00:00")));
    expect(w.end).toBe(at(ist("2026-10-09T06:00:00")));
    expect(rotatingShiftAt(ist("2026-10-08T23:30:00")).shiftCode).toBe("C");
  });

  it("near shift end the issuer can pick the next shift (not running yet)", () => {
    const now = ist("2026-10-08T13:30:00");
    const choices = shiftChoices(now);
    const a = choices.find((c) => c.shiftCode === "A")!;
    const b = choices.find((c) => c.shiftCode === "B")!;
    expect(a.running).toBe(true);
    expect(b.running).toBe(false);
    expect(b.start).toBe(at(ist("2026-10-08T14:00:00")));
  });

  it("G shift counts as one shift — valid until 18:00", () => {
    const w = shiftWindow("G", ist("2026-10-08T09:30:00"));
    expect(w.end).toBe(at(ist("2026-10-08T18:00:00")));
  });

  it("activation: from now to shift end; next-shift permits start at the shift start", () => {
    const now = ist("2026-10-08T10:16:00");
    const a = shiftWindow("A", now);
    const v = activationValidity({ shiftCode: "A", windowStart: a.start, windowEnd: a.end }, now);
    expect(v).toEqual({ shiftCode: "A", validFrom: at(now), validTo: at(ist("2026-10-08T14:00:00")), rolled: false });

    const b = shiftWindow("B", ist("2026-10-08T13:40:00"));
    const vb = activationValidity({ shiftCode: "B", windowStart: b.start, windowEnd: b.end }, ist("2026-10-08T13:45:00"));
    expect(vb.validFrom).toBe(at(ist("2026-10-08T14:00:00")));
    expect(vb.validTo).toBe(at(ist("2026-10-08T22:00:00")));
  });

  it("activation after the chosen shift ended rolls onto the shift running now", () => {
    const a = shiftWindow("A", ist("2026-10-08T10:00:00"));
    const v = activationValidity({ shiftCode: "A", windowStart: a.start, windowEnd: a.end }, ist("2026-10-08T15:00:00"));
    expect(v.rolled).toBe(true);
    expect(v.shiftCode).toBe("B");
    expect(v.validTo).toBe(at(ist("2026-10-08T22:00:00")));
  });

  it("emergency permits are capped at 4 hours", () => {
    const now = ist("2026-10-08T07:00:00");
    const a = shiftWindow("A", now);
    const v = activationValidity({ shiftCode: "A", windowStart: a.start, windowEnd: a.end }, now, true);
    expect(v.validTo).toBe(at(ist("2026-10-08T11:00:00")));
  });
});

describe("renewal = one more shift, max 2 renewals / 24 h", () => {
  it("A → B → C, then blocked", () => {
    const first = ist("2026-10-08T10:00:00");
    let p = { renewalCount: 0, firstValidFrom: at(first), validTo: at(ist("2026-10-08T14:00:00")) };
    expect(renewalBlocker(p)).toBeNull();

    const r1 = renewalWindow(p);
    expect(r1).toEqual({ shiftCode: "B", validFrom: at(ist("2026-10-08T14:00:00")), validTo: at(ist("2026-10-08T22:00:00")) });
    p = { ...p, renewalCount: 1, validTo: r1.validTo };

    const r2 = renewalWindow(p);
    expect(r2.shiftCode).toBe("C");
    expect(r2.validTo).toBe(at(ist("2026-10-09T06:00:00")));
    p = { ...p, renewalCount: 2, validTo: r2.validTo };

    expect(renewalBlocker(p)).toMatch(/Renewal limit reached/);
  });

  it("24 h cap clamps the last window", () => {
    const first = ist("2026-10-08T06:00:00");
    const p = { renewalCount: 1, firstValidFrom: at(first), validTo: at(ist("2026-10-08T22:00:00")) };
    expect(renewalWindow(p).validTo).toBe(at(ist("2026-10-09T06:00:00")));
    const capped = { renewalCount: 1, firstValidFrom: at(ist("2026-10-08T10:00:00")), validTo: at(ist("2026-10-09T10:00:00")) };
    expect(renewalBlocker(capped)).toMatch(/24 h limit/);
  });

  it("G shift renews into the rotating shift running at 18:00", () => {
    expect(nextShiftWindow(ist("2026-10-08T18:00:00")).shiftCode).toBe("B");
  });

  it("not activated → no renewal", () => {
    expect(renewalBlocker({ renewalCount: 0 })).toMatch(/not been activated/);
  });
});

describe("time checks", () => {
  const live = { status: "ACTIVE" as const, validTo: at(ist("2026-10-08T14:00:00")) };

  it("1 hour warning, once per validTo", () => {
    expect(shouldWarn(live, ist("2026-10-08T12:30:00"))).toBe(false);
    expect(shouldWarn(live, ist("2026-10-08T13:05:00"))).toBe(true);
    expect(shouldWarn({ ...live, warnedForValidTo: live.validTo }, ist("2026-10-08T13:05:00"))).toBe(false);
    expect(shouldWarn(live, ist("2026-10-08T14:01:00"))).toBe(false);
  });

  it("overdue is derived and never closes the permit", () => {
    expect(isOverdue(live, ist("2026-10-08T13:59:00"))).toBe(false);
    expect(isOverdue(live, ist("2026-10-08T14:01:00"))).toBe(true);
    expect(isOverdue({ ...live, status: "SUSPENDED" }, ist("2026-10-08T15:00:00"))).toBe(false);
    expect(shouldNotifyOverdue({ ...live, overdueNotifiedFor: live.validTo }, ist("2026-10-08T15:00:00"))).toBe(false);
    expect(minutesLeft(live, ist("2026-10-08T14:30:00"))).toBe(-30);
  });

  it("approvals lapse 12 h after the first approval if not active", () => {
    const p = { status: "PENDING_APPROVAL" as const, firstApprovalAt: at(ist("2026-10-08T06:00:00")) };
    expect(approvalsLapsed(p, ist("2026-10-08T17:59:00"))).toBe(false);
    expect(approvalsLapsed(p, ist("2026-10-08T18:01:00"))).toBe(true);
    expect(approvalsLapsed({ ...p, status: "ACTIVE" }, ist("2026-10-09T18:01:00"))).toBe(false);
  });

  it("emergency post-review due within 24 h", () => {
    const p = { emergency: true, firstValidFrom: at(ist("2026-10-08T02:00:00")), postReviews: [{ status: "pending" }] };
    expect(postReviewOverdue(p, ist("2026-10-09T01:00:00"))).toBe(false);
    expect(postReviewOverdue(p, ist("2026-10-09T03:00:00"))).toBe(true);
    expect(postReviewOverdue({ ...p, postReviews: [{ status: "approved" }] }, ist("2026-10-09T03:00:00"))).toBe(false);
  });

  it("actual hours from first activation", () => {
    expect(actualHours(at(ist("2026-10-08T10:00:00")), at(ist("2026-10-08T13:30:00")))).toBe(3.5);
  });
});

describe("permit form validation", () => {
  it("a complete cold-work permit is ready", () => {
    expect(validateForSubmit(coldForm())).toEqual([]);
  });

  it("every Part B1 and PPE line must be answered", () => {
    const errs = validateForSubmit(coldForm({ safetyMeasures: all(SAFETY_MEASURES).slice(1), ppe: [] }));
    expect(errs).toContain("Answer every safety measure (Yes / NA)");
    expect(errs).toContain("Answer every PPE item (Yes / NA)");
  });

  it("the Permit Holder must be one of the workers", () => {
    expect(validateForSubmit(coldForm({ holderId: "emp0130" }))).toContain("The Permit Holder must be one of the workers");
    expect(validateForSubmit(coldForm({ workerIds: [], holderId: undefined }))).toEqual(
      expect.arrayContaining(["Assign at least one worker", "Choose the Permit Holder"]),
    );
  });

  it("hot work needs the fire & gas checklist, fire watcher, extinguishers and an oxygen reading", () => {
    expect(validateForSubmit(hotForm())).toEqual([]);
    const errs = validateForSubmit(hotForm({ fireGas: [], gasReadings: [] }));
    expect(errs).toEqual(
      expect.arrayContaining([
        "Hot work: answer every fire & gas item",
        "Hot work needs: Competent fire watcher",
        "Hot work needs: Fire extinguishers",
        "Hot work needs a oxygen reading",
      ]),
    );
  });

  it("gas readings are checked against the safe limits", () => {
    expect(validateGasReadings([{ gas: "oxygen", value: 20.9 }, { gas: "carbon_monoxide", value: 12 }])).toEqual([]);
    expect(validateGasReadings([{ gas: "oxygen", value: 18 }])[0]).toMatch(/below the safe limit/);
    expect(validateGasReadings([{ gas: "chlorine", value: 3 }])[0]).toMatch(/above the safe limit/);
    expect(validateGasReadings([{ gas: "radon", value: 1 }])[0]).toMatch(/Unknown gas/);
    expect(validateForSubmit(hotForm({ gasReadings: [{ gas: "oxygen", value: 25 }] }))[0]).toMatch(/Oxygen 25/);
  });

  it("emergency permits are only for breakdown repair", () => {
    expect(validateForSubmit(coldForm({ emergency: true }))).toContain("Emergency permits are only for breakdown repair");
    expect(validateForSubmit(coldForm({ emergency: true, subCategory: "breakdown_repair" }))).toEqual([]);
  });

  it("type of work must match the category", () => {
    expect(validateForSubmit(coldForm({ subCategory: "welding" }))).toContain("Choose the type of work");
  });
});

describe("approvals", () => {
  it("Authoriser = HoD of the location's owner department", () => {
    expect(requiredApprovals(LOC.clarifier, "cold_work", "general_maintenance", false)).toEqual([
      { kind: "authoriser", departmentId: "dept-operations", status: "pending" },
    ]);
  });

  it("welding near MEE adds an Electrical clearance", () => {
    expect(extraClearances(LOC.meeBay, "hot_work", "welding")).toEqual(["dept-electrical"]);
  });

  it("tank entry adds Mechanical + the Safety gate; electrical work at the MCC needs no extra (owner is Electrical)", () => {
    expect(requiredApprovals(LOC.aeration, "cold_work", "tank_entry", false).map((a) => `${a.kind}:${a.departmentId ?? ""}`)).toEqual([
      "authoriser:dept-operations",
      "department:dept-mechanical",
      "safety:",
    ]);
    expect(extraClearances(LOC.mcc, "cold_work", "electrical_work")).toEqual([]);
  });

  it("hot work in a chemical area adds Chemical — unless Chemical already owns it", () => {
    expect(extraClearances({ ...LOC.clarifier, tags: ["chemical"] }, "hot_work", "grinding")).toEqual(["dept-chemical"]);
    expect(extraClearances(LOC.dosing, "hot_work", "grinding")).toEqual([]);
  });

  it("every concerned department at the location clears every permit there", () => {
    const aeration = { ...LOC.aeration, concernedDepartmentIds: ["dept-mechanical", "dept-electrical", "dept-chemical"] };
    expect(requiredApprovals(aeration, "cold_work", "general_maintenance", false).map((a) => `${a.kind}:${a.departmentId ?? ""}`)).toEqual([
      "authoriser:dept-operations",
      "department:dept-mechanical",
      "department:dept-electrical",
      "department:dept-chemical",
    ]);
  });

  it("concerned departments and policy rules merge without duplicates; the owner is never asked twice", () => {
    const loc = { ...LOC.meeBay, concernedDepartmentIds: ["dept-operations", "dept-electrical"] };
    expect(extraClearances(loc, "hot_work", "welding")).toEqual(["dept-electrical"]);
    expect(extraClearances({ ...LOC.clarifier, concernedDepartmentIds: ["dept-mechanical"] }, "cold_work", "tank_entry")).toEqual(["dept-mechanical"]);
  });

  it("only the Director or that plant's Plant Manager edits a location's concerned departments", () => {
    expect(canEditLocationDepartments({ role: "director" }, "s-etp")).toBe(true);
    expect(canEditLocationDepartments({ role: "manager", siteId: "s-etp" }, "s-etp")).toBe(true);
    expect(canEditLocationDepartments({ role: "manager", siteId: "s-ro" }, "s-etp")).toBe(false);
    expect(canEditLocationDepartments({ role: "hod" }, "s-etp")).toBe(false);
    expect(canEditLocationDepartments({ role: "shift_incharge", siteId: "s-etp" }, "s-etp")).toBe(false);
  });

  it("emergency permits need only the Plant Manager", () => {
    expect(requiredApprovals(LOC.clarifier, "hot_work", "breakdown_repair", true)).toEqual([
      { kind: "emergency", status: "pending" },
    ]);
  });
});

describe("conflicts at one location", () => {
  const base = { locationId: "loc-etp-aeration", status: "ACTIVE" as const };
  it("hot work clashes with tank entry at the same location", () => {
    const tank = { id: "p1", ...base, category: "cold_work", subCategory: "tank_entry" };
    const weld = { id: "p2", ...base, category: "hot_work", subCategory: "welding" };
    expect(findConflicts(weld, [tank]).map((c) => c.id)).toEqual(["p1"]);
    expect(findConflicts(weld, [{ ...tank, locationId: "loc-etp-clarifier" }])).toEqual([]);
    expect(findConflicts(weld, [{ ...tank, status: "COMPLETED" }])).toEqual([]);
    expect(findConflicts({ ...weld, subCategory: "grinding" }, [{ ...tank, subCategory: "general_maintenance" }])).toEqual([]);
  });
});

describe("who sees and acts", () => {
  const permit = {
    siteId: "s-etp",
    issuerId: "emp0125",
    holderId: "emp0126",
    workerIds: ["emp0126", "emp0127"],
    authoriserDepartmentId: "dept-operations",
    approvals: [{ departmentId: "dept-operations" }, { departmentId: "dept-electrical" }],
  };

  it("visibility is limited to concerned people", () => {
    expect(canViewPermit({ id: "emp0127", role: "employee", siteId: "s-etp" }, permit)).toBe(true);
    expect(canViewPermit({ id: "emp0128", role: "employee", siteId: "s-etp" }, permit)).toBe(false);
    expect(canViewPermit({ id: "emp0141", role: "supervisor", siteId: "s-mee" }, permit)).toBe(false);
    expect(canViewPermit({ id: "emp0124", role: "shift_incharge", siteId: "s-etp" }, permit)).toBe(true);
    expect(canViewPermit({ id: "user:hod.electrical@x", role: "hod", departmentIds: ["dept-electrical"] }, permit)).toBe(true);
    expect(canViewPermit({ id: "user:hod.chemical@x", role: "hod", departmentIds: ["dept-chemical"] }, permit)).toBe(false);
    expect(canViewPermit({ id: "user:director", role: "director" }, permit)).toBe(true);
    expect(canViewPermit({ id: "user:safety", role: "safety_incharge", siteId: "s-etp" }, permit)).toBe(true);
    expect(canViewPermit({ id: "emp0147", role: "hr" }, permit)).toBe(false);
  });

  it("only the department's HoD / deputy decides its approval; Safety decides the safety gate; PM the emergency", () => {
    const hodOps = { id: "user:hod.operations@x", role: "hod", departmentIds: ["dept-operations"] };
    expect(canDecideApproval(hodOps, { kind: "authoriser", departmentId: "dept-operations" }, permit)).toBe(true);
    expect(canDecideApproval(hodOps, { kind: "department", departmentId: "dept-electrical" }, permit)).toBe(false);
    expect(canDecideApproval({ role: "safety_incharge" }, { kind: "safety" }, permit)).toBe(true);
    expect(canDecideApproval({ role: "manager", siteId: "s-etp" }, { kind: "emergency" }, permit)).toBe(true);
    expect(canDecideApproval({ role: "manager", siteId: "s-ro" }, { kind: "emergency" }, permit)).toBe(false);
    expect(canDecideApproval({ role: "manager", siteId: "s-etp" }, { kind: "authoriser", departmentId: "dept-operations" }, permit)).toBe(false);
    expect(canDecideApproval({ role: "director" }, { kind: "authoriser", departmentId: "dept-operations" }, permit)).toBe(true);
  });

  it("issuer / authoriser / suspend / override scopes", () => {
    expect(canManageAsIssuer({ id: "emp0125", role: "supervisor", siteId: "s-etp" }, permit)).toBe(true);
    expect(canManageAsIssuer({ id: "emp0124", role: "shift_incharge", siteId: "s-etp" }, permit)).toBe(false);
    expect(canManageAsIssuer({ id: "emp0123", role: "manager", siteId: "s-etp" }, permit)).toBe(true);
    expect(canActAsAuthoriser({ id: "user:hod.operations@x", role: "hod", departmentIds: ["dept-operations"] }, permit)).toBe(true);
    expect(canActAsAuthoriser({ id: "user:hod.electrical@x", role: "hod", departmentIds: ["dept-electrical"] }, permit)).toBe(false);
    expect(canSuspend({ role: "safety_incharge" }, permit)).toBe(true);
    expect(canSuspend({ id: "emp0127", role: "employee", siteId: "s-etp" }, permit)).toBe(false);
    expect(canSuspendSite({ role: "manager", siteId: "s-etp" }, "s-etp")).toBe(true);
    expect(canSuspendSite({ role: "supervisor", siteId: "s-etp" }, "s-etp")).toBe(false);
    expect(canOverrideSoftBlocks({ role: "manager", siteId: "s-etp" }, "s-etp")).toBe(true);
    expect(canOverrideSoftBlocks({ role: "supervisor", siteId: "s-etp" }, "s-etp")).toBe(false);
  });

  it("acknowledgements: self, or in person on the holder's / issuer's device", () => {
    expect(ackViaFor("emp0127", "emp0127", permit)).toBe("self");
    expect(ackViaFor("emp0126", "emp0127", permit)).toBe("holder");
    expect(ackViaFor("emp0125", "emp0127", permit)).toBe("issuer");
    expect(ackViaFor("emp0128", "emp0127", permit)).toBeNull();
  });

  it("issuers are Supervisor / Shift In-Charge / Plant Manager with a plant", () => {
    expect(canIssuePermits({ role: "supervisor", siteId: "s-etp" })).toBe(true);
    expect(canIssuePermits({ role: "manager", siteId: "s-etp" })).toBe(true);
    expect(canIssuePermits({ role: "director" })).toBe(false);
    expect(canIssuePermits({ role: "hod" })).toBe(false);
    expect(canIssuePermits({ role: "employee", siteId: "s-etp" })).toBe(false);
  });

  it("sidebar: everyone but HR sees E-Permits; only issuers see Issue permit", () => {
    expect(canViewEPermitsNav(session(byEmail("hr@nectarenviro.com")))).toBe(false);
    expect(canViewEPermitsNav(session(byEmail("shilpa.hotkar@nectarenviro.com")))).toBe(true);
    expect(canViewEPermitsNav(session(byEmail("hod.operations@nectarenviro.com")))).toBe(true);
    expect(canIssueEPermit(session(byEmail("etp.supervisor@nectarenviro.com")))).toBe(true);
    expect(canIssueEPermit(session(byEmail("etp.shift@nectarenviro.com")))).toBe(true);
    expect(canIssueEPermit(session(byEmail("hod.operations@nectarenviro.com")))).toBe(false);
    expect(canIssueEPermit(session(byEmail("director@nectarenviro.com")))).toBe(false);
    expect(ePermitViewerOf(session(byEmail("hod.operations@nectarenviro.com")), ["dept-operations"])).toEqual({
      id: "user:hod.operations@nectarenviro.com",
      name: "Rajendra Kulkarni",
      role: "hod",
      siteId: undefined,
      departmentIds: ["dept-operations"],
    });
  });

  it("every department has a HoD and a deputy login", () => {
    expect(HOD_USERS).toHaveLength(8);
    expect(HOD_USERS.every((u) => u.role === "hod" && !u.employeeId)).toBe(true);
  });
});

describe("permit numbers", () => {
  it("site / Indian financial year / sequence", () => {
    expect(financialYear(ist("2026-10-08T10:00:00"))).toBe(2027);
    expect(financialYear(ist("2026-03-31T23:00:00"))).toBe(2026);
    expect(financialYear(ist("2026-04-01T00:30:00"))).toBe(2027);
    expect(formatPermitNo("s-etp", ist("2026-10-08T10:00:00"), 123)).toBe("ETP/FY27/00123");
    expect(renewalRef("ETP/FY27/00123", 2)).toBe("ETP/FY27/00123/R2");
  });

  it("policy version is pinned", () => {
    expect(EPERMIT_POLICY.version).toBe(1);
    expect(EPERMIT_POLICY.maxRenewals).toBe(2);
    expect(EPERMIT_POLICY.maxTotalHours).toBe(24);
    expect(HOUR).toBe(3_600_000);
  });
});
