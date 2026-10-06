/**
 * Safety rules — status machine, role permissions, clearance and reminder timing.
 *
 * SHARED FILE: logic mirrors server/src/modules/safety/safety-rules.ts.
 * Display labels on the client are locale-aware (EN / HI / MR).
 */

import { localizedRecord } from "@/lib/i18n/localized";

export type SafetyEventType = "incident" | "near_miss" | "breakdown";

export type SafetyStatus =
  | "REPORTED"
  | "ACKNOWLEDGED"
  | "INVESTIGATING"
  | "ACTION_PENDING"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED";

export type SafetySeverity = "low" | "medium" | "high" | "critical";

export type SafetyCategory =
  | "first_aid"
  | "medical"
  | "lost_time"
  | "fatal"
  | "death"
  | "plant_problem"
  | "fire"
  | "chemical"
  | "electrical"
  | "other";

export type SafetyRole =
  | "director"
  | "manager"
  | "hr"
  | "site_incharge"
  | "shift_incharge"
  | "safety_incharge"
  | "supervisor"
  | "employee";

export type ClearanceStatus = "pending" | "cleared" | "waived";

export const SAFETY_STATUSES: SafetyStatus[] = [
  "REPORTED",
  "ACKNOWLEDGED",
  "INVESTIGATING",
  "ACTION_PENDING",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
];

export const SAFETY_TRANSITIONS: Record<SafetyStatus, SafetyStatus[]> = {
  REPORTED: ["ACKNOWLEDGED"],
  ACKNOWLEDGED: ["INVESTIGATING", "RESOLVED"],
  INVESTIGATING: ["ACTION_PENDING", "RESOLVED"],
  ACTION_PENDING: ["RESOLVED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["INVESTIGATING"],
};

/**
 * Statuses where the case is still open. A case is only finished when the Director closes it,
 * so RESOLVED ("Solved") is still open and reminders keep firing.
 */
export const OPEN_STATUSES: SafetyStatus[] = [
  "REPORTED",
  "ACKNOWLEDGED",
  "INVESTIGATING",
  "ACTION_PENDING",
  "RESOLVED",
  "REOPENED",
];

export function isOpenStatus(status: SafetyStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export function canTransition(from: SafetyStatus, to: SafetyStatus): boolean {
  return (SAFETY_TRANSITIONS[from] ?? []).includes(to);
}

export function assertSafetyTransition(from: SafetyStatus, to: SafetyStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid safety status change: ${from} → ${to}`);
  }
}

/** Same aliasing as client rbac: legacy "management" → manager. */
export function normalizeSafetyRole(role?: string): SafetyRole {
  if (!role) return "employee";
  if (role === "management") return "manager";
  const known: SafetyRole[] = [
    "director",
    "manager",
    "hr",
    "site_incharge",
    "shift_incharge",
    "safety_incharge",
    "supervisor",
    "employee",
  ];
  return known.includes(role as SafetyRole) ? (role as SafetyRole) : "employee";
}

const ALL_ROLES: SafetyRole[] = [
  "director",
  "manager",
  "hr",
  "site_incharge",
  "shift_incharge",
  "safety_incharge",
  "supervisor",
  "employee",
];

export type SafetyAction =
  | "view"
  | "reportNearMiss"
  | "reportIncident"
  | "reportBreakdown"
  | "comment"
  | "investigate"
  | "resolve"
  | "close"
  | "clearNonCritical"
  | "clearCritical"
  | "waiveClearance"
  | "linkLeave"
  | "startCall"
  | "updateBreakdown"
  | "editProtocols"
  | "downloadReport";

export const SAFETY_PERMISSIONS: Record<SafetyAction, SafetyRole[]> = {
  view: ALL_ROLES,
  /** Only the plant manager raises safety concerns (near-miss, injury, fatal injury, death). */
  reportNearMiss: ["manager"],
  reportIncident: ["manager"],
  /** Plant breakdowns are an operations / OT matter, logged by the plant leads. */
  reportBreakdown: ["director", "manager", "safety_incharge", "site_incharge", "shift_incharge"],
  comment: ALL_ROLES,
  /**
   * Acknowledge, investigate, corrective actions, edit details — the people responsible for every case:
   * supervisor, shift in-charge, HR, Director and Safety In-charge, plus the manager who raised it.
   */
  investigate: ["director", "safety_incharge", "manager", "site_incharge", "supervisor", "shift_incharge", "hr"],
  /** Mark the case solved — the Director only; it stays open (reminders keep going) until the Director closes it. */
  resolve: ["director"],
  /** Close and reopen — the Director only. Closing is what finishes a case. */
  close: ["director"],
  clearNonCritical: ["director", "safety_incharge", "manager"],
  clearCritical: ["director", "safety_incharge"],
  waiveClearance: ["director"],
  linkLeave: ["director", "safety_incharge", "manager", "site_incharge", "hr"],
  startCall: ["director", "manager", "safety_incharge", "site_incharge", "shift_incharge"],
  updateBreakdown: ["director", "manager", "safety_incharge", "site_incharge", "shift_incharge"],
  editProtocols: ["director", "safety_incharge"],
  /** The case report PDF — everyone who runs a case, never plain employees. */
  downloadReport: ["director", "manager", "hr", "site_incharge", "shift_incharge", "safety_incharge", "supervisor"],
};

/** Director, HR and Safety In-charge work across every site. */
export const ORG_WIDE_ROLES: SafetyRole[] = ["director", "hr", "safety_incharge"];

export type SafetyScope = { role?: string; siteId?: string | null };

/**
 * Role check + site scope. Plant roles act only on their own site;
 * org-wide roles act anywhere. `eventSiteId` omitted = no site check.
 */
export function safetyCan(
  action: SafetyAction,
  actor: SafetyScope | null | undefined,
  eventSiteId?: string,
): boolean {
  if (!actor || !action || !SAFETY_PERMISSIONS[action]) return false;
  const allowed = SAFETY_PERMISSIONS[action];
  const role = normalizeSafetyRole(actor.role);
  if (!allowed.includes(role)) return false;
  if (action === "view" || !eventSiteId) return true;
  if (ORG_WIDE_ROLES.includes(role)) return true;
  return Boolean(actor.siteId) && actor.siteId === eventSiteId;
}

/** The parts of a case that say who is on it. */
export type SafetyCaseRef = {
  siteId: string;
  stakeholders?: { personId: string }[];
  involved?: string[];
  informedBy?: string[];
  reportedBy?: { personId: string };
  callInvited?: string[];
  callJoined?: string[];
  emergencyRecipients?: string[];
  correctiveActions?: { ownerId?: string }[];
};

/**
 * Named on the case: responsible, it happened to them, they saw it, reported it, were called to its meeting,
 * got its emergency broadcast, or own one of its corrective actions.
 */
export function isOnSafetyCase(personId: string | undefined, ev: SafetyCaseRef): boolean {
  if (!personId) return false;
  return (
    (ev.stakeholders ?? []).some((s) => s.personId === personId) ||
    (ev.involved ?? []).includes(personId) ||
    (ev.informedBy ?? []).includes(personId) ||
    ev.reportedBy?.personId === personId ||
    (ev.callInvited ?? []).includes(personId) ||
    (ev.callJoined ?? []).includes(personId) ||
    (ev.emergencyRecipients ?? []).includes(personId) ||
    (ev.correctiveActions ?? []).some((a) => a.ownerId === personId)
  );
}

/**
 * Every case is visible to everyone; this is who may act on one (comment, upload, work it, call a meeting):
 * anyone named on it; org-wide roles everywhere; plant leads on their own site.
 * Plain employees only act on the cases they are named on.
 */
export function canActOnSafetyCase(
  actor: (SafetyScope & { id?: string }) | null | undefined,
  ev: SafetyCaseRef,
): boolean {
  if (!actor) return false;
  if (isOnSafetyCase(actor.id, ev)) return true;
  const role = normalizeSafetyRole(actor.role);
  if (role === "employee") return false;
  if (ORG_WIDE_ROLES.includes(role)) return true;
  return Boolean(actor.siteId) && actor.siteId === ev.siteId;
}

/** Joining the safety meeting — only people named on the case (or already called to it). */
export function canJoinSafetyCall(actor: { id?: string } | null | undefined, ev: SafetyCaseRef): boolean {
  return Boolean(actor?.id) && isOnSafetyCase(actor!.id, ev);
}

export function reportActionFor(type: SafetyEventType): SafetyAction {
  return type === "near_miss" ? "reportNearMiss" : type === "breakdown" ? "reportBreakdown" : "reportIncident";
}

/** Which permission a status change needs. */
export function actionForStatus(next: SafetyStatus): SafetyAction {
  if (next === "RESOLVED") return "resolve";
  if (next === "CLOSED" || next === "REOPENED") return "close";
  return "investigate";
}

/** Fatal injury and death are always critical. */
export function effectiveSeverity(category: SafetyCategory, severity: SafetySeverity): SafetySeverity {
  return category === "fatal" || category === "death" ? "critical" : severity;
}

export function isCriticalCase(category: SafetyCategory, severity: SafetySeverity): boolean {
  return category === "fatal" || category === "death" || severity === "critical";
}

/** Involved people need fitness-for-duty clearance before returning from leave. */
export function defaultRequiresClearance(
  type: SafetyEventType,
  category: SafetyCategory,
  severity: SafetySeverity,
): boolean {
  if (type !== "incident") return false;
  if (category === "death") return false; // nobody returns to work
  if (category === "medical" || category === "lost_time" || category === "fatal") return true;
  return severity === "high" || severity === "critical";
}

/** Clearance permission depends on how serious the case is. */
export function clearanceAction(
  category: SafetyCategory,
  severity: SafetySeverity,
  decision: "cleared" | "waived",
): SafetyAction {
  if (decision === "waived") return "waiveClearance";
  return isCriticalCase(category, severity) ? "clearCritical" : "clearNonCritical";
}

export type BlockingCheckEvent = {
  correctiveActions?: { done: boolean }[];
  clearance?: { status: ClearanceStatus }[];
};

/** Reason RESOLVED is blocked, or null. */
export function resolveBlocker(ev: BlockingCheckEvent): string | null {
  const open = (ev.correctiveActions ?? []).filter((a) => !a.done).length;
  return open ? `${open} corrective action(s) still open` : null;
}

/** Reason CLOSED is blocked, or null. */
export function closeBlocker(ev: BlockingCheckEvent): string | null {
  const pending = (ev.clearance ?? []).filter((c) => c.status === "pending").length;
  if (pending) return `${pending} return-to-work clearance(s) still pending`;
  return resolveBlocker(ev);
}

const HOUR = 3_600_000;

/** "Notify until solved" cadence. */
export const REMINDER_INTERVAL_MS: Record<SafetySeverity, number> = {
  critical: 1 * HOUR,
  high: 4 * HOUR,
  medium: 24 * HOUR,
  low: 24 * HOUR,
};

/** After this many reminders the Director is alerted once. */
export const ESCALATE_AFTER = 3;

/** People called to a safety meeting who have not joined are reminded this often until they join or the case closes. */
export const MEETING_NUDGE_MS = 4 * HOUR;

/** Invited people who still have not joined the call and are due another reminder. */
export function meetingNudgesDue(
  ev: {
    status: SafetyStatus;
    callStartedAt?: string;
    callInvited?: string[];
    callJoined?: string[];
    callNudgedAt?: Record<string, string>;
  },
  now: number,
): string[] {
  if (!isOpenStatus(ev.status) || !ev.callStartedAt) return [];
  const joined = new Set(ev.callJoined ?? []);
  return (ev.callInvited ?? []).filter((p) => {
    if (joined.has(p)) return false;
    const last = Date.parse(ev.callNudgedAt?.[p] || ev.callStartedAt!);
    return !Number.isNaN(last) && now - last >= MEETING_NUDGE_MS;
  });
}

export function isReminderDue(
  ev: { status: SafetyStatus; severity: SafetySeverity; reportedAt: string; lastNotifiedAt?: string },
  now: number,
): boolean {
  if (!isOpenStatus(ev.status)) return false;
  const last = Date.parse(ev.lastNotifiedAt || ev.reportedAt);
  if (Number.isNaN(last)) return false;
  return now - last >= REMINDER_INTERVAL_MS[ev.severity];
}

/** Whole days between failure and restore (or now), minimum 0. */
export function downtimeDays(failedAt?: string, restoredAt?: string, now = Date.now()): number {
  if (!failedAt) return 0;
  const start = Date.parse(failedAt);
  const end = restoredAt ? Date.parse(restoredAt) : now;
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round(((end - start) / 86_400_000) * 10) / 10;
}

export function otTotals(entries: { employeeId: string; hours: number }[] = []): {
  people: number;
  hours: number;
} {
  const people = new Set(entries.filter((e) => e.hours > 0).map((e) => e.employeeId)).size;
  const hours = entries.reduce((sum, e) => sum + (e.hours > 0 ? e.hours : 0), 0);
  return { people, hours };
}

export const SAFETY_STATUS_LABELS: Record<SafetyStatus, string> = localizedRecord(
  "safety.status",
  [
    "REPORTED",
    "ACKNOWLEDGED",
    "INVESTIGATING",
    "ACTION_PENDING",
    "RESOLVED",
    "CLOSED",
    "REOPENED",
  ] as const,
);

export const SAFETY_TYPE_LABELS: Record<SafetyEventType, string> = localizedRecord(
  "safety.type",
  ["incident", "near_miss", "breakdown"] as const,
);

export const SAFETY_CATEGORY_LABELS: Record<SafetyCategory, string> = localizedRecord(
  "safety.category",
  [
    "first_aid",
    "medical",
    "lost_time",
    "fatal",
    "death",
    "plant_problem",
    "fire",
    "chemical",
    "electrical",
    "other",
  ] as const,
);

/** "Other — {custom hazard}" when the reporter named it, else the plain category label. */
export function safetyCategoryLabel(ev: { category: SafetyCategory; categoryOther?: string }): string {
  const base = SAFETY_CATEGORY_LABELS[ev.category] ?? ev.category;
  return ev.category === "other" && ev.categoryOther?.trim() ? `${base} — ${ev.categoryOther.trim()}` : base;
}

export const SAFETY_SEVERITY_LABELS: Record<SafetySeverity, string> =
  localizedRecord("safety.severity", ["low", "medium", "high", "critical"] as const);
