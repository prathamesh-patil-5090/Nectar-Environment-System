import type { SessionUser } from "@/lib/auth";

/**
 * The id the training API knows this login by: the employee id, or "user:<email>" for
 * people who are not employees (e.g. the Director), matching server `leaders.id`.
 */
export function personIdOf(session: SessionUser | null | undefined): string | undefined {
  if (!session) return undefined;
  return session.employeeId ?? `user:${session.email}`;
}
