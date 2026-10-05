import { employees, getEmployeeById, getSiteById, sites } from "@/lib/mock-data";
import { defaultOtRules } from "./rules";
import { getShiftById, otRecords } from "./data";
import type {
  OtFilters,
  OtInsight,
  OtRecord,
  OtStatus,
} from "./types";

function inMonth(date: string, year: number, month: number) {
  return (
    Number(date.slice(0, 4)) === year && Number(date.slice(5, 7)) === month
  );
}

export function applyOtFilters(
  records: OtRecord[],
  filters: OtFilters,
): OtRecord[] {
  return records.filter((r) => {
    if (filters.dateFrom && r.date < filters.dateFrom) return false;
    if (filters.dateTo && r.date > filters.dateTo) return false;
    if (filters.year != null && Number(r.date.slice(0, 4)) !== filters.year)
      return false;
    if (
      filters.month != null &&
      Number(r.date.slice(5, 7)) !== filters.month
    )
      return false;
    if (filters.siteId && r.siteId !== filters.siteId) return false;
    if (filters.department && r.department !== filters.department) return false;
    if (filters.employeeId && r.employeeId !== filters.employeeId) return false;
    if (filters.shiftId && r.shiftId !== filters.shiftId) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.reason && r.reason !== filters.reason) return false;
    if (filters.employeeType) {
      const emp = getEmployeeById(r.employeeId);
      if (!emp || emp.employeeType !== filters.employeeType) return false;
    }
    return true;
  });
}

export function sumHours(records: OtRecord[]) {
  return Math.round(records.reduce((s, r) => s + r.otHours, 0) * 100) / 100;
}

export function sumCost(records: OtRecord[]) {
  return Math.round(records.reduce((s, r) => s + r.otCost, 0) * 100) / 100;
}

export function uniqueEmployees(records: OtRecord[]) {
  return new Set(records.map((r) => r.employeeId)).size;
}

export function otDaysCount(records: OtRecord[]) {
  return new Set(records.map((r) => `${r.employeeId}|${r.date}`)).size;
}

export type OtOverviewKpis = {
  totalOtHours: number;
  totalOtDays: number;
  totalOtEmployees: number;
  totalOtCost: number;
  avgOtPerEmployee: number;
  avgOtPerSite: number;
  highestSite: {
    siteId: string;
    name: string;
    otHours: number;
    otCost: number;
    sharePct: number;
  } | null;
  highestEmployee: {
    employeeId: string;
    name: string;
    siteName: string;
    otHours: number;
    otDays: number;
    otCost: number;
  } | null;
  statusBreakdown: Record<OtStatus, number>;
};

export function getOverviewKpis(filters: OtFilters): OtOverviewKpis {
  const filtered = applyOtFilters(otRecords, filters);
  const totalOtHours = sumHours(filtered);
  const totalOtDays = otDaysCount(filtered);
  const totalOtEmployees = uniqueEmployees(filtered);
  const totalOtCost = sumCost(filtered);

  const bySite = new Map<string, { hours: number; cost: number }>();
  for (const r of filtered) {
    const cur = bySite.get(r.siteId) ?? { hours: 0, cost: 0 };
    cur.hours += r.otHours;
    cur.cost += r.otCost;
    bySite.set(r.siteId, cur);
  }
  const activeSites = bySite.size || sites.length;
  let highestSite: OtOverviewKpis["highestSite"] = null;
  for (const [siteId, v] of bySite) {
    if (!highestSite || v.hours > highestSite.otHours) {
      highestSite = {
        siteId,
        name: getSiteById(siteId)?.name ?? siteId,
        otHours: Math.round(v.hours * 100) / 100,
        otCost: Math.round(v.cost * 100) / 100,
        sharePct:
          totalOtHours > 0
            ? Math.round((v.hours / totalOtHours) * 1000) / 10
            : 0,
      };
    }
  }

  const byEmp = new Map<
    string,
    { hours: number; cost: number; days: Set<string> }
  >();
  for (const r of filtered) {
    const cur = byEmp.get(r.employeeId) ?? {
      hours: 0,
      cost: 0,
      days: new Set<string>(),
    };
    cur.hours += r.otHours;
    cur.cost += r.otCost;
    cur.days.add(r.date);
    byEmp.set(r.employeeId, cur);
  }
  let highestEmployee: OtOverviewKpis["highestEmployee"] = null;
  for (const [employeeId, v] of byEmp) {
    if (!highestEmployee || v.hours > highestEmployee.otHours) {
      const emp = getEmployeeById(employeeId);
      highestEmployee = {
        employeeId,
        name: emp?.name ?? employeeId,
        siteName: getSiteById(emp?.siteId ?? "")?.name ?? "—",
        otHours: Math.round(v.hours * 100) / 100,
        otDays: v.days.size,
        otCost: Math.round(v.cost * 100) / 100,
      };
    }
  }

  const statusBreakdown: Record<OtStatus, number> = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    PAID: 0,
    CANCELLED: 0,
  };
  for (const r of filtered) statusBreakdown[r.status] += 1;

  return {
    totalOtHours,
    totalOtDays,
    totalOtEmployees,
    totalOtCost,
    avgOtPerEmployee:
      totalOtEmployees > 0
        ? Math.round((totalOtHours / totalOtEmployees) * 100) / 100
        : 0,
    avgOtPerSite:
      activeSites > 0
        ? Math.round((totalOtHours / activeSites) * 100) / 100
        : 0,
    highestSite,
    highestEmployee,
    statusBreakdown,
  };
}

export type EmployeeOtRow = {
  employeeId: string;
  employeeName: string;
  siteId: string;
  siteName: string;
  department: string;
  otDays: number;
  otHours: number;
  otCost: number;
  avgOtPerDay: number;
  lastOtDate: string;
  otStatus: OtStatus | "MIXED";
};

export function getEmployeeOtRows(filters: OtFilters): EmployeeOtRow[] {
  const filtered = applyOtFilters(otRecords, filters);
  const map = new Map<
    string,
    {
      hours: number;
      cost: number;
      days: Set<string>;
      last: string;
      statuses: Set<OtStatus>;
      department: string;
      siteId: string;
    }
  >();

  for (const r of filtered) {
    const cur = map.get(r.employeeId) ?? {
      hours: 0,
      cost: 0,
      days: new Set<string>(),
      last: r.date,
      statuses: new Set<OtStatus>(),
      department: r.department,
      siteId: r.siteId,
    };
    cur.hours += r.otHours;
    cur.cost += r.otCost;
    cur.days.add(r.date);
    if (r.date > cur.last) cur.last = r.date;
    cur.statuses.add(r.status);
    map.set(r.employeeId, cur);
  }

  return [...map.entries()]
    .map(([employeeId, v]) => {
      const emp = getEmployeeById(employeeId);
      const statusList = [...v.statuses];
      return {
        employeeId,
        employeeName: emp?.name ?? employeeId,
        siteId: v.siteId,
        siteName: getSiteById(v.siteId)?.name ?? "—",
        department: v.department,
        otDays: v.days.size,
        otHours: Math.round(v.hours * 100) / 100,
        otCost: Math.round(v.cost * 100) / 100,
        avgOtPerDay:
          v.days.size > 0
            ? Math.round((v.hours / v.days.size) * 100) / 100
            : 0,
        lastOtDate: v.last,
        otStatus: (statusList.length === 1 ? statusList[0] : "MIXED") as
          | OtStatus
          | "MIXED",
      };
    })
    .sort((a, b) => b.otHours - a.otHours);
}

export type SiteOtRow = {
  siteId: string;
  siteName: string;
  otEmployees: number;
  otDays: number;
  otHours: number;
  otCost: number;
  avgOtPerEmployee: number;
};

export function getSiteOtRows(filters: OtFilters): SiteOtRow[] {
  const filtered = applyOtFilters(otRecords, filters);
  const map = new Map<
    string,
    { hours: number; cost: number; employees: Set<string>; days: Set<string> }
  >();
  for (const r of filtered) {
    const cur = map.get(r.siteId) ?? {
      hours: 0,
      cost: 0,
      employees: new Set<string>(),
      days: new Set<string>(),
    };
    cur.hours += r.otHours;
    cur.cost += r.otCost;
    cur.employees.add(r.employeeId);
    cur.days.add(`${r.employeeId}|${r.date}`);
    map.set(r.siteId, cur);
  }

  return sites.map((site) => {
    const v = map.get(site.id) ?? {
      hours: 0,
      cost: 0,
      employees: new Set<string>(),
      days: new Set<string>(),
    };
    const otEmployees = v.employees.size;
    return {
      siteId: site.id,
      siteName: site.name,
      otEmployees,
      otDays: v.days.size,
      otHours: Math.round(v.hours * 100) / 100,
      otCost: Math.round(v.cost * 100) / 100,
      avgOtPerEmployee:
        otEmployees > 0
          ? Math.round((v.hours / otEmployees) * 100) / 100
          : 0,
    };
  });
}

export function getMonthlyTrend(filters: OtFilters) {
  const filtered = applyOtFilters(otRecords, filters);
  const map = new Map<string, { hours: number; cost: number }>();
  for (const r of filtered) {
    const key = r.date.slice(0, 7);
    const cur = map.get(key) ?? { hours: 0, cost: 0 };
    cur.hours += r.otHours;
    cur.cost += r.otCost;
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      otHours: Math.round(v.hours * 100) / 100,
      otCost: Math.round(v.cost * 100) / 100,
    }));
}

export function getYearlyTrend(filters: OtFilters) {
  const filtered = applyOtFilters(otRecords, filters);
  const map = new Map<number, { hours: number; cost: number }>();
  for (const r of filtered) {
    const y = Number(r.date.slice(0, 4));
    const cur = map.get(y) ?? { hours: 0, cost: 0 };
    cur.hours += r.otHours;
    cur.cost += r.otCost;
    map.set(y, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, v]) => ({
      year,
      otHours: Math.round(v.hours * 100) / 100,
      otCost: Math.round(v.cost * 100) / 100,
    }));
}

export function getDepartmentBreakdown(filters: OtFilters) {
  const filtered = applyOtFilters(otRecords, filters);
  const map = new Map<string, { hours: number; cost: number }>();
  for (const r of filtered) {
    const cur = map.get(r.department) ?? { hours: 0, cost: 0 };
    cur.hours += r.otHours;
    cur.cost += r.otCost;
    map.set(r.department, cur);
  }
  return [...map.entries()]
    .map(([department, v]) => ({
      department,
      otHours: Math.round(v.hours * 100) / 100,
      otCost: Math.round(v.cost * 100) / 100,
    }))
    .sort((a, b) => b.otHours - a.otHours);
}

export function getShiftBreakdown(filters: OtFilters) {
  const filtered = applyOtFilters(otRecords, filters);
  const map = new Map<string, number>();
  for (const r of filtered) {
    map.set(r.shiftId, (map.get(r.shiftId) ?? 0) + r.otHours);
  }
  return [...map.entries()]
    .map(([shiftId, hours]) => ({
      shiftId,
      shiftName: getShiftById(shiftId)?.name ?? shiftId,
      otHours: Math.round(hours * 100) / 100,
    }))
    .sort((a, b) => b.otHours - a.otHours);
}

export function getReasonBreakdown(filters: OtFilters) {
  const filtered = applyOtFilters(otRecords, filters);
  const total = sumHours(filtered) || 1;
  const map = new Map<string, { hours: number; cost: number }>();
  for (const r of filtered) {
    if (r.reason === "unrecorded") continue;
    const cur = map.get(r.reason) ?? { hours: 0, cost: 0 };
    cur.hours += r.otHours;
    cur.cost += r.otCost;
    map.set(r.reason, cur);
  }
  return [...map.entries()]
    .map(([reason, v]) => ({
      reason,
      otHours: Math.round(v.hours * 100) / 100,
      otCost: Math.round(v.cost * 100) / 100,
      pct: Math.round((v.hours / total) * 1000) / 10,
    }))
    .sort((a, b) => b.otHours - a.otHours);
}

export function getStatusBreakdown(filters: OtFilters) {
  const filtered = applyOtFilters(otRecords, filters);
  const map = new Map<OtStatus, { count: number; hours: number; cost: number }>();
  for (const r of filtered) {
    const cur = map.get(r.status) ?? { count: 0, hours: 0, cost: 0 };
    cur.count += 1;
    cur.hours += r.otHours;
    cur.cost += r.otCost;
    map.set(r.status, cur);
  }
  return [...map.entries()].map(([status, v]) => ({
    status,
    count: v.count,
    otHours: Math.round(v.hours * 100) / 100,
    otCost: Math.round(v.cost * 100) / 100,
  }));
}

export function getHeatmapMonthSite(filters: OtFilters) {
  const filtered = applyOtFilters(otRecords, filters);
  const months = [...new Set(filtered.map((r) => r.date.slice(0, 7)))].sort();
  const siteIds = sites.map((s) => s.id);
  const cells: { month: string; siteId: string; siteName: string; hours: number }[] =
    [];
  for (const month of months) {
    for (const siteId of siteIds) {
      const hours = filtered
        .filter((r) => r.date.startsWith(month) && r.siteId === siteId)
        .reduce((s, r) => s + r.otHours, 0);
      cells.push({
        month,
        siteId,
        siteName: getSiteById(siteId)?.name ?? siteId,
        hours: Math.round(hours * 100) / 100,
      });
    }
  }
  return { months, siteIds, cells };
}

export function getEmployeeOtDetail(employeeId: string, filters: OtFilters) {
  const emp = getEmployeeById(employeeId);
  if (!emp) return null;
  const allEmp = otRecords.filter((r) => r.employeeId === employeeId);
  const filtered = applyOtFilters(allEmp, filters);
  const now = new Date();
  const cy = now.getUTCFullYear();
  const cm = now.getUTCMonth() + 1;
  const prevM = cm === 1 ? 12 : cm - 1;
  const prevY = cm === 1 ? cy - 1 : cy;

  const monthRecs = allEmp.filter((r) => inMonth(r.date, cy, cm));
  const yearRecs = allEmp.filter((r) => Number(r.date.slice(0, 4)) === cy);
  const prevMonthRecs = allEmp.filter((r) => inMonth(r.date, prevY, prevM));
  const prevYearRecs = allEmp.filter(
    (r) => Number(r.date.slice(0, 4)) === cy - 1,
  );

  const siteFiltered = applyOtFilters(otRecords, {
    ...filters,
    siteId: emp.siteId,
    employeeId: undefined,
  });
  const siteHours = sumHours(siteFiltered);
  const empHours = sumHours(filtered);

  return {
    employee: emp,
    site: getSiteById(emp.siteId),
    shift: getShiftById(emp.shiftId),
    records: filtered.sort((a, b) => b.date.localeCompare(a.date)),
    summary: {
      currentMonthHours: sumHours(monthRecs),
      currentMonthDays: otDaysCount(monthRecs),
      currentMonthCost: sumCost(monthRecs),
      currentYearHours: sumHours(yearRecs),
      currentYearDays: otDaysCount(yearRecs),
      currentYearCost: sumCost(yearRecs),
      previousMonthHours: sumHours(prevMonthRecs),
      previousYearHours: sumHours(prevYearRecs),
    },
    monthlyTrend: getMonthlyTrend({ employeeId }),
    siteSharePct:
      siteHours > 0 ? Math.round((empHours / siteHours) * 1000) / 10 : 0,
  };
}

export function getSiteOtDetail(siteId: string, filters: OtFilters) {
  const site = getSiteById(siteId);
  if (!site) return null;
  const scoped = applyOtFilters(otRecords, { ...filters, siteId });
  return {
    site,
    summary: {
      totalEmployees: employees.filter((e) => e.siteId === siteId).length,
      otEmployees: uniqueEmployees(scoped),
      otHours: sumHours(scoped),
      otDays: otDaysCount(scoped),
      otCost: sumCost(scoped),
      avgOtPerEmployee:
        uniqueEmployees(scoped) > 0
          ? Math.round(
              (sumHours(scoped) / uniqueEmployees(scoped)) * 100,
            ) / 100
          : 0,
    },
    employees: getEmployeeOtRows({ ...filters, siteId }),
    departments: getDepartmentBreakdown({ ...filters, siteId }),
    shifts: getShiftBreakdown({ ...filters, siteId }),
    monthlyTrend: getMonthlyTrend({ ...filters, siteId }),
  };
}

export function buildInsights(filters: OtFilters): OtInsight[] {
  const insights: OtInsight[] = [];
  const rules = defaultOtRules;
  const rows = getEmployeeOtRows(filters);
  const siteRows = getSiteOtRows(filters);
  const shiftShare = getShiftBreakdown(filters);
  const totalHours = sumHours(applyOtFilters(otRecords, filters)) || 1;

  for (const row of rows) {
    if (row.otHours >= rules.highOtHoursThreshold) {
      const siteAvg =
        siteRows.find((s) => s.siteId === row.siteId)?.avgOtPerEmployee ?? 0;
      insights.push({
        id: `high-${row.employeeId}`,
        kind: "high_ot",
        severity: "attention",
        title: "High OT",
        employeeId: row.employeeId,
        siteId: row.siteId,
        message: `${row.employeeName} has accumulated ${row.otHours} OT hours in the selected period${
          siteAvg > 0 && row.otHours > siteAvg
            ? `, above the site average of ${siteAvg} hrs`
            : ""
        }.`,
      });
    }
    if (row.otDays >= rules.repeatedOtDaysThreshold) {
      insights.push({
        id: `rep-${row.employeeId}`,
        kind: "repeated_ot",
        severity: "watch",
        title: "Repeated OT",
        employeeId: row.employeeId,
        siteId: row.siteId,
        message: `${row.employeeName} performed OT on ${row.otDays} different days during the selected period.`,
      });
    }
  }

  for (const row of rows.slice(0, 8)) {
    const detail = getEmployeeOtDetail(row.employeeId, filters);
    if (!detail) continue;
    if (detail.siteSharePct >= rules.concentrationShareThreshold * 100) {
      insights.push({
        id: `conc-${row.employeeId}`,
        kind: "ot_concentration",
        severity: "watch",
        title: "OT Concentration",
        employeeId: row.employeeId,
        siteId: row.siteId,
        message: `${row.employeeName} contributes ${detail.siteSharePct}% of the site's total OT hours.`,
      });
    }
    if (
      detail.summary.currentMonthHours > detail.summary.previousMonthHours &&
      detail.summary.previousMonthHours > 0
    ) {
      insights.push({
        id: `inc-${row.employeeId}`,
        kind: "increasing_ot",
        severity: "info",
        title: "Increasing OT",
        employeeId: row.employeeId,
        siteId: row.siteId,
        message: `${row.employeeName}'s OT increased versus the previous month (${detail.summary.previousMonthHours} → ${detail.summary.currentMonthHours} hrs).`,
      });
    }
  }

  if (shiftShare.length) {
    const top = shiftShare[0];
    const pct = Math.round((top.otHours / totalHours) * 1000) / 10;
    if (pct >= 30) {
      insights.push({
        id: `shift-${top.shiftId}`,
        kind: "shift_pattern",
        severity: "info",
        title: "OT After Specific Shift",
        message: `${top.shiftName} accounts for ${pct}% of OT hours in the selected period.`,
      });
    }
  }

  for (const site of siteRows) {
    if (site.otHours >= rules.highOtSiteHoursThreshold) {
      insights.push({
        id: `site-high-${site.siteId}`,
        kind: "high_ot",
        severity: "attention",
        title: "High OT Site",
        siteId: site.siteId,
        message: `${site.siteName} is above the configured site OT threshold with ${site.otHours} hours.`,
      });
    }
    const siteEmp = rows.filter((r) => r.siteId === site.siteId);
    if (siteEmp.length >= 2) {
      const top2 = siteEmp.slice(0, 2).reduce((s, r) => s + r.otHours, 0);
      const share = site.otHours > 0 ? top2 / site.otHours : 0;
      if (share >= 0.55) {
        insights.push({
          id: `dep-${site.siteId}`,
          kind: "site_dependency",
          severity: "watch",
          title: "Site Dependency",
          siteId: site.siteId,
          message: `${site.siteName} repeatedly relies on a small set of employees for OT (${Math.round(share * 100)}% from top 2).`,
        });
      }
    }
  }

  // Absenteeism-linked pattern (correlation language only)
  for (const site of siteRows.slice(0, 4)) {
    const abs = applyOtFilters(otRecords, {
      ...filters,
      siteId: site.siteId,
    }).filter(
      (r) => r.reason === "employee_absence" || r.reason === "shift_gap",
    );
    const absHours = sumHours(abs);
    if (absHours > 0 && site.otHours > 0 && absHours / site.otHours >= 0.25) {
      insights.push({
        id: `abs-${site.siteId}`,
        kind: "absenteeism_pattern",
        severity: "info",
        title: "OT vs Workforce Pattern",
        siteId: site.siteId,
        message: `${site.siteName} shows elevated OT linked to absence/shift-gap reasons (${Math.round((absHours / site.otHours) * 100)}% of site OT hours). This is a correlation, not proven causation.`,
      });
    }
  }

  return insights.slice(0, 24);
}

export function getEmployeeInsights(
  employeeId: string,
  filters: OtFilters,
): OtInsight[] {
  return buildInsights(filters).filter((i) => i.employeeId === employeeId);
}

export function defaultOtFilters(): OtFilters {
  return {
    dateFrom: "2026-01-01",
    dateTo: "2026-09-20",
  };
}
