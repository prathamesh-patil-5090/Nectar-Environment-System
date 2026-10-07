/**
 * Pure helpers for E-Permit pages: what the viewer has to do on a permit, inbox KPIs and buckets.
 * The server enforces the same rules (e-permit-rules.ts); these only decide what to show.
 */
import {
  LIVE_STATUSES,
  TERMINAL_STATUSES,
  canActAsAuthoriser,
  canDecideApproval,
  canManageAsIssuer,
  isOverdue,
  postReviewOverdue,
  type PermitViewer,
} from "./rules";
import type { EPermit } from "./types";

const DAY = 86_400_000;

export type PermitTodo =
  | "approve"
  | "acknowledge"
  | "renewal_ack"
  | "approve_renewal"
  | "accept_return"
  | "post_review"
  | "submit"
  | "revise"
  | "return_or_renew"
  | "declare_safe"
  | "resume";

/** Who still has to acknowledge the current round (issue, or the pending renewal). */
export function pendingAcks(p: EPermit): { personId: string; role: "issuer" | "holder" | "worker"; context: "issue" | "renewal"; round: number }[] {
  const renewal = p.status === "RENEWAL_PENDING" ? p.renewals.find((r) => r.status === "pending") : undefined;
  if (renewal) {
    const holder = renewal.newHolderId ?? p.holderId;
    const people: { personId: string; role: "issuer" | "holder" | "worker" }[] = [
      ...(renewal.newIssuerId ? [{ personId: renewal.newIssuerId, role: "issuer" as const }] : []),
      { personId: holder, role: "holder" },
      ...p.workerIds.filter((w) => w !== holder).map((w) => ({ personId: w, role: "worker" as const })),
    ];
    const done = new Set(p.acks.filter((a) => a.context === "renewal" && a.round === renewal.n).map((a) => a.personId));
    return people.filter((x) => !done.has(x.personId)).map((x) => ({ ...x, context: "renewal", round: renewal.n }));
  }
  if (p.status !== "PENDING_APPROVAL" && !LIVE_STATUSES.includes(p.status)) return [];
  const people: { personId: string; role: "issuer" | "holder" | "worker" }[] = [
    { personId: p.issuerId, role: "issuer" },
    { personId: p.holderId, role: "holder" },
    ...p.workerIds.filter((w) => w !== p.holderId && w !== p.issuerId).map((w) => ({ personId: w, role: "worker" as const })),
  ];
  const done = new Set(p.acks.filter((a) => a.context === "issue" && a.round === 0).map((a) => a.personId));
  return people.filter((x) => !done.has(x.personId)).map((x) => ({ ...x, context: "issue", round: 0 }));
}

/** What this viewer should do on this permit now (empty = nothing). */
export function todosFor(p: EPermit, viewer: PermitViewer | null, now = Date.now()): PermitTodo[] {
  if (!viewer) return [];
  const out: PermitTodo[] = [];
  const issuer = canManageAsIssuer(viewer, p);
  const isMeIssuer = viewer.id === p.issuerId;
  // The Director may decide any approval (waive / escalate) but only emergency ones land in their inbox
  const mayDecide = (a: EPermit["approvals"][number]) =>
    a.status === "pending" && canDecideApproval(viewer, a, p) && (viewer.role !== "director" || a.kind === "emergency");
  if (p.status === "PENDING_APPROVAL" && p.approvals.some(mayDecide)) out.push("approve");
  const acks = pendingAcks(p);
  if (acks.some((a) => a.personId === viewer.id)) out.push(p.status === "RENEWAL_PENDING" ? "renewal_ack" : "acknowledge");
  if (p.status === "RENEWAL_PENDING" && canActAsAuthoriser(viewer, p) && viewer.role === "hod") out.push("approve_renewal");
  if (p.status === "RETURN_PENDING" && canActAsAuthoriser(viewer, p) && viewer.role === "hod") out.push("accept_return");
  if (p.status === "SUSPENDED" && canActAsAuthoriser(viewer, p) && viewer.role === "hod") out.push("resume");
  if (p.emergency && p.postReviews.some((r) => r.status === "pending" && canDecideApproval(viewer, r, p) && viewer.role !== "director")) {
    out.push("post_review");
  }
  if (isMeIssuer && p.status === "DRAFT") out.push("submit");
  if (isMeIssuer && p.status === "REJECTED") out.push("revise");
  if (issuer && isMeIssuer && p.status === "ACTIVE" && isOverdue(p, now)) out.push("return_or_renew");
  if (viewer.id === p.holderId && LIVE_STATUSES.includes(p.status) && !p.returnInfo?.holderAt && isOverdue(p, now)) out.push("declare_safe");
  return [...new Set(out)];
}

export type EPermitKpis = {
  pendingApproval: number;
  active: number;
  overdue: number;
  renewalPending: number;
  suspended: number;
  returnPending: number;
  closed30d: number;
  emergencyReviewsDue: number;
};

export function ePermitKpis(permits: EPermit[], now = Date.now()): EPermitKpis {
  return {
    pendingApproval: permits.filter((p) => p.status === "PENDING_APPROVAL").length,
    active: permits.filter((p) => LIVE_STATUSES.includes(p.status)).length,
    overdue: permits.filter((p) => isOverdue(p, now)).length,
    renewalPending: permits.filter((p) => p.status === "RENEWAL_PENDING").length,
    suspended: permits.filter((p) => p.status === "SUSPENDED").length,
    returnPending: permits.filter((p) => p.status === "RETURN_PENDING").length,
    closed30d: permits.filter(
      (p) => TERMINAL_STATUSES.includes(p.status) && p.completedAt && now - Date.parse(p.completedAt) <= 30 * DAY,
    ).length,
    emergencyReviewsDue: permits.filter((p) => p.emergency && p.postReviews.some((r) => r.status === "pending")).length,
  };
}

export type InboxBucket = "mine" | "pending" | "active" | "overdue" | "suspended" | "closed" | "all";

export function inBucket(p: EPermit, bucket: InboxBucket, viewer: PermitViewer | null, now = Date.now()): boolean {
  switch (bucket) {
    case "mine":
      return todosFor(p, viewer, now).length > 0;
    case "pending":
      return ["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(p.status);
    case "active":
      return LIVE_STATUSES.includes(p.status) || p.status === "RETURN_PENDING";
    case "overdue":
      return isOverdue(p, now) || postReviewOverdue(p, now);
    case "suspended":
      return p.status === "SUSPENDED";
    case "closed":
      return TERMINAL_STATUSES.includes(p.status);
    default:
      return true;
  }
}

/** Live permits at a site (shift hub / Safety). */
export function livePermitsAt(permits: EPermit[], siteId?: string): EPermit[] {
  return permits.filter((p) => LIVE_STATUSES.includes(p.status) && (!siteId || p.siteId === siteId));
}

/** Permits raised for a Safety breakdown (any status except cancelled). */
export function permitsForBreakdown(permits: EPermit[], safetyEventId: string): EPermit[] {
  return permits.filter((p) => p.safetyEventId === safetyEventId && p.status !== "CANCELLED");
}
