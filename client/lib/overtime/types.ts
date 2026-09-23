export type OtStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PAID"
  | "CANCELLED";

export type ShiftType = "morning" | "afternoon" | "night";

export type EmployeeType = "permanent" | "contract" | "deputed";

export type PayCategory =
  | "operator"
  | "technician"
  | "supervisor"
  | "analyst"
  | "lead";

export type OtReasonCode =
  | "employee_absence"
  | "operational_requirement"
  | "emergency"
  | "shift_gap"
  | "plant_upset"
  | "unrecorded";

export type OtRulesConfig = {
  minimumOTMinutes: number;
  roundingInterval: number;
  maximumDailyOTHours: number | null;
  weeklyOffOTEnabled: boolean;
  holidayOTEnabled: boolean;
  highOtHoursThreshold: number;
  highOtSiteHoursThreshold: number;
  repeatedOtDaysThreshold: number;
  concentrationShareThreshold: number;
};

export type Shift = {
  id: string;
  name: string;
  type: ShiftType;
  startTime: string;
  endTime: string;
  scheduledHours: number;
  breakMinutes: number;
};

export type OtRateRule = {
  id: string;
  payCategory: PayCategory;
  multiplier: number;
  weeklyOffMultiplier: number;
  holidayMultiplier: number;
  baseHourlyRate: number;
};

export type AttendanceSnapshot = {
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string;
  actualEnd: string;
  breakMinutes: number;
  isWeeklyOff: boolean;
  isHoliday: boolean;
  onApprovedLeave: boolean;
};

export type OtRecord = {
  id: string;
  employeeId: string;
  siteId: string;
  date: string;
  shiftId: string;
  department: string;
  scheduledHours: number;
  actualHours: number;
  otHours: number;
  otRate: number;
  otCost: number;
  reason: OtReasonCode;
  status: OtStatus;
  dayOfWeek: number;
  hourBucket: number;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type OtFilters = {
  dateFrom?: string;
  dateTo?: string;
  year?: number;
  month?: number;
  siteId?: string;
  department?: string;
  employeeId?: string;
  shiftId?: string;
  employeeType?: EmployeeType;
  status?: OtStatus;
  reason?: OtReasonCode;
};

export type OtInsight = {
  id: string;
  kind:
    | "high_ot"
    | "repeated_ot"
    | "ot_concentration"
    | "increasing_ot"
    | "frequent_ot"
    | "shift_pattern"
    | "site_dependency"
    | "absenteeism_pattern";
  severity: "info" | "watch" | "attention";
  title: string;
  message: string;
  employeeId?: string;
  siteId?: string;
};

export const OT_REASON_LABELS: Record<OtReasonCode, string> = {
  employee_absence: "Employee Absence",
  operational_requirement: "Operational Requirement",
  emergency: "Emergency",
  shift_gap: "Shift Gap",
  plant_upset: "Plant Upset",
  unrecorded: "Unrecorded",
};

export const OT_STATUS_LABELS: Record<OtStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};
