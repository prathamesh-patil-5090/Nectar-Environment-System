"use client";

import { useMemo, useState } from "react";
import { App, Button, Select, Table, Tag } from "antd";
import { getSiteName, sites } from "@/lib/mock-data";
import {
  ACTIVE_PATTERN,
  EFFECTIVE,
  generateNextRotation,
  getRotationPreviews,
  getRotationRows,
  getShiftByCode,
} from "@/lib/shift";
import { nectarColors } from "@/lib/theme";

export default function ShiftRotationPage() {
  const { message } = App.useApp();
  const [siteId, setSiteId] = useState<string>();
  const [tick, setTick] = useState(0);
  const rows = useMemo(() => getRotationRows(siteId), [siteId, tick]);
  const previews = useMemo(() => getRotationPreviews(), [tick]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
          }}
        >
          Employee rotation schedule
        </div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>
          Pattern: <strong>{ACTIVE_PATTERN.name}</strong> — {ACTIVE_PATTERN.description}{" "}
          Next effective date: <strong>{EFFECTIVE}</strong>
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Select
          allowClear
          placeholder="Site"
          style={{ width: 220 }}
          value={siteId}
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
          onChange={setSiteId}
        />
        <Button
          type="primary"
          disabled={!siteId}
          onClick={() => {
            if (!siteId) return;
            generateNextRotation(siteId);
            message.success("Next rotation draft generated for review.");
            setTick((t) => t + 1);
          }}
        >
          Generate next schedule
        </Button>
      </div>

      <Table
        rowKey="employeeId"
        dataSource={rows}
        pagination={{ pageSize: 10 }}
        style={{ background: nectarColors.white }}
        columns={[
          { title: "Employee", dataIndex: "employeeName" },
          {
            title: "Site",
            dataIndex: "siteId",
            render: (id) => getSiteName(id),
          },
          { title: "Group", dataIndex: "groupId" },
          {
            title: "Current",
            dataIndex: "currentCode",
            render: (c) => (
              <Tag color={getShiftByCode(c)?.color}>{c}</Tag>
            ),
          },
          {
            title: "Next",
            dataIndex: "nextCode",
            render: (c) => (
              <Tag color={getShiftByCode(c)?.color}>{c}</Tag>
            ),
          },
          { title: "Effective", dataIndex: "effectiveDate" },
        ]}
      />

      <div
        style={{
          background: nectarColors.white,
          padding: 20,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          Generated schedules pending review
        </div>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={previews}
          columns={[
            { title: "From", dataIndex: "fromDate" },
            { title: "To", dataIndex: "toDate" },
            {
              title: "Site",
              dataIndex: "siteId",
              render: (id) => getSiteName(id),
            },
            { title: "Employees", dataIndex: "employeesAffected" },
            {
              title: "Change",
              key: "ch",
              render: (_, r) => `${r.fromCode} → ${r.toCode}`,
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (s) => <Tag>{s}</Tag>,
            },
          ]}
        />
      </div>
    </div>
  );
}
