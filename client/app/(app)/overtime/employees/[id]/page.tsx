"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Descriptions,
  Empty,
  Radio,
  Table,
  Tag,
} from "antd";
import {
  ArrowLeftOutlined,
} from "@ant-design/icons";
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
import {
  formatHours,
  formatInr,
  getEmployeeInsights,
  getEmployeeOtDetail,
  OT_REASON_LABELS,
  OT_STATUS_LABELS,
  defaultOtFilters,
} from "@/lib/overtime";
import { nectarColors } from "@/lib/theme";

export default function OtEmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [granularity, setGranularity] = useState<"monthly" | "weekly" | "daily">(
    "monthly",
  );
  const filters = defaultOtFilters();
  const detail = useMemo(
    () => getEmployeeOtDetail(id, filters),
    [id, filters],
  );
  const insights = useMemo(
    () => getEmployeeInsights(id, filters),
    [id, filters],
  );

  if (!detail) {
    return (
      <Empty description="Employee not found">
        <Button type="primary" onClick={() => router.push("/overtime/employees")}>
          Back
        </Button>
      </Empty>
    );
  }

  const { employee, site, shift, summary, records, monthlyTrend } = detail;

  const chartData = useMemo(() => {
    if (granularity === "monthly") {
      return monthlyTrend.map((m) => ({ label: m.month, otHours: m.otHours }));
    }
    if (granularity === "weekly") {
      const map = new Map<string, number>();
      for (const r of records) {
        const d = new Date(r.date + "T00:00:00Z");
        const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const week = Math.ceil(
          ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getUTCDay() + 1) /
            7,
        );
        const key = `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
        map.set(key, (map.get(key) ?? 0) + r.otHours);
      }
      return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, otHours]) => ({
          label,
          otHours: Math.round(otHours * 100) / 100,
        }));
    }
    const map = new Map<string, number>();
    for (const r of records) {
      map.set(r.date, (map.get(r.date) ?? 0) + r.otHours);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, otHours]) => ({
        label,
        otHours: Math.round(otHours * 100) / 100,
      }));
  }, [granularity, monthlyTrend, records]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push("/overtime/employees")}
        style={{ width: "fit-content", paddingInline: 0 }}
      >
        Employee OT
      </Button>

      <div style={{ background: nectarColors.white, padding: 24 }}>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 26,
            color: nectarColors.ink,
          }}
        >
          {employee.name}
        </div>
        <div style={{ color: nectarColors.muted, marginBottom: 16 }}>
          {employee.id} · {employee.designation}
        </div>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Site">
            {site ? (
              <Link href={`/overtime/sites/${site.id}`}>{site.name}</Link>
            ) : (
              "—"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Department">
            {employee.department}
          </Descriptions.Item>
          <Descriptions.Item label="Designation">
            {employee.designation}
          </Descriptions.Item>
          <Descriptions.Item label="Shift">
            {shift?.name ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Joining Date">
            {employee.joinedAt}
          </Descriptions.Item>
          <Descriptions.Item label="Employment Status">
            <Tag color={employee.employmentStatus === "active" ? "success" : "default"}>
              {employee.employmentStatus}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
        className="nectar-ot-summary"
      >
        <SummaryTile label="Current month OT hours" value={formatHours(summary.currentMonthHours)} />
        <SummaryTile label="Current month OT days" value={String(summary.currentMonthDays)} />
        <SummaryTile label="Current month OT cost" value={formatInr(summary.currentMonthCost)} />
        <SummaryTile label="Current year OT hours" value={formatHours(summary.currentYearHours)} />
        <SummaryTile label="Current year OT days" value={String(summary.currentYearDays)} />
        <SummaryTile label="Current year OT cost" value={formatInr(summary.currentYearCost)} />
        <SummaryTile label="Previous month OT hours" value={formatHours(summary.previousMonthHours)} />
        <SummaryTile label="Previous year OT hours" value={formatHours(summary.previousYearHours)} />
      </div>

      <div style={{ background: nectarColors.white, padding: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: 18,
            }}
          >
            Employee OT trend
          </div>
          <Radio.Group
            value={granularity}
            onChange={(e) => setGranularity(e.target.value)}
            optionType="button"
            options={[
              { label: "Monthly", value: "monthly" },
              { label: "Weekly", value: "weekly" },
              { label: "Daily", value: "daily" },
            ]}
          />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          {granularity === "monthly" ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5EDE9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="otHours"
                stroke={nectarColors.leaf}
                strokeWidth={2}
                name="OT Hours"
              />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5EDE9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} hide={granularity === "daily" && chartData.length > 40} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="otHours" fill={nectarColors.mint} name="OT Hours" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div style={{ background: nectarColors.white, padding: 20 }}>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          Employee OT insights
        </div>
        {insights.length ? (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {insights.map((i) => (
              <li
                key={i.id}
                style={{
                  padding: "10px 0",
                  borderBottom: `1px solid ${nectarColors.sand}`,
                }}
              >
                <strong>{i.title}</strong>
                <div style={{ color: nectarColors.muted, fontSize: 13 }}>
                  {i.message}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: nectarColors.muted }}>
            No notable insights for this employee in the selected period.
          </div>
        )}
      </div>

      <div style={{ background: nectarColors.white, padding: 20 }}>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          OT records
        </div>
        <Table
          rowKey="id"
          size="small"
          pagination={{ pageSize: 8 }}
          dataSource={records}
          columns={[
            { title: "Date", dataIndex: "date" },
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
            {
              title: "Status",
              dataIndex: "status",
              render: (s: keyof typeof OT_STATUS_LABELS) => (
                <Tag>{OT_STATUS_LABELS[s]}</Tag>
              ),
            },
            {
              title: "Reason",
              dataIndex: "reason",
              render: (r: keyof typeof OT_REASON_LABELS) => OT_REASON_LABELS[r],
            },
          ]}
        />
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: nectarColors.white,
        padding: 14,
        borderLeft: `3px solid ${nectarColors.leaf}`,
      }}
    >
      <div style={{ fontSize: 12, color: nectarColors.muted }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 650, color: nectarColors.ink }}>
        {value}
      </div>
    </div>
  );
}
