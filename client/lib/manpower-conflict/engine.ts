import { getSiteName } from "@/lib/mock-data";
import { computeShiftImpact } from "@/lib/shift-impact/engine";
import { detectContests } from "@/lib/reliever-competition/engine";
import { getOtDecisions } from "@/lib/ot-decision/store";
import { getLifecycleReport } from "@/lib/leave-lifecycle/engine";
import { getManpowerSources } from "./sources";
import type {
  GetManpowerConflictReportOpts,
  ManpowerConflictReport,
  ManpowerIssue,
} from "./types";

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00Z").getTime();
  const end = new Date(to + "T00:00:00Z").getTime();
  for (let t = start; t <= end; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out.length ? out : [from];
}

/**
 * Unified Manpower + Conflict report for a site/date window.
 */
export function getManpowerConflictReport(
  opts: GetManpowerConflictReportOpts,
): ManpowerConflictReport {
  const { from, to, siteId, focusLeaveId } = opts;
  const {
    detectConflicts,
    getLeaveById,
    getLeaveRequests,
    getPlantOverlappingLeaves,
  } = getManpowerSources();

  const issues: ManpowerIssue[] = [];

  const impact = computeShiftImpact({
    siteId,
    from,
    to,
    focusLeaveId,
  });

  for (const v of impact.vacancies) {
    if (v.status === "covered" || v.status === "ot_fallback") continue;

    const noCandidates = v.candidates.length === 0;
    if (noCandidates) {
      issues.push({
        id: `uncov-${v.id}`,
        siteId: v.siteId,
        date: v.date,
        shiftCode: v.shiftCode,
        kind: "uncovered_vacancy",
        severity: "attention",
        title: "Uncovered shift vacancy",
        message: `${getSiteName(v.siteId)} ${v.date} ${v.shiftCode}: no employee or pool match${
          v.absentEmployeeName ? ` (absent: ${v.absentEmployeeName})` : ""
        }.`,
        href: v.leaveId
          ? `/leave/requests/${v.leaveId}`
          : "/shifts/reliever-allocation",
        employeeId: v.absentEmployeeId,
        leaveId: v.leaveId,
        resolvableBy: "ot",
      });
    } else {
      issues.push({
        id: `open-${v.id}`,
        siteId: v.siteId,
        date: v.date,
        shiftCode: v.shiftCode,
        kind: "open_vacancy",
        severity: "attention",
        title: "Open vacancy — cover not assigned",
        message: `${getSiteName(v.siteId)} ${v.date} ${v.shiftCode}: ${v.candidates.length} candidate(s) available; assign cover or accept OT.`,
        href: v.leaveId
          ? `/leave/requests/${v.leaveId}`
          : "/shifts/reliever-allocation",
        employeeId: v.absentEmployeeId,
        leaveId: v.leaveId,
        resolvableBy: "cover",
      });
    }
  }

  const conflicts = detectConflicts(siteId).filter(
    (c) =>
      c.date >= from && c.date <= to && (!siteId || c.siteId === siteId),
  );

  for (const c of conflicts) {
    const kind =
      c.type === "leave"
        ? "leave_on_roster"
        : c.type === "double_booking"
          ? "double_booking"
          : c.type === "rest"
            ? "rest"
            : "weekly_off";
    const severity: ManpowerIssue["severity"] =
      kind === "weekly_off" && c.severity === "watch"
        ? "watch"
        : "attention";
    issues.push({
      id: c.id,
      siteId: c.siteId,
      date: c.date,
      kind,
      severity,
      title:
        kind === "leave_on_roster"
          ? "Leave on roster"
          : kind === "double_booking"
            ? "Double booking"
            : kind === "rest"
              ? "Insufficient rest"
              : "Weekly off conflict",
      message: c.message,
      href: `/employees/${c.employeeId}`,
      employeeId: c.employeeId,
      resolvableBy: "schedule_edit",
    });
  }

  if (focusLeaveId) {
    const overlaps = getPlantOverlappingLeaves(focusLeaveId);
    for (const o of overlaps) {
      issues.push({
        id: `overlap-${focusLeaveId}-${o.id}`,
        siteId: o.siteId,
        date: o.startDate,
        kind: "plant_overlap",
        severity: "watch",
        title: "Plant leave overlap",
        message: `${o.employeeName} leave ${o.startDate}→${o.endDate} overlaps this request at ${getSiteName(o.siteId)}.`,
        href: `/leave/requests/${o.id}`,
        employeeId: o.employeeId,
        leaveId: o.id,
        resolvableBy: "none",
      });
    }
  } else {
    const leaves = getLeaveRequests(siteId).filter(
      (l) =>
        l.endDate >= from &&
        l.startDate <= to &&
        !["REJECTED", "CANCELLED", "CLOSED"].includes(l.status),
    );
    const seen = new Set<string>();
    for (const a of leaves) {
      for (const b of leaves) {
        if (a.id >= b.id) continue;
        if (a.siteId !== b.siteId) continue;
        if (a.endDate < b.startDate || b.endDate < a.startDate) continue;
        const key = `${a.id}|${b.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push({
          id: `overlap-${key}`,
          siteId: a.siteId,
          date: a.startDate < b.startDate ? b.startDate : a.startDate,
          kind: "plant_overlap",
          severity: "watch",
          title: "Plant leave overlap",
          message: `${a.employeeName} and ${b.employeeName} have overlapping leave at ${getSiteName(a.siteId)}.`,
          href: `/leave/requests/${a.id}`,
          leaveId: a.id,
          resolvableBy: "none",
        });
      }
    }
  }

  void getLeaveById;

  const contests = detectContests({ from, to, siteId });
  for (const contest of contests) {
    for (const claim of contest.claims) {
      if (claim.status === "awarded" || claim.status === "need_alt") continue;
      issues.push({
        id: `contest-${contest.id}-${claim.id}`,
        siteId: claim.siteId,
        date: claim.date,
        shiftCode: claim.shiftCode,
        kind: "reliever_contest",
        severity: "watch",
        title: "Reliever contest",
        message: `${contest.candidateName} contested for ${claim.absentEmployeeName} at ${getSiteName(claim.siteId)} (${contest.kind.replaceAll("_", " ")}).`,
        href: `/reliever-pool/competition${
          claim.leaveId ? `?leaveId=${claim.leaveId}` : ""
        }`,
        leaveId: claim.leaveId,
        resolvableBy: "cover",
      });
    }
  }

  for (const d of getOtDecisions({
    siteId,
    status: "pending",
  })) {
    if (d.date < from || d.date > to) continue;
    issues.push({
      id: `otd-${d.id}`,
      siteId: d.siteId,
      date: d.date,
      shiftCode: d.shiftCode,
      kind: "ot_decision_pending",
      severity: "watch",
      title: "OT decision pending",
      message: d.message,
      href: `/overtime/decisions${d.leaveId ? `?leaveId=${d.leaveId}` : ""}`,
      leaveId: d.leaveId,
      resolvableBy: "ot",
    });
  }

  const life = getLifecycleReport({ siteId, asOf: from });
  for (const c of life.cases) {
    if (c.kind === "extension_open") {
      issues.push({
        id: `lc-ext-${c.leaveId}`,
        siteId: c.siteId,
        date: c.expectedReturnDate,
        kind: "lifecycle_extension",
        severity: "attention",
        title: "Leave extension open",
        message: c.message,
        href: `/leave/lifecycle?leaveId=${c.leaveId}`,
        leaveId: c.leaveId,
        employeeId: c.employeeId,
        resolvableBy: "none",
      });
    }
    if (c.kind === "cover_disrupted") {
      issues.push({
        id: `lc-dis-${c.leaveId}`,
        siteId: c.siteId,
        date: c.expectedReturnDate,
        kind: "cover_disrupted",
        severity: "attention",
        title: "Cover disrupted",
        message: c.message,
        href: `/leave/lifecycle?leaveId=${c.leaveId}`,
        leaveId: c.leaveId,
        employeeId: c.employeeId,
        resolvableBy: "cover",
      });
    }
  }

  const uncoveredDates = new Set(
    issues
      .filter((i) => i.kind === "uncovered_vacancy")
      .map((i) => `${i.siteId}|${i.date}`),
  );
  const overlapsByDay = new Map<string, ManpowerIssue[]>();
  for (const i of issues) {
    if (i.kind !== "plant_overlap") continue;
    for (const d of eachDate(i.date, i.date)) {
      const key = `${i.siteId}|${d}`;
      const list = overlapsByDay.get(key) ?? [];
      list.push(i);
      overlapsByDay.set(key, list);
    }
  }
  for (const [key, list] of overlapsByDay) {
    if (list.length >= 2 && uncoveredDates.has(key)) {
      for (const i of list) i.severity = "attention";
    }
  }

  const byId = new Map<string, ManpowerIssue>();
  for (const i of issues) {
    if (!byId.has(i.id)) byId.set(i.id, i);
  }
  const deduped = [...byId.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return {
    from,
    to,
    siteId,
    focusLeaveId,
    issues: deduped,
    attentionCount: deduped.filter((i) => i.severity === "attention").length,
    uncoveredCount: deduped.filter((i) => i.kind === "uncovered_vacancy")
      .length,
    overlapCount: deduped.filter((i) => i.kind === "plant_overlap").length,
    openVacancyCount: deduped.filter((i) => i.kind === "open_vacancy").length,
  };
}
