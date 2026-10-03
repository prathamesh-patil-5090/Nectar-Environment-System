import {
  evaluateOtDecision,
  ensurePendingOtDecision,
  findClearingOtDecision,
} from "./engine";
import type { AcceptOtGateResult, EvaluateOtDecisionOpts } from "./types";

/**
 * Soft block: OT accept needs Manager remark when policy flags fire
 * (cover still available, over daily max, high site load, etc.).
 * An approved OtDecision for the same site/date/leave clears the block.
 */
export function assertCanAcceptOt(
  opts: EvaluateOtDecisionOpts & {
    remark?: string;
    /** Manager/Director already provided remark on this call */
    managerCleared?: boolean;
    actorRole?: "sic" | "manager" | "director";
  },
): AcceptOtGateResult {
  const evaluation = evaluateOtDecision(opts);

  const cleared = findClearingOtDecision({
    siteId: opts.siteId,
    date: opts.date,
    leaveId: opts.leaveId,
    vacancyId: opts.vacancyId,
  });
  if (cleared) {
    return {
      ok: true,
      needsManagerRemark: false,
      evaluation,
      reasons: [],
      clearedByDecisionId: cleared.id,
    };
  }

  if (!evaluation.needsManagerRemark) {
    return {
      ok: true,
      needsManagerRemark: false,
      evaluation,
      reasons: [],
    };
  }

  const isManager =
    opts.actorRole === "manager" || opts.actorRole === "director";

  if (
    isManager &&
    opts.remark &&
    opts.remark.trim().length > 0
  ) {
    const pending = ensurePendingOtDecision(opts);
    return {
      ok: true,
      needsManagerRemark: true,
      evaluation,
      reasons: [],
      clearedByDecisionId: pending.id,
    };
  }

  ensurePendingOtDecision(opts);

  return {
    ok: false,
    needsManagerRemark: true,
    evaluation,
    reasons: [
      evaluation.message,
      "Open OverTime → Decisions to Approve with remark, or have Manager clear OT on this request.",
    ],
  };
}

export function assertCanAcceptOtOrThrow(
  opts: Parameters<typeof assertCanAcceptOt>[0],
) {
  const result = assertCanAcceptOt(opts);
  if (!result.ok) {
    throw new Error(result.reasons.join(" "));
  }
  return result;
}
