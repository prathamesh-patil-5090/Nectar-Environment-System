"use client";

import { useMemo, useState } from "react";
import { DatePicker, Select, Table, Tag } from "antd";
import dayjs from "dayjs";
import { employees, getSiteName, sites } from "@/lib/mock-data";
import { TODAY, getPlannedDays, getShiftMasterById } from "@/lib/shift";
import { nectarColors } from "@/lib/theme";
import { sSerifText22 } from "@/lib/styles";

export default function ShiftSchedulePage() {
  const [siteId, setSiteId] = useState<string>();
  const [employeeId, setEmployeeId] = useState<string>();
  const [range, setRange] = useState<[string, string]>([
    TODAY,
    dayjs(TODAY).add(7, "day").format("YYYY-MM-DD"),
  ]);

  const rows = useMemo(
    () =>
      getPlannedDays({ siteId, employeeId, from: range[0], to: range[1] }),
    [siteId, employeeId, range],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={sSerifText22}>Shift schedule</div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>Forward-looking planned shifts (Current → Next → Future).</p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Select
          allowClear
          placeholder="Site"
          style={{ width: 200 }}
          value={siteId}
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
          onChange={setSiteId}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Employee"
          style={{ width: 200 }}
          value={employeeId}
          options={employees.map((e) => ({ value: e.id, label: e.name }))}
          onChange={setEmployeeId}
        />
        <DatePicker.RangePicker
          value={[dayjs(range[0]), dayjs(range[1])]}
          onChange={(d) => {
            if (d?.[0] && d?.[1]) {
              setRange([d[0].format("YYYY-MM-DD"), d[1].format("YYYY-MM-DD")]);
            }
          }}
        />
      </div>

      <Table
        rowKey="id"
        size="middle"
        dataSource={rows}
        pagination={{ pageSize: 12 }}
        scroll={{ x: 900 }}
        style={{ background: nectarColors.white }}
        columns={[
          { title: "Date", dataIndex: "date", width: 110 },
          {
            title: "Employee",
            dataIndex: "employeeId",
            render: (id) => employees.find((e) => e.id === id)?.name ?? id,
          },
          { title: "Site", dataIndex: "siteId", render: (id) => getSiteName(id) },
          {
            title: "Planned",
            dataIndex: "plannedCode",
            render: (c, r) =>
              c === "OFF" ? (
                <Tag>Weekly Off</Tag>
              ) : (
                <Tag color={getShiftMasterById(r.plannedShiftId)?.color}>{c}</Tag>
              ),
          },
          { title: "Actual", dataIndex: "actualCode", render: (c) => (c ? <Tag>{c}</Tag> : "—") },
          {
            title: "Deviation",
            key: "dev",
            render: (_, r) =>
              r.actualCode &&
              r.plannedCode !== "OFF" &&
              r.actualCode !== r.plannedCode ? (
                <Tag color={nectarColors.alert}>Yes</Tag>
              ) : (
                <Tag>No</Tag>
              ),
          },
          { title: "Status", dataIndex: "status" },
        ]}
      />
    </div>
  );
}
