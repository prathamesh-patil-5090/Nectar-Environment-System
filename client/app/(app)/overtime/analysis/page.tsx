"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Table, Tabs, Tag } from "antd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import OtFiltersBar from "@/components/overtime/OtFiltersBar";
import OtReportsPanel from "@/components/overtime/OtReportsPanel";
import { useOtFilters } from "@/components/overtime/OtFilterContext";
import {
  buildInsights,
  formatHours,
  formatInr,
  getDepartmentBreakdown,
  getEmployeeOtRows,
  getHeatmapMonthSite,
  getMonthlyTrend,
  getReasonBreakdown,
  getShiftBreakdown,
  getSiteOtRows,
  getStatusBreakdown,
  getYearlyTrend,
  OT_REASON_LABELS,
  OT_STATUS_LABELS,
} from "@/lib/overtime";
import { nectarColors } from "@/lib/theme";
import { gridGap16, gridGap162 } from "@/lib/styles";
import SharedPanel from "@/components/Panel";
import { tr, trData, trCell } from "@/lib/i18n";

const PIE_COLORS = [
  nectarColors.leaf,
  nectarColors.mint,
  nectarColors.sky,
  nectarColors.alert,
  "#0E7490",
];

export default function OtAnalysisPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>{tr("Loading analysis…")}</div>}><OtAnalysisInner /></Suspense>
  );
}

function OtAnalysisInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "reports" ? "reports" : "analysis";
  const { filters, setFilters, lockedSiteId } = useOtFilters();
  const monthly = getMonthlyTrend(filters);
  const yearly = getYearlyTrend(filters);
  const sites = getSiteOtRows(filters).filter((s) => s.otHours > 0);
  const employees = getEmployeeOtRows(filters).slice(0, 10);
  const departments = getDepartmentBreakdown(filters);
  const shifts = getShiftBreakdown(filters);
  const reasons = getReasonBreakdown(filters);
  const statuses = getStatusBreakdown(filters);
  const heatmap = getHeatmapMonthSite(filters);
  const insights = buildInsights(filters);
  const maxHeat = Math.max(...heatmap.cells.map((c) => c.hours), 1);

  const setTab = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "reports") params.set("tab", "reports");
    else params.delete("tab");
    const q = params.toString();
    router.replace(q ? `/overtime/analysis?${q}` : "/overtime/analysis");
  };

  const analysisBody = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={gridGap16} className="nectar-ot-two">
        <Panel title={tr("Monthly OT hours")}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="otHours" name={tr("OT Hours")} stroke={nectarColors.leaf} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title={tr("Monthly OT cost")}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatInr(Number(v))} />
              <Bar dataKey="otCost" name={tr("OT Cost")} fill={nectarColors.alert} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div style={gridGap162} className="nectar-ot-two">
        <Panel title={tr("Site-wise OT")}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sites}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="siteName" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} tickFormatter={(v) => String(trData(String(v)))} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="otHours" fill={nectarColors.mint} name={tr("Hours")} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title={tr("OT status mix")}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statuses.map((s) => ({ ...s, label: OT_STATUS_LABELS[s.status as keyof typeof OT_STATUS_LABELS] ?? s.status }))}
                dataKey="otHours"
                nameKey="label"
                outerRadius={90}
                label={(props) => {
                  const label = String(props.name ?? "");
                  const pct = props.percent ?? 0;
                  return `${label} ${(pct * 100).toFixed(0)}%`;
                }}
              >
                {statuses.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title={tr("Employee OT concentration")}>
        <Table
          size="small"
          rowKey="employeeId"
          pagination={false}
          dataSource={employees}
          columns={[
            {
              title: tr("Employee"),
              dataIndex: "employeeName",
              render: (n, r) => (
                <Link href={`/overtime/employees/${r.employeeId}`}>{trData(n)}</Link>
              ),
            },
            { title: tr("Site"), dataIndex: "siteName", render: trCell },
            { title: tr("OT Hours"), dataIndex: "otHours", render: (v) => formatHours(v) },
            { title: tr("OT Cost"), dataIndex: "otCost", render: (v) => formatInr(v) },
            { title: tr("OT Days"), dataIndex: "otDays", render: trCell },
          ]}
        />
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }} className="nectar-ot-three">
        <Panel title={tr("By department")}>
          <Table
            size="small"
            pagination={false}
            rowKey="department"
            dataSource={departments}
            columns={[
              { title: tr("Dept"), dataIndex: "department", render: trCell },
              { title: tr("Hours"), dataIndex: "otHours", render: (v) => formatHours(v) },
            ]}
          />
        </Panel>
        <Panel title={tr("By shift")}>
          <Table
            size="small"
            pagination={false}
            rowKey="shiftId"
            dataSource={shifts}
            columns={[
              { title: tr("Shift"), dataIndex: "shiftName", render: trCell },
              { title: tr("Hours"), dataIndex: "otHours", render: (v) => formatHours(v) },
            ]}
          />
        </Panel>
        <Panel title={tr("By reason")}>
          <Table
            size="small"
            pagination={false}
            rowKey="reason"
            dataSource={reasons}
            columns={[
              {
                title: tr("Reason"),
                dataIndex: "reason",
                render: (r) => OT_REASON_LABELS[r as keyof typeof OT_REASON_LABELS],
              },
              { title: tr("Hours"), dataIndex: "otHours", render: (v) => formatHours(v) },
              { title: "%", dataIndex: "pct", render: (v) => `${v}%` },
            ]}
          />
        </Panel>
      </div>

      <Panel title={tr("Yearly OT")}>
        <Table
          size="small"
          pagination={false}
          rowKey="year"
          dataSource={yearly}
          columns={[
            { title: tr("Year"), dataIndex: "year" },
            { title: tr("OT Hours"), dataIndex: "otHours", render: (v) => formatHours(v) },
            { title: tr("OT Cost"), dataIndex: "otCost", render: (v) => formatInr(v) },
          ]}
        />
      </Panel>

      <Panel title={tr("OT heatmap (Month × Site)")}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 3, minWidth: 640, width: "100%" }}>
            <thead>
              <tr>
                <th style={thStyle}>{tr("Site")}</th>
                {heatmap.months.map((m) => (
                  <th key={m} style={thStyle}>{m.slice(5)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.siteIds.map((siteId) => {
                const name =
                  heatmap.cells.find((c) => c.siteId === siteId)?.siteName ??
                  siteId;
                return (
                  <tr key={siteId}>
                    <td style={{ ...thStyle, textAlign: "left", color: nectarColors.ink }}>{trData(name)}</td>
                    {heatmap.months.map((month) => {
                      const cell = heatmap.cells.find(
                        (c) => c.siteId === siteId && c.month === month,
                      );
                      const hours = cell?.hours ?? 0;
                      const intensity = hours / maxHeat;
                      return (
                        <td key={month} style={{ padding: 0 }}>
                          <div
                            title={tr("{name} {month}: {hours} hrs", { name: trData(name), month: trData(month), hours })}
                            style={{
                              background: `rgba(28, 68, 99, ${0.08 + intensity * 0.72})`,
                              color: intensity > 0.55 ? "#fff" : nectarColors.ink, textAlign: "center", fontSize: 11,
                              fontWeight: 600, padding: "8px 4px", borderRadius: 4, minWidth: 36,
                            }}
                          >
                            {hours || "·"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={tr("High OT detection & patterns")}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {insights.map((i) => (
            <li key={i.id} style={{ padding: "10px 0", borderBottom: `1px solid ${nectarColors.sand}` }}>
              <Tag
                color={
                  i.severity === "attention"
                    ? nectarColors.alert
                    : i.severity === "watch"
                      ? nectarColors.sky
                      : nectarColors.mint
                }
                style={{ border: "none" }}
              >
                {trData(i.title)}
              </Tag>
              <div style={{ marginTop: 4, fontSize: 13, color: nectarColors.muted }}>{trData(i.message)}</div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
        {tr("Where OT happens, who generates it, when it occurs, what it costs — plus downloadable reports.")}
      </p>
      <OtFiltersBar value={filters} onChange={setFilters} lockedSiteId={lockedSiteId} />
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: "analysis", label: tr("Analysis"), children: analysisBody },
          { key: "reports", label: tr("Reports"), children: <OtReportsPanel filters={filters} /> },
        ]}
      />
    </div>
  );
}

const thStyle: React.CSSProperties = {
  fontWeight: 500,
  fontSize: 11,
  color: nectarColors.muted,
  padding: "4px 6px",
  textAlign: "center",
};

function Panel(props: { title: string; children: React.ReactNode }) {
  return <SharedPanel {...props} boxStyle={{ background: nectarColors.white, padding: 20 }} />;
}
