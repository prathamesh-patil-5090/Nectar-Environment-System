/**
 * Production-style workforce metrics for the demo.
 *
 * Plain-language glossary
 * -----------------------
 * O&M = Operations & Maintenance — the work of *running* a treatment plant
 *       day-to-day (ops) and *keeping equipment healthy* (maintenance).
 *
 * Skill matrix = a table of "for this job role, how good are we expected to be
 *                at each skill?" (role baselines, 0–100).
 *
 * Skill mapping = dashboard heatmap of that matrix (roles × skills).
 *
 * Skill map = one person's scores on the same skills (role baseline ± personal
 *             skillScore delta).
 *
 * Site readiness = one plant score (0–100): "can this site run safely today?"
 */

import {
  employees,
  getEmployeeSkills,
  sites,
  skillLabels,
  skillMatrix,
  type Employee,
  type SkillKey,
  type Site,
} from "@/lib/mock-data";
import { getAbsences } from "@/lib/reliever/pool";
import { getTrainingItems } from "@/lib/training";

/** Weights for site readiness — must sum to 1.0 */
export const READINESS_WEIGHTS = {
  staffing: 0.3,
  training: 0.3,
  skill: 0.25,
  coverage: 0.15,
} as const;

/** Sites at or above this are counted as "compliance ready" */
export const READINESS_READY_THRESHOLD = 80;

export type SiteReadinessBreakdown = {
  siteId: string;
  siteName: string;
  readiness: number;
  staffingPct: number;
  trainingPct: number;
  skillPct: number;
  coveragePct: number;
  activeStaff: number;
  requiredStaff: number;
  openAbsences: number;
  overdueTrainingCount: number;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function activeStaffAtSite(siteId: string): Employee[] {
  return employees.filter(
    (e) => e.siteId === siteId && e.employmentStatus === "active",
  );
}

/**
 * Staffing factor: do we have enough people on the books vs planned headcount?
 * staffingPct = min(100, 100 * active / required)
 */
export function computeStaffingPct(siteId: string): {
  pct: number;
  active: number;
  required: number;
} {
  const site = sites.find((s) => s.id === siteId);
  const active = activeStaffAtSite(siteId).length;
  const required = Math.max(1, site?.headcount ?? active);
  const pct = clamp(Math.round((100 * active) / required));
  return { pct, active, required };
}

/**
 * Training factor: share of staff with no overdue training courses.
 * Uses localStorage-backed training overrides when present.
 */
export function computeTrainingPct(siteId: string): {
  pct: number;
  overdueCount: number;
} {
  const staff = activeStaffAtSite(siteId);
  if (!staff.length) return { pct: 0, overdueCount: 0 };

  const training = getTrainingItems();
  let overduePeople = 0;
  for (const emp of staff) {
    const overdue = training.some(
      (t) => t.employeeId === emp.id && t.status === "overdue",
    );
    // Fall back to roster flag if no training rows for that person
    const hasRows = training.some((t) => t.employeeId === emp.id);
    if (hasRows ? overdue : emp.trainingStatus === "overdue") {
      overduePeople += 1;
    }
  }
  const compliant = staff.length - overduePeople;
  const pct = clamp(Math.round((100 * compliant) / staff.length));
  return { pct, overdueCount: overduePeople };
}

/**
 * Skill factor: average overall skillScore of active staff (already 0–100).
 */
export function computeSkillPct(siteId: string): number {
  const staff = activeStaffAtSite(siteId);
  if (!staff.length) return 0;
  const avg =
    staff.reduce((sum, e) => sum + e.skillScore, 0) / staff.length;
  return clamp(Math.round(avg));
}

/**
 * Coverage factor: open absences without replacement erode readiness.
 * At 0 open absences → 100%. If open absences reach 20% of headcount → 0%.
 */
export function computeCoveragePct(siteId: string): {
  pct: number;
  openAbsences: number;
} {
  const { required } = computeStaffingPct(siteId);
  const openAbsences = getAbsences().filter(
    (a) => a.siteId === siteId && a.status === "open",
  ).length;
  const stressCap = Math.max(1, required * 0.2);
  const pct = clamp(Math.round(100 * (1 - openAbsences / stressCap)));
  return { pct, openAbsences };
}

/**
 * Production site readiness:
 *
 *   readiness =
 *     0.30 × staffingPct +
 *     0.30 × trainingPct +
 *     0.25 × skillPct +
 *     0.15 × coveragePct
 *
 * All inputs are 0–100; result rounded to nearest integer.
 */
export function computeSiteReadiness(siteId: string): SiteReadinessBreakdown {
  const site = sites.find((s) => s.id === siteId);
  const staffing = computeStaffingPct(siteId);
  const training = computeTrainingPct(siteId);
  const skillPct = computeSkillPct(siteId);
  const coverage = computeCoveragePct(siteId);

  const readiness = clamp(
    Math.round(
      READINESS_WEIGHTS.staffing * staffing.pct +
        READINESS_WEIGHTS.training * training.pct +
        READINESS_WEIGHTS.skill * skillPct +
        READINESS_WEIGHTS.coverage * coverage.pct,
    ),
  );

  return {
    siteId,
    siteName: site?.name ?? siteId,
    readiness,
    staffingPct: staffing.pct,
    trainingPct: training.pct,
    skillPct,
    coveragePct: coverage.pct,
    activeStaff: staffing.active,
    requiredStaff: staffing.required,
    openAbsences: coverage.openAbsences,
    overdueTrainingCount: training.overdueCount,
  };
}

export function getSitesWithComputedReadiness(siteId?: string): (Site & {
  readiness: number;
  readinessBreakdown: SiteReadinessBreakdown;
})[] {
  return sites
    .filter((s) => (siteId ? s.id === siteId : true))
    .map((s) => {
      const breakdown = computeSiteReadiness(s.id);
      return { ...s, readiness: breakdown.readiness, readinessBreakdown: breakdown };
    });
}

/**
 * Skill matrix (role × skill) — production meaning:
 * Curated role baselines (or assessment averages). Not recalculated per render.
 * Optional rollup: average of personal skill maps for people in that role.
 */
export function getSkillMatrixRows() {
  return skillMatrix.map((row) => ({ ...row }));
}

/**
 * Personal skill map — production formula already used in getEmployeeSkills:
 *
 *   roleAvg = average(roleBaseline[skill])
 *   delta   = employee.skillScore − roleAvg
 *   score[skill] = clamp(roleBaseline[skill] + delta, 0, 100)
 */
export function explainEmployeeSkillMap(employee: Employee) {
  const skills = getEmployeeSkills(employee);
  const keys = Object.keys(skillLabels) as SkillKey[];
  const row = skillMatrix.find((r) => r.role === employee.role);
  const roleAvg = row
    ? Math.round(keys.reduce((s, k) => s + row[k], 0) / keys.length)
    : 0;
  return {
    skills,
    roleAvg,
    delta: employee.skillScore - roleAvg,
    overallSkillScore: employee.skillScore,
  };
}

export function getSkillCoveragePct(siteId?: string): number {
  const staff = siteId
    ? activeStaffAtSite(siteId)
    : employees.filter((e) => e.employmentStatus === "active");
  if (!staff.length) return 0;
  return clamp(
    Math.round(staff.reduce((s, e) => s + e.skillScore, 0) / staff.length),
  );
}

export function countComplianceReadySites(siteId?: string): number {
  return getSitesWithComputedReadiness(siteId).filter(
    (s) => s.readiness >= READINESS_READY_THRESHOLD,
  ).length;
}
