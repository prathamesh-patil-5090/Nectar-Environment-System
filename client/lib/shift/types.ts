export type ShiftCode = "A" | "B" | "C" | "G" | "OFF";

export type RotationPatternId = "weekly_abc" | "paired_aabbcc";

export type ShiftMaster = {
  id: string;
  code: ShiftCode;
  name: string;
  startTime: string;
  endTime: string;
  scheduledHours: number;
  breakMinutes: number;
  color: string;
};

export type RotationPattern = {
  id: RotationPatternId;
  name: string;
  description: string;
  /** Sequence of shift codes repeating for groups */
  sequence: ShiftCode[];
  periodDays: number;
};

export type RestRuleConfig = {
  /** Minimum rest hours between consecutive shifts — configurable, not hard-coded legal advice */
  minimumRestHours: number;
  weeklyOffDay: number; // 0=Sun
  weeklyOffOtEnabled: boolean;
};

export type EmployeeRotationRow = {
  employeeId: string;
  employeeName: string;
  siteId: string;
  groupId: string;
  currentShiftId: string;
  currentCode: ShiftCode;
  nextShiftId: string;
  nextCode: ShiftCode;
  effectiveDate: string;
  weeklyOffDay: number;
};

export type PlannedShiftDay = {
  id: string;
  employeeId: string;
  siteId: string;
  date: string;
  plannedShiftId: string;
  plannedCode: ShiftCode;
  actualShiftId?: string;
  actualCode?: ShiftCode;
  isWeeklyOff: boolean;
  status: "planned" | "active" | "completed";
};

export type RotationAssignmentCell = {
  employeeId: string;
  date: string;
  code: ShiftCode;
};

export type RotationDecision = {
  by: string;
  at: string;
  remark: string;
  outcome: "approved" | "rejected";
};

export type RotationPreviewStatus =
  | "draft"
  | "pending_manager"
  | "pending_director"
  | "active"
  | "rejected";

export type RotationPreview = {
  id: string;
  siteId: string;
  fromDate: string;
  toDate: string;
  employeesAffected: number;
  fromCode: ShiftCode;
  toCode: ShiftCode;
  status: RotationPreviewStatus;
  /** Monthly builder fields */
  patternId?: RotationPatternId;
  groupIds?: string[];
  assignments?: RotationAssignmentCell[];
  label?: string;
  managerViewedAt?: string;
  directorViewedAt?: string;
  managerDecision?: RotationDecision;
  directorDecision?: RotationDecision;
};

export type ShiftChangeRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId: string;
  date: string;
  fromShiftId: string;
  toShiftId: string;
  reason: string;
  requestedBy: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  potentialOtHours: number;
  manpowerOk: boolean;
  createdAt: string;
};

export type ShiftConflict = {
  id: string;
  type: "rest" | "weekly_off" | "double_booking" | "leave";
  employeeId: string;
  employeeName: string;
  siteId: string;
  date: string;
  message: string;
  severity: "watch" | "attention";
};

export type ShiftDeviationAgg = {
  siteId: string;
  siteName: string;
  deviations: number;
  employeesAffected: number;
  otHoursAssociated: number;
};

export type RelieverSuggestion = {
  shiftId: string;
  shiftCode: ShiftCode;
  siteId: string;
  required: number;
  available: number;
  absent: number;
  suggestedRelieverIds: string[];
};
