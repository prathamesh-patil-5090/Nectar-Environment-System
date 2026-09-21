"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { employees, getSiteName, type Employee } from "@/lib/mock-data";
import { nectarColors } from "@/lib/theme";

const statusColor = {
  compliant: "success",
  "due-soon": "warning",
  overdue: "error",
} as const;

const statusLabel = {
  compliant: "Compliant",
  "due-soon": "Due soon",
  overdue: "Overdue",
} as const;

const columns: ColumnsType<Employee> = [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    sorter: (a, b) => a.name.localeCompare(b.name),
    render: (name: string, record) => (
      <Link
        href={`/employees/${record.id}`}
        style={{ color: nectarColors.leaf, fontWeight: 600 }}
      >
        {name}
      </Link>
    ),
  },
  {
    title: "Role",
    dataIndex: "role",
    key: "role",
    filters: [...new Set(employees.map((e) => e.role))].map((role) => ({
      text: role,
      value: role,
    })),
    onFilter: (value, record) => record.role === value,
  },
  {
    title: "Site",
    key: "site",
    render: (_, record) => getSiteName(record.siteId),
  },
  {
    title: "Skill score",
    dataIndex: "skillScore",
    key: "skillScore",
    sorter: (a, b) => a.skillScore - b.skillScore,
    render: (score: number) => (
      <span
        style={{
          fontWeight: 600,
          color: score < 70 ? nectarColors.alert : nectarColors.ink,
        }}
      >
        {score}%
      </span>
    ),
  },
  {
    title: "Training",
    dataIndex: "trainingStatus",
    key: "trainingStatus",
    filters: [
      { text: "Compliant", value: "compliant" },
      { text: "Due soon", value: "due-soon" },
      { text: "Overdue", value: "overdue" },
    ],
    onFilter: (value, record) => record.trainingStatus === value,
    render: (status: Employee["trainingStatus"]) => (
      <Tag color={statusColor[status]}>{statusLabel[status]}</Tag>
    ),
  },
];

export default function EmployeesPage() {
  const router = useRouter();

  return (
    <div>
      <p style={{ margin: "0 0 16px", color: nectarColors.muted, fontSize: 14 }}>
        Deputed operators, technicians, and supervisors across O&amp;M sites.
      </p>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={employees}
        pagination={{ pageSize: 10 }}
        style={{ background: nectarColors.white }}
        onRow={(record) => ({
          onClick: (event) => {
            const target = event.target as HTMLElement;
            if (target.closest("a")) return;
            router.push(`/employees/${record.id}`);
          },
          style: { cursor: "pointer" },
        })}
      />
    </div>
  );
}
