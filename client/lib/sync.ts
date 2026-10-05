/**
 * Global Client Auto-Hydration Service
 *
 * Connects frontend stores with the live NestJS backend running on http://localhost:3001
 * with automatic fallback to local browser cache if backend is unreachable or offline.
 */

import { syncLeavesWithApi } from "@/lib/leave/store";
import { syncRelieversWithApi } from "@/lib/reliever/pool";
import { syncTrainingWithApi } from "@/lib/training/store";
import { syncSafetyWithApi } from "@/lib/safety/store";

let isHydrating = false;

export async function hydrateAllStoresFromApi(): Promise<void> {
  if (typeof window === "undefined" || isHydrating) return;
  isHydrating = true;

  try {
    await Promise.allSettled([
      syncTrainingWithApi(),
      syncLeavesWithApi(),
      syncRelieversWithApi(),
      syncSafetyWithApi(),
    ]);
  } catch (err) {
    console.debug("Hydration: offline fallback active", err);
  } finally {
    isHydrating = false;
  }
}
