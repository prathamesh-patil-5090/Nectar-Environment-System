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
import { sSerifText18Mb12, sSerifText26Ink, sWhitePad2 } from "@/lib/styles";
import { tr, trData } from "@/lib/i18n";

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

  const chartData = useMemo(() => {
    if (!detail) return [];
    const { records, monthlyTrend } = detail;
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
        .map(([label, otHours]) => ({ label, otHours: Math.round(otHours * 100) / 100 }));
    }
    const map = new Map<string, number>();
    for (const r of records) {
      map.set(r.date, (map.get(r.date) ?? 0) + r.otHours);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, otHours]) => ({ label, otHours: Math.round(otHours * 100) / 100 }));
  }, [detail, granularity]);

  if (!detail) {
    return (
      <Empty description={tr("Employee not found")}><Button type="primary" onClick={() => router.push("/overtime/employees")}>{tr("Back")}</Button></Empty>
    );
  }

  const { employee, site, shift, summary, records } = detail;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push("/overtime/employees")}
        style={{ width: "fit-content", paddingInline: 0 }}
      >
        {tr("Employee OT")}
      </Button>

      <div style={{ background: nectarColors.white, padding: 24 }}>
        <div style={sSerifText26Ink}>{trData(employee.name)}</div>
        <div style={{ color: nectarColors.muted, marginBottom: 16 }}>{employee.id} · {trData(employee.designation)}</div>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label={tr("Site")}>
            {site ? (
              <Link href={`/overtime/sites/${site.id}`}>{trData(site.name)}</Link>
            ) : (
              "—"
            )}
          </Descriptions.Item>
          <Descriptions.Item label={tr("Department")}>{trData(employee.department)}</Descriptions.Item>
          <Descriptions.Item label={tr("Designation")}>{trData(employee.designation)}</Descriptions.Item>
          <Descriptions.Item label={tr("Shift")}>{shift?.name ?? "—"}</Descriptions.Item>
          <Descriptions.Item label={tr("Joining Date")}>{employee.joinedAt}</Descriptions.Item>
          <Descriptions.Item label={tr("Employment Status")}>
            <Tag color={employee.employmentStatus === "active" ? "success" : "default"}>{trData(employee.employmentStatus)}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}
        className="nectar-ot-summary"
      >
        <SummaryTile label={tr("Current month OT hours")} value={formatHours(summary.currentMonthHours)} />
        <SummaryTile label={tr("Current month OT days")} value={String(summary.currentMonthDays)} />
        <SummaryTile label={tr("Current month OT cost")} value={formatInr(summary.currentMonthCost)} />
        <SummaryTile label={tr("Current year OT hours")} value={formatHours(summary.currentYearHours)} />
        <SummaryTile label={tr("Current year OT days")} value={String(summary.currentYearDays)} />
        <SummaryTile label={tr("Current year OT cost")} value={formatInr(summary.currentYearCost)} />
        <SummaryTile label={tr("Previous month OT hours")} value={formatHours(summary.previousMonthHours)} />
        <SummaryTile label={tr("Previous year OT hours")} value={formatHours(summary.previousYearHours)} />
      </div>

      <div style={{ background: nectarColors.white, padding: 20 }}>
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 18 }}>{tr("Employee OT trend")}</div>
          <Radio.Group
            value={granularity}
            onChange={(e) => setGranularity(e.target.value)}
            optionType="button"
            options={[
              { label: tr("Monthly"), value: "monthly" },
              { label: tr("Weekly"), value: "weekly" },
              { label: tr("Daily"), value: "daily" },
            ]}
          />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          {granularity === "monthly" ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="otHours" stroke={nectarColors.leaf} strokeWidth={2} name={tr("OT Hours")} />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} hide={granularity === "daily" && chartData.length > 40} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="otHours" fill={nectarColors.mint} name={tr("OT Hours")} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div style={{ background: nectarColors.white, padding: 20 }}>
        <div style={sSerifText18Mb12}>{tr("Employee OT insights")}</div>
        {insights.length ? (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {insights.map((i) => (
              <li key={i.id} style={{ padding: "10px 0", borderBottom: `1px solid ${nectarColors.sand}` }}>
                <strong>{trData(i.title)}</strong>
                <div style={{ color: nectarColors.muted, fontSize: 13 }}>{trData(i.message)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: nectarColors.muted }}>{tr("No notable insights for this employee in the selected period.")}</div>
        )}
      </div>

      <div style={{ background: nectarColors.white, padding: 20 }}>
        <div style={sSerifText18Mb12}>{tr("OT records")}</div>
        <Table
          rowKey="id"
          size="small"
          pagination={{ pageSize: 8 }}
          dataSource={records}
          columns={[
            { title: tr("Date"), dataIndex: "date" },
            { title: tr("OT Hours"), dataIndex: "otHours", render: (v) => formatHours(v) },
            { title: tr("OT Cost"), dataIndex: "otCost", render: (v) => formatInr(v) },
            {
              title: tr("Status"),
              dataIndex: "status",
              render: (s: keyof typeof OT_STATUS_LABELS) => (
                <Tag>{OT_STATUS_LABELS[s]}</Tag>
              ),
            },
            { title: tr("Reason"), dataIndex: "reason", render: (r: keyof typeof OT_REASON_LABELS) => OT_REASON_LABELS[r] },
          ]}
        />
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={sWhitePad2}>
      <div style={{ fontSize: 12, color: nectarColors.muted, marginBottom: 4 }}>{trData(label)}</div>
      <div style={{ fontSize: 18, fontWeight: 650, color: nectarColors.ink }}>{trData(value)}</div>
    </div>
  );
}
