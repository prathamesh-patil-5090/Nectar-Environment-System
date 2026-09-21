"use client";

import { useMemo, useState } from "react";
import { Switch, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  trainingItems,
  type TrainingItem,
  type TrainingPriority,
} from "@/lib/mock-data";
import { nectarColors } from "@/lib/theme";

const priorityColor: Record<TrainingPriority, string> = {
  critical: nectarColors.alert,
  high: "#D97706",
  medium: nectarColors.sky,
  low: nectarColors.muted,
};

const statusLabel = {
  overdue: "Overdue",
  "due-soon": "Due soon",
  scheduled: "Scheduled",
} as const;

const columns: ColumnsType<TrainingItem> = [
  {
    title: "Employee",
    dataIndex: "employeeName",
    key: "employeeName",
    sorter: (a, b) => a.employeeName.localeCompare(b.employeeName),
  },
  {
    title: "Site",
    dataIndex: "siteName",
    key: "siteName",
  },
  {
    title: "Course",
    dataIndex: "course",
    key: "course",
  },
  {
    title: "Due date",
    dataIndex: "dueDate",
    key: "dueDate",
    sorter: (a, b) => a.dueDate.localeCompare(b.dueDate),
  },
  {
    title: "Priority",
    dataIndex: "priority",
    key: "priority",
    render: (priority: TrainingPriority) => (
      <Tag color={priorityColor[priority]} style={{ border: "none", margin: 0 }}>
        {priority}
      </Tag>
    ),
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (status: TrainingItem["status"]) => (
      <Tag
        color={
          status === "overdue"
            ? "error"
            : status === "due-soon"
              ? "warning"
              : "default"
        }
      >
        {statusLabel[status]}
      </Tag>
    ),
  },
];

export default function TrainingPage() {
  const [urgentOnly, setUrgentOnly] = useState(false);

  const data = useMemo(() => {
    if (!urgentOnly) return trainingItems;
    return trainingItems.filter(
      (t) => t.status === "overdue" || t.status === "due-soon",
    );
  }, [urgentOnly]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
          Certifications and refresher courses for site-critical skills.
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: nectarColors.ink,
            cursor: "pointer",
          }}
        >
          <Switch checked={urgentOnly} onChange={setUrgentOnly} />
          Urgent only
        </label>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        pagination={{ pageSize: 10 }}
        style={{ background: nectarColors.white }}
      />
    </div>
  );
}
