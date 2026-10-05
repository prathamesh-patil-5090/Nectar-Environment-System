/**
 * Safety gates used by leave / OT / cover code. Pure reads of the safety cache —
 * with no safety data loaded every check passes, so existing flows are unchanged.
 * The server enforces the same leave-close rule (LeavesService.updateStatus).
 */
import { isCriticalCase, isOpenStatus } from "./rules";
import { getSafetyEvents } from "./store";
import type { SafetyEvent } from "./types";

export type PendingClearanceRef = { eventId: string; title: string; employeeId: string };

export function pendingClearanceFor(
  employeeId: string,
  events: SafetyEvent[] = getSafetyEvents(),
): PendingClearanceRef[] {
  if (!employeeId) return [];
  return events.flatMap((ev) =>
    (ev.clearance ?? [])
      .filter((c) => c.employeeId === employeeId && c.status === "pending")
      .map((c) => ({ eventId: ev.id, title: ev.title, employeeId: c.employeeId })),
  );
}

/** Same wording as the server so either layer gives the user one message. */
export function safetyClearanceBlockMessage(
  employeeId: string,
  events?: SafetyEvent[],
): string | null {
  const [first] = pendingClearanceFor(employeeId, events);
  if (!first) return null;
  return `Safety clearance pending (${first.eventId} · ${first.title}). Safety In-charge or Manager must clear return to work before this leave can be closed.`;
}

/** Throws when the employee may not be returned to duty yet. */
export function assertSafetyClearance(employeeId: string, events?: SafetyEvent[]): void {
  const msg = safetyClearanceBlockMessage(employeeId, events);
  if (msg) throw new Error(msg);
}

/** Open high / critical incident this person was involved in — soft-block OT and cover. */
export function openSeriousIncidentFor(
  employeeId: string,
  events: SafetyEvent[] = getSafetyEvents(),
): SafetyEvent | undefined {
  if (!employeeId) return undefined;
  return events.find(
    (ev) =>
      ev.type === "incident" &&
      isOpenStatus(ev.status) &&
      ev.status !== "RESOLVED" && // solved: the person is released even before the Director closes it
      (isCriticalCase(ev.category, ev.severity) || ev.severity === "high") &&
      ev.involved.includes(employeeId),
  );
}
