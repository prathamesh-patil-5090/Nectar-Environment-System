export type OtDecisionStatus =
  | "pending"
  | "approved"
  | "blocked"
  | "superseded";

export type OtDecisionTrigger =
  | "leave_cover"
  | "roster_vacancy"
  | "rotation_publish"
  | "manual_assign"
  /** Repair work on a plant breakdown (Safety → Breakdowns) */
  | "breakdown_repair"
  /** Permitted work needs more hours than the E-Permit allows */
  | "e_permit_overrun";

export type OtPolicyFlag =
  | "reliever_available"
  | "over_daily_max"
  | "over_weekly_soft"
  | "high_site_load";

export type OtDecisionAssignee = {
  employeeId: string;
  name: string;
  siteId: string;
  currentOtHoursOnDate: number;
};

export type OtDecision = {
  id: string;
  status: OtDecisionStatus;
  trigger: OtDecisionTrigger;
  siteId: string;
  date: string;
  shiftCode?: string;
  shiftId?: string;
  leaveId?: string;
  vacancyId?: string;
  absenceId?: string;
  /** Safety breakdown this OT repairs (trigger breakdown_repair) */
  safetyEventId?: string;
  /** E-Permit whose work ran over (trigger e_permit_overrun) */
  ePermitId?: string;
  hours: number;
  cost: number;
  flags: OtPolicyFlag[];
  proposedAssignees: OtDecisionAssignee[];
  chosenEmployeeId?: string;
  chosenEmployeeName?: string;
  remark?: string;
  actor?: string;
  createdAt: string;
  decidedAt?: string;
  title: string;
  message: string;
};

export type EvaluateOtDecisionOpts = {
  siteId: string;
  date: string;
  shiftCode?: string;
  shiftId?: string;
  leaveId?: string;
  vacancyId?: string;
  absenceId?: string;
  trigger?: OtDecisionTrigger;
  /** Proposed OT hours; default 8 */
  hours?: number;
};

export type OtDecisionEvaluation = {
  hours: number;
  cost: number;
  flags: OtPolicyFlag[];
  proposedAssignees: OtDecisionAssignee[];
  candidateCoverCount: number;
  needsManagerRemark: boolean;
  canSicAccept: boolean;
  reasons: string[];
  title: string;
  message: string;
};

export type AcceptOtGateResult = {
  ok: boolean;
  needsManagerRemark: boolean;
  evaluation: OtDecisionEvaluation;
  reasons: string[];
  /** Existing approved decision that clears the soft block */
  clearedByDecisionId?: string;
};
