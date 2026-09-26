"use client";

import { Progress, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { sites, type Site } from "@/lib/mock-data";
import { nectarColors } from "@/lib/theme";

const plantColor: Record<Site["plantType"], string> = {
  ETP: nectarColors.leaf,
  STP: nectarColors.sky,
  WTP: nectarColors.mint,
  RO: "#0E7490",
  MEE: "#7C3AED",
};

const columns: ColumnsType<Site> = [
  {
    title: "Site",
    dataIndex: "name",
    key: "name",
    sorter: (a, b) => a.name.localeCompare(b.name),
  },
  {
    title: "Plant type",
    dataIndex: "plantType",
    key: "plantType",
    filters: ["ETP", "RO", "MEE", "STP", "WTP"].map((t) => ({ text: t, value: t })),
    onFilter: (value, record) => record.plantType === value,
    render: (type: Site["plantType"]) => (
      <Tag color={plantColor[type]} style={{ border: "none" }}>
        {type}
      </Tag>
    ),
  },
  {
    title: "Location",
    dataIndex: "location",
    key: "location",
  },
  {
    title: "Headcount",
    dataIndex: "headcount",
    key: "headcount",
    sorter: (a, b) => a.headcount - b.headcount,
  },
  {
    title: "Readiness",
    dataIndex: "readiness",
    key: "readiness",
    sorter: (a, b) => a.readiness - b.readiness,
    render: (readiness: number) => (
      <div style={{ minWidth: 140 }}>
        <Progress
          percent={readiness}
          size="small"
          strokeColor={
            readiness < 70
              ? nectarColors.alert
              : readiness < 85
                ? nectarColors.sky
                : nectarColors.mint
          }
        />
      </div>
    ),
  },
];

export default function SitesPage() {
  return (
    <div>
      <p style={{ margin: "0 0 16px", color: nectarColors.muted, fontSize: 14 }}>
        Treatment facilities under operation and maintenance.
      </p>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={sites}
        pagination={false}
        style={{ background: nectarColors.white }}
      />
    </div>
  );
}
