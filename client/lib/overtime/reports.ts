import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getEmployeeById, getSiteById } from "@/lib/mock-data";
import {
  applyOtFilters,
  getEmployeeOtRows,
  getMonthlyTrend,
  getOverviewKpis,
  getSiteOtRows,
  buildInsights,
  getReasonBreakdown,
  getStatusBreakdown,
} from "./aggregations";
import { otRecords } from "./mock-data";
import { downloadBlob, formatInr, toCsv } from "./format";
import { OT_REASON_LABELS, OT_STATUS_LABELS, type OtFilters } from "./types";
import { getShiftById } from "./mock-data";

function periodSlug(filters: OtFilters): string {
  if (filters.year && filters.month) {
    const names = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${names[filters.month - 1]}_${filters.year}`;
  }
  if (filters.year) return String(filters.year);
  if (filters.dateFrom && filters.dateTo)
    return `${filters.dateFrom}_to_${filters.dateTo}`;
  return "All";
}

function siteSlug(filters: OtFilters): string {
  if (!filters.siteId) return "";
  const name = getSiteById(filters.siteId)?.name ?? filters.siteId;
  return name.replace(/\s+/g, "_");
}

export type ReportKind =
  | "employee"
  | "site"
  | "monthly"
  | "yearly"
  | "management";

export type ReportFormat = "csv" | "xlsx" | "pdf";

function employeeReportRows(filters: OtFilters) {
  return applyOtFilters(otRecords, filters).map((r) => {
    const emp = getEmployeeById(r.employeeId);
    return {
      "Employee ID": r.employeeId,
      "Employee Name": emp?.name ?? "",
      Site: getSiteById(r.siteId)?.name ?? "",
      Department: r.department,
      "OT Date": r.date,
      Shift: getShiftById(r.shiftId)?.name ?? "",
      "Scheduled Hours": r.scheduledHours,
      "Actual Hours": r.actualHours,
      "OT Hours": r.otHours,
      "OT Rate": r.otRate,
      "OT Cost": r.otCost,
      "OT Status": OT_STATUS_LABELS[r.status],
      "OT Reason": OT_REASON_LABELS[r.reason],
    };
  });
}

function siteReportRows(filters: OtFilters) {
  return getSiteOtRows(filters).map((r) => ({
    Site: r.siteName,
    "OT Employees": r.otEmployees,
    "OT Days": r.otDays,
    "OT Hours": r.otHours,
    "OT Cost": r.otCost,
    "Average OT": r.avgOtPerEmployee,
  }));
}

function monthlyReportRows(filters: OtFilters) {
  const trend = getMonthlyTrend(filters);
  return trend.map((m) => {
    const monthFilters: OtFilters = {
      ...filters,
      dateFrom: `${m.month}-01`,
      dateTo: `${m.month}-31`,
      year: undefined,
      month: undefined,
    };
    const kpis = getOverviewKpis(monthFilters);
    return {
      Month: m.month,
      "OT Employees": kpis.totalOtEmployees,
      "OT Days": kpis.totalOtDays,
      "OT Hours": m.otHours,
      "OT Cost": m.otCost,
      "Approved OT": kpis.statusBreakdown.APPROVED,
      "Pending OT": kpis.statusBreakdown.PENDING,
      "Rejected OT": kpis.statusBreakdown.REJECTED,
    };
  });
}

function yearlyReportRows(filters: OtFilters) {
  return getMonthlyTrend({
    ...filters,
    year: filters.year,
    dateFrom: undefined,
    dateTo: undefined,
    month: undefined,
  }).map((m) => ({
    Month: m.month,
    "OT Hours": m.otHours,
    "OT Cost": m.otCost,
  }));
}

function managementRows(filters: OtFilters) {
  const kpis = getOverviewKpis(filters);
  const sites = getSiteOtRows(filters);
  const employees = getEmployeeOtRows(filters).slice(0, 15);
  const reasons = getReasonBreakdown(filters);
  const statuses = getStatusBreakdown(filters);
  const insights = buildInsights(filters);

  return {
    summary: [
      {
        Metric: "Total OT Hours",
        Value: kpis.totalOtHours,
      },
      {
        Metric: "Total OT Cost",
        Value: kpis.totalOtCost,
      },
      {
        Metric: "OT Employees",
        Value: kpis.totalOtEmployees,
      },
      {
        Metric: "OT Days",
        Value: kpis.totalOtDays,
      },
      {
        Metric: "Highest OT Site",
        Value: kpis.highestSite
          ? `${kpis.highestSite.name} (${kpis.highestSite.otHours} hrs)`
          : "—",
      },
      {
        Metric: "Highest OT Employee",
        Value: kpis.highestEmployee
          ? `${kpis.highestEmployee.name} (${kpis.highestEmployee.otHours} hrs)`
          : "—",
      },
    ],
    sites,
    employees,
    reasons,
    statuses,
    insights: insights.map((i) => ({
      Title: i.title,
      Message: i.message,
      Severity: i.severity,
    })),
  };
}

function filename(kind: ReportKind, filters: OtFilters, format: ReportFormat) {
  const site = siteSlug(filters);
  const period = periodSlug(filters);
  const base =
    kind === "employee"
      ? `OT_Employee_Report_${period}`
      : kind === "site"
        ? `OT_Report${site ? `_Site_${site}` : ""}_${period}`
        : kind === "monthly"
          ? `OT_Monthly_Report_${period}`
          : kind === "yearly"
            ? `OT_Yearly_Report_${period}`
            : `OT_Management_Report_${period}`;
  return `${base}.${format === "xlsx" ? "xlsx" : format}`;
}

function exportCsv(name: string, rows: Record<string, unknown>[]) {
  downloadBlob(
    name,
    new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
}

function exportXlsx(
  name: string,
  sheets: { name: string; rows: Record<string, unknown>[] }[],
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    name,
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}

function exportPdf(
  name: string,
  title: string,
  rows: Record<string, unknown>[],
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toISOString().slice(0, 10)}`, 14, 22);
  if (!rows.length) {
    doc.text("No rows for selected filters.", 14, 32);
  } else {
    const headers = Object.keys(rows[0]);
    autoTable(doc, {
      startY: 28,
      head: [headers],
      body: rows.map((r) => headers.map((h) => String(r[h] ?? ""))),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [28, 68, 99] },
    });
  }
  doc.save(name);
}

export function downloadOtReport(
  kind: ReportKind,
  format: ReportFormat,
  filters: OtFilters,
) {
  const name = filename(kind, filters, format);

  if (kind === "management") {
    const data = managementRows(filters);
    if (format === "csv") {
      exportCsv(name, data.summary as unknown as Record<string, unknown>[]);
      return;
    }
    if (format === "xlsx") {
      exportXlsx(name, [
        { name: "Summary", rows: data.summary as unknown as Record<string, unknown>[] },
        {
          name: "Sites",
          rows: data.sites.map((s) => ({
            Site: s.siteName,
            "OT Hours": s.otHours,
            "OT Cost": s.otCost,
            "OT Employees": s.otEmployees,
          })),
        },
        {
          name: "Top Employees",
          rows: data.employees.map((e) => ({
            Employee: e.employeeName,
            Site: e.siteName,
            "OT Hours": e.otHours,
            "OT Cost": e.otCost,
          })),
        },
        {
          name: "Reasons",
          rows: data.reasons.map((r) => ({
            Reason: OT_REASON_LABELS[r.reason as keyof typeof OT_REASON_LABELS] ?? r.reason,
            Hours: r.otHours,
            Cost: r.otCost,
            "%": r.pct,
          })),
        },
        {
          name: "Insights",
          rows: data.insights,
        },
      ]);
      return;
    }
    const pdfRows = [
      ...data.summary,
      {
        Metric: "Note",
        Value: `Total cost ${formatInr(getOverviewKpis(filters).totalOtCost)}`,
      },
    ];
    exportPdf(name, "OT Management Analysis", pdfRows as unknown as Record<string, unknown>[]);
    return;
  }

  const rows =
    kind === "employee"
      ? employeeReportRows(filters)
      : kind === "site"
        ? siteReportRows(filters)
        : kind === "monthly"
          ? monthlyReportRows(filters)
          : yearlyReportRows(filters);

  if (format === "csv") exportCsv(name, rows);
  else if (format === "xlsx") exportXlsx(name, [{ name: "OT Report", rows }]);
  else
    exportPdf(
      name,
      kind === "employee"
        ? "Employee OT Report"
        : kind === "site"
          ? "Site OT Report"
          : kind === "monthly"
            ? "Monthly OT Report"
            : "Yearly OT Report",
      rows,
    );
}
