import type { SessionUser, UserRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/auth";
import type { Employee } from "@/lib/mock-data";

export { ROLE_LABELS };

export function normalizeRole(role: UserRole | undefined): UserRole {
  if (!role) return "employee";
  if (role === "management") return "manager";
  return role;
}

export function roleLabel(role: UserRole | undefined): string {
  return ROLE_LABELS[normalizeRole(role)];
}

/** Org-wide visibility — Director + HR + Safety In-Charge */
export function canViewAllSites(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "director" || role === "hr" || role === "safety_incharge";
}

export function scopedSiteId(user: SessionUser | null): string | undefined {
  if (canViewAllSites(user)) return undefined;
  return user?.siteId ?? "s-etp";
}

/** True when the session maps to an employee master record */
export function hasEmployeeSelfService(user: SessionUser | null): boolean {
  return Boolean(user?.employeeId);
}

/**
 * Self-service employee id when viewing "my" records.
 * Pure employees always; managers / SIC / supervisors when they have employeeId.
 */
export function scopedEmployeeId(user: SessionUser | null): string | undefined {
  if (!user?.employeeId) return undefined;
  const role = normalizeRole(user.role);
  if (role === "employee") return user.employeeId;
  return undefined;
}

/** Employee id for dual-dashboard "My Employee" section */
export function selfEmployeeId(user: SessionUser | null): string | undefined {
  return user?.employeeId;
}

export function canAccessEmployeeRecord(
  user: SessionUser | null,
  employee: Employee | undefined,
): boolean {
  if (!user || !employee) return false;
  if (canViewAllSites(user)) return true;
  if (user.employeeId && user.employeeId === employee.id) return true;
  const site = scopedSiteId(user);
  if (site && employee.siteId === site) return true;
  return false;
}

export function canDownloadOtReports(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "director" ||
    role === "manager" ||
    role === "hr" ||
    role === "shift_incharge" ||
    role === "site_incharge" ||
    role === "supervisor"
  );
}

export const canDownloadReports = canDownloadOtReports;

export function canViewOtModule(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role !== "employee";
}

export function canResolveOtDecisions(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "director" || role === "manager";
}

export function canAssignOt(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "director" || role === "manager";
}

export function canViewLeaveManagement(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "director" || role === "manager" || role === "hr";
}

export function canViewLeavePending(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role !== "employee";
}

export function canEnterLeaveForOthers(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "director" ||
    role === "manager" ||
    role === "hr" ||
    role === "site_incharge" ||
    role === "shift_incharge" ||
    role === "supervisor"
  );
}

export function canSupervisorVerifyLeave(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "director" ||
    role === "manager" ||
    role === "supervisor" ||
    role === "shift_incharge"
  );
}

export function canSiteApproveLeave(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "director" ||
    role === "manager" ||
    role === "site_incharge" ||
    role === "shift_incharge"
  );
}

/** Plant manager (or Director acting as manager) after the shift is covered */
export function canManagerDecideLeave(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "director" || role === "manager";
}

/** Final leave sign-off — Director only */
export function canAdminFinalizeLeave(user: SessionUser | null): boolean {
  return normalizeRole(user?.role) === "director";
}

/** HR role — leave validation and policy oversight */
export function canHrValidateLeave(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "hr" || role === "director";
}

export function canConfirmLeaveReturn(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "director" ||
    role === "manager" ||
    role === "supervisor" ||
    role === "site_incharge" ||
    role === "shift_incharge"
  );
}

/** Soft-withdraw: owner employee, before site approval / escalation. */
export function canWithdrawLeaveRequest(
  user: SessionUser | null,
  leave: { employeeId: string; status: string; enteredByName?: string },
): boolean {
  if (!user) return false;
  const withdrawable = [
    "REQUESTED",
    "PENDING_EMPLOYEE_CONSENT",
    "SUPERVISOR_VERIFIED",
    "ABSENT",
    "SUPERVISOR_RECORDED",
  ];
  if (!withdrawable.includes(leave.status)) return false;
  if (user.employeeId && user.employeeId === leave.employeeId) return true;
  // Person who filed on-behalf may withdraw while awaiting consent
  if (
    leave.status === "PENDING_EMPLOYEE_CONSENT" &&
    user.name &&
    leave.enteredByName &&
    user.name === leave.enteredByName
  ) {
    return true;
  }
  return false;
}

export function canManageShifts(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "director" ||
    role === "manager" ||
    role === "site_incharge" ||
    role === "shift_incharge"
  );
}

/** Draft the monthly rotation — Shift In-Charge, Manager, Director */
export function canGenerateRotation(user: SessionUser | null): boolean {
  return canManageShifts(user);
}

/** Manager (or Director) first approval of a monthly draft */
export function canManagerDecideRotation(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "director" || role === "manager";
}

/** Director final approval — publishes onto the live roster */
export function canAdminFinalizeRotation(user: SessionUser | null): boolean {
  return normalizeRole(user?.role) === "director";
}

/** @deprecated Prefer canManagerDecideRotation / canAdminFinalizeRotation */
export function canPublishRotation(user: SessionUser | null): boolean {
  return canManagerDecideRotation(user);
}

export function canApproveShiftChanges(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "director" ||
    role === "manager" ||
    role === "site_incharge" ||
    role === "shift_incharge"
  );
}

export function canManageRelieverPool(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "director" ||
    role === "manager" ||
    role === "site_incharge" ||
    role === "shift_incharge" ||
    role === "supervisor"
  );
}

export function canViewSafetyInsights(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "director" ||
    role === "manager" ||
    role === "hr" ||
    role === "safety_incharge" ||
    role === "site_incharge"
  );
}

/** HR — training oversight and compliance management */
export function canManageTraining(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "director" ||
    role === "manager" ||
    role === "hr" ||
    role === "shift_incharge"
  );
}

/** Assessment Evaluator — Plant Manager is the primary and only authorized person conducting and scoring in-person practical & oral viva assessments */
export function canEvaluateAssessments(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "manager" || role === "director";
}

export function leaveActorRole(
  user: SessionUser | null,
): "employee" | "supervisor" | "site_incharge" | "hr" | "management" | "director" {
  const role = normalizeRole(user?.role);
  if (role === "director") return "director";
  if (role === "hr") return "hr";
  if (role === "site_incharge" || role === "shift_incharge") return "site_incharge";
  if (role === "supervisor") return "supervisor";
  if (role === "manager") return "management";
  return "employee";
}

export function isElevated(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "director" || role === "manager";
}

/** Dual management + employee nav for Mgr / SIC / Supervisor */
export function hasDualDashboard(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    hasEmployeeSelfService(user) &&
    (role === "manager" ||
      role === "shift_incharge" ||
      role === "supervisor")
  );
}

/** Sites list in sidebar — plant leads & above (not supervisor) */
export function canViewSitesNav(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "director" ||
    role === "manager" ||
    role === "shift_incharge" ||
    role === "site_incharge" ||
    role === "hr" ||
    role === "safety_incharge"
  );
}

/**
 * Shifts module in sidebar — SIC / Manager / Director.
 * Supervisors stay out of day-to-day shift planning nav.
 */
export function canViewShiftsNav(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "director" ||
    role === "manager" ||
    role === "shift_incharge" ||
    role === "site_incharge"
  );
}

export function canResolveRelieverCompetition(
  user: SessionUser | null,
): boolean {
  const role = normalizeRole(user?.role);
  return role === "director" || role === "manager";
}

/** Reliever pool — Supervisor (availability) + SIC + Manager + Director */
export function canViewRelieverPoolNav(user: SessionUser | null): boolean {
  return canManageRelieverPool(user);
}

/**
 * Which shift sub-pages appear in the sidebar.
 * Supervisors: none. SIC/Manager/Director: full set.
 */
export function visibleShiftNavKeys(user: SessionUser | null): string[] | null {
  if (!canViewShiftsNav(user)) return null;
  return [
    "/shifts",
    "/shifts/master",
    "/shifts/schedule",
    "/shifts/rotation",
    "/shifts/change-requests",
    "/shifts/reliever-allocation",
    "/shifts/manpower",
    "/shifts/deviations",
  ];
}
