import {
  employees,
  getEmployeeById,
  getSiteById,
  getSiteName,
} from "@/lib/mock-data";
import type { LeaveImpact } from "@/lib/leave/types";
import type { ShiftCode } from "@/lib/shift/types";
import { rankCoverCandidates } from "./candidates";
import {
  getLeaveApi,
  getPoolApi,
  getShiftApi,
  type LeaveRow,
} from "./registry";
import { inferRequiredSkills } from "./skills";
import {
  OT_HOURLY_COST,
  type ComputeShiftImpactOpts,
  type ShiftImpactReport,
  type ShiftImpactRisk,
  type ShiftVacancy,
} from "./types";

type LeaveShiftImpactDay = {
  date: string;
  shiftCode: string;
  shiftName: string;
  replacementRequired: boolean;
};

const COVERING_LEAVE_STATUSES = new Set([
  "REQUESTED",
  "PENDING_EMPLOYEE_CONSENT",
  "SUPERVISOR_VERIFIED",
  "SITE_APPROVED",
  "MANAGER_APPROVED",
  "HR_VALIDATED",
  "APPROVED",
  "ABSENT",
  "SUPERVISOR_RECORDED",
  "SITE_VERIFIED",
  "PENDING_INFORMATION",
  "UNEXPLAINED_ABSENCE",
  "EXTENSION_REQUIRED",
]);

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00Z").getTime();
  const end = new Date(to + "T00:00:00Z").getTime();
  for (let t = start; t <= end; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out.length ? out : [from];
}

function requiredHeadcount(siteId: string): number {
  const site = getSiteById(siteId);
  return Math.max(2, Math.ceil((site?.headcount ?? 6) / 3));
}

function riskFromOt(hours: number, availableRelievers: number): ShiftImpactRisk {
  if (hours >= 8) return "high";
  if (hours > 0 || availableRelievers === 0) return "low";
  return "none";
}

function buildLeaveVacancies(
  leaves: LeaveRow[],
  from: string,
  to: string,
  siteFilter?: string,
): ShiftVacancy[] {
  const { getPlannedShiftForLeave, getShiftByCode, shiftMaster } =
    getShiftApi();
  const vacancies: ShiftVacancy[] = [];

  for (const leave of leaves) {
    if (!COVERING_LEAVE_STATUSES.has(leave.status)) continue;
    if (siteFilter && leave.siteId !== siteFilter) continue;
    if (leave.endDate < from || leave.startDate > to) continue;

    const planned = getPlannedShiftForLeave(
      leave.employeeId,
      leave.startDate < from ? from : leave.startDate,
      leave.endDate > to ? to : leave.endDate,
    );

    for (const day of planned) {
      if (day.plannedCode === "OFF") continue;
      const shift =
        shiftMaster.find((s) => s.id === day.plannedShiftId) ??
        getShiftByCode(day.plannedCode as ShiftCode);
      const shiftId = shift?.id ?? day.plannedShiftId ?? leave.shiftId;
      const shiftCode = (shift?.code ?? day.plannedCode) as ShiftCode;
      const requiredSkills = inferRequiredSkills(leave.siteId, shiftCode);

      const covered = Boolean(
        leave.assignedCoverEmployeeId || leave.assignedRelieverId,
      );
      const status: ShiftVacancy["status"] = covered
        ? leave.coverSource === "ot_fallback"
          ? "ot_fallback"
          : "covered"
        : leave.coverSource === "ot_fallback"
          ? "ot_fallback"
          : "open";

      const candidates =
        status === "open"
          ? rankCoverCandidates({
              siteId: leave.siteId,
              date: day.date,
              requiredSkills,
              excludeEmployeeIds: [leave.employeeId],
            })
          : [];

      vacancies.push({
        id: `leave:${leave.id}:${day.date}:${shiftCode}`,
        siteId: leave.siteId,
        date: day.date,
        shiftId,
        shiftCode,
        source: "leave",
        absentEmployeeId: leave.employeeId,
        absentEmployeeName: leave.employeeName,
        leaveId: leave.id,
        requiredSkills,
        status,
        candidates,
        chosenCoverId:
          leave.assignedCoverEmployeeId ?? leave.assignedRelieverId,
        chosenCoverName: leave.replacementPlan,
        chosenCoverSource: leave.coverSource as ShiftVacancy["chosenCoverSource"],
      });
    }
  }

  return vacancies;
}

function buildRosterGapVacancies(
  from: string,
  to: string,
  siteFilter: string | undefined,
  leaveVacancies: ShiftVacancy[],
): ShiftVacancy[] {
  const { getPlannedDays, shiftMaster } = getShiftApi();
  const { sites } = getPoolApi();
  const targetSites = siteFilter
    ? sites.filter((s) => s.id === siteFilter)
    : sites.filter((s) => ["s-etp", "s-ro", "s-mee"].includes(s.id));

  const leaveKeys = new Set(
    leaveVacancies.map((v) => `${v.siteId}|${v.date}|${v.shiftCode}`),
  );

  const vacancies: ShiftVacancy[] = [];

  for (const site of targetSites) {
    const required = requiredHeadcount(site.id);
    for (const date of eachDate(from, to)) {
      for (const shift of shiftMaster.filter(
        (s) => s.code !== "G" && s.code !== "OFF",
      )) {
        const planned = getPlannedDays({
          siteId: site.id,
          from: date,
          to: date,
        }).filter(
          (d) => d.plannedShiftId === shift.id && d.plannedCode !== "OFF",
        );
        const leaveHits = leaveVacancies.filter(
          (v) =>
            v.siteId === site.id &&
            v.date === date &&
            v.shiftCode === shift.code,
        ).length;
        const available = Math.max(0, planned.length - leaveHits);
        const shortfall = Math.max(0, required - available);
        if (shortfall <= 0) continue;

        const key = `${site.id}|${date}|${shift.code}`;
        const extraGaps = leaveKeys.has(key)
          ? Math.max(0, shortfall - leaveHits)
          : shortfall;
        if (extraGaps <= 0) continue;

        const requiredSkills = inferRequiredSkills(site.id, shift.code);
        for (let i = 0; i < extraGaps; i++) {
          const candidates = rankCoverCandidates({
            siteId: site.id,
            date,
            requiredSkills,
          });
          vacancies.push({
            id: `roster:${site.id}:${date}:${shift.code}:${i}`,
            siteId: site.id,
            date,
            shiftId: shift.id,
            shiftCode: shift.code,
            source: "roster_gap",
            requiredSkills,
            status: "open",
            candidates,
          });
        }
      }
    }
  }

  return vacancies;
}

function manpowerSnapshot(
  siteId: string,
  date: string,
  excludeEmployeeId?: string,
) {
  const siteStaff = employees.filter(
    (e) => e.siteId === siteId && e.employmentStatus === "active",
  ).length;
  const onLeave = getLeaveApi()
    .getLeaveRequests(siteId)
    .filter(
      (l) =>
        COVERING_LEAVE_STATUSES.has(l.status) &&
        l.startDate <= date &&
        l.endDate >= date &&
        l.employeeId !== excludeEmployeeId,
    ).length;
  const currentManpower = Math.max(
    0,
    siteStaff - onLeave - (excludeEmployeeId ? 1 : 0),
  );
  const site = getSiteById(siteId);
  const requiredManpower = site?.headcount
    ? Math.max(8, Math.round(site.headcount * 0.85))
    : 10;
  return { currentManpower, requiredManpower };
}

/**
 * Unified Shift Impact: leave vacancies + roster gaps with ranked cover candidates.
 */
export function computeShiftImpact(
  opts: ComputeShiftImpactOpts,
): ShiftImpactReport {
  const { from, to, siteId, focusLeaveId } = opts;
  const { getLeaveRequests, getLeaveById } = getLeaveApi();
  const { getClusterForSite, getRelievers } = getPoolApi();

  let leaves: LeaveRow[] = getLeaveRequests(siteId);
  let focusLeave: LeaveRow | undefined;

  if (focusLeaveId) {
    focusLeave = getLeaveById(focusLeaveId);
    if (focusLeave) {
      const plantLeaves = getLeaveRequests(focusLeave.siteId);
      leaves = plantLeaves.filter(
        (l) =>
          l.id === focusLeaveId ||
          (COVERING_LEAVE_STATUSES.has(l.status) &&
            l.startDate <= focusLeave!.endDate &&
            focusLeave!.startDate <= l.endDate),
      );
    }
  }

  const leaveVacancies = buildLeaveVacancies(
    leaves,
    from,
    to,
    focusLeaveId ? focusLeave?.siteId ?? siteId : siteId,
  );

  const rosterVacancies = focusLeaveId
    ? []
    : buildRosterGapVacancies(from, to, siteId, leaveVacancies);

  let vacancies = [...leaveVacancies, ...rosterVacancies];

  if (focusLeaveId) {
    vacancies = vacancies.sort((a, b) => {
      const aFocus = a.leaveId === focusLeaveId ? 0 : 1;
      const bFocus = b.leaveId === focusLeaveId ? 0 : 1;
      if (aFocus !== bFocus) return aFocus - bFocus;
      return a.date.localeCompare(b.date);
    });
  }

  const open = vacancies.filter((v) => v.status === "open");
  const uncovered = open.filter((v) => v.candidates.length === 0);
  const uncoveredCount = uncovered.length;
  const coveredCount = vacancies.filter((v) => v.status === "covered").length;
  const potentialOtHours = uncoveredCount * 8;
  const potentialOtCost = potentialOtHours * OT_HOURLY_COST;

  const snapSite =
    siteId ?? focusLeave?.siteId ?? vacancies[0]?.siteId ?? "s-etp";
  const snapDate = from;
  const { currentManpower, requiredManpower } = manpowerSnapshot(
    snapSite,
    snapDate,
    focusLeave?.employeeId,
  );

  const cluster = getClusterForSite(snapSite);
  const availableRelievers = getRelievers(cluster?.id).filter(
    (r) => r.availability === "available",
  ).length;
  const nearbyAvailableWorkers = getRelievers(cluster?.id).filter(
    (r) =>
      r.availability === "available" &&
      r.homeSiteId &&
      r.homeSiteId !== snapSite,
  ).length;

  return {
    from,
    to,
    siteId: siteId ?? focusLeave?.siteId,
    focusLeaveId,
    vacancies,
    uncoveredCount,
    coveredCount,
    potentialOtHours,
    potentialOtCost,
    risk: riskFromOt(potentialOtHours, availableRelievers),
    availableRelievers,
    nearbyAvailableWorkers,
    currentManpower,
    requiredManpower,
  };
}

/** Compat: LeaveImpact shape used across the leave UI. */
export function leaveImpactFromEngine(
  employeeId: string,
  date: string,
  endDate?: string,
): LeaveImpact & {
  affectedShiftDays: LeaveShiftImpactDay[];
  report: ShiftImpactReport;
} {
  const emp = getEmployeeById(employeeId);
  const siteId = emp?.siteId ?? "s-etp";
  const to = endDate ?? date;
  const { getLeaveRequests } = getLeaveApi();
  const focus = getLeaveRequests(siteId).find(
    (l) =>
      l.employeeId === employeeId &&
      l.startDate <= to &&
      l.endDate >= date &&
      COVERING_LEAVE_STATUSES.has(l.status),
  );

  const report = computeShiftImpact({
    siteId,
    from: date,
    to,
    focusLeaveId: focus?.id,
  });

  let affectedShiftDays: LeaveShiftImpactDay[] = report.vacancies
    .filter((v) => v.source === "leave" && v.absentEmployeeId === employeeId)
    .map((v) => ({
      date: v.date,
      shiftCode: v.shiftCode,
      shiftName: v.shiftCode === "OFF" ? "Weekly Off" : `${v.shiftCode} Shift`,
      replacementRequired: v.shiftCode !== "OFF",
    }));

  if (!affectedShiftDays.length) {
    const { getPlannedShiftForLeave, shiftMaster } = getShiftApi();
    affectedShiftDays = getPlannedShiftForLeave(employeeId, date, to)
      .filter((p) => p.plannedCode !== "OFF")
      .map((p) => ({
        date: p.date,
        shiftCode: p.plannedCode,
        shiftName: `${p.plannedCode} Shift`,
        replacementRequired: true,
      }));

    if (!focus) {
      const previewVacancies = affectedShiftDays.map((d) => {
        const requiredSkills = inferRequiredSkills(siteId, d.shiftCode);
        const candidates = rankCoverCandidates({
          siteId,
          date: d.date,
          requiredSkills,
          excludeEmployeeIds: [employeeId],
        });
        return { ...d, candidates };
      });
      const uncovered = previewVacancies.filter((v) => !v.candidates.length)
        .length;
      report.vacancies = previewVacancies.map((v, i) => ({
        id: `preview:${employeeId}:${v.date}:${i}`,
        siteId,
        date: v.date,
        shiftId: emp?.shiftId ?? "sh-morning",
        shiftCode: v.shiftCode as ShiftCode,
        source: "leave" as const,
        absentEmployeeId: employeeId,
        absentEmployeeName: emp?.name,
        requiredSkills: inferRequiredSkills(siteId, v.shiftCode),
        status: "open" as const,
        candidates: v.candidates,
      }));
      report.uncoveredCount = uncovered;
      report.potentialOtHours = uncovered * 8;
      report.potentialOtCost = report.potentialOtHours * OT_HOURLY_COST;
      report.risk = riskFromOt(
        report.potentialOtHours,
        report.availableRelievers,
      );
    }

    void shiftMaster;
  }

  const { shiftMaster } = getShiftApi();
  const shift = shiftMaster.find(
    (s) => s.id === (emp?.shiftId ?? "sh-morning"),
  );

  return {
    employeeId,
    employeeName: emp?.name ?? employeeId,
    siteId,
    siteName: getSiteName(siteId),
    shiftId: emp?.shiftId ?? "sh-morning",
    shiftName: shift?.name ?? "Shift",
    date,
    currentManpower: report.currentManpower,
    requiredManpower: report.requiredManpower,
    availableRelievers: report.availableRelievers,
    nearbyAvailableWorkers: report.nearbyAvailableWorkers,
    potentialOtHours: report.potentialOtHours,
    potentialOtCost: report.potentialOtCost,
    risk: report.risk,
    affectedShiftDays,
    report,
  };
}

/** Candidates for leave replacement picker (employees + pool). */
export function listCoverOptionsForSite(
  siteId: string,
  date: string,
  excludeEmployeeId?: string,
) {
  const requiredSkills = inferRequiredSkills(siteId, "A");
  const ranked = rankCoverCandidates({
    siteId,
    date,
    requiredSkills,
    excludeEmployeeIds: excludeEmployeeId ? [excludeEmployeeId] : [],
  });

  const local = ranked.filter(
    (c) => c.source === "local_employee" || c.source === "local_pool",
  );
  const cluster = ranked.filter(
    (c) => c.source === "cluster_employee" || c.source === "cluster_pool",
  );
  return { local, cluster, all: ranked };
}
