"use client";

import { useMemo, useState } from "react";
import { Select, Table, Tag } from "antd";
import { employees, getSiteName, sites } from "@/lib/mock-data";
import {
  getDeviationAggregates,
  getDeviations,
  getOtByShiftCause,
  getShiftInsights,
} from "@/lib/shift";
import { nectarColors } from "@/lib/theme";
import { gridGap16, sSerifText18Mb12, sSerifText22, sWhitePadR10 } from "@/lib/styles";

export default function ShiftDeviationsPage() {
  const [siteId, setSiteId] = useState<string>();
  const rows = useMemo(() => getDeviations(siteId), [siteId]);
  const agg = useMemo(() => getDeviationAggregates(), []);
  const insights = useMemo(() => getShiftInsights(siteId), [siteId]);
  const ot = useMemo(() => getOtByShiftCause(), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={sSerifText22}>Shift deviation</div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>Planned vs actual shift — linked to OT analysis for unplanned changes.</p>
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
        rowKey="siteId"
        pagination={false}
        dataSource={agg.filter((a) => !siteId || a.siteId === siteId)}
        style={{ background: nectarColors.white }}
        columns={[
          { title: "Site", dataIndex: "siteName" },
          { title: "Deviations", dataIndex: "deviations" },
          { title: "Employees affected", dataIndex: "employeesAffected" },
          { title: "OT associated", dataIndex: "otHoursAssociated", render: (h) => `${h} hrs` },
        ]}
      />

      <Table
        rowKey="id"
        dataSource={rows}
        pagination={{ pageSize: 10 }}
        style={{ background: nectarColors.white }}
        columns={[
          { title: "Date", dataIndex: "date" },
          {
            title: "Employee",
            dataIndex: "employeeId",
            render: (id) => employees.find((e) => e.id === id)?.name ?? id,
          },
          { title: "Site", dataIndex: "siteId", render: (id) => getSiteName(id) },
          { title: "Planned", dataIndex: "plannedCode", render: (c) => <Tag>{c}</Tag> },
          { title: "Actual", dataIndex: "actualCode", render: (c) => <Tag color={nectarColors.alert}>{c}</Tag> },
          { title: "Deviation", key: "d", render: () => <Tag color={nectarColors.alert}>Yes</Tag> },
        ]}
      />

      <div style={gridGap16} className="nectar-ot-two">
        <div style={sWhitePadR10}>
          <div style={sSerifText18Mb12}>OT after shift changes</div>
          <div style={{ fontSize: 28, fontWeight: 650, color: nectarColors.alert }}>{insights.otAfterChanges} hrs</div>
          <p style={{ color: nectarColors.muted, fontSize: 13 }}>
            Observation from unplanned deviations in the selected period — not a
            judgment of cause.
          </p>
        </div>
        <div style={sWhitePadR10}>
          <div style={sSerifText18Mb12}>Shift with highest OT</div>
          <Table
            size="small"
            pagination={false}
            rowKey="code"
            dataSource={[...ot.byShift].sort((a, b) => b.otHours - a.otHours)}
            columns={[
              { title: "Shift", dataIndex: "shift" },
              { title: "OT Hours", dataIndex: "otHours", render: (h) => `${h} hrs` },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
