import { localizedRecord } from "@/lib/i18n/localized";

export type LeaveMode = "planned" | "emergency";

export type LeaveType =
  | "casual"
  | "sick"
  | "family_emergency"
  | "unpaid"
  | "other";

export type LeaveStatus =
  | "REQUESTED"
  | "PENDING_EMPLOYEE_CONSENT"
  | "SUPERVISOR_VERIFIED"
  | "SITE_APPROVED"
  | "MANAGER_APPROVED"
  | "HR_VALIDATED"
  | "APPROVED"
  | "ABSENT"
  | "SUPERVISOR_RECORDED"
  | "SITE_VERIFIED"
  | "CLOSED"
  | "PENDING_INFORMATION"
  | "UNEXPLAINED_ABSENCE"
  | "REJECTED"
  | "CANCELLED"
  | "EXTENSION_REQUIRED";

export type LeaveEntrySource = "employee" | "supervisor_on_behalf";

export type LeaveActorRole =
  | "employee"
  | "supervisor"
  | "site_incharge"
  | "hr"
  | "management"
  | "director";

export type ConsentDecision = "approved" | "rejected";
export type ManagerDecision = "approved" | "rejected";

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId: string;
  department: string;
  shiftId: string;
  mode: LeaveMode;
  leaveType: LeaveType;
  status: LeaveStatus;
  entrySource: LeaveEntrySource;
  startDate: string;
  endDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  reason: string;
  lastCommunication?: string;
  requestedByName?: string;
  enteredByName: string;
  enteredByRole: LeaveActorRole;
  supervisorName: string;
  siteInChargeName: string;
  /** Manager display name for the plant */
  managerName?: string;
  submittedByEmployeeId?: string;
  employeeConsent?: ConsentDecision;
  employeeConsentAt?: string;
  employeeConsentNote?: string;
  managerDecision?: ManagerDecision;
  managerDecisionAt?: string;
  rejectionReason?: string;
  /** Soft-delete / withdrawal (kept visible for ops) */
  cancellationReason?: string;
  cancelledByName?: string;
  cancelledByRole?: LeaveActorRole;
  cancelledAt?: string;
  replacementRequired: boolean;
  assignedRelieverId?: string;
  /** Employee assigned as cover (first-class, not pool) */
  assignedCoverEmployeeId?: string;
  /** How coverage was resolved */
  coverSource?:
    | "local_employee"
    | "cluster_employee"
    | "local_pool"
    | "cluster_pool"
    | "ot_fallback"
    | "auto_pool";
  replacementPlan?: string;
  potentialOtHours: number;
  potentialOtCost: number;
  leaveBalanceDays: number;
  daysRequested: number;
  isHalfDay?: boolean;
  halfDaySlot?: "morning" | "afternoon";
  policyVerdict?: "PASS" | "WARN" | "BLOCK";
  policyFlags?: Array<{
    code: string;
    severity: "warn" | "block";
    message: string;
  }>;
  policySuggestions?: string[];
  createdAt: string;
  updatedAt: string;
  timeline: LeaveTimelineEvent[];
};

export type LeaveTimelineEvent = {
  at: string;
  actor: string;
  role: LeaveActorRole;
  action: string;
  note?: string;
};

export type LeaveImpact = {
  employeeId: string;
  employeeName: string;
  siteId: string;
  siteName: string;
  shiftId: string;
  shiftName: string;
  date: string;
  currentManpower: number;
  requiredManpower: number;
  availableRelievers: number;
  nearbyAvailableWorkers: number;
  potentialOtHours: number;
  potentialOtCost: number;
  risk: "none" | "low" | "high";
};

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = localizedRecord(
  "leave.type",
  ["casual", "sick", "family_emergency", "unpaid", "other"] as const,
);

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = localizedRecord(
  "leave.status",
  [
    "REQUESTED",
    "PENDING_EMPLOYEE_CONSENT",
    "SUPERVISOR_VERIFIED",
    "SITE_APPROVED",
    "MANAGER_APPROVED",
    "HR_VALIDATED",
    "APPROVED",
    "ABSENT",
    "SUPERVISOR_RECORDED",
    "SITE_VERIFIED",
    "CLOSED",
    "PENDING_INFORMATION",
    "UNEXPLAINED_ABSENCE",
    "REJECTED",
    "CANCELLED",
    "EXTENSION_REQUIRED",
  ] as const,
);
