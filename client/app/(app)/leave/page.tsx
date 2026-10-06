"use client";

import Link from "next/link";
import { Button, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import KpiStat from "@/components/KpiStat";
import { getSession } from "@/lib/auth";
import {
  getLeaveKpis,
  getLeaveRequests,
  getPendingJustifications,
  LEAVE_STATUS_LABELS,
  type LeaveStatus,
} from "@/lib/leave";
import {
  canViewLeavePending,
  isElevated,
  scopedEmployeeId,
  scopedSiteId,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { rowWrapGap1BgR8, sSerifText22Ink, sWhitePadR12BorderShadow } from "@/lib/styles";
import Panel from "@/components/Panel";
import { translatePersonName, useT, trData } from "@/lib/i18n";

const STATUS_COLOR: Partial<Record<LeaveStatus, string>> = {
  REQUESTED: nectarColors.sky,
  PENDING_EMPLOYEE_CONSENT: "#D97706",
  SUPERVISOR_VERIFIED: nectarColors.leaf,
  SUPERVISOR_RECORDED: nectarColors.leaf,
  SITE_APPROVED: nectarColors.mint,
  SITE_VERIFIED: nectarColors.mint,
  MANAGER_APPROVED: nectarColors.leaf,
  HR_VALIDATED: nectarColors.leaf,
  APPROVED: nectarColors.mint,
  PENDING_INFORMATION: "#D97706",
  UNEXPLAINED_ABSENCE: nectarColors.alert,
  EXTENSION_REQUIRED: nectarColors.alert,
  CLOSED: nectarColors.muted,
  REJECTED: nectarColors.alert,
};

export default function LeaveOverviewPage() {
  const t = useT();
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const empScope = scopedEmployeeId(session);
  const kpis = getLeaveKpis(empScope ? undefined : siteScope, empScope);
  const recent = getLeaveRequests(
    empScope ? undefined : siteScope,
    empScope,
  ).slice(0, 6);
  const pending = empScope
    ? []
    : getPendingJustifications().filter((l) =>
        siteScope ? l.siteId === siteScope : true,
      );

  const showMgmt = isElevated(session) && !empScope;
  const showPending = canViewLeavePending(session) && !empScope;
  const isSelf = Boolean(empScope);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={sWhitePadR12BorderShadow}>
        <div style={sSerifText22Ink}>{t("leaveUi.title")}</div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted, maxWidth: 720 }}>
          {isSelf ? t("leaveUi.selfSubtitle") : t("leaveUi.mgmtSubtitle")}
        </p>
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/leave/requests">
            <Button type="primary" icon={<PlusOutlined />}>
              {isSelf ? t("leaveUi.requestLeave") : t("leaveUi.newLeave")}
            </Button>
          </Link>
        </div>
      </div>

      <div style={rowWrapGap1BgR8}>
        {isSelf ? (
          <>
            <KpiStat label={t("leaveUi.myRequests")} value={kpis.totalRequests} hint={t("leaveUi.allStatuses")} />
            <KpiStat label={t("leaveUi.pending")} value={kpis.pendingRequests} tone="info" />
            <KpiStat label={t("leaveUi.approved")} value={kpis.approvedCount} tone="positive" />
            <KpiStat label={t("leaveUi.rejected")} value={kpis.rejectedCount} tone="alert" />
          </>
        ) : showMgmt ? (
          <>
            <KpiStat label={t("leaveUi.totalEmployees")} value={kpis.totalEmployees} />
            <KpiStat label={t("leaveUi.currentlyOnLeave")} value={kpis.currentlyOnLeave} tone="info" />
            <KpiStat label={t("leaveUi.unexplainedAbsence")} value={kpis.leaveWithoutInformation} tone="alert" />
            <KpiStat label={t("leaveUi.criticalShortages")} value={kpis.criticalSiteShortages} tone="alert" />
            <KpiStat label={t("leaveUi.leaveOtRisk")} value={kpis.leaveOtRisk} tone="alert" />
            <KpiStat label={t("leaveUi.longLeave")} value={kpis.longLeaveCases} tone="info" />
          </>
        ) : showPending ? (
          <>
            <KpiStat label={t("leaveUi.pendingRequests")} value={kpis.pendingRequests} tone="info" />
            <KpiStat label={t("leaveUi.unverifiedAbsences")} value={kpis.unverifiedAbsences} tone="alert" />
            <KpiStat label={t("leaveUi.employeesOnLeave")} value={kpis.currentlyOnLeave} />
            <KpiStat label={t("leaveUi.leaveWithoutInfo")} value={kpis.leaveWithoutInformation} tone="alert" />
            <KpiStat label={t("leaveUi.overdueClosure")} value={kpis.overdueLeaveClosure} tone="alert" />
            <KpiStat label={t("leaveUi.leaveOtRisk")} value={kpis.leaveOtRisk} hint={t("leaveUi.needsReplacement")} />
          </>
        ) : (
          <>
            <KpiStat label={t("leaveUi.pendingAtSite")} value={kpis.pendingRequests} tone="info" />
            <KpiStat label={t("leaveUi.onLeaveToday")} value={kpis.currentlyOnLeave} />
            <KpiStat label={t("leaveUi.otRiskCases")} value={kpis.leaveOtRisk} tone="alert" />
            <KpiStat label={t("leaveUi.needsReturn")} value={kpis.overdueLeaveClosure} tone="alert" />
          </>
        )}
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: isSelf ? "1fr" : "1.2fr 1fr", gap: 16 }}
        className="nectar-ot-two"
      >
        <Panel title={isSelf ? t("leaveUi.myRecent") : t("leaveUi.recentActivity")}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {recent.length === 0 ? (
              <li style={{ color: nectarColors.muted, fontSize: 13 }}>{t("leaveUi.noRequests")}</li>
            ) : null}
            {recent.map((l) => (
              <li key={l.id} style={{ padding: "12px 0", borderBottom: `1px solid ${nectarColors.sand}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/leave/requests/${l.id}`} style={{ fontWeight: 600, color: nectarColors.leaf }}>
                    {isSelf
                      ? `${l.startDate} → ${l.endDate}`
                      : translatePersonName(l.employeeName)}
                  </Link>
                  <Tag color={STATUS_COLOR[l.status] ?? nectarColors.muted} style={{ border: "none", margin: 0 }}>
                    {LEAVE_STATUS_LABELS[l.status]}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: nectarColors.muted }}>
                  {isSelf ? null : (
                    <>
                      {l.startDate} → {l.endDate} ·{" "}
                    </>
                  )}
                  {trData(l.mode)} ·{" "}
                  {l.entrySource === "supervisor_on_behalf"
                    ? t("leaveUi.enteredBySupervisor", { name: l.enteredByName ?? "" })
                    : t("leaveUi.requestedByEmployee")}
                  {l.rejectionReason ? ` · ${l.rejectionReason}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {isSelf ? null : (
        <Panel title={t("leaveUi.hierarchy")}>
          <ol style={{ margin: 0, paddingLeft: 18, color: nectarColors.ink, fontSize: 13, lineHeight: 1.7 }}>
            <li>{t("leaveUi.h1")}</li>
            <li>{t("leaveUi.h2")}</li>
            <li>{t("leaveUi.h3")}</li>
            <li>{t("leaveUi.h4")}</li>
          </ol>
          {pending.length ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{t("leaveUi.needsAttention")}</div>
              {pending.slice(0, 3).map((p) => (
                <div key={p.id} style={{ fontSize: 12, marginBottom: 6 }}>
                  <Link href={`/leave/requests/${p.id}`}>{translatePersonName(p.employeeName)}</Link>{" "}
                  — {LEAVE_STATUS_LABELS[p.status]}
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
        )}
      </div>
    </div>
  );
}
