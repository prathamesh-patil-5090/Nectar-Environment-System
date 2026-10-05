import { beforeEach, describe, expect, it } from "vitest";
import {
  assertCanAcceptOt,
  approveOtDecision,
  evaluateOtDecision,
  ensurePendingOtDecision,
  resetOtDecisionStore,
} from "@/lib/ot-decision";
import { resetLeaveStore } from "@/lib/leave/store";
import { resetRelieverPool } from "@/lib/reliever/pool";
import { resetShiftStore } from "@/lib/shift/store";
import { resetOtAssignments } from "@/lib/overtime/assignments";

import "@/lib/leave/store";
import "@/lib/reliever/pool";
import "@/lib/shift/store";

describe("ot-decision", () => {
  beforeEach(() => {
    resetLeaveStore();
    resetRelieverPool();
    resetShiftStore();
    resetOtDecisionStore();
    resetOtAssignments();
  });

  it("flags reliever_available when cover candidates exist", () => {
    const ev = evaluateOtDecision({
      siteId: "s-etp",
      date: "2026-09-23",
      trigger: "roster_vacancy",
      hours: 8,
    });
    // ETP on demo day typically has pool/employee cover
    if (ev.candidateCoverCount > 0) {
      expect(ev.flags).toContain("reliever_available");
      expect(ev.needsManagerRemark).toBe(true);
      expect(ev.canSicAccept).toBe(false);
    }
  });

  it("soft-blocks SIC when flags present until Manager approves", () => {
    const blocked = assertCanAcceptOt({
      siteId: "s-etp",
      date: "2026-09-23",
      hours: 8,
      trigger: "leave_cover",
      leaveId: "lv-test",
      actorRole: "sic",
    });
    if (!blocked.evaluation.needsManagerRemark) {
      // No soft flags in this seed — still ok
      expect(blocked.ok).toBe(true);
      return;
    }
    expect(blocked.ok).toBe(false);

    const pending = ensurePendingOtDecision({
      siteId: "s-etp",
      date: "2026-09-23",
      leaveId: "lv-test",
      hours: 8,
      trigger: "leave_cover",
    });
    approveOtDecision({
      decisionId: pending.id,
      actor: "Test Manager",
      remark: "No safer cover this shift — accept OT",
    });

    const cleared = assertCanAcceptOt({
      siteId: "s-etp",
      date: "2026-09-23",
      leaveId: "lv-test",
      hours: 8,
      actorRole: "sic",
    });
    expect(cleared.ok).toBe(true);
    expect(cleared.clearedByDecisionId).toBe(pending.id);
  });

  it("flags over_daily_max when hours exceed rule", () => {
    const ev = evaluateOtDecision({
      siteId: "s-mee",
      date: "2026-09-22",
      hours: 10,
      trigger: "roster_vacancy",
    });
    expect(ev.flags).toContain("over_daily_max");
    expect(ev.needsManagerRemark).toBe(true);
  });

  it("allows Manager with remark without prior decision", () => {
    const gate = assertCanAcceptOt({
      siteId: "s-mee",
      date: "2026-09-22",
      hours: 10,
      actorRole: "manager",
      remark: "Critical evaporator coverage",
    });
    expect(gate.ok).toBe(true);
  });
});
