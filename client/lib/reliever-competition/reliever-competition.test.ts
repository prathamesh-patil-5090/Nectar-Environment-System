import { beforeEach, describe, expect, it } from "vitest";
import {
  assertCanAssignContestedCandidate,
  detectContests,
  acknowledgeContest,
  awardContest,
  resetCompetitionStore,
} from "@/lib/reliever-competition";
import { resetRelieverPool } from "@/lib/reliever/pool";
import { resetLeaveStore } from "@/lib/leave/store";
import { resetShiftStore } from "@/lib/shift/store";

import "@/lib/leave/store";
import "@/lib/reliever/pool";
import "@/lib/shift/store";

describe("reliever-competition", () => {
  beforeEach(() => {
    resetLeaveStore();
    resetRelieverPool();
    resetShiftStore();
    resetCompetitionStore();
  });

  it("detects shared top pick across open ETP absences on same day", () => {
    const contests = detectContests({
      from: "2026-09-23",
      to: "2026-09-23",
      siteId: "s-etp",
    });
    const shared = contests.filter((c) => c.kind !== "already_assigned");
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.some((c) => c.claims.length >= 2)).toBe(true);
  });

  it("soft-blocks contested assign until acknowledge", () => {
    const contests = detectContests({
      from: "2026-09-23",
      to: "2026-09-23",
      siteId: "s-etp",
    });
    const contest = contests.find((c) => c.claims.length >= 2);
    expect(contest).toBeTruthy();
    const claim = contest!.claims.find((c) => c.absenceId || c.leaveId)!;
    const leaveId = claim.leaveId ?? claim.absenceId!;

    const blocked = assertCanAssignContestedCandidate({
      leaveId,
      candidateId: contest!.candidateId,
      from: "2026-09-23",
      to: "2026-09-23",
      siteId: "s-etp",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.contested).toBe(true);

    acknowledgeContest({
      contestId: contest!.id,
      leaveId,
      candidateId: contest!.candidateId,
      actor: "Test Manager",
      remark: "Priority cover for morning plant",
    });

    const cleared = assertCanAssignContestedCandidate({
      leaveId,
      candidateId: contest!.candidateId,
      from: "2026-09-23",
      to: "2026-09-23",
      siteId: "s-etp",
    });
    expect(cleared.ok).toBe(true);
  });

  it("award marks winner and clears soft block for winner only", () => {
    const contests = detectContests({
      from: "2026-09-23",
      to: "2026-09-23",
      siteId: "s-etp",
    });
    const contest = contests.find(
      (c) =>
        c.kind !== "already_assigned" &&
        new Set(
          c.claims.map((cl) => cl.leaveId ?? cl.absenceId ?? cl.vacancyId),
        ).size >= 2,
    )!;
    expect(contest).toBeTruthy();

    const keys = [
      ...new Set(
        contest.claims.map((cl) => cl.leaveId ?? cl.absenceId!).filter(Boolean),
      ),
    ];
    const winnerId = keys[0]!;
    const loserId = keys[1]!;
    expect(winnerId).not.toBe(loserId);

    const { contest: updated } = awardContest({
      contestId: contest.id,
      winnerLeaveId: winnerId,
      candidateId: contest.candidateId,
      actor: "Test Manager",
    });

    expect(
      updated.claims.find((c) => (c.leaveId ?? c.absenceId) === winnerId)
        ?.status,
    ).toBe("awarded");
    expect(
      updated.claims.find((c) => (c.leaveId ?? c.absenceId) === loserId)
        ?.status,
    ).toBe("need_alt");

    expect(
      assertCanAssignContestedCandidate({
        leaveId: winnerId,
        candidateId: contest.candidateId,
        from: "2026-09-23",
        to: "2026-09-23",
        siteId: "s-etp",
      }).ok,
    ).toBe(true);

    expect(
      assertCanAssignContestedCandidate({
        leaveId: loserId,
        candidateId: contest.candidateId,
        from: "2026-09-23",
        to: "2026-09-23",
        siteId: "s-etp",
      }).ok,
    ).toBe(false);
  });

  it("flags already_assigned contests for deployed pool people", () => {
    const contests = detectContests({
      from: "2026-09-22",
      to: "2026-09-24",
    });
    expect(contests.some((c) => c.kind === "already_assigned")).toBe(true);
  });
});
