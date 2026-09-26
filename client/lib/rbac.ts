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

/** Org-wide visibility — Admin (+ hidden HR / Safety for compat) */
export function canViewAllSites(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "admin" || role === "hr" || role === "safety_incharge";
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
  return role === "admin" || role === "manager" || role === "hr";
}

export function canViewOtModule(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role !== "employee";
}

export function canAssignOt(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "admin" || role === "manager";
}

export function canViewLeaveManagement(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "admin" || role === "manager";
}

export function canViewLeavePending(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "admin" ||
    role === "manager" ||
    role === "hr" ||
    role === "safety_incharge"
  );
}

export function canEnterLeaveForOthers(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "admin" ||
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
    role === "admin" ||
    role === "manager" ||
    role === "supervisor" ||
    role === "shift_incharge"
  );
}

export function canSiteApproveLeave(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "admin" ||
    role === "manager" ||
    role === "site_incharge" ||
    role === "shift_incharge"
  );
}

/** Final leave approve/reject for demo — Manager / Admin (HR path inactive) */
export function canManagerDecideLeave(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "admin" || role === "manager";
}

/** Kept for hidden HR role; demo UI prefers canManagerDecideLeave */
export function canHrValidateLeave(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "hr" || role === "admin";
}

export function canConfirmLeaveReturn(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "admin" ||
    role === "manager" ||
    role === "supervisor" ||
    role === "site_incharge" ||
    role === "shift_incharge"
  );
}

export function canManageShifts(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "admin" ||
    role === "manager" ||
    role === "site_incharge" ||
    role === "shift_incharge"
  );
}

export function canApproveShiftChanges(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "admin" ||
    role === "manager" ||
    role === "site_incharge" ||
    role === "shift_incharge"
  );
}

export function canManageRelieverPool(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "admin" ||
    role === "manager" ||
    role === "site_incharge" ||
    role === "shift_incharge" ||
    role === "supervisor"
  );
}

export function canViewSafetyInsights(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "admin" ||
    role === "manager" ||
    role === "hr" ||
    role === "safety_incharge" ||
    role === "site_incharge"
  );
}

export function leaveActorRole(
  user: SessionUser | null,
): "employee" | "supervisor" | "site_incharge" | "hr" | "management" {
  const role = normalizeRole(user?.role);
  if (role === "hr") return "hr";
  if (role === "site_incharge" || role === "shift_incharge") return "site_incharge";
  if (role === "supervisor") return "supervisor";
  if (role === "admin" || role === "manager") return "management";
  return "employee";
}

export function isElevated(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "admin" || role === "manager";
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
