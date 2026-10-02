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

export default function LeaveManagementPage() {
  const router = useRouter();
  const session = getSession();
  const allowed = canViewLeaveManagement(session);
  const siteScope = scopedSiteId(session);

  useEffect(() => {
    if (!allowed) router.replace("/leave");
  }, [allowed, router]);

  if (!allowed) {
    return <Empty description="Not available for your role" />;
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
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
            color: nectarColors.ink,
          }}
        >
          Management leave visibility
        </div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>
          Exceptions and workforce impact — not routine approvals. Drill from
          site → leave → OT impact. Active returns and cover issues:{" "}
          <Link href="/leave/lifecycle">Lifecycle / Coverage</Link>.
          {siteScope ? ` Scoped to ${getSiteName(siteScope)}.` : ""}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          background: "rgba(28, 68, 99, 0.06)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <KpiStat label="Total employees" value={kpis.totalEmployees} />
        <KpiStat
          label="Currently on leave"
          value={kpis.currentlyOnLeave}
          tone="info"
        />
        <KpiStat
          label="Unexplained absence"
          value={kpis.leaveWithoutInformation}
          tone="alert"
        />
        <KpiStat
          label="Critical site shortages"
          value={kpis.criticalSiteShortages}
          tone="alert"
        />
        <KpiStat
          label="Leave → OT risk"
          value={kpis.leaveOtRisk}
          tone="alert"
        />
        <KpiStat
          label="Long leave cases"
          value={kpis.longLeaveCases}
          tone="info"
        />
      </div>

      <div
        style={{ background: nectarColors.white, padding: 20, borderRadius: 10 }}
      >
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          Site → leave impact
        </div>
        <Table
          rowKey="siteId"
          pagination={false}
          dataSource={bySite}
          columns={[
            {
              title: "Site",
              dataIndex: "siteName",
              render: (n, r) => (
                <Link href={`/overtime/sites/${r.siteId}`}>{n}</Link>
              ),
            },
            { title: "Approved on leave", dataIndex: "onLeave" },
            {
              title: "OT risk leaves",
              dataIndex: "otRisk",
              render: (n: number) =>
                n > 0 ? <Tag color={nectarColors.alert}>{n}</Tag> : n,
            },
            {
              title: "Unexplained / pending",
              dataIndex: "unexplained",
              render: (n: number) =>
                n > 0 ? <Tag color="#D97706">{n}</Tag> : n,
            },
          ]}
        />
      </div>

      <div
        style={{ background: nectarColors.white, padding: 20, borderRadius: 10 }}
      >
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          Exception drill-down
        </div>
        <Table
          rowKey="id"
          dataSource={riskRows}
          pagination={{ pageSize: 8 }}
          columns={[
            {
              title: "Employee",
              dataIndex: "employeeName",
              render: (n, r) => (
                <Link href={`/leave/requests/${r.id}`}>{n}</Link>
              ),
            },
            {
              title: "Site",
              dataIndex: "siteId",
              render: (id) => getSiteName(id),
            },
            {
              title: "Supervisor",
              dataIndex: "supervisorName",
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (s: keyof typeof LEAVE_STATUS_LABELS) =>
                LEAVE_STATUS_LABELS[s],
            },
            {
              title: "OT impact",
              dataIndex: "potentialOtHours",
              render: (h: number, r) =>
                h > 0 ? (
                  <span style={{ color: nectarColors.alert, fontWeight: 600 }}>
                    +{h} hrs · ₹{r.potentialOtCost.toLocaleString("en-IN")}
                  </span>
                ) : (
                  "None"
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}
