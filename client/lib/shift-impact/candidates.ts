import {
  employees,
  getEmployeeById,
  type Employee,
} from "@/lib/mock-data";
import type { SkillTag } from "@/lib/reliever/pool";
import {
  getCoverageApi,
  getPoolApi,
  getShiftApi,
} from "./registry";
import {
  COVER_SOURCE_RANK,
  type CoverCandidate,
  type CoverCandidateSource,
} from "./types";
import {
  employeeSkillTags,
  skillMatchScore,
  skillsMatch,
} from "./skills";

type PlannedDayLookup = (
  employeeId: string,
  date: string,
) => { plannedCode: string } | undefined;

type CoveringLeaveLookup = (employeeId: string, date: string) => boolean;

function defaultPlannedDay(
  employeeId: string,
  date: string,
): { plannedCode: string } | undefined {
  try {
    return getShiftApi().getPlannedDays({ employeeId, from: date, to: date })[0];
  } catch {
    return undefined;
  }
}

function defaultCoveringLeave(employeeId: string, date: string): boolean {
  return getCoverageApi().employeeHasCoveringLeave(employeeId, date);
}

function isEmployeeFreeThatDay(
  emp: Employee,
  date: string,
  plannedDay: PlannedDayLookup,
): boolean {
  const day = plannedDay(emp.id, date);
  if (!day) return true;
  return day.plannedCode === "OFF";
}

function toCandidate(
  partial: Omit<CoverCandidate, "matchScore"> & { matchScore?: number },
): CoverCandidate {
  return {
    ...partial,
    matchScore: partial.matchScore ?? 0,
  };
}

/** Ranked cover candidates: local emp → cluster emp → local pool → cluster pool. */
export function rankCoverCandidates(opts: {
  siteId: string;
  date: string;
  requiredSkills: SkillTag[];
  excludeEmployeeIds?: string[];
  plannedDay?: PlannedDayLookup;
  coveringLeave?: CoveringLeaveLookup;
}): CoverCandidate[] {
  const {
    siteId,
    date,
    requiredSkills,
    excludeEmployeeIds = [],
    plannedDay = defaultPlannedDay,
    coveringLeave = defaultCoveringLeave,
  } = opts;

  const { getClusterForSite, getRelievers, sites } = getPoolApi();
  const cluster = getClusterForSite(siteId);
  const clusterSiteIds = new Set(cluster?.siteIds ?? [siteId]);
  const site = sites.find((s) => s.id === siteId);
  const excluded = new Set(excludeEmployeeIds);

  const candidates: CoverCandidate[] = [];

  const activeEmps = employees.filter(
    (e) =>
      e.employmentStatus === "active" &&
      clusterSiteIds.has(e.siteId) &&
      !excluded.has(e.id),
  );

  for (const emp of activeEmps) {
    if (coveringLeave(emp.id, date)) continue;
    if (!isEmployeeFreeThatDay(emp, date, plannedDay)) continue;
    const skills = employeeSkillTags(emp);
    if (!skillsMatch(skills, requiredSkills)) continue;

    const source: CoverCandidateSource =
      emp.siteId === siteId ? "local_employee" : "cluster_employee";
    candidates.push(
      toCandidate({
        kind: "employee",
        id: emp.id,
        employeeId: emp.id,
        name: emp.name,
        phone: emp.phone,
        source,
        homeSiteId: emp.siteId,
        skills,
        matchScore:
          skillMatchScore(skills, requiredSkills) * 10 +
          (50 - COVER_SOURCE_RANK[source] * 10),
      }),
    );
  }

  const pool = getRelievers(cluster?.id).filter(
    (r) => r.availability === "available",
  );

  for (const r of pool) {
    if (r.employeeId && excluded.has(r.employeeId)) continue;
    if (r.employeeId && coveringLeave(r.employeeId, date)) continue;
    if (site && !r.plantTypes.includes(site.plantType)) continue;
    if (!skillsMatch(r.skills, requiredSkills)) continue;

    const source: CoverCandidateSource =
      r.homeSiteId === siteId ? "local_pool" : "cluster_pool";
    candidates.push(
      toCandidate({
        kind: "reliever",
        id: r.id,
        employeeId: r.employeeId,
        name: r.name,
        phone: r.phone,
        source,
        homeSiteId: r.homeSiteId,
        skills: r.skills,
        matchScore:
          skillMatchScore(r.skills, requiredSkills) * 10 +
          (50 - COVER_SOURCE_RANK[source] * 10),
      }),
    );
  }

  const byPerson = new Map<string, CoverCandidate>();
  for (const c of candidates) {
    const key = c.employeeId ?? `${c.kind}:${c.id}`;
    const existing = byPerson.get(key);
    if (
      !existing ||
      COVER_SOURCE_RANK[c.source] < COVER_SOURCE_RANK[existing.source] ||
      (COVER_SOURCE_RANK[c.source] === COVER_SOURCE_RANK[existing.source] &&
        c.matchScore > existing.matchScore)
    ) {
      byPerson.set(key, c);
    }
  }

  return [...byPerson.values()].sort((a, b) => {
    const rankDiff =
      COVER_SOURCE_RANK[a.source] - COVER_SOURCE_RANK[b.source];
    if (rankDiff !== 0) return rankDiff;
    return b.matchScore - a.matchScore;
  });
}

export function candidateDisplaySource(source: CoverCandidateSource): string {
  switch (source) {
    case "local_employee":
      return "Same plant employee";
    case "cluster_employee":
      return "Cluster employee";
    case "local_pool":
      return "Local pool";
    case "cluster_pool":
      return "Cluster pool";
    default:
      return source;
  }
}

export function resolveEmployeeName(employeeId: string): string {
  return getEmployeeById(employeeId)?.name ?? employeeId;
}
