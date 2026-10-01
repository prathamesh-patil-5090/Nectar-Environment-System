"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Select, Table, Tag } from "antd";
import { getEmployeeById, getSiteName, sites } from "@/lib/mock-data";
import { getRelievers } from "@/lib/reliever/pool";
import { computeShiftImpact, candidateDisplaySource } from "@/lib/shift-impact";
import { nectarColors } from "@/lib/theme";

const TODAY = "2026-09-23";

export default function RelieverAllocationPage() {
  const [siteId, setSiteId] = useState<string>();
  const report = useMemo(
    () =>
      computeShiftImpact({
        siteId,
        from: TODAY,
        to: TODAY,
      }),
    [siteId],
  );
  const allRelievers = getRelievers();

  const rows = report.vacancies;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
          }}
        >
          Reliever allocation
        </div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>
          Shift Impact: leave vacancies and roster gaps with ranked cover
          (employees + pool). Manage availability in{" "}
          <Link href="/reliever-pool">Reliever Pool</Link>.
        </p>
        <div style={{ marginTop: 8, fontSize: 13, color: nectarColors.muted }}>
          OT risk: <strong>{report.risk}</strong> · Uncovered:{" "}
          {report.uncoveredCount} · Est. OT {report.potentialOtHours} hrs
        </div>
      </div>

      <Select
        allowClear
        placeholder="Site"
        style={{ maxWidth: 240 }}
        value={siteId}
        options={sites.map((s) => ({ value: s.id, label: s.name }))}
        onChange={setSiteId}
      />

      <Table
        rowKey={(r) => r.id}
        dataSource={rows}
        style={{ background: nectarColors.white }}
        locale={{ emptyText: "No open shift vacancies for this window" }}
        columns={[
          {
            title: "Site",
            dataIndex: "siteId",
            render: (id: string) => getSiteName(id),
          },
          {
            title: "Date",
            dataIndex: "date",
          },
          {
            title: "Shift",
            dataIndex: "shiftCode",
            render: (c: string) => <Tag>{c}</Tag>,
          },
          {
            title: "Source",
            dataIndex: "source",
            render: (s: string) => (
              <Tag color={s === "leave" ? nectarColors.sky : "#D97706"}>
                {s === "leave" ? "Leave" : "Roster gap"}
              </Tag>
            ),
          },
          {
            title: "Absent",
            key: "absent",
            render: (_, r) =>
              r.absentEmployeeName ?? (
                <span style={{ color: nectarColors.muted }}>—</span>
              ),
          },
          {
            title: "Status",
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
                {s}
              </Tag>
            ),
          },
          {
            title: "Top cover candidates",
            key: "candidates",
            render: (_, r) => {
              if (r.status !== "open") {
                return (
                  <span style={{ color: nectarColors.muted }}>
                    {r.chosenCoverName ?? r.status}
                  </span>
                );
              }
              if (!r.candidates.length) {
                return (
                  <span style={{ color: nectarColors.alert }}>
                    No match — OT risk
                  </span>
                );
              }
              return r.candidates.slice(0, 3).map((c) => {
                const poolName = allRelievers.find((x) => x.id === c.id)?.name;
                const empName = getEmployeeById(c.id)?.name;
                return (
                  <Tag key={c.id} color={nectarColors.leaf}>
                    {c.name || poolName || empName || c.id} ·{" "}
                    {candidateDisplaySource(c.source)}
                  </Tag>
                );
              });
            },
          },
          {
            title: "Leave",
            key: "leave",
            render: (_, r) =>
              r.leaveId ? (
                <Link href={`/leave/requests/${r.leaveId}`}>Open</Link>
              ) : (
                "—"
              ),
          },
        ]}
      />
    </div>
  );
}
