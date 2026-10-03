import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_USERS, DEMO_USERS_HIDDEN, type SessionUser } from "@/lib/auth";
import { canSafety, safetyActorOf } from "@/lib/rbac";
import { employees } from "@/lib/mock-data";
import {
  adminFinalizeLeave,
  confirmReturn,
  createLeaveRequest,
  getLeaveById,
  managerDecideLeave,
  resetLeaveStore,
  siteApprove,
  supervisorVerify,
} from "@/lib/leave/store";
import { confirmReturnLifecycle, resetLifecycleStore } from "@/lib/leave-lifecycle";
import { getRelievers, resetRelieverPool } from "@/lib/reliever/pool";
import { resetShiftStore } from "@/lib/shift/store";
import { rankCoverCandidates } from "@/lib/shift-impact/candidates";
import {
  ESCALATE_AFTER,
  MEETING_NUDGE_MS,
  REMINDER_INTERVAL_MS,
  SAFETY_PERMISSIONS,
  canJoinSafetyCall,
  canActOnSafetyCase,
  SAFETY_STATUSES,
  canTransition,
  closeBlocker,
  defaultRequiresClearance,
  effectiveSeverity,
  isReminderDue,
  meetingNudgesDue,
  resolveBlocker,
  safetyCan,
  type SafetyAction,
} from "./rules";
import {
  assertSafetyClearance,
  openSeriousIncidentFor,
  pendingClearanceFor,
  safetyClearanceBlockMessage,
} from "./gates";
import { __setSafetyEventsForTest } from "./store";
import { safetyKpis } from "./kpis";
import type { SafetyEvent } from "./types";

const HOUR = 3_600_000;

function event(over: Partial<SafetyEvent> = {}): SafetyEvent {
  return {
    id: "inc-test",
    type: "incident",
    siteId: "s-etp",
    title: "Test case",
    description: "",
    location: "",
    occurredAt: "2026-09-29T08:00:00.000Z",
    reportedAt: "2026-09-29T08:10:00.000Z",
    category: "medical",
    severity: "medium",
    status: "INVESTIGATING",
    reportedBy: { personId: "emp0124", name: "SIC", role: "shift_incharge" },
    informedBy: [],
    involved: ["emp0126"],
    stakeholders: [],
    media: [],
    rootCause: "",
    correctiveActions: [],
    timeline: [],
    isEmergency: false,
    emergencyRecipients: [],
    emergencyAcks: [],
    notifyCount: 0,
    linkedLeaveIds: [],
    requiresReturnClearance: true,
    clearance: [{ employeeId: "emp0126", status: "pending" }],
    otEntries: [],
    otDecisionIds: [],
    ...over,
  };
}

const session = (u: (typeof DEMO_USERS)[number]): SessionUser => ({
  email: u.email,
  name: u.name,
  role: u.role,
  siteId: u.siteId,
  employeeId: u.employeeId,
});

describe("safety rules — shared with server", () => {
  it("client and server rule files are identical", () => {
    const client = readFileSync(path.resolve(__dirname, "rules.ts"), "utf8");
    const server = readFileSync(
      path.resolve(__dirname, "../../../server/src/modules/safety/safety-rules.ts"),
      "utf8",
    );
    expect(client.replace(/\r\n/g, "\n")).toBe(server.replace(/\r\n/g, "\n"));
  });

  it("status machine only allows the documented moves", () => {
    const allowed = SAFETY_STATUSES.flatMap((from) =>
      SAFETY_STATUSES.filter((to) => canTransition(from, to)).map((to) => `${from}→${to}`),
    );
    expect(allowed).toEqual([
      "REPORTED→ACKNOWLEDGED",
      "ACKNOWLEDGED→INVESTIGATING",
      "ACKNOWLEDGED→RESOLVED",
      "INVESTIGATING→ACTION_PENDING",
      "INVESTIGATING→RESOLVED",
      "ACTION_PENDING→RESOLVED",
      "RESOLVED→CLOSED",
      "RESOLVED→REOPENED",
      "CLOSED→REOPENED",
      "REOPENED→INVESTIGATING",
    ]);
  });

  it("fatal is always critical; clearance only for injury incidents", () => {
    expect(effectiveSeverity("fatal", "low")).toBe("critical");
    expect(effectiveSeverity("death", "low")).toBe("critical");
    expect(defaultRequiresClearance("incident", "fatal", "critical")).toBe(true);
    expect(defaultRequiresClearance("incident", "death", "critical")).toBe(false);
    expect(defaultRequiresClearance("incident", "medical", "low")).toBe(true);
    expect(defaultRequiresClearance("incident", "lost_time", "low")).toBe(true);
    expect(defaultRequiresClearance("incident", "first_aid", "low")).toBe(false);
    expect(defaultRequiresClearance("incident", "first_aid", "high")).toBe(true);
    expect(defaultRequiresClearance("near_miss", "medical", "critical")).toBe(false);
    expect(defaultRequiresClearance("breakdown", "plant_problem", "critical")).toBe(false);
  });

  it("resolve needs actions done; close also needs clearances", () => {
    const ev = event({ correctiveActions: [{ id: "a", text: "x", done: false }] });
    expect(resolveBlocker(ev)).toMatch(/corrective action/);
    expect(closeBlocker(ev)).toMatch(/clearance/);
    const done = event({ correctiveActions: [{ id: "a", text: "x", done: true }], clearance: [] });
    expect(resolveBlocker(done)).toBeNull();
    expect(closeBlocker(done)).toBeNull();
  });

  it("reminders repeat by severity until resolved", () => {
    const base = { status: "INVESTIGATING" as const, reportedAt: "2026-10-01T00:00:00.000Z" };
    const t0 = Date.parse(base.reportedAt);
    expect(isReminderDue({ ...base, severity: "critical" }, t0 + 59 * 60_000)).toBe(false);
    expect(isReminderDue({ ...base, severity: "critical" }, t0 + HOUR)).toBe(true);
    expect(isReminderDue({ ...base, severity: "high" }, t0 + 3 * HOUR)).toBe(false);
    expect(isReminderDue({ ...base, severity: "high" }, t0 + 4 * HOUR)).toBe(true);
    expect(isReminderDue({ ...base, severity: "low" }, t0 + 24 * HOUR)).toBe(true);
    expect(isReminderDue({ ...base, severity: "critical", lastNotifiedAt: new Date(t0 + HOUR).toISOString() }, t0 + 90 * 60_000)).toBe(false);
    // Solved but not closed by the Director: still reminding
    expect(isReminderDue({ ...base, status: "RESOLVED", severity: "critical" }, t0 + 10 * HOUR)).toBe(true);
    expect(isReminderDue({ ...base, status: "CLOSED", severity: "critical" }, t0 + 10 * HOUR)).toBe(false);
    expect(REMINDER_INTERVAL_MS.medium).toBe(24 * HOUR);
    expect(ESCALATE_AFTER).toBe(3);
  });
});

describe("safety roles — every demo login", () => {
  const all = [...DEMO_USERS, ...DEMO_USERS_HIDDEN].map(session);

  /** Expected actions per role (site-independent). Mirrors docs/SAFETY_PLAN.md §7. */
  const EXPECTED: Record<string, SafetyAction[]> = {
    // Only the manager raises safety concerns; only the Director marks a case solved, closes and reopens it
    director: ["view", "reportBreakdown", "comment", "investigate", "resolve", "close", "clearNonCritical", "clearCritical", "waiveClearance", "linkLeave", "startCall", "updateBreakdown", "editProtocols", "downloadReport"],
    safety_incharge: ["view", "reportBreakdown", "comment", "investigate", "clearNonCritical", "clearCritical", "linkLeave", "startCall", "updateBreakdown", "editProtocols", "downloadReport"],
    manager: ["view", "reportNearMiss", "reportIncident", "reportBreakdown", "comment", "investigate", "clearNonCritical", "linkLeave", "startCall", "updateBreakdown", "downloadReport"],
    site_incharge: ["view", "reportBreakdown", "comment", "investigate", "linkLeave", "startCall", "updateBreakdown", "downloadReport"],
    shift_incharge: ["view", "reportBreakdown", "comment", "investigate", "startCall", "updateBreakdown", "downloadReport"],
    hr: ["view", "comment", "investigate", "linkLeave", "downloadReport"],
    supervisor: ["view", "comment", "investigate", "downloadReport"],
    // Plain employees: no report downloads
    employee: ["view", "comment"],
  };

  it("each login gets exactly its role's safety actions", () => {
    const actions = Object.keys(SAFETY_PERMISSIONS) as SafetyAction[];
    for (const u of all) {
      const role = u.role === "management" ? "manager" : u.role;
      const got = actions.filter((a) => canSafety(u, a));
      expect({ email: u.email, got }).toEqual({ email: u.email, got: EXPECTED[role] });
    }
  });

  it("plant roles are scoped to their own site; org-wide roles are not", () => {
    for (const u of all) {
      const role = u.role === "management" ? "manager" : u.role;
      const orgWide = ["director", "hr", "safety_incharge"].includes(role);
      const other = u.siteId === "s-ro" ? "s-etp" : "s-ro";
      // Everyone can view every site ("visible to all")
      expect(canSafety(u, "view", other)).toBe(true);
      // Only a manager raises concerns, and only for their own site
      expect(canSafety(u, "reportNearMiss", other)).toBe(false);
      if (u.siteId) expect(canSafety(u, "reportNearMiss", u.siteId)).toBe(role === "manager");
      // Responsible plant roles work cases at their own site only; org-wide roles anywhere
      if (["supervisor", "shift_incharge"].includes(role)) expect(canSafety(u, "investigate", other)).toBe(false);
      if (orgWide) expect(canSafety(u, "investigate", other)).toBe(true);
    }
  });

  it("every case is visible, but plain employees only join or act on cases they are named on", () => {
    const ev = {
      siteId: "s-ro",
      stakeholders: [{ personId: "lead-1" }],
      involved: ["emp-hurt"],
      informedBy: ["emp-saw"],
      reportedBy: { personId: "mgr-1" },
      callInvited: ["emp-hurt", "emp-saw", "lead-1"],
      callJoined: ["mgr-1"],
      correctiveActions: [{ ownerId: "emp-owner" }],
    };
    const emp = (id: string, siteId = "s-ro") => ({ id, role: "employee", siteId });
    // Same plant, not named on the case: can read it, cannot act on it or join its meeting
    expect(canActOnSafetyCase(emp("emp-stranger"), ev)).toBe(false);
    expect(canJoinSafetyCall(emp("emp-stranger"), ev)).toBe(false);
    for (const id of ["emp-hurt", "emp-saw", "emp-owner"]) {
      expect(canActOnSafetyCase(emp(id), ev)).toBe(true);
      expect(canJoinSafetyCall(emp(id), ev)).toBe(true);
    }
    // Plant leads act on their own plant's cases; org-wide roles on all; nobody joins a meeting they're not on
    expect(canActOnSafetyCase({ id: "si-1", role: "site_incharge", siteId: "s-ro" }, ev)).toBe(true);
    expect(canActOnSafetyCase({ id: "si-2", role: "site_incharge", siteId: "s-etp" }, ev)).toBe(false);
    expect(canActOnSafetyCase({ id: "dir", role: "director" }, ev)).toBe(true);
    expect(canJoinSafetyCall({ id: "si-1" }, ev)).toBe(false);
    expect(canJoinSafetyCall({ id: "mgr-1" }, ev)).toBe(true);
    expect(canJoinSafetyCall(null, ev)).toBe(false);
  });

  it("actor id = employee id, or user:<email> for logins without one (matches server notifications)", () => {
    const director = all.find((u) => u.role === "director")!;
    const safety = all.find((u) => u.role === "safety_incharge")!;
    const emp = all.find((u) => u.role === "employee")!;
    expect(safetyActorOf(director)?.id).toBe(`user:${director.email}`);
    expect(safetyActorOf(safety)?.id).toBe("user:safety@nectarenviro.com");
    expect(safetyActorOf(emp)?.id).toBe(emp.employeeId);
    expect(safetyActorOf({ ...emp, role: "management" })?.role).toBe("manager");
  });

  it("unknown action or no user is denied", () => {
    expect(safetyCan(undefined as unknown as SafetyAction, { role: "director" })).toBe(false);
    expect(canSafety(null, "view")).toBe(false);
  });
});

describe("safety gates", () => {
  afterEach(() => __setSafetyEventsForTest([]));

  it("no safety data → nothing blocks", () => {
    __setSafetyEventsForTest([]);
    expect(pendingClearanceFor("emp0126")).toEqual([]);
    expect(() => assertSafetyClearance("emp0126")).not.toThrow();
    expect(openSeriousIncidentFor("emp0126")).toBeUndefined();
  });

  it("pending clearance blocks with the same wording the server uses", () => {
    __setSafetyEventsForTest([event()]);
    expect(safetyClearanceBlockMessage("emp0126")).toMatch(/^Safety clearance pending \(inc-test · Test case\)/);
    expect(() => assertSafetyClearance("emp0127")).not.toThrow();
    __setSafetyEventsForTest([event({ clearance: [{ employeeId: "emp0126", status: "cleared" }] })]);
    expect(() => assertSafetyClearance("emp0126")).not.toThrow();
  });

  it("open high/critical incident holds the person; resolved or minor does not", () => {
    __setSafetyEventsForTest([event({ severity: "high" })]);
    expect(openSeriousIncidentFor("emp0126")?.id).toBe("inc-test");
    __setSafetyEventsForTest([event({ severity: "high", status: "RESOLVED" })]);
    expect(openSeriousIncidentFor("emp0126")).toBeUndefined();
    __setSafetyEventsForTest([event({ severity: "low", category: "first_aid" })]);
    expect(openSeriousIncidentFor("emp0126")).toBeUndefined();
    __setSafetyEventsForTest([event({ severity: "critical", type: "near_miss" })]);
    expect(openSeriousIncidentFor("emp0126")).toBeUndefined();
  });

  it("kpis count open, pending clearance and days since LTI", () => {
    const now = Date.parse("2026-10-03T00:00:00.000Z");
    const k = safetyKpis(
      [
        event(),
        event({ id: "lti", category: "lost_time", status: "CLOSED", clearance: [], occurredAt: "2026-09-23T00:00:00.000Z" }),
        event({ id: "nm", type: "near_miss", status: "REPORTED", clearance: [], occurredAt: "2026-09-30T00:00:00.000Z" }),
        event({ id: "bd", type: "breakdown", status: "REPORTED", clearance: [], failedAt: "2026-10-01T00:00:00.000Z", otEntries: [{ employeeId: "emp0127", hours: 4 }], occurredAt: "2026-10-01T00:00:00.000Z" }),
        event({ id: "ro", siteId: "s-ro", status: "REPORTED", clearance: [] }),
      ],
      "s-etp",
      now,
    );
    expect(k).toMatchObject({ open: 3, pendingClearances: 1, nearMiss30d: 1, activeBreakdowns: 1, breakdownOtHours30d: 4, daysSinceLti: 10 });
  });
});

describe("leave return ↔ safety clearance", () => {
  function approvedLeave(employeeId: string) {
    const emp = employees.find((e) => e.id === employeeId)!;
    const leave = createLeaveRequest({
      employeeId,
      mode: "planned",
      leaveType: "sick",
      startDate: "2026-09-30",
      endDate: "2026-10-01",
      expectedReturnDate: "2026-10-01",
      reason: "Injury at work",
      entrySource: "employee",
      enteredByName: emp.name,
      enteredByRole: "employee",
      supervisorName: "Amit Supervisor",
      siteInChargeName: "Sanjay Jadhav",
    });
    supervisorVerify(leave.id, "Supervisor");
    siteApprove(leave.id, "SIC", { relieverId: "rv1" });
    managerDecideLeave(leave.id, "Manager", "approved");
    adminFinalizeLeave(leave.id, "Director", "approved");
    return leave;
  }

  beforeEach(() => {
    resetLeaveStore();
    resetRelieverPool();
    resetShiftStore();
    resetLifecycleStore();
    __setSafetyEventsForTest([]);
  });
  afterEach(() => __setSafetyEventsForTest([]));

  it("blocks CLOSED while clearance is pending, without side effects; closes once cleared", () => {
    const leave = approvedLeave("emp0126");
    expect(getLeaveById(leave.id)?.status).toBe("APPROVED");
    __setSafetyEventsForTest([event()]);

    expect(() => confirmReturn(leave.id, "Supervisor", "2026-10-01")).toThrow(/Safety clearance pending/);
    expect(getLeaveById(leave.id)?.status).toBe("APPROVED");
    expect(getRelievers().find((r) => r.id === "rv1")?.availability).not.toBe("available");

    expect(() =>
      confirmReturnLifecycle({ leaveId: leave.id, actor: "Manager", actualReturnDate: "2026-10-01", actorRole: "manager" }),
    ).toThrow(/Safety clearance pending/);

    __setSafetyEventsForTest([event({ clearance: [{ employeeId: "emp0126", status: "cleared" }] })]);
    const closed = confirmReturn(leave.id, "Supervisor", "2026-10-01");
    expect(closed.status).toBe("CLOSED");
    expect(getRelievers().find((r) => r.id === "rv1")?.availability).toBe("available");
  });

  it("late return still opens an extension (not a close) while clearance is pending", () => {
    const leave = approvedLeave("emp0126");
    __setSafetyEventsForTest([event()]);
    const late = confirmReturn(leave.id, "Supervisor", "2026-10-03");
    expect(late.status).toBe("EXTENSION_REQUIRED");
    expect(() =>
      confirmReturn(leave.id, "Manager", "2026-10-04", { remark: "Back after clinic" }),
    ).toThrow(/Safety clearance pending/);
  });

  it("someone else's pending clearance does not block this leave", () => {
    const leave = approvedLeave("emp0126");
    __setSafetyEventsForTest([event({ involved: ["emp0127"], clearance: [{ employeeId: "emp0127", status: "pending" }] })]);
    expect(confirmReturn(leave.id, "Supervisor", "2026-10-01").status).toBe("CLOSED");
  });
});

describe("cover / OT hold for people in an open serious incident", () => {
  afterEach(() => __setSafetyEventsForTest([]));

  it("excludes the involved employee from cover candidates only while the incident is open", () => {
    const opts = { siteId: "s-etp", date: "2026-10-05", requiredSkills: [] };
    __setSafetyEventsForTest([]);
    const before = rankCoverCandidates(opts).map((c) => c.employeeId);
    const targetId = before.find((id): id is string => Boolean(id));
    expect(targetId).toBeTruthy();
    const target = { id: targetId! };
    __setSafetyEventsForTest([event({ involved: [target.id], severity: "critical", clearance: [] })]);
    const during = rankCoverCandidates(opts).map((c) => c.employeeId);
    expect(during).not.toContain(target.id);
    expect(during.length).toBe(before.filter((id) => id !== target.id).length);
    __setSafetyEventsForTest([event({ involved: [target.id], severity: "critical", status: "RESOLVED", clearance: [] })]);
    expect(rankCoverCandidates(opts).map((c) => c.employeeId)).toEqual(before);
  });
});

describe("safety meeting no-shows", () => {
  const started = "2026-10-03T06:00:00.000Z";
  const t0 = Date.parse(started);
  const base = {
    status: "INVESTIGATING" as const,
    callStartedAt: started,
    callInvited: ["emp0125", "emp0124", "user:director@nectarenviro.com"],
    callJoined: ["emp0123", "emp0124"],
  };

  it("reminds called people who have not joined, every 4 hours", () => {
    expect(meetingNudgesDue(base, t0 + 3 * HOUR)).toEqual([]);
    expect(meetingNudgesDue(base, t0 + 4 * HOUR)).toEqual(["emp0125", "user:director@nectarenviro.com"]);
    const nudged = { ...base, callNudgedAt: { emp0125: new Date(t0 + 4 * HOUR).toISOString() } };
    expect(meetingNudgesDue(nudged, t0 + 6 * HOUR)).toEqual(["user:director@nectarenviro.com"]);
    expect(meetingNudgesDue(nudged, t0 + 8 * HOUR)).toEqual(["emp0125", "user:director@nectarenviro.com"]);
    expect(MEETING_NUDGE_MS).toBe(4 * HOUR);
  });

  it("keeps going while the case is solved but not closed; stops once the Director closes it", () => {
    expect(meetingNudgesDue({ ...base, status: "RESOLVED" }, t0 + 4 * HOUR)).toHaveLength(2);
    expect(meetingNudgesDue({ ...base, status: "CLOSED" }, t0 + 4 * HOUR)).toEqual([]);
    expect(meetingNudgesDue({ ...base, callStartedAt: undefined }, t0 + 4 * HOUR)).toEqual([]);
  });
});
