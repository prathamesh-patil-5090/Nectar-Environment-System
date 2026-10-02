"use client";

import { useState } from "react";
import Link from "next/link";
import { App, Button, Empty, Popconfirm, Segmented, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { dismissTrainingAssignment, getTrainingAssignments as fetchAssignments } from "@/lib/api/training";
import { getCourseById, getPersonName, useTrainingData } from "@/lib/training/store";
import { useAsync, useViewer } from "@/lib/training/hooks";
import type { TrainingAssignment } from "@/lib/training/types";
import FlagTrainingNeedModal from "./FlagTrainingNeedModal";

const OPEN = ["open", "in_progress", "assigned"];
const statusTag = (s: TrainingAssignment["status"]) =>
  OPEN.includes(s) ? <Tag color="blue">{s === "in_progress" ? "In progress" : "Open"}</Tag> : s === "dismissed" ? <Tag>Dismissed</Tag> : <Tag color="green">Resolved</Tag>;

/** Everything the viewer has flagged or assigned; they can dismiss open items. */
export default function MyFlagsTab() {
  const { message } = App.useApp();
  const viewer = useViewer();
  useTrainingData();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [newOpen, setNewOpen] = useState(false);
  const { data, loading, reload } = useAsync(
    () => fetchAssignments({ assignedBy: viewer.personId, status: filter === "open" ? "open" : undefined }),
    [viewer.personId, filter],
  );

  const columns: ColumnsType<TrainingAssignment> = [
    {
      title: "Employee",
      key: "emp",
      render: (_, a) => <Link href={`/employees/${a.employeeId}`}>{getPersonName(a.employeeId) ?? a.employeeId}</Link>,
    },
    {
      title: "Type",
      key: "kind",
      render: (_, a) => (a.kind === "suggested" ? <Tag color="purple">Weak area</Tag> : <Tag color="gold">Mandatory</Tag>),
    },
    {
      title: "Course / topic",
      key: "what",
      render: (_, a) => {
        const c = a.courseId ? getCourseById(a.courseId) : undefined;
        return (
          <div>
            {c ? <Link href={`/training/course/${c.id}`}>{c.code} · {c.title}</Link> : <strong>{a.topic || a.skills?.join(", ")}</strong>}
            <div style={{ fontSize: 12, color: "#4A6375" }}>{a.reason}</div>
          </div>
        );
      },
    },
    { title: "Due", dataIndex: "dueDate", render: (d?: string) => d?.slice(0, 10) ?? "—" },
    { title: "Status", dataIndex: "status", render: statusTag },
    {
      title: "",
      key: "act",
      align: "right",
      render: (_, a) =>
        OPEN.includes(a.status) ? (
          <Popconfirm
            title="Dismiss this item?"
            description="The employee will no longer see it."
            onConfirm={async () => {
              try {
                await dismissTrainingAssignment(a.id, viewer.personId!);
                message.success("Dismissed");
                void reload();
              } catch (err) {
                message.error((err as Error).message);
              }
            }}
          >
            <Button size="small">Dismiss</Button>
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Segmented value={filter} onChange={(v) => setFilter(v as "open" | "all")} options={[{ value: "open", label: "Open" }, { value: "all", label: "All" }]} />
        <Button type="primary" onClick={() => setNewOpen(true)}>Flag / assign training</Button>
      </div>
      <Table<TrainingAssignment>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data ?? []}
        scroll={{ x: 800 }}
        pagination={{ pageSize: 15, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="You haven't flagged or assigned anything" /> }}
      />
      <FlagTrainingNeedModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={reload} />
    </div>
  );
}
