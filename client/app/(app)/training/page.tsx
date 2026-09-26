"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { App, Button, Switch, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { getSession } from "@/lib/auth";
import {
  getEmployeeById,
  type TrainingItem,
  type TrainingPriority,
} from "@/lib/mock-data";
import { getTrainingItems, markTrainingCompleted } from "@/lib/training";
import {
  canEnterLeaveForOthers,
  scopedEmployeeId,
  scopedSiteId,
  selfEmployeeId,
} from "@/lib/rbac";
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
  completed: "Completed",
} as const;

export default function TrainingPage() {
  const { message } = App.useApp();
  const session = getSession();
  const searchParams = useSearchParams();
  const mineParam = searchParams?.get("mine") === "1";
  const empScope = scopedEmployeeId(session);
  const selfId = selfEmployeeId(session);
  const isPersonal = Boolean(empScope) || mineParam;
  const targetEmpId = empScope ?? (mineParam ? selfId : undefined);
  const siteScope = scopedSiteId(session);
  const canMarkForOthers = canEnterLeaveForOthers(session) && !isPersonal;
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [tick, setTick] = useState(0);

  const data = useMemo(() => {
    void tick;
    let rows = getTrainingItems();
    if (isPersonal && targetEmpId) {
      rows = rows.filter((t) => t.employeeId === targetEmpId);
    } else if (empScope) {
      rows = rows.filter((t) => t.employeeId === empScope);
    } else if (siteScope) {
      rows = rows.filter((t) => {
        const emp = getEmployeeById(t.employeeId);
        return emp?.siteId === siteScope;
      });
    }
    if (urgentOnly) {
      rows = rows.filter(
        (t) => t.status === "overdue" || t.status === "due-soon",
      );
    }
    return rows;
  }, [isPersonal, targetEmpId, empScope, siteScope, urgentOnly, tick]);

  const columns: ColumnsType<TrainingItem> = [
    ...(!isPersonal
      ? ([
          {
            title: "Employee",
            dataIndex: "employeeName",
            key: "employeeName",
            sorter: (a: TrainingItem, b: TrainingItem) =>
              a.employeeName.localeCompare(b.employeeName),
            render: (name: string, record: TrainingItem) => (
              <Link
                href={`/employees/${record.employeeId}`}
                style={{ color: nectarColors.leaf, fontWeight: 600 }}
              >
                {name}
              </Link>
            ),
          },
          {
            title: "Site",
            dataIndex: "siteName",
            key: "siteName",
          },
        ] as ColumnsType<TrainingItem>)
      : []),
    {
      title: "Course",
      dataIndex: "course",
      key: "course",
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (p: TrainingPriority) => (
        <Tag color={priorityColor[p]} style={{ border: "none" }}>
          {p}
        </Tag>
      ),
    },
    {
      title: "Due",
      dataIndex: "dueDate",
      key: "dueDate",
      sorter: (a, b) => a.dueDate.localeCompare(b.dueDate),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "Overdue", value: "overdue" },
        { text: "Due soon", value: "due-soon" },
        { text: "Scheduled", value: "scheduled" },
        { text: "Completed", value: "completed" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: TrainingItem["status"]) => (
        <Tag
          color={
            status === "overdue"
              ? "error"
              : status === "due-soon"
                ? "warning"
                : status === "completed"
                  ? "success"
                  : "default"
          }
        >
          {statusLabel[status]}
        </Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_, row) => {
        const allow =
          row.status !== "completed" &&
          ((empScope && row.employeeId === empScope) ||
            (canMarkForOthers && !empScope));
        if (!allow) return "—";
        return (
          <Button
            size="small"
            type="primary"
            onClick={() => {
              markTrainingCompleted(row.id);
              message.success("Marked completed");
              setTick((t) => t + 1);
            }}
          >
            Mark completed
          </Button>
        );
      },
    },
  ];

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
          {isPersonal
            ? "Your assigned, completed, and upcoming training courses."
            : "Certifications and refresher courses for site-critical skills."}
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
