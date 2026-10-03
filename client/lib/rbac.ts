import type { SessionUser, UserRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/auth";
import { safetyCan, type SafetyAction } from "@/lib/safety/rules";
import type { SafetyActor } from "@/lib/safety/types";

export { ROLE_LABELS };

type Check = (user: SessionUser | null) => boolean;

export function normalizeRole(role: UserRole | undefined): UserRole {
  if (!role) return "employee";
  if (role === "management") return "manager";
  return role;
}

export function roleLabel(role: UserRole | undefined): string {
  return ROLE_LABELS[normalizeRole(role)];
}

/** Check that passes when the user's (normalized) role is one of `roles`. */
const allow =
  (...roles: UserRole[]): Check =>
  (user) =>
    roles.includes(normalizeRole(user?.role));

const notEmployee: Check = (user) => normalizeRole(user?.role) !== "employee";

/** Org-wide visibility — Director + HR + Safety In-Charge */
export const canViewAllSites = allow("director", "hr", "safety_incharge");
/** New, upcoming and closed plants — Director only */
export const canViewPlantPipeline = allow("director");

export function scopedSiteId(user: SessionUser | null): string | undefined {
  if (canViewAllSites(user)) return undefined;
  return user?.siteId ?? "s-etp";
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

/** Who an employee record is, for seniority checks (mock and API employees both fit). */
type EmployeeRef = { id: string; siteId?: string; employeeCategory?: string };

/** Plant seniority of a login role — higher sees and acts on lower. */
const ROLE_RANK: Partial<Record<UserRole, number>> = {
  manager: 4,
  site_incharge: 3,
  shift_incharge: 3,
  supervisor: 2,
  employee: 1,
};

/** Plant seniority of an employee record (employeeCategory). HR / Director sit above every plant. */
const CATEGORY_RANK: Record<string, number> = {
  director: 6,
  hr: 5,
  manager: 4,
  shift_incharge: 3,
  supervisor: 2,
  shift: 1,
  general: 1,
};

/**
 * Can `user` see or act on `employee` as someone in their charge?
 * Never yourself. Director: everyone. HR / Safety In-Charge: everyone below HR.
 * Plant roles: only people at their own plant who are junior to them (a Site Manager never sees the Plant Manager).
 */
export function isInChargeOf(user: SessionUser | null, employee: EmployeeRef | undefined): boolean {
  if (!user || !employee) return false;
  if (user.employeeId && user.employeeId === employee.id) return false;
  const role = normalizeRole(user.role);
  const targetRank = CATEGORY_RANK[employee.employeeCategory ?? ""] ?? 1;
  if (role === "director") return true;
  if (role === "hr" || role === "safety_incharge") return targetRank < CATEGORY_RANK.hr;
  const rank = ROLE_RANK[role] ?? 0;
  const site = scopedSiteId(user);
  return Boolean(site) && employee.siteId === site && targetRank < rank;
}

/** Profile access: your own record, or someone in your charge. */
export function canAccessEmployeeRecord(user: SessionUser | null, employee: EmployeeRef | undefined): boolean {
  if (!user || !employee) return false;
  if (user.employeeId && user.employeeId === employee.id) return true;
  return isInChargeOf(user, employee);
}

/** Employees roster page + sidebar entry — anyone with people in their charge (not plain employees). */
export const canViewEmployeeRoster = notEmployee;

// ── Overtime ──────────────────────────────────────────────────────────────
export const canDownloadOtReports = allow(
  "director", "manager", "hr", "shift_incharge", "site_incharge", "supervisor",
);
export const canDownloadReports = canDownloadOtReports;
export const canViewOtModule = notEmployee;
export const canAssignOt = allow("director", "manager");

// ── Leave ─────────────────────────────────────────────────────────────────
export const canViewLeaveManagement = allow("director", "manager", "hr");
export const canViewLeavePending = notEmployee;
export const canEnterLeaveForOthers = allow(
  "director", "manager", "hr", "site_incharge", "shift_incharge", "supervisor",
);
export const canSupervisorVerifyLeave = allow("director", "manager", "supervisor", "shift_incharge");
export const canSiteApproveLeave = allow("director", "manager", "site_incharge", "shift_incharge");
export const canResolveOtDecisions = allow("director", "manager");
/** Plant manager (or Director acting as manager) after the shift is covered */
export const canManagerDecideLeave = allow("director", "manager");
/** Final leave sign-off — Director only */
export const canAdminFinalizeLeave = allow("director");
export const canConfirmLeaveReturn = allow(
  "director", "manager", "supervisor", "site_incharge", "shift_incharge",
);

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
  return (
    leave.status === "PENDING_EMPLOYEE_CONSENT" &&
    !!user.name &&
    !!leave.enteredByName &&
    user.name === leave.enteredByName
  );
}

// ── Shifts & relievers ────────────────────────────────────────────────────
export const canManageShifts = allow("director", "manager", "site_incharge", "shift_incharge");
/** Draft the monthly rotation — Shift In-Charge, Manager, Director */
export const canGenerateRotation = canManageShifts;
/** Manager (or Director) first approval of a monthly draft */
export const canManagerDecideRotation = allow("director", "manager");
/** Director final approval — publishes onto the live roster */
export const canAdminFinalizeRotation = allow("director");
/** @deprecated Prefer canManagerDecideRotation / canAdminFinalizeRotation */
export const canPublishRotation = canManagerDecideRotation;
export const canApproveShiftChanges = allow("director", "manager", "site_incharge", "shift_incharge");
export const canManageRelieverPool = allow(
  "director", "manager", "site_incharge", "shift_incharge", "supervisor",
);

/** Assessment Evaluator — Plant Manager is the primary and only authorized person conducting and scoring in-person practical & oral viva assessments */
export const canEvaluateAssessments = allow("manager", "director");

const LEAVE_ACTOR: Partial<Record<UserRole, "supervisor" | "site_incharge" | "hr" | "management" | "director">> = {
  director: "director",
  hr: "hr",
  site_incharge: "site_incharge",
  shift_incharge: "site_incharge",
  supervisor: "supervisor",
  manager: "management",
};

export function leaveActorRole(
  user: SessionUser | null,
): "employee" | "supervisor" | "site_incharge" | "hr" | "management" | "director" {
  return LEAVE_ACTOR[normalizeRole(user?.role)] ?? "employee";
}

export const isElevated = allow("director", "manager");

// ── Sidebar navigation ────────────────────────────────────────────────────
/** Sites list in sidebar — plant leads & above (not supervisor) */
export const canViewSitesNav = allow(
  "director", "manager", "shift_incharge", "site_incharge", "hr", "safety_incharge",
);
/**
 * Shifts module in sidebar — SIC / Manager / Director.
 * Supervisors stay out of day-to-day shift planning nav.
 */
export const canViewShiftsNav = allow("director", "manager", "shift_incharge", "site_incharge");
export const canResolveRelieverCompetition = allow("director", "manager");
/** Reliever pool — Supervisor (availability) + SIC + Manager + Director */
export const canViewRelieverPoolNav = canManageRelieverPool;

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

// ── Safety ────────────────────────────────────────────────────────────────
// Thin wrappers over lib/safety/rules.ts — the same table the server enforces.

/** Identity sent with every safety write: employee id, or "user:<email>" for org-wide logins. */
export function safetyActorOf(user: SessionUser | null): SafetyActor | null {
  if (!user) return null;
  return {
    id: user.employeeId ?? `user:${user.email}`,
    name: user.name,
    role: normalizeRole(user.role),
    siteId: user.siteId,
  };
}

/** Role + site check. Omit `siteId` for "can this role ever do it" (e.g. show a button). */
export function canSafety(
  user: SessionUser | null,
  action: SafetyAction,
  siteId?: string,
): boolean {
  if (!user) return false;
  return safetyCan(action, { role: normalizeRole(user.role), siteId: user.siteId }, siteId);
}

export const canViewSafety: Check = (user) => canSafety(user, "view");
export const canReportSafetyIncident: Check = (user) => canSafety(user, "reportIncident");
export const canEditSafetyProtocols: Check = (user) => canSafety(user, "editProtocols");
