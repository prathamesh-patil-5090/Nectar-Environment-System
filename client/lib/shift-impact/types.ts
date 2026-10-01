import type { SkillTag } from "@/lib/reliever/pool";
import type { ShiftCode } from "@/lib/shift/types";

export type VacancySource = "leave" | "roster_gap";

export type VacancyStatus = "open" | "covered" | "ot_fallback";

export type CoverCandidateKind = "employee" | "reliever";

export type CoverCandidateSource =
  | "local_employee"
  | "cluster_employee"
  | "local_pool"
  | "cluster_pool";

export type CoverSource =
  | CoverCandidateSource
  | "ot_fallback"
  | "auto_pool";

export type ShiftVacancy = {
  id: string;
  siteId: string;
  date: string;
  shiftId: string;
  shiftCode: ShiftCode;
  source: VacancySource;
  absentEmployeeId?: string;
  absentEmployeeName?: string;
  leaveId?: string;
  requiredSkills: SkillTag[];
  status: VacancyStatus;
  candidates: CoverCandidate[];
  chosenCoverId?: string;
  chosenCoverName?: string;
  chosenCoverSource?: CoverSource;
};

export type CoverCandidate = {
  kind: CoverCandidateKind;
  /** Reliever id or employee id depending on kind */
  id: string;
  employeeId?: string;
  name: string;
  phone?: string;
  source: CoverCandidateSource;
  homeSiteId?: string;
  skills: SkillTag[];
  matchScore: number;
};

export type ShiftImpactRisk = "none" | "low" | "high";

export type ShiftImpactReport = {
  from: string;
  to: string;
  siteId?: string;
  focusLeaveId?: string;
  vacancies: ShiftVacancy[];
  uncoveredCount: number;
  coveredCount: number;
  potentialOtHours: number;
  potentialOtCost: number;
  risk: ShiftImpactRisk;
  availableRelievers: number;
  nearbyAvailableWorkers: number;
  currentManpower: number;
  requiredManpower: number;
};

export type ComputeShiftImpactOpts = {
  siteId?: string;
  from: string;
  to: string;
  /** When set, report centers on that leave's days plus competing same-plant overlaps */
  focusLeaveId?: string;
};

export const OT_HOURLY_COST = 270;

export const COVER_SOURCE_RANK: Record<CoverCandidateSource, number> = {
  local_employee: 0,
  cluster_employee: 1,
  local_pool: 2,
  cluster_pool: 3,
};
