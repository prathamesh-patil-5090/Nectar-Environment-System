"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  canViewLeaveManagement,
  canViewLeavePending,
  isElevated,
  scopedEmployeeId,
  scopedSiteId,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

const STATUS_COLOR: Partial<Record<LeaveStatus, string>> = {
  REQUESTED: nectarColors.sky,
  SUPERVISOR_VERIFIED: nectarColors.leaf,
  SUPERVISOR_RECORDED: nectarColors.leaf,
  SITE_APPROVED: nectarColors.mint,
  SITE_VERIFIED: nectarColors.mint,
  HR_VALIDATED: nectarColors.leaf,
  APPROVED: nectarColors.mint,
  PENDING_INFORMATION: "#D97706",
  UNEXPLAINED_ABSENCE: nectarColors.alert,
  EXTENSION_REQUIRED: nectarColors.alert,
  CLOSED: nectarColors.muted,
  REJECTED: nectarColors.alert,
};

export default function LeaveOverviewPage() {
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const empScope = scopedEmployeeId(session);
  const [tick] = useState(0);
  const kpis = useMemo(() => getLeaveKpis(siteScope), [siteScope, tick]);
  const recent = useMemo(() => {
    let list = getLeaveRequests(siteScope).slice(0, 6);
    if (empScope) list = list.filter((l) => l.employeeId === empScope);
    return list;
  }, [siteScope, empScope, tick]);
  const pending = useMemo(() => getPendingJustifications(), [tick]);

  const showMgmt = isElevated(session);
  const showPending = canViewLeavePending(session);
  const showManagement = canViewLeaveManagement(session);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          background: nectarColors.white,
          borderRadius: 12,
          padding: 20,
          border: "1px solid rgba(15,42,36,0.08)",
          backgroundImage: `linear-gradient(135deg, #F0F7F3 0%, ${nectarColors.white} 50%)`,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
            color: nectarColors.ink,
          }}
        >
          Leave & absence
        </div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted, maxWidth: 720 }}>
          Employee informs → Supervisor records/verifies → Site In-Charge manages
          manpower → HR controls policy & exceptions → Management sees impact.
          Leave is connected to reliever pool and OT risk.
        </p>
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/leave/requests">
            <Button type="primary" icon={<PlusOutlined />}>
              New leave / absence
            </Button>
          </Link>
          <Link href="/leave/requests">
            <Button>All requests</Button>
          </Link>
          {showPending ? (
            <Link href="/leave/pending">
              <Button>Pending justifications</Button>
            </Link>
          ) : null}
          {showManagement ? (
            <Link href="/leave/management">
              <Button>Management view</Button>
            </Link>
          ) : null}
        </div>
      </div>

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
        {showMgmt ? (
          <>
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
          </>
        ) : showPending ? (
          <>
            <KpiStat
              label="Pending leave requests"
              value={kpis.pendingRequests}
              tone="info"
            />
            <KpiStat
              label="Unverified absences"
              value={kpis.unverifiedAbsences}
              tone="alert"
            />
            <KpiStat
              label="Employees on leave"
              value={kpis.currentlyOnLeave}
            />
            <KpiStat
              label="Leave without information"
              value={kpis.leaveWithoutInformation}
              tone="alert"
            />
            <KpiStat
              label="Overdue leave closure"
              value={kpis.overdueLeaveClosure}
              tone="alert"
            />
            <KpiStat
              label="Leave → OT risk"
              value={kpis.leaveOtRisk}
              hint="Needs replacement plan"
            />
          </>
        ) : (
          <>
            <KpiStat
              label="Pending at site"
              value={kpis.pendingRequests}
              tone="info"
            />
            <KpiStat
              label="On leave today"
              value={kpis.currentlyOnLeave}
            />
            <KpiStat
              label="OT risk cases"
              value={kpis.leaveOtRisk}
              tone="alert"
            />
            <KpiStat
              label="Needs return confirm"
              value={kpis.overdueLeaveClosure}
              tone="alert"
            />
          </>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 16,
        }}
        className="nectar-ot-two"
      >
        <Panel title="Recent leave activity">
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {recent.map((l) => (
              <li
                key={l.id}
                style={{
                  padding: "12px 0",
                  borderBottom: `1px solid ${nectarColors.sand}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <Link
                    href={`/leave/requests/${l.id}`}
                    style={{ fontWeight: 600, color: nectarColors.leaf }}
                  >
                    {l.employeeName}
                  </Link>
                  <Tag
                    color={STATUS_COLOR[l.status] ?? nectarColors.muted}
                    style={{ border: "none", margin: 0 }}
                  >
                    {LEAVE_STATUS_LABELS[l.status]}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: nectarColors.muted }}>
                  {l.startDate} → {l.endDate} · {l.mode} ·{" "}
                  {l.entrySource === "supervisor_on_behalf"
                    ? `Entered by supervisor (${l.enteredByName})`
                    : "Requested by employee"}
                  {l.potentialOtHours > 0
                    ? ` · OT risk ${l.potentialOtHours} hrs`
                    : ""}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Hierarchy reminder">
          <ol
            style={{
              margin: 0,
              paddingLeft: 18,
              color: nectarColors.ink,
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            <li>Employee informs (or supervisor records)</li>
            <li>Supervisor verifies / enters</li>
            <li>Site In-Charge checks manpower & replacement</li>
            <li>HR validates policy, balance, exceptions</li>
            <li>Management sees shortages & OT risk</li>
          </ol>
          {pending.length ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Needs attention
              </div>
              {pending.slice(0, 3).map((p) => (
                <div key={p.id} style={{ fontSize: 12, marginBottom: 6 }}>
                  <Link href={`/leave/requests/${p.id}`}>
                    {p.employeeName}
                  </Link>{" "}
                  — {LEAVE_STATUS_LABELS[p.status]}
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: nectarColors.white,
        padding: 20,
        borderRadius: 10,
        border: "1px solid rgba(15,42,36,0.06)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontSize: 18,
          marginBottom: 12,
          color: nectarColors.ink,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
