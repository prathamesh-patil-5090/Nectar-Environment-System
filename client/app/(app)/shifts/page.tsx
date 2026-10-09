"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Select, Table, Tag } from "antd";
import KpiStat from "@/components/KpiStat";
import { getSession } from "@/lib/auth";
import { getSiteName, sites } from "@/lib/mock-data";
import {
  getOtByShiftCause,
  getRotationPreviews,
  getShiftDashboardKpis,
  getShiftInsights,
  TODAY,
  addDays,
} from "@/lib/shift";
import { getManpowerConflictReport } from "@/lib/manpower-conflict";
import { scopedSiteId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { gridGap16, gridGap162, rowWrapGap1BgR8 } from "@/lib/styles";
import Panel from "@/components/Panel";
import ActivePermitsPanel from "@/components/e-permit/ActivePermitsPanel";
import { tr, trNode, translatePersonName, trData, trCell, trEnum } from "@/lib/i18n";

export default function ShiftsDashboardPage() {
  const session = getSession();
  const locked = scopedSiteId(session);
  const [siteId, setSiteId] = useState<string | undefined>(locked);
  const [tick] = useState(0);

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
    return getManpowerConflictReport({
      siteId,
      from: TODAY,
      to: addDays(TODAY, 10),
    }).issues.slice(0, 8);
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

      <Select
        allowClear={!locked}
        disabled={!!locked}
        placeholder={tr("All sites")}
        style={{ maxWidth: 280 }}
        value={siteId}
        options={sites.map((s) => ({ value: s.id, label: s.name }))}
        onChange={setSiteId}
      />

      <div style={rowWrapGap1BgR8}>
        <KpiStat label={tr("Employees today")} value={kpis.employeesToday} />
        <KpiStat label={tr("A Shift")} value={kpis.aShift} tone="positive" />
        <KpiStat label={tr("B Shift")} value={kpis.bShift} tone="info" />
        <KpiStat label={tr("C Shift")} value={kpis.cShift} tone="info" />
        <KpiStat label={tr("General")} value={kpis.general} />
        <KpiStat label={tr("Pending changes")} value={kpis.pendingChanges} tone="alert" />
        <KpiStat label={tr("Shift conflicts")} value={kpis.shiftConflicts} tone="alert" />
        <KpiStat label={tr("Uncovered positions")} value={kpis.uncoveredPositions} tone="alert" />
      </div>

      <div className="nectar-ot-two" style={gridGap162}>
        <Panel title={tr("Upcoming rotation")}>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={upcoming}
            columns={[
              { title: tr("Date"), dataIndex: "fromDate" },
              { title: tr("Site"), dataIndex: "siteId", render: (id) => trData(getSiteName(id)) },
              { title: tr("Employees"), dataIndex: "employeesAffected", render: trCell },
              { title: tr("Shift"), key: "rot", render: (_, r) => `${r.fromCode} → ${r.toCode}` },
              { title: tr("Status"), dataIndex: "status", render: (s: string) => <Tag>{trEnum(s)}</Tag> },
              {
                title: "",
                key: "act",
                render: (_, r) => {
                  const open =
                    r.status === "pending_manager" ||
                    r.status === "pending_director" ||
                    r.status === "draft";
                  if (!open) return null;
                  if (siteId && r.siteId !== siteId) return null;
                  return (
                    <Link href="/shifts/rotation"><Button size="small">{tr("Review on Rotation")}</Button></Link>
                  );
                },
              },
            ]}
          />
        </Panel>

        <Panel title={tr("Manpower + Conflict")}>
          {conflicts.length === 0 ? (
            <div style={{ color: nectarColors.muted, fontSize: 13 }}>
              {tr("No shortages or conflicts in the next window.")}{" "}
              <Link href="/shifts/manpower">{tr("Open hub")}</Link>
            </div>
          ) : (
            <>
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
                    <Tag
                      color={
                        c.severity === "attention"
                          ? nectarColors.alert
                          : "#D97706"
                      }
                    >
                      {trEnum(c.kind)}
                    </Tag>
                    <strong>{trData(c.title)}</strong>
                    <div style={{ color: nectarColors.muted }}>{trData(c.message)}</div>
                    {c.href ? (
                      <Link href={c.href} style={{ fontSize: 12 }}>
                        {tr("Open")}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 8 }}>
                <Link href="/shifts/manpower">{tr("View all on Manpower + Conflict")}</Link>
              </div>
            </>
          )}
        </Panel>
      </div>

      <ActivePermitsPanel siteId={siteId} />

      <div className="nectar-ot-two" style={gridGap16}>
        <Panel title={tr("OT by cause (shift-linked)")}>
          <Table
            size="small"
            pagination={false}
            rowKey="cause"
            dataSource={otCause.byCause}
            columns={[
              { title: tr("Cause"), dataIndex: "cause", render: trCell },
              { title: tr("Hours"), dataIndex: "hours", render: (h) => tr("{h} hrs", { h }) },
            ]}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: nectarColors.muted }}>{tr("Total OT reference: {totalOt} hrs", { totalOt: otCause.totalOt })}</div>
        </Panel>
        <Panel title={tr("Insights")}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            {tr("OT after unplanned shift changes:")}{" "}
            <strong>{tr("{otAfterChanges} hrs", { otAfterChanges: insights.otAfterChanges })}</strong>
          </div>
          {insights.frequent.slice(0, 3).map((f) => (
            <div key={f.employeeId} style={{ fontSize: 12, marginBottom: 6 }}>
              {trNode("{name} moved from planned shift {count} times", { name: <Link href={`/employees/${f.employeeId}`}>{translatePersonName(f.employeeName)}</Link>, count: f.changes })}
            </div>
          ))}
          {insights.siteIssues.slice(0, 2).map((s) => (
            <div key={s.siteId} style={{ fontSize: 12, color: nectarColors.muted }}>{tr("{siteName}: {deviations} deviations · {otHoursAssociated} OT hrs", { siteName: trData(s.siteName), deviations: s.deviations, otHoursAssociated: s.otHoursAssociated })}</div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
