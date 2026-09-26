"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Select, Table, Tag } from "antd";
import KpiStat from "@/components/KpiStat";
import { getSession } from "@/lib/auth";
import { getSiteName, sites } from "@/lib/mock-data";
import {
  TODAY,
  activateRotationPreview,
  detectConflicts,
  getOtByShiftCause,
  getRotationPreviews,
  getShiftDashboardKpis,
  getShiftInsights,
  rejectRotationPreview,
} from "@/lib/shift";
import { canManageShifts, scopedSiteId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

export default function ShiftsDashboardPage() {
  const session = getSession();
  const locked = scopedSiteId(session);
  const canEdit = canManageShifts(session);
  const [siteId, setSiteId] = useState<string | undefined>(locked);
  const [tick, setTick] = useState(0);

  const kpis = useMemo(() => {
    void tick;
    return getShiftDashboardKpis(siteId);
  }, [siteId, tick]);
  const upcoming = useMemo(() => {
    void tick;
    return getRotationPreviews().filter((p) =>
      siteId ? p.siteId === siteId : true,
    );
  }, [tick, siteId]);
  const conflicts = useMemo(() => {
    void tick;
    return detectConflicts(siteId).slice(0, 5);
  }, [siteId, tick]);
  const insights = useMemo(() => {
    void tick;
    return getShiftInsights(siteId);
  }, [siteId, tick]);
  const otCause = useMemo(() => {
    void tick;
    return getOtByShiftCause();
  }, [tick]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          background: nectarColors.white,
          borderRadius: 12,
          padding: 20,
          border: "1px solid rgba(15,42,36,0.08)",
          backgroundImage: `linear-gradient(135deg, #EEF6F2 0%, ${nectarColors.white} 55%)`,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
            color: nectarColors.ink,
          }}
        >
          Shift rotation
        </div>
        <p style={{ margin: "6px 0 12px", color: nectarColors.muted, maxWidth: 760 }}>
          Plan shifts forward — forecast gaps, allocate relievers, and avoid OT
          before the day starts. Current date: <strong>{TODAY}</strong>
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/shifts/master"><Button>Shift Master</Button></Link>
          <Link href="/shifts/schedule"><Button>Schedule</Button></Link>
          <Link href="/shifts/rotation"><Button type="primary">Rotation</Button></Link>
          <Link href="/shifts/change-requests"><Button>Change Requests</Button></Link>
          <Link href="/shifts/reliever-allocation"><Button>Reliever Allocation</Button></Link>
          <Link href="/shifts/deviations"><Button>Deviations</Button></Link>
        </div>
      </div>

      <Select
        allowClear={!locked}
        disabled={!!locked}
        placeholder="All sites"
        style={{ maxWidth: 280 }}
        value={siteId}
        options={sites.map((s) => ({ value: s.id, label: s.name }))}
        onChange={setSiteId}
      />

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
        <KpiStat label="Employees today" value={kpis.employeesToday} />
        <KpiStat label="A Shift" value={kpis.aShift} tone="positive" />
        <KpiStat label="B Shift" value={kpis.bShift} tone="info" />
        <KpiStat label="C Shift" value={kpis.cShift} tone="info" />
        <KpiStat label="General" value={kpis.general} />
        <KpiStat label="Pending changes" value={kpis.pendingChanges} tone="alert" />
        <KpiStat label="Shift conflicts" value={kpis.shiftConflicts} tone="alert" />
        <KpiStat label="Uncovered positions" value={kpis.uncoveredPositions} tone="alert" />
      </div>

      <div className="nectar-ot-two" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        <Panel title="Upcoming rotation">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={upcoming}
            columns={[
              { title: "Date", dataIndex: "fromDate" },
              {
                title: "Site",
                dataIndex: "siteId",
                render: (id) => getSiteName(id),
              },
              { title: "Employees", dataIndex: "employeesAffected" },
              {
                title: "Shift",
                key: "rot",
                render: (_, r) => `${r.fromCode} → ${r.toCode}`,
              },
              {
                title: "Status",
                dataIndex: "status",
                render: (s) => <Tag>{s.replace("_", " ")}</Tag>,
              },
              {
                title: "",
                key: "act",
                render: (_, r) => {
                  const undecided =
                    r.status === "pending_review" || r.status === "draft";
                  if (!undecided || !canEdit) return null;
                  if (siteId && r.siteId !== siteId) return null;
                  return (
                    <>
                      <Button
                        size="small"
                        type="primary"
                        style={{ marginRight: 6 }}
                        onClick={() => {
                          activateRotationPreview(r.id);
                          setTick((t) => t + 1);
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        danger
                        onClick={() => {
                          rejectRotationPreview(r.id);
                          setTick((t) => t + 1);
                        }}
                      >
                        Reject
                      </Button>
                    </>
                  );
                },
              },
            ]}
          />
        </Panel>

        <Panel title="Conflicts">
          {conflicts.length === 0 ? (
            <div style={{ color: nectarColors.muted, fontSize: 13 }}>
              No rest / weekly-off conflicts in the next window.
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {conflicts.map((c) => (
                <li
                  key={c.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: `1px solid ${nectarColors.sand}`,
                    fontSize: 13,
                  }}
                >
                  <Tag color={c.severity === "attention" ? nectarColors.alert : "#D97706"}>
                    {c.type}
                  </Tag>
                  <strong>{c.employeeName}</strong>
                  <div style={{ color: nectarColors.muted }}>{c.message}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="nectar-ot-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="OT by cause (shift-linked)">
          <Table
            size="small"
            pagination={false}
            rowKey="cause"
            dataSource={otCause.byCause}
            columns={[
              { title: "Cause", dataIndex: "cause" },
              {
                title: "Hours",
                dataIndex: "hours",
                render: (h) => `${h} hrs`,
              },
            ]}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: nectarColors.muted }}>
            Total OT reference: {otCause.totalOt} hrs
          </div>
        </Panel>
        <Panel title="Insights">
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            OT after unplanned shift changes:{" "}
            <strong>{insights.otAfterChanges} hrs</strong>
          </div>
          {insights.frequent.slice(0, 3).map((f) => (
            <div key={f.employeeId} style={{ fontSize: 12, marginBottom: 6 }}>
              <Link href={`/employees/${f.employeeId}`}>{f.employeeName}</Link>{" "}
              moved from planned shift {f.changes} times
            </div>
          ))}
          {insights.siteIssues.slice(0, 2).map((s) => (
            <div key={s.siteId} style={{ fontSize: 12, color: nectarColors.muted }}>
              {s.siteName}: {s.deviations} deviations · {s.otHoursAssociated} OT hrs
            </div>
          ))}
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
