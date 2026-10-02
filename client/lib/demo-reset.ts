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
import { resetTrainingStore } from "@/lib/training/store";

const CLEAR_KEYS = [
  "nectar-enviro-ot-assignments",
  "nectar-enviro-notifications",
  "nectar-enviro-notifications-seeded-v2",
  "nectar-enviro-notifications-seeded-v3",
  "nectar-enviro-training-status-v1",
  "nectar-enviro-training-status-v2",
  "nectar-enviro-leave-store-v1",
  "nectar-enviro-leave-store-v2",
  "nectar-enviro-shift-store-v2",
  "nectar-enviro-shift-store-v3",
  "nectar-enviro-reliever-pool-v1",
  "nectar-enviro-reliever-pool-v2",
  "nectar.relieverCompetition.v1",
  "nectar.otDecisions.v1",
  "nectar.leaveLifecycle.v1",
  "neipl_training_enrollments_v2",
  "neipl_training_skill_mapping_v2",
  "neipl_training_written_tests_v2",
  "neipl_training_practical_tests_v2",
  "neipl_training_oral_tests_v2",
  "neipl_training_certificates_v2",
  "neipl_training_lni_records_v2",
  "neipl_training_sessions_v2",
  "neipl_training_enrollments_v3",
  "neipl_training_skill_mapping_v3",
  "neipl_training_written_tests_v3",
  "neipl_training_practical_tests_v3",
  "neipl_training_oral_tests_v3",
  "neipl_training_certificates_v3",
  "neipl_training_lni_records_v3",
  "neipl_training_sessions_v3",
] as const;

export function resetDemoLocalData(): void {
  if (typeof window === "undefined") return;

  resetLeaveStore();
  resetRelieverPool();
  resetShiftStore();
  resetTrainingStore();

  for (const key of CLEAR_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
