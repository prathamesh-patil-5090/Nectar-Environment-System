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
import { gridGap16, sSerifText26Ink, sWhitePad2 } from "@/lib/styles";
import SharedPanel from "@/components/Panel";
import { tr, trData, trCell } from "@/lib/i18n";

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
      <Empty description={tr("Site not found")}><Button type="primary" onClick={() => router.push("/overtime/sites")}>{tr("Back")}</Button></Empty>
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
        {tr("Site OT")}
      </Button>

      <div style={{ background: nectarColors.white, padding: 24 }}>
        <div style={sSerifText26Ink}>{trData(site.name)}</div>
        <div style={{ color: nectarColors.muted }}>{trData(site.plantType)} · {trData(site.location)}</div>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}
        className="nectar-ot-summary"
      >
        <Tile label={tr("Total employees")} value={String(summary.totalEmployees)} />
        <Tile label={tr("OT employees")} value={String(summary.otEmployees)} />
        <Tile label={tr("OT hours")} value={formatHours(summary.otHours)} />
        <Tile label={tr("OT days")} value={String(summary.otDays)} />
        <Tile label={tr("OT cost")} value={formatInr(summary.otCost)} />
        <Tile label={tr("Avg OT / employee")} value={formatHours(summary.avgOtPerEmployee)} />
      </div>

      <div style={gridGap16} className="nectar-ot-two">
        <Panel title={tr("Department breakdown")}>
          <Table
            size="small"
            pagination={false}
            rowKey="department"
            dataSource={departments}
            columns={[
              { title: tr("Department"), dataIndex: "department", render: trCell },
              { title: tr("OT Hours"), dataIndex: "otHours", render: (v) => formatHours(v) },
              { title: tr("OT Cost"), dataIndex: "otCost", render: (v) => formatInr(v) },
            ]}
          />
        </Panel>
        <Panel title={tr("Shift breakdown")}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={shifts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="shiftName" tick={{ fontSize: 11 }} tickFormatter={(v) => String(trData(String(v)))} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="otHours" fill={nectarColors.sky} name={tr("OT Hours")} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title={tr("Monthly trend")}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="h" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="c" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line yAxisId="h" type="monotone" dataKey="otHours" stroke={nectarColors.leaf} name={tr("OT Hours")} />
            <Line yAxisId="c" type="monotone" dataKey="otCost" stroke={nectarColors.alert} name={tr("OT Cost")} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title={tr("Employee breakdown")}>
        <Table
          size="small"
          rowKey="employeeId"
          pagination={{ pageSize: 8 }}
          dataSource={employees}
          columns={[
            {
              title: tr("Employee"),
              dataIndex: "employeeName",
              render: (name, r) => (
                <Link href={`/overtime/employees/${r.employeeId}`}>{trData(name)}</Link>
              ),
            },
            { title: tr("Department"), dataIndex: "department", render: trCell },
            { title: tr("OT Hours"), dataIndex: "otHours", render: (v) => formatHours(v) },
            { title: tr("OT Cost"), dataIndex: "otCost", render: (v) => formatInr(v) },
            { title: tr("OT Days"), dataIndex: "otDays", render: trCell },
          ]}
        />
      </Panel>
    </div>
  );
}

function Panel(props: { title: string; children: React.ReactNode }) {
  return <SharedPanel {...props} boxStyle={{ background: nectarColors.white, padding: 20 }} />;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div style={sWhitePad2}>
      <div style={{ fontSize: 12, color: nectarColors.muted, marginBottom: 4 }}>{trData(label)}</div>
      <div style={{ fontSize: 18, fontWeight: 650, color: nectarColors.ink }}>{trData(value)}</div>
    </div>
  );
}
