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

const PIE_COLORS = [
  nectarColors.leaf,
  nectarColors.mint,
  nectarColors.sky,
  nectarColors.alert,
  "#0E7490",
];

export default function OtAnalysisPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading analysis…</div>}>
      <OtAnalysisInner />
    </Suspense>
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
        className="nectar-ot-two"
      >
        <Panel title="Monthly OT hours">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5EDE9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="otHours"
                stroke={nectarColors.leaf}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Monthly OT cost">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5EDE9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatInr(Number(v))} />
              <Bar dataKey="otCost" fill={nectarColors.alert} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 16,
        }}
        className="nectar-ot-two"
      >
        <Panel title="Site-wise OT">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sites}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5EDE9" />
              <XAxis dataKey="siteName" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="otHours" fill={nectarColors.mint} name="Hours" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="OT status mix">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statuses}
                dataKey="otHours"
                nameKey="status"
                outerRadius={90}
                label={(props) => {
                  const status = String(props.name ?? "");
                  const pct = props.percent ?? 0;
                  const label =
                    OT_STATUS_LABELS[status as keyof typeof OT_STATUS_LABELS] ??
                    status;
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

      <Panel title="Employee OT concentration">
        <Table
          size="small"
          rowKey="employeeId"
          pagination={false}
          dataSource={employees}
          columns={[
            {
              title: "Employee",
              dataIndex: "employeeName",
              render: (n, r) => (
                <Link href={`/overtime/employees/${r.employeeId}`}>{n}</Link>
              ),
            },
            { title: "Site", dataIndex: "siteName" },
            {
              title: "OT Hours",
              dataIndex: "otHours",
              render: (v) => formatHours(v),
            },
            {
              title: "OT Cost",
              dataIndex: "otCost",
              render: (v) => formatInr(v),
            },
            { title: "OT Days", dataIndex: "otDays" },
          ]}
        />
      </Panel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
        }}
        className="nectar-ot-three"
      >
        <Panel title="By department">
          <Table
            size="small"
            pagination={false}
            rowKey="department"
            dataSource={departments}
            columns={[
              { title: "Dept", dataIndex: "department" },
              {
                title: "Hours",
                dataIndex: "otHours",
                render: (v) => formatHours(v),
              },
            ]}
          />
        </Panel>
        <Panel title="By shift">
          <Table
            size="small"
            pagination={false}
            rowKey="shiftId"
            dataSource={shifts}
            columns={[
              { title: "Shift", dataIndex: "shiftName" },
              {
                title: "Hours",
                dataIndex: "otHours",
                render: (v) => formatHours(v),
              },
            ]}
          />
        </Panel>
        <Panel title="By reason">
          <Table
            size="small"
            pagination={false}
            rowKey="reason"
            dataSource={reasons}
            columns={[
              {
                title: "Reason",
                dataIndex: "reason",
                render: (r) => OT_REASON_LABELS[r as keyof typeof OT_REASON_LABELS],
              },
              {
                title: "Hours",
                dataIndex: "otHours",
                render: (v) => formatHours(v),
              },
              {
                title: "%",
                dataIndex: "pct",
                render: (v) => `${v}%`,
              },
            ]}
          />
        </Panel>
      </div>

      <Panel title="Yearly OT">
        <Table
          size="small"
          pagination={false}
          rowKey="year"
          dataSource={yearly}
          columns={[
            { title: "Year", dataIndex: "year" },
            {
              title: "OT Hours",
              dataIndex: "otHours",
              render: (v) => formatHours(v),
            },
            {
              title: "OT Cost",
              dataIndex: "otCost",
              render: (v) => formatInr(v),
            },
          ]}
        />
      </Panel>

      <Panel title="OT heatmap (Month × Site)">
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "separate",
              borderSpacing: 3,
              minWidth: 640,
              width: "100%",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Site</th>
                {heatmap.months.map((m) => (
                  <th key={m} style={thStyle}>
                    {m.slice(5)}
                  </th>
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
                    <td style={{ ...thStyle, textAlign: "left", color: nectarColors.ink }}>
                      {name}
                    </td>
                    {heatmap.months.map((month) => {
                      const cell = heatmap.cells.find(
                        (c) => c.siteId === siteId && c.month === month,
                      );
                      const hours = cell?.hours ?? 0;
                      const intensity = hours / maxHeat;
                      return (
                        <td key={month} style={{ padding: 0 }}>
                          <div
                            title={`${name} ${month}: ${hours} hrs`}
                            style={{
                              background: `rgba(31, 107, 74, ${0.08 + intensity * 0.72})`,
                              color: intensity > 0.55 ? "#fff" : nectarColors.ink,
                              textAlign: "center",
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "8px 4px",
                              borderRadius: 4,
                              minWidth: 36,
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

      <Panel title="High OT detection & patterns">
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {insights.map((i) => (
            <li
              key={i.id}
              style={{
                padding: "10px 0",
                borderBottom: `1px solid ${nectarColors.sand}`,
              }}
            >
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
                {i.title}
              </Tag>
              <div style={{ marginTop: 4, fontSize: 13, color: nectarColors.muted }}>
                {i.message}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
        Where OT happens, who generates it, when it occurs, what it costs — plus
        downloadable reports.
      </p>
      <OtFiltersBar
        value={filters}
        onChange={setFilters}
        lockedSiteId={lockedSiteId}
      />
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: "analysis", label: "Analysis", children: analysisBody },
          {
            key: "reports",
            label: "Reports",
            children: <OtReportsPanel filters={filters} />,
          },
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

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: nectarColors.white, padding: 20 }}>
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
