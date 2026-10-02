import { getManpowerConflictReport } from "./engine";
import { getManpowerSources } from "./sources";
import type {
  LeaveGateResult,
  ManpowerIssue,
  PublishGateResult,
} from "./types";

const SCHEDULE_BLOCK_KINDS = new Set(["double_booking"]);

const VACANCY_KINDS = new Set(["uncovered_vacancy", "open_vacancy"]);

/**
 * Hard gate for leave site approval.
 * Cover / OT opts clear vacancy blockers.
 * leave_on_roster / rest appear on the hub but do not block site-approve
 * (roster still shows the person until leave is approved).
 * Double booking for the absent employee on leave dates still blocks.
 */
export function assertCanSiteApproveLeave(
  leaveId: string,
  opts?: {
    relieverId?: string;
    otFallback?: boolean;
    arrangeReplacement?: boolean;
  },
): LeaveGateResult {
  const { getLeaveById } = getManpowerSources();
  const leave = getLeaveById(leaveId);
  if (!leave) {
    return {
      ok: false,
      reasons: ["Leave request not found"],
      blockingIssues: [],
    };
  }

  const report = getManpowerConflictReport({
    siteId: leave.siteId,
    from: leave.startDate,
    to: leave.endDate,
    focusLeaveId: leave.id,
  });

  const coverResolves =
    Boolean(opts?.relieverId) ||
    Boolean(opts?.otFallback) ||
    Boolean(opts?.arrangeReplacement) ||
    Boolean(leave.assignedRelieverId) ||
    Boolean(leave.assignedCoverEmployeeId) ||
    leave.coverSource === "ot_fallback";

  const blocking: ManpowerIssue[] = [];

  for (const issue of report.issues) {
    if (issue.severity !== "attention") continue;

    if (VACANCY_KINDS.has(issue.kind)) {
      if (issue.leaveId && issue.leaveId !== leave.id) continue;
      if (!coverResolves) blocking.push(issue);
      continue;
    }

    if (SCHEDULE_BLOCK_KINDS.has(issue.kind)) {
      if (issue.employeeId === leave.employeeId) {
        blocking.push(issue);
      }
    }
  }

  const focusVacancies = report.issues.filter(
    (i) =>
      VACANCY_KINDS.has(i.kind) &&
      (!i.leaveId || i.leaveId === leave.id) &&
      i.severity === "attention",
  );
  if (focusVacancies.length && !coverResolves) {
    for (const v of focusVacancies) {
      if (!blocking.find((b) => b.id === v.id)) blocking.push(v);
    }
  }

  return {
    ok: blocking.length === 0,
    reasons: blocking.map((b) => b.message),
    blockingIssues: blocking,
  };
}

export function assertCanSiteApproveLeaveOrThrow(
  leaveId: string,
  opts?: {
    relieverId?: string;
    otFallback?: boolean;
    arrangeReplacement?: boolean;
  },
) {
  const result = assertCanSiteApproveLeave(leaveId, opts);
  if (!result.ok) {
    throw new Error(
      result.reasons[0] ??
        "Cannot site-approve: resolve manpower conflicts or assign cover / OT",
    );
  }
  return result;
}

export function assertCanPublishRotation(
  siteId: string,
  fromDate: string,
  toDate: string,
  opts?: {
    acknowledgeOt?: boolean;
    assignments?: Array<{ employeeId: string; date: string; code: string }>;
  },
): PublishGateResult {
  const { validateScheduleAssignments } = getManpowerSources();

  const report = getManpowerConflictReport({
    siteId,
    from: fromDate,
    to: toDate,
  });

  const blocking: ManpowerIssue[] = [];

  if (opts?.assignments?.length) {
    const draftConflicts = validateScheduleAssignments(
      siteId,
      opts.assignments as Parameters<typeof validateScheduleAssignments>[1],
    ).filter((c) => c.severity === "attention");
    for (const c of draftConflicts) {
      blocking.push({
        id: c.id,
        siteId: c.siteId,
        date: c.date,
        kind:
          c.type === "leave"
            ? "leave_on_roster"
            : c.type === "rest"
              ? "rest"
              : c.type === "double_booking"
                ? "double_booking"
                : "weekly_off",
        severity: "attention",
        title: "Draft schedule conflict",
        message: c.message,
        employeeId: c.employeeId,
        resolvableBy: "schedule_edit",
      });
    }
  }

  for (const issue of report.issues) {
    if (issue.severity !== "attention") continue;
    if (issue.kind === "uncovered_vacancy") {
      if (opts?.acknowledgeOt) continue;
      blocking.push(issue);
      continue;
    }
    // Live rest / leave_on_roster / open_vacancy are hub signals.
    // Publish hard-blocks from draft validation (above) + uncovered gaps only.
  }

  const onlyVacancy =
    blocking.length > 0 &&
    blocking.every((b) => b.kind === "uncovered_vacancy");

  return {
    ok: blocking.length === 0,
    reasons: blocking.map((b) => b.message),
    blockingIssues: blocking,
    otAcknowledgeWouldClear: onlyVacancy,
  };
}

export function assertCanPublishRotationOrThrow(
  siteId: string,
  fromDate: string,
  toDate: string,
  opts?: {
    acknowledgeOt?: boolean;
    assignments?: Array<{ employeeId: string; date: string; code: string }>;
  },
) {
  const result = assertCanPublishRotation(siteId, fromDate, toDate, opts);
  if (!result.ok) {
    throw new Error(
      result.reasons[0] ??
        "Cannot publish rotation: resolve attention conflicts or acknowledge OT for uncovered gaps",
    );
  }
  return result;
}

export function leaveRequiresCoverChoice(leaveId: string): boolean {
  const result = assertCanSiteApproveLeave(leaveId, {});
  return result.blockingIssues.some((i) => VACANCY_KINDS.has(i.kind));
}
