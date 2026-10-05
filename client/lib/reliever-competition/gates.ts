import {
  findContestForCandidate,
  hasCompetitionAck,
  hasCompetitionAward,
} from "./engine";
import type { AssignContestGateResult, RelieverContest } from "./types";

/**
 * Soft block: contested candidate needs Manager acknowledge or Award
 * before assign sticks. OT is never blocked by competition.
 */
export function assertCanAssignContestedCandidate(opts: {
  leaveId: string;
  candidateId: string;
  from: string;
  to: string;
  siteId?: string;
  /** Explicit bypass after Award / Manager override */
  competitionCleared?: boolean;
}): AssignContestGateResult {
  if (opts.competitionCleared) {
    return { ok: true, contested: false, reasons: [] };
  }

  const contest = findContestForCandidate(opts.candidateId, {
    from: opts.from,
    to: opts.to,
    siteId: opts.siteId,
  });

  if (!contest) {
    return { ok: true, contested: false, reasons: [] };
  }

  // Candidate must actually be this contest's person
  const isPerson =
    contest.candidateId === opts.candidateId ||
    contest.employeeId === opts.candidateId;
  if (!isPerson) {
    return { ok: true, contested: false, reasons: [] };
  }

  // Leave must be one of the competing claims (or any claim if already_assigned)
  const onClaim = contest.claims.some(
    (c) => c.leaveId === opts.leaveId || c.absenceId === opts.leaveId,
  );
  if (!onClaim && contest.kind !== "already_assigned") {
    return { ok: true, contested: false, reasons: [] };
  }

  if (hasCompetitionAck(opts.leaveId, opts.candidateId)) {
    return {
      ok: true,
      contested: true,
      contest,
      reasons: [],
    };
  }

  if (
    hasCompetitionAward(contest.id, opts.leaveId, opts.candidateId)
  ) {
    return {
      ok: true,
      contested: true,
      contest,
      reasons: [],
    };
  }

  const others = contest.claims
    .filter((c) => (c.leaveId ?? c.absenceId) !== opts.leaveId)
    .map((c) => c.absentEmployeeName)
    .slice(0, 3);

  return {
    ok: false,
    contested: true,
    contest,
    reasons: [
      `${contest.candidateName} is contested (${contest.kind.replaceAll("_", " ")}).` +
        (others.length
          ? ` Also needed for: ${others.join(", ")}.`
          : ""),
      "Manager must Award or Acknowledge on Reliever Competition before this assign sticks.",
    ],
  };
}

export function isCandidateContested(
  candidateId: string,
  leaveId: string,
  window: { from: string; to: string; siteId?: string },
): RelieverContest | undefined {
  const gate = assertCanAssignContestedCandidate({
    leaveId,
    candidateId,
    from: window.from,
    to: window.to,
    siteId: window.siteId,
  });
  return gate.contested ? gate.contest : undefined;
}
