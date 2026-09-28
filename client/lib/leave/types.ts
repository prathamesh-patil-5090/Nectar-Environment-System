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
  replacementRequired: boolean;
  assignedRelieverId?: string;
  replacementPlan?: string;
  potentialOtHours: number;
  potentialOtCost: number;
  leaveBalanceDays: number;
  daysRequested: number;
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

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  casual: "Casual",
  sick: "Sick",
  family_emergency: "Family emergency",
  unpaid: "Unpaid",
  other: "Other",
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  REQUESTED: "Requested",
  PENDING_EMPLOYEE_CONSENT: "Awaiting employee consent",
  SUPERVISOR_VERIFIED: "Supervisor verified",
  SITE_APPROVED: "Site approved",
  MANAGER_APPROVED: "Manager approved — awaiting Director",
  HR_VALIDATED: "HR validated",
  APPROVED: "Approved",
  ABSENT: "Absent",
  SUPERVISOR_RECORDED: "Supervisor recorded",
  SITE_VERIFIED: "Site verified",
  CLOSED: "Closed",
  PENDING_INFORMATION: "Pending information",
  UNEXPLAINED_ABSENCE: "Unexplained absence",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  EXTENSION_REQUIRED: "Extension required",
};
