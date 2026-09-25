import type { SessionUser, UserRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/auth";

export { ROLE_LABELS };

export function normalizeRole(role: UserRole | undefined): UserRole {
  if (!role) return "employee";
  if (role === "management") return "manager";
  return role;
}

export function roleLabel(role: UserRole | undefined): string {
  return ROLE_LABELS[normalizeRole(role)];
}

/** Org-wide visibility (not limited to one site) */
export function canViewAllSites(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return (
    role === "admin" ||
    role === "manager" ||
    role === "hr" ||
    role === "safety_incharge"
  );
}

export function scopedSiteId(user: SessionUser | null): string | undefined {
  if (canViewAllSites(user)) return undefined;
  return user?.siteId ?? "s1";
}

/** Own employee record only (employee role) */
export function scopedEmployeeId(user: SessionUser | null): string | undefined {
  if (normalizeRole(user?.role) === "employee") {
    return user?.employeeId ?? "e1";
  }
  return undefined;
}

export function canDownloadOtReports(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "admin" || role === "manager" || role === "hr";
}

export function canViewOtModule(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role !== "employee";
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

export function canHrValidateLeave(user: SessionUser | null): boolean {
  const role = normalizeRole(user?.role);
  return role === "admin" || role === "manager" || role === "hr";
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
