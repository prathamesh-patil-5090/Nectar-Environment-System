import { employees, getEmployeeById } from "@/lib/mock-data";
import { getOtAssignments } from "@/lib/overtime/assignments";
import { defaultOtRules, getRateRule } from "@/lib/overtime/rules";
import { computeShiftImpact } from "@/lib/shift-impact/engine";
import { rankCoverCandidates } from "@/lib/shift-impact/candidates";
import { OT_HOURLY_COST } from "@/lib/shift-impact/types";
import type { SkillTag } from "@/lib/reliever/pool";
import { openSeriousIncidentFor } from "@/lib/safety/gates";
import {
  findClearingOtDecision,
  getOtDecisions,
  updateOtDecision,
  upsertOtDecision,
} from "./store";
import type {
  EvaluateOtDecisionOpts,
  OtDecision,
  OtDecisionEvaluation,
  OtDecisionAssignee,
  OtPolicyFlag,
} from "./types";

function hoursOnDate(employeeId: string, date: string): number {
  try {
    return getOtAssignments({ employeeId })
      .filter((a) => a.date === date && a.status !== "cancelled")
      .reduce((s, a) => s + a.hours, 0);
  } catch {
    return 0;
  }
}

function siteOtHoursInWindow(siteId: string, date: string): number {
  try {
    // Soft window: same calendar month prefix YYYY-MM
    const prefix = date.slice(0, 7);
    return getOtAssignments({ siteId })
      .filter(
        (a) => a.date.startsWith(prefix) && a.status !== "cancelled",
      )
      .reduce((s, a) => s + a.hours, 0);
  } catch {
    return 0;
  }
}

function proposeAssignees(
  siteId: string,
  date: string,
  hours: number,
): OtDecisionAssignee[] {
  const maxDaily = defaultOtRules.maximumDailyOTHours ?? 4;
  return employees
    .filter(
      (e) =>
        e.siteId === siteId &&
        e.otEligible &&
        e.employmentStatus === "active" &&
        e.employeeCategory !== "manager" &&
        // Not proposed for OT while involved in an open high/critical safety incident
        !openSeriousIncidentFor(e.id),
    )
    .map((e) => ({
      employeeId: e.id,
      name: e.name,
      siteId: e.siteId,
      currentOtHoursOnDate: hoursOnDate(e.id, date),
    }))
    .filter((a) => a.currentOtHoursOnDate + hours <= maxDaily + 2)
    .sort((a, b) => a.currentOtHoursOnDate - b.currentOtHoursOnDate)
    .slice(0, 5);
}

function flagLabel(f: OtPolicyFlag): string {
  switch (f) {
    case "reliever_available":
      return "Eligible cover still available (reliever-first)";
    case "over_daily_max":
      return `Would exceed max daily OT (${defaultOtRules.maximumDailyOTHours ?? 4}h)`;
    case "over_weekly_soft":
      return "Assignee already has elevated OT load";
    case "high_site_load":
      return `Site OT load is high (≥ ${defaultOtRules.highOtSiteHoursThreshold}h this month)`;
  }
}

/**
 * Evaluate whether OT may be accepted and what soft flags apply.
 */
export function evaluateOtDecision(
  opts: EvaluateOtDecisionOpts,
): OtDecisionEvaluation {
  const hours = opts.hours ?? 8;
  const cost = Math.round(hours * OT_HOURLY_COST);
  const flags: OtPolicyFlag[] = [];
  const reasons: string[] = [];

  let candidateCoverCount = 0;
  let requiredSkills: SkillTag[] = [];

  if (opts.leaveId || opts.vacancyId) {
    const impact = computeShiftImpact({
      siteId: opts.siteId,
      from: opts.date,
      to: opts.date,
      focusLeaveId: opts.leaveId,
    });
    const vacancy =
      impact.vacancies.find((v) =>
        opts.vacancyId
          ? v.id === opts.vacancyId
          : opts.leaveId
            ? v.leaveId === opts.leaveId && v.date === opts.date
            : v.date === opts.date && v.status === "open",
      ) ??
      impact.vacancies.find(
        (v) => v.date === opts.date && v.status === "open",
      );

    if (vacancy) {
      candidateCoverCount = vacancy.candidates.length;
      requiredSkills = vacancy.requiredSkills;
    }
  }

  if (candidateCoverCount === 0 && !opts.leaveId) {
    // Roster / absence path — rank live
    const ranked = rankCoverCandidates({
      siteId: opts.siteId,
      date: opts.date,
      requiredSkills: requiredSkills.length
        ? requiredSkills
        : (["General Shift"] as SkillTag[]),
    });
    candidateCoverCount = ranked.length;
  }

  if (candidateCoverCount > 0) {
    flags.push("reliever_available");
    reasons.push(flagLabel("reliever_available"));
  }

  const maxDaily = defaultOtRules.maximumDailyOTHours ?? 4;
  if (hours > maxDaily) {
    flags.push("over_daily_max");
    reasons.push(flagLabel("over_daily_max"));
  }

  const siteLoad = siteOtHoursInWindow(opts.siteId, opts.date);
  if (siteLoad >= defaultOtRules.highOtSiteHoursThreshold) {
    flags.push("high_site_load");
    reasons.push(flagLabel("high_site_load"));
  }

  const proposedAssignees = proposeAssignees(opts.siteId, opts.date, hours);
  if (
    proposedAssignees.length &&
    proposedAssignees.every(
      (a) => a.currentOtHoursOnDate >= defaultOtRules.highOtHoursThreshold / 4,
    )
  ) {
    flags.push("over_weekly_soft");
    reasons.push(flagLabel("over_weekly_soft"));
  }

  const needsManagerRemark = flags.length > 0;
  const canSicAccept = !needsManagerRemark;

  const title =
    candidateCoverCount > 0
      ? "OT while cover candidates remain"
      : "OT last resort — no cover match";

  const message = needsManagerRemark
    ? `Manager remark required before OT: ${reasons.join("; ")}.`
    : `SIC may accept OT (${hours}h · ₹${cost}).`;

  return {
    hours,
    cost,
    flags,
    proposedAssignees,
    candidateCoverCount,
    needsManagerRemark,
    canSicAccept,
    reasons,
    title,
    message,
  };
}

export function ensurePendingOtDecision(
  opts: EvaluateOtDecisionOpts,
): OtDecision {
  const existing = getOtDecisions({
    siteId: opts.siteId,
    status: "pending",
  }).find(
    (d) =>
      d.date === opts.date &&
      (opts.leaveId ? d.leaveId === opts.leaveId : true) &&
      (opts.vacancyId ? d.vacancyId === opts.vacancyId : true) &&
      (opts.absenceId ? d.absenceId === opts.absenceId : true),
  );
  if (existing) return existing;

  const ev = evaluateOtDecision(opts);
  return upsertOtDecision({
    status: "pending",
    trigger: opts.trigger ?? (opts.leaveId ? "leave_cover" : "roster_vacancy"),
    siteId: opts.siteId,
    date: opts.date,
    shiftCode: opts.shiftCode,
    shiftId: opts.shiftId,
    leaveId: opts.leaveId,
    vacancyId: opts.vacancyId,
    absenceId: opts.absenceId,
    hours: ev.hours,
    cost: ev.cost,
    flags: ev.flags,
    proposedAssignees: ev.proposedAssignees,
    title: ev.title,
    message: ev.message,
  });
}

export function approveOtDecision(input: {
  decisionId: string;
  actor: string;
  remark: string;
  employeeId?: string;
}): OtDecision {
  if (!input.remark.trim()) {
    throw new Error("Remark is required to approve OT");
  }
  const emp = input.employeeId ? getEmployeeById(input.employeeId) : undefined;
  return updateOtDecision(input.decisionId, {
    status: "approved",
    actor: input.actor,
    remark: input.remark.trim(),
    chosenEmployeeId: emp?.id,
    chosenEmployeeName: emp?.name,
    decidedAt: new Date().toISOString(),
  });
}

export function blockOtDecision(input: {
  decisionId: string;
  actor: string;
  remark: string;
}): OtDecision {
  if (!input.remark.trim()) {
    throw new Error("Remark is required to block OT");
  }
  return updateOtDecision(input.decisionId, {
    status: "blocked",
    actor: input.actor,
    remark: input.remark.trim(),
    decidedAt: new Date().toISOString(),
  });
}

/**
 * OT request for repairing a plant breakdown. Always a new decision (never merged with
 * leave-cover decisions on the same date); goes through the normal approve/block flow.
 */
export function createBreakdownOtDecision(input: {
  siteId: string;
  date: string;
  hours: number;
  safetyEventId: string;
  breakdownTitle: string;
}): OtDecision {
  const ev = evaluateOtDecision({ siteId: input.siteId, date: input.date, hours: input.hours, trigger: "breakdown_repair" });
  return upsertOtDecision({
    status: "pending",
    trigger: "breakdown_repair",
    siteId: input.siteId,
    date: input.date,
    safetyEventId: input.safetyEventId,
    hours: ev.hours,
    cost: ev.cost,
    flags: ev.flags,
    proposedAssignees: ev.proposedAssignees,
    title: `Breakdown repair: ${input.breakdownTitle}`,
    message: ev.message,
  });
}

/**
 * OT request for permitted work that needs more hours than the E-Permit window. Always a new decision;
 * it carries the permit id so OT shows what work it was for and the permit shows who approved the hours.
 */
export function createEPermitOtDecision(input: {
  siteId: string;
  date: string;
  hours: number;
  ePermitId: string;
  permitNo: string;
  workTitle: string;
}): OtDecision {
  const ev = evaluateOtDecision({ siteId: input.siteId, date: input.date, hours: input.hours, trigger: "e_permit_overrun" });
  return upsertOtDecision({
    status: "pending",
    trigger: "e_permit_overrun",
    siteId: input.siteId,
    date: input.date,
    ePermitId: input.ePermitId,
    hours: ev.hours,
    cost: ev.cost,
    flags: ev.flags,
    proposedAssignees: ev.proposedAssignees,
    title: `E-Permit overrun: ${input.permitNo} · ${input.workTitle}`,
    message: ev.message,
  });
}

/** Cost helper for UI using operator rate when available */
export function estimateOtCost(hours: number, payCategory = "operator"): number {
  try {
    const rule = getRateRule(payCategory as "operator");
    return Math.round(hours * rule.baseHourlyRate * rule.multiplier);
  } catch {
    return Math.round(hours * OT_HOURLY_COST);
  }
}

export { findClearingOtDecision };
