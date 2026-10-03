"use client";

import Link from "next/link";
import { Descriptions, Tag } from "antd";
import KpiStat from "@/components/KpiStat";
import SkillHeatmap from "@/components/SkillHeatmap";
import UrgentTrainingList from "@/components/UrgentTrainingList";
import SiteReadiness from "@/components/SiteReadiness";
import SafetySummaryPanel from "@/components/safety/SafetySummaryPanel";
import { getSession } from "@/lib/auth";
import {
  getDashboardKpis,
  getEmployeeById,
  getSiteById,
  getSiteName,
} from "@/lib/mock-data";
import {
  formatInrAmount,
  getSalaryHistory,
  salaryMonthLabel,
} from "@/lib/salary";
import { getUnreadCount } from "@/lib/notifications";
import { getOtAssignments } from "@/lib/overtime";
import {
  normalizeRole,
  roleLabel,
  scopedSiteId,
  selfEmployeeId,
} from "@/lib/rbac";
import {
  countComplianceReadySites,
  getSkillCoveragePct,
} from "@/lib/workforce-metrics";
import { nectarColors } from "@/lib/theme";

import EmployeeDashboardView from "@/components/dashboard/EmployeeDashboardView";
import { rowWrapGap1BgR8, sWhitePadR10Border } from "@/lib/styles";

function dashboardSubtitle(
  role: ReturnType<typeof normalizeRole>,
  siteScope?: string,
) {
  if (role === "director") {
    return "Organization-wide workforce posture across ETP, RO and MEE plants.";
  }
  if (role === "manager" && siteScope) {
    return `${getSiteName(siteScope)} — plant management dashboard.`;
  }
  if (role === "shift_incharge" && siteScope) {
    return `${getSiteName(siteScope)} — shift coordination & deployment.`;
  }
  if (role === "supervisor" && siteScope) {
    return `${getSiteName(siteScope)} — team & plant day-to-day view.`;
  }
  if (role === "employee") {
    return "Your personal workforce console & shift overview.";
  }
  return "O&M workforce posture across active treatment plants.";
}

export default function DashboardPage() {
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const baseKpis = getDashboardKpis(siteScope);
  const kpis = {
    ...baseKpis,
    skillCoverage: getSkillCoveragePct(siteScope),
    complianceReadySites: countComplianceReadySites(siteScope),
  };
  const role = normalizeRole(session?.role);
  const empId = selfEmployeeId(session);
  const employee = empId ? getEmployeeById(empId) : undefined;
  const site = employee ? getSiteById(employee.siteId) : undefined;

  const reporting = employee
    ? {
        manager: employee.managerId
          ? getEmployeeById(employee.managerId)
          : undefined,
        sic: employee.shiftInChargeId
          ? getEmployeeById(employee.shiftInChargeId)
          : undefined,
        supervisor: employee.supervisorId
          ? getEmployeeById(employee.supervisorId)
          : undefined,
      }
    : null;

  const subtitle = dashboardSubtitle(role, siteScope);
  const isEmployeeView = role === "employee" && employee;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
          {subtitle}
          {session ? (
            <span style={{ marginLeft: 8, opacity: 0.8 }}>· Signed in as {roleLabel(session.role)}</span>
          ) : null}
        </p>
      </div>

      {isEmployeeView ? (
        <EmployeeDashboardView employee={employee} site={site} reporting={reporting} />
      ) : (
        <>
          {employee && reporting ? (
            <div style={sWhitePadR10Border}>
              <div
                style={{
                  fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 20, color: nectarColors.ink,
                  marginBottom: 4,
                }}
              >
                {employee.name}
              </div>
              <p style={{ margin: "0 0 14px", color: nectarColors.muted, fontSize: 13 }}>
                {employee.designation}
                {site ? ` · ${site.name} (${site.plantType})` : null}
                {" · "}
                {employee.department}
              </p>
              <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} title="Appointed under / reporting structure">
                <Descriptions.Item label="Manager">
                  {reporting?.manager?.name ?? (
                    <span style={{ color: nectarColors.muted }}>You are plant manager</span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Shift In-Charge">{reporting?.sic?.name ?? "—"}</Descriptions.Item>
                <Descriptions.Item label="Supervisor">{reporting?.supervisor?.name ?? "—"}</Descriptions.Item>
                <Descriptions.Item label="Category"><Tag>{employee.employeeCategory.replace(/_/g, " ")}</Tag></Descriptions.Item>
                <Descriptions.Item label="Shift">{employee.shiftId.replace("sh-", "")}</Descriptions.Item>
                <Descriptions.Item label="Employment">{employee.employmentStatus} · {employee.employeeType}</Descriptions.Item>
              </Descriptions>
            </div>
          ) : null}

          <div style={rowWrapGap1BgR8}>
            <KpiStat
              label="Total employees"
              value={kpis.totalEmployees}
              hint={siteScope ? "Plant roster" : "All plants"}
            />
            <KpiStat label="Active sites" value={kpis.activeSites} hint="ETP · RO · MEE" tone="info" />
            <KpiStat
              label="Skill coverage"
              value={`${kpis.skillCoverage}%`}
              hint="Avg mapped vs required"
              tone="positive"
            />
            <KpiStat label="Urgent training" value={kpis.urgentTraining} hint="Overdue or critical" tone="alert" />
            <KpiStat
              label="Compliance-ready sites"
              value={`${kpis.complianceReadySites}/${kpis.activeSites}`}
              hint="Readiness ≥ 80%"
              tone="positive"
            />
          </div>

          <SafetySummaryPanel siteId={siteScope} />

          <div className="nectar-dash-grid">
            <SkillHeatmap />
            <UrgentTrainingList />
          </div>

          <SiteReadiness />
        </>
      )}
    </div>
  );
}
