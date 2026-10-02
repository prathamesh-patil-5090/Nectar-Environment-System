"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import KpiStat from "@/components/KpiStat";
import OtFiltersBar from "@/components/overtime/OtFiltersBar";
import { useOtFilters } from "@/components/overtime/OtFilterContext";
import {
  buildInsights,
  formatHours,
  formatInr,
  getMonthlyTrend,
  getOverviewKpis,
  getSiteOtRows,
} from "@/lib/overtime";
import { nectarColors } from "@/lib/theme";
import { gridGap16, rowWrapGap1BgR8, sSerifText18InkMb122 } from "@/lib/styles";
import type { CSSProperties } from "react";

const sText18SemiboldLeaf: CSSProperties = { fontSize: 18, fontWeight: 600, color: nectarColors.leaf };

export default function OtOverviewPage() {
  const { filters, setFilters, lockedSiteId } = useOtFilters();
  const kpis = getOverviewKpis(filters);
  const trend = getMonthlyTrend(filters);
  const sites = getSiteOtRows(filters)
    .filter((s) => s.otHours > 0)
    .sort((a, b) => b.otHours - a.otHours)
    .slice(0, 6);
  const insights = buildInsights(filters).slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ margin: "0 0 12px", color: nectarColors.muted, fontSize: 14 }}>How much OT are we generating, where, who, and at what cost?</p>
        <OtFiltersBar value={filters} onChange={setFilters} lockedSiteId={lockedSiteId} />
      </div>

      <div style={rowWrapGap1BgR8}>
        <KpiStat label="Total OT Hours" value={formatHours(kpis.totalOtHours)} />
        <KpiStat label="Total OT Days" value={kpis.totalOtDays} hint="Employee-days with OT" tone="info" />
        <KpiStat label="Total OT Employees" value={kpis.totalOtEmployees} tone="info" />
        <KpiStat label="Total OT Cost" value={formatInr(kpis.totalOtCost)} tone="alert" />
        <KpiStat label="Avg OT / Employee" value={formatHours(kpis.avgOtPerEmployee)} tone="positive" />
        <KpiStat label="Avg OT / Site" value={formatHours(kpis.avgOtPerSite)} tone="positive" />
      </div>

      <div style={gridGap16} className="nectar-ot-two">
        <div style={{ background: nectarColors.white, padding: 20 }}>
          <SectionTitle>Highest OT site</SectionTitle>
          {kpis.highestSite ? (
            <div>
              <Link href={`/overtime/sites/${kpis.highestSite.siteId}`} style={sText18SemiboldLeaf}>{kpis.highestSite.name}</Link>
              <div style={{ marginTop: 8, color: nectarColors.muted, fontSize: 13 }}>
                {formatHours(kpis.highestSite.otHours)} ·{" "}
                {formatInr(kpis.highestSite.otCost)} ·{" "}
                {kpis.highestSite.sharePct}% of total OT
              </div>
            </div>
          ) : (
            <EmptyHint />
          )}
        </div>
        <div style={{ background: nectarColors.white, padding: 20 }}>
          <SectionTitle>Highest OT employee</SectionTitle>
          {kpis.highestEmployee ? (
            <div>
              <Link href={`/overtime/employees/${kpis.highestEmployee.employeeId}`} style={sText18SemiboldLeaf}>{kpis.highestEmployee.name}</Link>
              <div style={{ marginTop: 8, color: nectarColors.muted, fontSize: 13 }}>
                {kpis.highestEmployee.employeeId} · {kpis.highestEmployee.siteName}
                <br />
                {formatHours(kpis.highestEmployee.otHours)} ·{" "}
                {kpis.highestEmployee.otDays} OT days ·{" "}
                {formatInr(kpis.highestEmployee.otCost)}
              </div>
            </div>
          ) : (
            <EmptyHint />
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }} className="nectar-ot-two">
        <ChartCard title="Monthly OT hours">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="otHours"
                stroke={nectarColors.leaf}
                strokeWidth={2}
                dot={false}
                name="OT Hours"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Site-wise OT">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sites} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="siteName" width={110} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="otHours" fill={nectarColors.mint} name="OT Hours" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ background: nectarColors.white, padding: 20 }}>
        <SectionTitle>OT intelligence</SectionTitle>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {insights.map((i) => (
            <li key={i.id} style={{ padding: "10px 0", borderBottom: `1px solid ${nectarColors.sand}` }}>
              <div style={{ fontWeight: 600, color: nectarColors.ink }}>{i.title}</div>
              <div style={{ fontSize: 13, color: nectarColors.muted }}>{i.message}</div>
            </li>
          ))}
          {!insights.length ? <EmptyHint /> : null}
        </ul>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={sSerifText18InkMb122}>{children}</div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: nectarColors.white, padding: 20 }}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function EmptyHint() {
  return (
    <div style={{ color: nectarColors.muted, fontSize: 13 }}>No OT in the selected period.</div>
  );
}
