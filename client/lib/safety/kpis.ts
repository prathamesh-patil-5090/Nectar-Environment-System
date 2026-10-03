import { isCriticalCase, isOpenStatus, otTotals } from "./rules";
import type { SafetyEvent } from "./types";

const DAY = 86_400_000;

export type SafetyKpis = {
  open: number;
  openCritical: number;
  activeEmergencies: number;
  nearMiss30d: number;
  activeBreakdowns: number;
  breakdownOtHours30d: number;
  pendingClearances: number;
  /** Whole days since the last lost-time / fatal injury, or null when none recorded. */
  daysSinceLti: number | null;
};

/** Safety KPIs for one site (or all sites). Pure — used by /safety, dashboard and site pages. */
export function safetyKpis(events: SafetyEvent[], siteId?: string, now = Date.now()): SafetyKpis {
  const rows = siteId ? events.filter((e) => e.siteId === siteId) : events;
  const open = rows.filter((e) => isOpenStatus(e.status));
  const since30 = now - 30 * DAY;
  const lti = rows
    .filter((e) => e.type === "incident" && (e.category === "lost_time" || e.category === "fatal"))
    .map((e) => Date.parse(e.occurredAt))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];

  return {
    open: open.length,
    openCritical: open.filter((e) => isCriticalCase(e.category, e.severity) || e.severity === "high").length,
    activeEmergencies: open.filter((e) => e.isEmergency).length,
    nearMiss30d: rows.filter((e) => e.type === "near_miss" && Date.parse(e.occurredAt) >= since30).length,
    activeBreakdowns: rows.filter((e) => e.type === "breakdown" && !e.restoredAt && e.status !== "CLOSED").length,
    breakdownOtHours30d: rows
      .filter((e) => e.type === "breakdown" && Date.parse(e.occurredAt) >= since30)
      .reduce((sum, e) => sum + otTotals(e.otEntries).hours, 0),
    pendingClearances: rows.reduce((n, e) => n + e.clearance.filter((c) => c.status === "pending").length, 0),
    daysSinceLti: lti === undefined ? null : Math.max(0, Math.floor((now - lti) / DAY)),
  };
}
