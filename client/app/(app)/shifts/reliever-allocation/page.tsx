"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Select, Table, Tag } from "antd";
import { getEmployeeById, getSiteName, sites } from "@/lib/mock-data";
import { getRelievers } from "@/lib/reliever/pool";
import { computeShiftImpact, candidateDisplaySource } from "@/lib/shift-impact";
import { nectarColors } from "@/lib/theme";
import { sSerifText22 } from "@/lib/styles";
import { tr, trNode, trData } from "@/lib/i18n";

const TODAY = "2026-09-23";

export default function RelieverAllocationPage() {
  const [siteId, setSiteId] = useState<string>();
  const report = useMemo(
    () =>
      computeShiftImpact({ siteId, from: TODAY, to: TODAY }),
    [siteId],
  );
  const allRelievers = getRelievers();

  const rows = report.vacancies;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={sSerifText22}>{tr("Reliever allocation")}</div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>
          {trNode("Shift Impact: leave vacancies and roster gaps with ranked cover (employees + pool). Manage availability in {link}.", { link: <Link href="/reliever-pool">{tr("Reliever Pool")}</Link> })}
        </p>
        <div style={{ marginTop: 8, fontSize: 13, color: nectarColors.muted }}>
          {trNode("OT risk: {risk} · Uncovered: {uncovered} · Est. OT {hours} hrs", { risk: <strong>{tr(report.risk)}</strong>, uncovered: report.uncoveredCount, hours: report.potentialOtHours })}
        </div>
      </div>

      <Select
        allowClear
        placeholder={tr("Site")}
        style={{ maxWidth: 240 }}
        value={siteId}
        options={sites.map((s) => ({ value: s.id, label: s.name }))}
        onChange={setSiteId}
      />

      <Table
        rowKey={(r) => r.id}
        dataSource={rows}
        style={{ background: nectarColors.white }}
        locale={{ emptyText: tr("No open shift vacancies for this window") }}
        columns={[
          { title: tr("Site"), dataIndex: "siteId", render: (id: string) => trData(getSiteName(id)) },
          { title: tr("Date"), dataIndex: "date" },
          { title: tr("Shift"), dataIndex: "shiftCode", render: (c: string) => <Tag>{trData(c)}</Tag> },
          {
            title: tr("Source"),
            dataIndex: "source",
            render: (s: string) => (
              <Tag color={s === "leave" ? nectarColors.sky : "#D97706"}>{s === "leave" ? tr("Leave") : tr("Roster gap")}</Tag>
            ),
          },
          {
            title: tr("Absent"),
            key: "absent",
            render: (_, r) =>
              r.absentEmployeeName ?? (
                <span style={{ color: nectarColors.muted }}>—</span>
              ),
          },
          {
            title: tr("Status"),
            dataIndex: "status",
            render: (s: string) => (
              <Tag
                color={
                  s === "open"
                    ? nectarColors.alert
                    : s === "covered"
                      ? nectarColors.mint
                      : "#D97706"
                }
              >
                {trData(s)}
              </Tag>
            ),
          },
          {
            title: tr("Top cover candidates"),
            key: "candidates",
            render: (_, r) => {
              if (r.status !== "open") {
                return (
                  <span style={{ color: nectarColors.muted }}>{r.chosenCoverName ?? r.status}</span>
                );
              }
              if (!r.candidates.length) {
                return (
                  <span style={{ color: nectarColors.alert }}>{tr("No match — OT risk")}</span>
                );
              }
              return r.candidates.slice(0, 3).map((c) => {
                const poolName = allRelievers.find((x) => x.id === c.id)?.name;
                const empName = getEmployeeById(c.id)?.name;
                return (
                  <Tag key={c.id} color={nectarColors.leaf}>
                    {c.name || poolName || empName || c.id} ·{" "}
                    {trData(candidateDisplaySource(c.source))}
                  </Tag>
                );
              });
            },
          },
          {
            title: tr("Leave"),
            key: "leave",
            render: (_, r) =>
              r.leaveId ? (
                <Link href={`/leave/requests/${r.leaveId}`}>{tr("Open")}</Link>
              ) : (
                "—"
              ),
          },
        ]}
      />
    </div>
  );
}
