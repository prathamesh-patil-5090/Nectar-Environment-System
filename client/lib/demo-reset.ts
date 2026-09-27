/**
 * Clear browser-persisted demo edits and restore in-code seed data.
 * Does not clear the login session.
 *
 * Leave / reliever / shift: in-memory reset + re-persist seed.
 * OT / notifications / training: drop keys only — next page read re-seeds from code.
 * (Avoids Turbopack circular bindings on assignments ↔ notifications.)
 */

import { resetLeaveStore } from "@/lib/leave/store";
import { resetRelieverPool } from "@/lib/reliever/pool";
import { resetShiftStore } from "@/lib/shift/store";

const CLEAR_KEYS = [
  "nectar-enviro-ot-assignments",
  "nectar-enviro-notifications",
  "nectar-enviro-notifications-seeded-v2",
  "nectar-enviro-training-status-v1",
] as const;

export function resetDemoLocalData(): void {
  if (typeof window === "undefined") return;

  resetLeaveStore();
  resetRelieverPool();
  resetShiftStore();

  for (const key of CLEAR_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
