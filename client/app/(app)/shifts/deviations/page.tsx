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
import { tr, trCell, trData } from "@/lib/i18n";

export default function ShiftDeviationsPage() {
  const [siteId, setSiteId] = useState<string>();
  const rows = useMemo(() => getDeviations(siteId), [siteId]);
  const agg = useMemo(() => getDeviationAggregates(), []);
  const insights = useMemo(() => getShiftInsights(siteId), [siteId]);
  const ot = useMemo(() => getOtByShiftCause(), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={sSerifText22}>{tr("Shift deviation")}</div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>{tr("Planned vs actual shift — linked to OT analysis for unplanned changes.")}</p>
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
        rowKey="siteId"
        pagination={false}
        dataSource={agg.filter((a) => !siteId || a.siteId === siteId)}
        style={{ background: nectarColors.white }}
        columns={[
          { title: tr("Site"), dataIndex: "siteName", render: trCell },
          { title: tr("Deviations"), dataIndex: "deviations", render: trCell },
          { title: tr("Employees affected"), dataIndex: "employeesAffected", render: trCell },
          { title: tr("OT associated"), dataIndex: "otHoursAssociated", render: (h) => tr("{h} hrs", { h }) },
        ]}
      />

      <Table
        rowKey="id"
        dataSource={rows}
        pagination={{ pageSize: 10 }}
        style={{ background: nectarColors.white }}
        columns={[
          { title: tr("Date"), dataIndex: "date" },
          {
            title: tr("Employee"),
            dataIndex: "employeeId",
            render: (id) => trData(employees.find((e) => e.id === id)?.name ?? id),
          },
          { title: tr("Site"), dataIndex: "siteId", render: (id) => trData(getSiteName(id)) },
          { title: tr("Planned"), dataIndex: "plannedCode", render: (c) => <Tag>{trData(c)}</Tag> },
          { title: tr("Actual"), dataIndex: "actualCode", render: (c) => <Tag color={nectarColors.alert}>{trData(c)}</Tag> },
          { title: tr("Deviation"), key: "d", render: () => <Tag color={nectarColors.alert}>{tr("Yes")}</Tag> },
        ]}
      />

      <div style={gridGap16} className="nectar-ot-two">
        <div style={sWhitePadR10}>
          <div style={sSerifText18Mb12}>{tr("OT after shift changes")}</div>
          <div style={{ fontSize: 28, fontWeight: 650, color: nectarColors.alert }}>{tr("{otAfterChanges} hrs", { otAfterChanges: insights.otAfterChanges })}</div>
          <p style={{ color: nectarColors.muted, fontSize: 13 }}>
            {tr("Observation from unplanned deviations in the selected period — not a judgment of cause.")}
          </p>
        </div>
        <div style={sWhitePadR10}>
          <div style={sSerifText18Mb12}>{tr("Shift with highest OT")}</div>
          <Table
            size="small"
            pagination={false}
            rowKey="code"
            dataSource={[...ot.byShift].sort((a, b) => b.otHours - a.otHours)}
            columns={[
              { title: tr("Shift"), dataIndex: "shift", render: trCell },
              { title: tr("OT Hours"), dataIndex: "otHours", render: (h) => tr("{h} hrs", { h }) },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
