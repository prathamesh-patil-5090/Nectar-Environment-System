import { getEmployeeById, getSiteName } from "@/lib/mock-data";
import { computeShiftImpact } from "@/lib/shift-impact/engine";
import { rankCoverCandidates } from "@/lib/shift-impact/candidates";
import { getLeaveApi } from "@/lib/shift-impact/registry";
import {
  OT_HOURLY_COST,
  type CoverCandidate,
  type ShiftVacancy,
} from "@/lib/shift-impact/types";
import {
  getCompetitionSources,
  type CompetitionAbsence,
  type CompetitionReliever,
} from "./sources";
import {
  addCompetitionAck,
  addCompetitionAward,
  getCompetitionAcks,
  getCompetitionAwards,
  hasCompetitionAck,
  hasCompetitionAward,
} from "./store";
import type {
  ContestClaim,
  ContestKind,
  DetectContestsOpts,
  RelieverContest,
} from "./types";

const DEFAULT_TOP_N = 3;

type VacancyLike = {
  id: string;
  siteId: string;
  date: string;
  shiftCode?: string;
  shiftId?: string;
  leaveId?: string;
  absenceId?: string;
  absentEmployeeName: string;
  requiredSkills: string[];
  candidates: CoverCandidate[];
};

function personKey(c: {
  kind: string;
  id: string;
  employeeId?: string;
}): string {
  return c.employeeId ?? `${c.kind}:${c.id}`;
}

function leaveMode(
  leaveId?: string,
): "planned" | "emergency" | undefined {
  if (!leaveId) return undefined;
  try {
    const leave = getLeaveApi().getLeaveById(leaveId) as
      | { mode?: "planned" | "emergency" }
      | undefined;
    return leave?.mode;
  } catch {
    return undefined;
  }
}

function claimStatus(
  contestId: string,
  leaveId: string | undefined,
  candidateId: string,
): ContestClaim["status"] {
  if (!leaveId) return "competing";
  const award = getCompetitionAwards().find(
    (a) => a.contestId === contestId && a.candidateId === candidateId,
  );
  if (award) {
    return award.winnerLeaveId === leaveId ? "awarded" : "need_alt";
  }
  if (hasCompetitionAck(leaveId, candidateId)) return "acknowledged";
  return "competing";
}

function vacancyFromImpact(v: ShiftVacancy): VacancyLike {
  return {
    id: v.id,
    siteId: v.siteId,
    date: v.date,
    shiftCode: v.shiftCode,
    shiftId: v.shiftId,
    leaveId: v.leaveId,
    absentEmployeeName: v.absentEmployeeName ?? "Unknown",
    requiredSkills: v.requiredSkills,
    candidates: v.candidates,
  };
}

function vacancyFromAbsence(a: CompetitionAbsence): VacancyLike {
  const candidates = rankCoverCandidates({
    siteId: a.siteId,
    date: a.date,
    requiredSkills: a.requiredSkills as CoverCandidate["skills"],
    excludeEmployeeIds: [a.employeeId],
  });
  return {
    id: `abs-${a.id}`,
    siteId: a.siteId,
    date: a.date,
    shiftId: a.shiftId,
    absenceId: a.id,
    leaveId: a.id.startsWith("lv") ? a.id : undefined,
    absentEmployeeName: a.employeeName,
    requiredSkills: a.requiredSkills,
    candidates,
  };
}

function collectVacancies(opts: DetectContestsOpts): VacancyLike[] {
  const { from, to, siteId } = opts;
  const { getAbsences } = getCompetitionSources();
  const impact = computeShiftImpact({ siteId, from, to });
  const fromLeaves = impact.vacancies
    .filter((v) => v.status === "open")
    .map(vacancyFromImpact);

  const leaveVacancyKeys = new Set(
    fromLeaves.map((v) => `${v.siteId}|${v.date}|${v.leaveId ?? ""}`),
  );

  const fromAbsences = getAbsences()
    .filter((a) => {
      if (a.status !== "open") return false;
      if (a.date < from || a.date > to) return false;
      if (siteId && a.siteId !== siteId) return false;
      if (
        a.id.startsWith("lv") &&
        leaveVacancyKeys.has(`${a.siteId}|${a.date}|${a.id}`)
      ) {
        return false;
      }
      return true;
    })
    .map(vacancyFromAbsence);

  const byId = new Map<string, VacancyLike>();
  for (const v of [...fromLeaves, ...fromAbsences]) {
    if (!byId.has(v.id)) byId.set(v.id, v);
  }
  return [...byId.values()];
}

function buildClaim(
  contestId: string,
  v: VacancyLike,
  candidate: CoverCandidate | undefined,
  alternativeCount: number,
): ContestClaim {
  const leaveId = v.leaveId;
  return {
    id: `claim-${v.id}-${contestId}`,
    leaveId,
    absenceId: v.absenceId,
    vacancyId: v.id,
    siteId: v.siteId,
    date: v.date,
    shiftCode: v.shiftCode,
    shiftId: v.shiftId,
    mode: leaveMode(leaveId),
    absentEmployeeName: v.absentEmployeeName,
    requiredSkills: v.requiredSkills,
    alternativeCount,
    otHoursIfRejected: 8,
    otCostIfRejected: 8 * OT_HOURLY_COST,
    status: claimStatus(contestId, leaveId, candidate?.id ?? ""),
    matchScore: candidate?.matchScore,
  };
}

function kindForClaims(claims: ContestClaim[]): ContestKind {
  const siteSet = new Set(claims.map((c) => c.siteId));
  if (siteSet.size > 1) return "cross_plant";
  return "shared_top_pick";
}

/**
 * Detect contested cover people across open vacancies / absences.
 */
export function detectContests(opts: DetectContestsOpts): RelieverContest[] {
  const topN = opts.topN ?? DEFAULT_TOP_N;
  const vacancies = collectVacancies(opts);
  const byPerson = new Map<
    string,
    {
      candidate: CoverCandidate;
      entries: { vacancy: VacancyLike; candidate: CoverCandidate }[];
    }
  >();

  for (const v of vacancies) {
    const top = v.candidates.slice(0, topN);
    for (const c of top) {
      const key = personKey(c);
      const row = byPerson.get(key) ?? { candidate: c, entries: [] };
      row.candidate = c;
      row.entries.push({ vacancy: v, candidate: c });
      byPerson.set(key, row);
    }
  }

  const contests: RelieverContest[] = [];

  for (const [key, row] of byPerson) {
    const uniqueVacancyIds = new Set(row.entries.map((e) => e.vacancy.id));
    if (uniqueVacancyIds.size < 2) continue;

    const contestId = `contest-shared-${key}`;
    const claimByVac = new Map<string, ContestClaim>();
    for (const e of row.entries) {
      const alts = Math.max(0, e.vacancy.candidates.length - 1);
      const claim = buildClaim(contestId, e.vacancy, e.candidate, alts);
      const vid = claim.vacancyId ?? claim.id;
      if (!claimByVac.has(vid)) claimByVac.set(vid, claim);
    }
    const deduped = [...claimByVac.values()];
    if (deduped.length < 2) continue;

    contests.push({
      id: contestId,
      kind: kindForClaims(deduped),
      candidateKind: row.candidate.kind,
      candidateId: row.candidate.id,
      candidateName: row.candidate.name,
      employeeId: row.candidate.employeeId,
      claims: deduped,
      siteIds: [...new Set(deduped.map((c) => c.siteId))],
    });
  }

  const { getRelievers, getAbsences } = getCompetitionSources();
  const assigned = getRelievers().filter((r) => r.availability === "assigned");
  for (const r of assigned) {
    const matching = vacancies.filter((v) => {
      const need = new Set(v.requiredSkills);
      return r.skills.some((s) => need.has(s));
    });
    if (matching.length === 0) continue;

    const contestId = `contest-assigned-${r.id}`;
    const coveringClaim: ContestClaim = {
      id: `claim-covering-${r.id}`,
      leaveId: r.assignedAbsenceId,
      absenceId: r.assignedAbsenceId,
      siteId: r.assignedSiteId ?? r.homeSiteId ?? matching[0]!.siteId,
      date: matching[0]!.date,
      mode: leaveMode(r.assignedAbsenceId),
      absentEmployeeName: coveringName(r, getAbsences),
      requiredSkills: r.skills,
      alternativeCount: 0,
      otHoursIfRejected: 0,
      otCostIfRejected: 0,
      status: "awarded",
    };
    const openClaims = matching.map((v) =>
      buildClaim(contestId, v, undefined, Math.max(0, v.candidates.length)),
    );
    const claimByKey = new Map<string, ContestClaim>();
    for (const c of [coveringClaim, ...openClaims]) {
      const k = c.vacancyId ?? c.leaveId ?? c.absenceId ?? c.id;
      if (!claimByKey.has(k)) claimByKey.set(k, c);
    }
    const deduped = [...claimByKey.values()];
    if (deduped.length < 2) continue;

    contests.push({
      id: contestId,
      kind: "already_assigned",
      candidateKind: "reliever",
      candidateId: r.id,
      candidateName: r.name,
      employeeId: r.employeeId,
      claims: deduped,
      siteIds: [...new Set(deduped.map((c) => c.siteId))],
    });
  }

  return contests.sort((a, b) =>
    a.candidateName.localeCompare(b.candidateName),
  );
}

function coveringName(
  r: CompetitionReliever,
  getAbsences: () => CompetitionAbsence[],
): string {
  if (!r.assignedAbsenceId) return "Current assignment";
  const abs = getAbsences().find((a) => a.id === r.assignedAbsenceId);
  if (abs) return abs.employeeName;
  try {
    const leave = getLeaveApi().getLeaveById(r.assignedAbsenceId);
    return leave?.employeeName ?? "Current assignment";
  } catch {
    return "Current assignment";
  }
}

export function findContestForCandidate(
  candidateId: string,
  opts: DetectContestsOpts,
): RelieverContest | undefined {
  return detectContests(opts).find(
    (c) =>
      c.candidateId === candidateId ||
      c.employeeId === candidateId,
  );
}

export function getContestsForLeave(
  leaveId: string,
  opts: DetectContestsOpts,
): RelieverContest[] {
  return detectContests(opts).filter((c) =>
    c.claims.some((cl) => cl.leaveId === leaveId || cl.absenceId === leaveId),
  );
}

export function acknowledgeContest(input: {
  contestId: string;
  leaveId: string;
  candidateId: string;
  actor: string;
  remark: string;
}) {
  if (!input.remark.trim()) {
    throw new Error("Remark is required to acknowledge a contested assignment");
  }
  return addCompetitionAck(input);
}

export function awardContest(input: {
  contestId: string;
  winnerLeaveId: string;
  candidateId: string;
  actor: string;
}): {
  award: ReturnType<typeof addCompetitionAward>;
  contest: RelieverContest;
} {
  const contest =
    detectContests({
      from: "2026-09-20",
      to: "2026-10-10",
    }).find((c) => c.id === input.contestId) ??
    detectContests({
      from: "2020-01-01",
      to: "2099-12-31",
    }).find((c) => c.id === input.contestId);

  if (!contest) throw new Error("Contest not found");
  if (
    contest.candidateId !== input.candidateId &&
    contest.employeeId !== input.candidateId
  ) {
    throw new Error("Candidate does not match this contest");
  }

  const winnerClaim = contest.claims.find(
    (c) =>
      c.leaveId === input.winnerLeaveId ||
      c.absenceId === input.winnerLeaveId,
  );
  if (!winnerClaim) {
    throw new Error("Winner leave is not part of this contest");
  }

  const award = addCompetitionAward({
    contestId: input.contestId,
    winnerLeaveId: input.winnerLeaveId,
    candidateId: input.candidateId,
    actor: input.actor,
  });

  if (winnerClaim.leaveId || winnerClaim.absenceId) {
    addCompetitionAck({
      contestId: input.contestId,
      leaveId: winnerClaim.leaveId ?? winnerClaim.absenceId!,
      candidateId: input.candidateId,
      actor: input.actor,
      remark: `Awarded by ${input.actor}`,
    });
  }

  const refreshed = {
    ...contest,
    claims: contest.claims.map((c) => {
      const lid = c.leaveId ?? c.absenceId;
      if (lid === input.winnerLeaveId) {
        return { ...c, status: "awarded" as const };
      }
      return { ...c, status: "need_alt" as const };
    }),
  };

  return { award, contest: refreshed };
}

export function contestLabel(kind: ContestKind): string {
  switch (kind) {
    case "shared_top_pick":
      return "Shared top pick";
    case "already_assigned":
      return "Already assigned";
    case "cross_plant":
      return "Cross-plant demand";
  }
}

export function claimSiteLabel(siteId: string): string {
  return getSiteName(siteId);
}

export function candidateDisplayName(contest: RelieverContest): string {
  if (contest.employeeId) {
    return getEmployeeById(contest.employeeId)?.name ?? contest.candidateName;
  }
  return contest.candidateName;
}

export {
  getCompetitionAcks,
  getCompetitionAwards,
  hasCompetitionAck,
  hasCompetitionAward,
};
