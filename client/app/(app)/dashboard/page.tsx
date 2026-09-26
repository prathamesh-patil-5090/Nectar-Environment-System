"use client";

import Link from "next/link";
import { Descriptions, Tag } from "antd";
import KpiStat from "@/components/KpiStat";
import SkillHeatmap from "@/components/SkillHeatmap";
import UrgentTrainingList from "@/components/UrgentTrainingList";
import SiteReadiness from "@/components/SiteReadiness";
import { getSession } from "@/lib/auth";
import {
  getDashboardKpis,
  getEmployeeById,
  getSiteById,
  getSiteName,
} from "@/lib/mock-data";
import { getCertificatesForEmployee } from "@/lib/certificates";
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

function dashboardSubtitle(
  role: ReturnType<typeof normalizeRole>,
  siteScope?: string,
) {
  if (role === "admin") {
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
    return "Your personal workforce dashboard.";
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

  const personal = empId
    ? {
        salary: getSalaryHistory(empId)[0],
        certs: getCertificatesForEmployee(empId),
        otOpen: getOtAssignments({ employeeId: empId }).filter(
          (a) => a.status === "assigned" || a.status === "acknowledged",
        ).length,
        unread: getUnreadCount(empId),
      }
    : null;

  const subtitle = dashboardSubtitle(role, siteScope);

  const isEmployeeView = role === "employee" && employee;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p
          style={{
            margin: 0,
            color: nectarColors.muted,
            fontSize: 14,
          }}
        >
          {subtitle}
          {session ? (
            <span style={{ marginLeft: 8, opacity: 0.8 }}>
              · Signed in as {roleLabel(session.role)}
            </span>
          ) : null}
        </p>
      </div>

      {employee && (isEmployeeView || reporting) ? (
        <div
          style={{
            background: nectarColors.white,
            padding: 20,
            borderRadius: 10,
            border: "1px solid rgba(15,42,36,0.08)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: 20,
              color: nectarColors.ink,
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
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            title="Appointed under / reporting structure"
          >
            <Descriptions.Item label="Manager">
              {reporting?.manager?.name ?? (
                <span style={{ color: nectarColors.muted }}>You are plant manager</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Shift In-Charge">
              {reporting?.sic?.name ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Supervisor">
              {reporting?.supervisor?.name ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Category">
              <Tag>{employee.employeeCategory.replace(/_/g, " ")}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Shift">
              {employee.shiftId.replace("sh-", "")}
            </Descriptions.Item>
            <Descriptions.Item label="Employment">
              {employee.employmentStatus} · {employee.employeeType}
            </Descriptions.Item>
          </Descriptions>
          {isEmployeeView && personal ? (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                fontSize: 13,
              }}
            >
              <Link href="/notifications" style={{ color: nectarColors.leaf }}>
                {personal.unread} unread notification
                {personal.unread === 1 ? "" : "s"}
              </Link>
              <span style={{ color: nectarColors.muted }}>·</span>
              <Link href="/notifications" style={{ color: nectarColors.leaf }}>
                {personal.otOpen} open OT assignment
                {personal.otOpen === 1 ? "" : "s"}
              </Link>
              <span style={{ color: nectarColors.muted }}>·</span>
              <Link href="/salary" style={{ color: nectarColors.leaf }}>
                {personal.salary
                  ? `Salary ${salaryMonthLabel(personal.salary.salaryMonth)} ${formatInrAmount(personal.salary.amount)}`
                  : "Salary history"}
              </Link>
              <span style={{ color: nectarColors.muted }}>·</span>
              <Link href="/certifications" style={{ color: nectarColors.leaf }}>
                {personal.certs.length} certificate
                {personal.certs.length === 1 ? "" : "s"}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isEmployeeView ? (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              background: "rgba(15,42,36,0.06)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <KpiStat
              label="Total employees"
              value={kpis.totalEmployees}
              hint={siteScope ? "Plant roster" : "All plants"}
            />
            <KpiStat
              label="Active sites"
              value={kpis.activeSites}
              hint="ETP · RO · MEE"
              tone="info"
            />
            <KpiStat
              label="Skill coverage"
              value={`${kpis.skillCoverage}%`}
              hint="Avg mapped vs required"
              tone="positive"
            />
            <KpiStat
              label="Urgent training"
              value={kpis.urgentTraining}
              hint="Overdue or critical"
              tone="alert"
            />
            <KpiStat
              label="Compliance-ready sites"
              value={`${kpis.complianceReadySites}/${kpis.activeSites}`}
              hint="Readiness ≥ 80%"
              tone="positive"
            />
          </div>

          <div className="nectar-dash-grid">
            <SkillHeatmap />
            <UrgentTrainingList />
          </div>

          <SiteReadiness />
        </>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          <div
            style={{
              background: nectarColors.white,
              padding: 20,
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-fraunces), Georgia, serif",
                fontSize: 18,
                marginBottom: 8,
              }}
            >
              Quick links
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
              <li>
                <Link href={`/employees/${employee!.id}`}>My profile</Link>
              </li>
              <li>
                <Link href="/leave/requests">My leave</Link>
              </li>
              <li>
                <Link href="/salary">Salary history</Link>
              </li>
              <li>
                <Link href="/certifications">Certifications</Link>
              </li>
              <li>
                <Link href="/notifications">Notifications & OT</Link>
              </li>
              <li>
                <Link href="/training">Training</Link>
              </li>
            </ul>
          </div>
          <div
            style={{
              background: nectarColors.white,
              padding: 20,
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-fraunces), Georgia, serif",
                fontSize: 18,
                marginBottom: 8,
              }}
            >
              Latest salary
            </div>
            {personal?.salary ? (
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Month">
                  {salaryMonthLabel(personal.salary.salaryMonth)}
                </Descriptions.Item>
                <Descriptions.Item label="Amount">
                  {formatInrAmount(personal.salary.amount)}
                </Descriptions.Item>
                <Descriptions.Item label="Paid">
                  {personal.salary.paymentDate} · {personal.salary.paymentTime}
                </Descriptions.Item>
                <Descriptions.Item label="Bank">
                  {personal.salary.bankName} · ****
                  {personal.salary.accountLast4} · {personal.salary.paymentMode}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <p style={{ color: nectarColors.muted }}>No salary records.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
