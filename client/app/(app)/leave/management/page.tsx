"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Empty, Table, Tag } from "antd";
import KpiStat from "@/components/KpiStat";
import { getSession } from "@/lib/auth";
import { getSiteName, sites } from "@/lib/mock-data";
import {
  getLeaveKpis,
  getLeaveRequests,
  LEAVE_STATUS_LABELS,
} from "@/lib/leave";
import { canViewLeaveManagement, scopedSiteId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { rowWrapGap1BgR8, sSerifText18Mb12, sSerifText22Ink, sWhitePadR10 } from "@/lib/styles";
import { tr, trNode, intlLocale, trCell, trData } from "@/lib/i18n";

export default function LeaveManagementPage() {
  const router = useRouter();
  const session = getSession();
  const allowed = canViewLeaveManagement(session);
  const siteScope = scopedSiteId(session);

  useEffect(() => {
    if (!allowed) router.replace("/leave");
  }, [allowed, router]);

  if (!allowed) {
    return <Empty description={tr("Not available for your role")} />;
  }

  const kpis = getLeaveKpis(siteScope);
  const riskRows = getLeaveRequests(siteScope).filter(
    (l) =>
      (l.potentialOtHours > 0 ||
        [
          "UNEXPLAINED_ABSENCE",
          "PENDING_INFORMATION",
          "EXTENSION_REQUIRED",
        ].includes(l.status)) &&
      !["CLOSED", "REJECTED", "CANCELLED"].includes(l.status),
  );

  const siteList = siteScope
    ? sites.filter((s) => s.id === siteScope)
    : sites;

  const bySite = siteList.map((s) => {
    const siteLeaves = getLeaveRequests(s.id).filter(
      (l) => !["CLOSED", "REJECTED", "CANCELLED"].includes(l.status),
    );
    return {
      siteId: s.id,
      siteName: s.name,
      onLeave: siteLeaves.filter((l) => l.status === "APPROVED").length,
      otRisk: siteLeaves.filter((l) => l.potentialOtHours > 0).length,
      unexplained: siteLeaves.filter((l) =>
        ["UNEXPLAINED_ABSENCE", "PENDING_INFORMATION"].includes(l.status),
      ).length,
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={sSerifText22Ink}>{tr("Management leave visibility")}</div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>
          {trNode("Exceptions and workforce impact — not routine approvals. Drill from site → leave → OT impact. Active returns and cover issues: {link}.", {
            link: <Link href="/leave/lifecycle">{tr("Lifecycle / Coverage")}</Link>,
          })}
          {siteScope ? tr(" Scoped to {siteName}.", { siteName: trData(getSiteName(siteScope)) }) : ""}
        </p>
      </div>

      <div style={rowWrapGap1BgR8}>
        <KpiStat label={tr("Total employees")} value={kpis.totalEmployees} />
        <KpiStat label={tr("Currently on leave")} value={kpis.currentlyOnLeave} tone="info" />
        <KpiStat label={tr("Unexplained absence")} value={kpis.leaveWithoutInformation} tone="alert" />
        <KpiStat label={tr("Critical site shortages")} value={kpis.criticalSiteShortages} tone="alert" />
        <KpiStat label={tr("Leave → OT risk")} value={kpis.leaveOtRisk} tone="alert" />
        <KpiStat label={tr("Long leave cases")} value={kpis.longLeaveCases} tone="info" />
      </div>

      <div style={sWhitePadR10}>
        <div style={sSerifText18Mb12}>{tr("Site → leave impact")}</div>
        <Table
          rowKey="siteId"
          pagination={false}
          dataSource={bySite}
          columns={[
            {
              title: tr("Site"),
              dataIndex: "siteName",
              render: (n, r) => (
                <Link href={`/overtime/sites/${r.siteId}`}>{trData(n)}</Link>
              ),
            },
            { title: tr("Approved on leave"), dataIndex: "onLeave", render: trCell },
            {
              title: tr("OT risk leaves"),
              dataIndex: "otRisk",
              render: (n: number) =>
                n > 0 ? <Tag color={nectarColors.alert}>{n}</Tag> : n,
            },
            {
              title: tr("Unexplained / pending"),
              dataIndex: "unexplained",
              render: (n: number) =>
                n > 0 ? <Tag color="#D97706">{n}</Tag> : n,
            },
          ]}
        />
      </div>

      <div style={sWhitePadR10}>
        <div style={sSerifText18Mb12}>{tr("Exception drill-down")}</div>
        <Table
          rowKey="id"
          dataSource={riskRows}
          pagination={{ pageSize: 8 }}
          columns={[
            {
              title: tr("Employee"),
              dataIndex: "employeeName",
              render: (n, r) => (
                <Link href={`/leave/requests/${r.id}`}>{trData(n)}</Link>
              ),
            },
            { title: tr("Site"), dataIndex: "siteId", render: (id) => trData(getSiteName(id)) },
            { title: tr("Supervisor"), dataIndex: "supervisorName", render: trCell },
            {
              title: tr("Status"),
              dataIndex: "status",
              render: (s: keyof typeof LEAVE_STATUS_LABELS) =>
                LEAVE_STATUS_LABELS[s],
            },
            {
              title: tr("OT impact"),
              dataIndex: "potentialOtHours",
              render: (h: number, r) =>
                h > 0 ? (
                  <span style={{ color: nectarColors.alert, fontWeight: 600 }}>{tr("+{h} hrs · ₹{potentialOtCost}", { h, potentialOtCost: r.potentialOtCost.toLocaleString(intlLocale()) })}</span>
                ) : (
                  tr("None")
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}
