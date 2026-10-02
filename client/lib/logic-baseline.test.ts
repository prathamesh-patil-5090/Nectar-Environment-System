/**
 * Behaviour lock for refactors: snapshots the output of permission checks,
 * KPI / aggregation functions and a scripted leave workflow. Any refactor that
 * claims "no behaviour change" must leave __snapshots__/logic-baseline.test.ts.snap
 * untouched. Regenerate only for intentional changes: `npx vitest run -u`.
 */
import { createHash } from "node:crypto";
import Module from "node:module";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// training/store.ts uses runtime require("@/lib/…"); teach Node the "@/" alias (test-only).
const M = Module as unknown as { _resolveFilename: (req: string, ...rest: unknown[]) => string };
const resolve = M._resolveFilename;
M._resolveFilename = (req, ...rest) =>
  resolve(req.startsWith("@/") ? path.resolve(__dirname, "..", req.slice(2)) + ".ts" : req, ...rest);
import { DEMO_USERS, DEMO_USERS_HIDDEN, type SessionUser } from "@/lib/auth";
import * as rbac from "@/lib/rbac";
import { employees, getDashboardKpis, sites } from "@/lib/mock-data";
import * as leave from "@/lib/leave/store";
import { getPoolKpis, listReplacementOptions, resetRelieverPool } from "@/lib/reliever/pool";
import {
  getDeviationAggregates,
  getOtByShiftCause,
  getShiftDashboardKpis,
  getShiftInsights,
  resetShiftStore,
} from "@/lib/shift/store";
import * as ot from "@/lib/overtime/aggregations";
import {
  countComplianceReadySites,
  getSitesWithComputedReadiness,
  getSkillCoveragePct,
} from "@/lib/workforce-metrics";
import { computeShiftImpact, listCoverOptionsForSite } from "@/lib/shift-impact/engine";
import {
  getAllCertificates,
  getPendingEvaluations,
  getRecommendedCourses,
  getTrainingItems,
  resetTrainingStore,
} from "@/lib/training/store";
import { getNotificationsForEmployee } from "@/lib/notifications";
import { getSalaryHistory } from "@/lib/salary";

const NOW = new Date("2026-09-23T04:30:00Z");
const SITE_IDS = sites.map((s) => s.id);

const sessions: (SessionUser | null)[] = [
  null,
  ...[...DEMO_USERS, ...DEMO_USERS_HIDDEN].map(({ email, name, role, siteId, employeeId }) => ({
    email,
    name,
    role,
    siteId,
    employeeId,
  })),
];

/** Bulky outputs: row count + content hash keeps the snapshot small but exact. */
function digest(v: unknown) {
  const json = JSON.stringify(v);
  return { length: Array.isArray(v) ? v.length : undefined, sha256: createHash("sha256").update(json).digest("hex") };
}

/** Run fn and capture either its result or its error message. */
function outcome<T>(fn: () => T): T | { error: string } {
  try {
    return fn();
  } catch (e) {
    return { error: (e as Error).message };
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  let s = 0x2f6b1d3;
  vi.spyOn(Math, "random").mockImplementation(() => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  });
  resetLeaveStore();
  resetRelieverPool();
  resetShiftStore();
  resetTrainingStore();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const { resetLeaveStore } = leave;

describe("rbac", () => {
  it("permission matrix: every exported check × every demo session", () => {
    const sample = [employees[0], employees.find((e) => e.siteId !== "s-etp"), undefined];
    const matrix: Record<string, unknown[]> = {};
    for (const [name, fn] of Object.entries(rbac)) {
      if (typeof fn !== "function") continue;
      matrix[name] = sessions.map((u) =>
        name === "canWithdrawLeaveRequest"
          ? leave.getLeaveRequests().map((l) => rbac.canWithdrawLeaveRequest(u, l))
          : name === "canAccessEmployeeRecord"
          ? sample.map((e) => (fn as typeof rbac.canAccessEmployeeRecord)(u, e))
          : name === "normalizeRole" || name === "roleLabel"
            ? (fn as (r?: string) => unknown)(u?.role)
            : (fn as (u: SessionUser | null) => unknown)(u),
      );
    }
    expect(matrix).toMatchSnapshot();
  });
});

describe("kpis & aggregations", () => {
  it("dashboard / readiness", () => {
    expect({
      dashboard: [undefined, ...SITE_IDS].map((s) => getDashboardKpis(s)),
      readiness: digest(getSitesWithComputedReadiness()),
      skillCoverage: [undefined, ...SITE_IDS].map((s) => getSkillCoveragePct(s)),
      complianceReady: [undefined, ...SITE_IDS].map((s) => countComplianceReadySites(s)),
    }).toMatchSnapshot();
  });

  it("leave", () => {
    expect({
      kpis: [undefined, ...SITE_IDS].map((s) => leave.getLeaveKpis(s)),
      employeeKpis: leave.getLeaveKpis(undefined, "emp0126"),
      pendingJustifications: leave.getPendingJustifications().map((l) => l.id),
      overlapping: leave.getLeaveRequests().map((l) => [l.id, leave.getPlantOverlappingLeaves(l.id).map((o) => o.id)]),
    }).toMatchSnapshot();
  });

  it("shift / reliever / impact", () => {
    expect({
      shiftKpis: [undefined, ...SITE_IDS].map((s) => getShiftDashboardKpis(s)),
      shiftInsights: digest(getShiftInsights()),
      deviations: digest(getDeviationAggregates()),
      otByShiftCause: digest(getOtByShiftCause()),
      poolKpis: getPoolKpis(),
      replacementOptions: digest(SITE_IDS.map((s) => listReplacementOptions(s, { date: "2026-09-25" }))),
      coverOptions: digest(SITE_IDS.map((s) => listCoverOptionsForSite(s, "2026-09-25"))),
      impact: digest(computeShiftImpact({ from: "2026-09-20", to: "2026-10-05" })),
    }).toMatchSnapshot();
  });

  it("overtime", () => {
    const f = ot.defaultOtFilters();
    expect({
      overview: ot.getOverviewKpis(f),
      employees: digest(ot.getEmployeeOtRows(f)),
      sites: digest(ot.getSiteOtRows(f)),
      monthly: digest(ot.getMonthlyTrend(f)),
      yearly: ot.getYearlyTrend(f),
      department: ot.getDepartmentBreakdown(f),
      shift: ot.getShiftBreakdown(f),
      reason: ot.getReasonBreakdown(f),
      status: ot.getStatusBreakdown(f),
      heatmap: digest(ot.getHeatmapMonthSite(f)),
      insights: digest(ot.buildInsights(f)),
    }).toMatchSnapshot();
  });

  it("training / notifications / salary", () => {
    expect({
      certificates: digest(getAllCertificates()),
      pendingEvaluations: digest(getPendingEvaluations()),
      recommended: getRecommendedCourses("emp0126").map((r) => r.id),
      trainingItems: digest(getTrainingItems()),
      notifications: getNotificationsForEmployee("emp0126"),
      salary: getSalaryHistory("emp0126"),
    }).toMatchSnapshot();
  });
});

describe("leave workflow", () => {
  const base: leave.CreateLeaveInput = {
    employeeId: "emp0128",
    mode: "planned",
    leaveType: "casual",
    startDate: "2026-09-28",
    endDate: "2026-09-29",
    expectedReturnDate: "2026-09-30",
    reason: "Baseline flow",
    entrySource: "employee",
    enteredByName: "Mohee Vinchu",
    enteredByRole: "employee",
    supervisorName: "Neetesh Diwathe",
    siteInChargeName: "Bidhichand Rajbhar",
  };

  it("every action, valid and invalid, records the same result", () => {
    const steps: Record<string, unknown> = {};
    const a = leave.createLeaveRequest(base, { skipApiPush: true });
    steps.create = a;
    steps.invalidFinalize = outcome(() => leave.finalizeApprove(a.id, "Dir"));
    steps.verify = outcome(() => leave.supervisorVerify(a.id, "Sup"));
    steps.siteApprove = outcome(() => leave.siteApprove(a.id, "SIC", { arrangeReplacement: true }));
    steps.manager = outcome(() => leave.managerDecideLeave(a.id, "Mgr", "approved"));
    steps.admin = outcome(() => leave.adminFinalizeLeave(a.id, "Dir", "approved"));
    steps.lateReturn = outcome(() => leave.confirmReturn(a.id, "Sup", "2026-10-02"));
    steps.closeExtension = outcome(() => leave.confirmReturn(a.id, "Sup", "2026-10-03"));

    const b = leave.createLeaveRequest({ ...base, employeeId: "emp0129", mode: "emergency" }, { skipApiPush: true });
    steps.emergencyCreate = b;
    steps.emergencyVerify = outcome(() => leave.supervisorVerify(b.id, "Sup"));
    steps.emergencySite = outcome(() => leave.siteApprove(b.id, "SIC", { otFallback: true, approveAnyway: true }));
    steps.escalate = outcome(() => leave.escalateLeave(b.id, "SIC", "Need docs"));
    steps.rejectNoNote = outcome(() => leave.rejectLeave(b.id, "Mgr", "  "));
    steps.reject = outcome(() => leave.rejectLeave(b.id, "Mgr", "Not justified"));

    const c = leave.createLeaveRequest(
      { ...base, employeeId: "emp0127", entrySource: "supervisor_on_behalf", enteredByRole: "supervisor" },
      { skipApiPush: true },
    );
    steps.onBehalfCreate = c;
    steps.consent = outcome(() => leave.employeeConsentLeave(c.id, "Rohit", "approved", "ok"));
    steps.cancelNoReason = outcome(() => leave.cancelLeave(c.id, "Rohit", ""));
    steps.cancel = outcome(() => leave.cancelLeave(c.id, "Rohit", "Plans changed"));
    steps.consentAgain = outcome(() => leave.employeeConsentLeave(c.id, "Rohit", "rejected"));

    // Chosen cover: one pool/local reliever, one employee; then an on-time return
    const pick = (kind: "employee" | "reliever", employeeId: string) => {
      const o = listReplacementOptions("s-etp", { date: "2026-10-06", excludeEmployeeId: employeeId });
      return [...o.local, ...o.cluster].find((x) => (kind === "employee") === (x.kind === "employee"))?.relieverId;
    };
    const d = leave.createLeaveRequest(
      { ...base, employeeId: "emp0130", startDate: "2026-10-06", endDate: "2026-10-06", expectedReturnDate: "2026-10-07" },
      { skipApiPush: true },
    );
    steps.chosenRelieverId = pick("reliever", d.employeeId);
    steps.dVerify = outcome(() => leave.supervisorVerify(d.id, "Sup"));
    steps.dSite = outcome(() => leave.siteApprove(d.id, "SIC", { relieverId: steps.chosenRelieverId as string }));
    steps.dManager = outcome(() => leave.managerDecideLeave(d.id, "Mgr", "approved"));
    steps.dAdmin2 = outcome(() => leave.adminFinalizeLeave(d.id, "Dir", "approved"));
    steps.dOnTimeReturn = outcome(() => leave.confirmReturn(d.id, "Sup", "2026-10-07"));

    const e = leave.createLeaveRequest(
      { ...base, employeeId: "emp0126", startDate: "2026-10-06", endDate: "2026-10-06", expectedReturnDate: "2026-10-07" },
      { skipApiPush: true },
    );
    steps.chosenEmployeeId = pick("employee", e.employeeId);
    steps.eVerify = outcome(() => leave.supervisorVerify(e.id, "Sup"));
    steps.eSite = outcome(() => leave.siteApprove(e.id, "SIC", { relieverId: steps.chosenEmployeeId as string }));
    steps.eSiteAgain = outcome(() => leave.siteApprove(e.id, "SIC", { otFallback: true }));

    steps.finalStore = digest(leave.getLeaveRequests());
    expect(steps).toMatchSnapshot();
  });
});
