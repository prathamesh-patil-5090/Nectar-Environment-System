"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Empty, Table } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
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
import { useOtFilters } from "@/components/overtime/OtFilterContext";
import {
  formatHours,
  formatInr,
  getSiteOtDetail,
} from "@/lib/overtime";
import { nectarColors } from "@/lib/theme";

export default function OtSiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { filters } = useOtFilters();
  const detail = getSiteOtDetail(id, filters);

  if (!detail) {
    return (
      <Empty description="Site not found">
        <Button type="primary" onClick={() => router.push("/overtime/sites")}>
          Back
        </Button>
      </Empty>
    );
  }

  const { site, summary, employees, departments, shifts, monthlyTrend } = detail;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push("/overtime/sites")}
        style={{ width: "fit-content", paddingInline: 0 }}
      >
        Site OT
      </Button>

      <div style={{ background: nectarColors.white, padding: 24 }}>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 26,
            color: nectarColors.ink,
          }}
        >
          {site.name}
        </div>
        <div style={{ color: nectarColors.muted }}>
          {site.plantType} · {site.location}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
        className="nectar-ot-summary"
      >
        <Tile label="Total employees" value={String(summary.totalEmployees)} />
        <Tile label="OT employees" value={String(summary.otEmployees)} />
        <Tile label="OT hours" value={formatHours(summary.otHours)} />
        <Tile label="OT days" value={String(summary.otDays)} />
        <Tile label="OT cost" value={formatInr(summary.otCost)} />
        <Tile
          label="Avg OT / employee"
          value={formatHours(summary.avgOtPerEmployee)}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
        className="nectar-ot-two"
      >
        <Panel title="Department breakdown">
          <Table
            size="small"
            pagination={false}
            rowKey="department"
            dataSource={departments}
            columns={[
              { title: "Department", dataIndex: "department" },
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
        <Panel title="Shift breakdown">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={shifts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5EDE9" />
              <XAxis dataKey="shiftName" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="otHours" fill={nectarColors.sky} name="OT Hours" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Monthly trend">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5EDE9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="h" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="c" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line
              yAxisId="h"
              type="monotone"
              dataKey="otHours"
              stroke={nectarColors.leaf}
              name="OT Hours"
            />
            <Line
              yAxisId="c"
              type="monotone"
              dataKey="otCost"
              stroke={nectarColors.alert}
              name="OT Cost"
            />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Employee breakdown">
        <Table
          size="small"
          rowKey="employeeId"
          pagination={{ pageSize: 8 }}
          dataSource={employees}
          columns={[
            {
              title: "Employee",
              dataIndex: "employeeName",
              render: (name, r) => (
                <Link href={`/overtime/employees/${r.employeeId}`}>{name}</Link>
              ),
            },
            { title: "Department", dataIndex: "department" },
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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: nectarColors.white,
        padding: 14,
        borderLeft: `3px solid ${nectarColors.mint}`,
      }}
    >
      <div style={{ fontSize: 12, color: nectarColors.muted }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 650 }}>{value}</div>
    </div>
  );
}
