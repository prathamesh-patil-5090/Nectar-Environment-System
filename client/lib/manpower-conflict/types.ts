export type ManpowerIssueKind =
  | "uncovered_vacancy"
  | "open_vacancy"
  | "plant_overlap"
  | "rest"
  | "weekly_off"
  | "leave_on_roster"
  | "double_booking"
  | "reliever_contest"
  | "ot_decision_pending"
  | "lifecycle_extension"
  | "cover_disrupted";

export type ManpowerSeverity = "watch" | "attention";

export type ManpowerResolvableBy =
  | "cover"
  | "ot"
  | "schedule_edit"
  | "none";

export type ManpowerIssue = {
  id: string;
  siteId: string;
  date: string;
  shiftCode?: string;
  kind: ManpowerIssueKind;
  severity: ManpowerSeverity;
  title: string;
  message: string;
  href?: string;
  employeeId?: string;
  leaveId?: string;
  resolvableBy: ManpowerResolvableBy;
};

export type ManpowerConflictReport = {
  from: string;
  to: string;
  siteId?: string;
  focusLeaveId?: string;
  issues: ManpowerIssue[];
  attentionCount: number;
  uncoveredCount: number;
  overlapCount: number;
  openVacancyCount: number;
};

export type GetManpowerConflictReportOpts = {
  siteId?: string;
  from: string;
  to: string;
  focusLeaveId?: string;
};

export type LeaveGateResult = {
  ok: boolean;
  reasons: string[];
  blockingIssues: ManpowerIssue[];
};

export type PublishGateResult = {
  ok: boolean;
  reasons: string[];
  blockingIssues: ManpowerIssue[];
  /** True when only uncovered vacancies remain (OT acknowledge can clear) */
  otAcknowledgeWouldClear: boolean;
};
