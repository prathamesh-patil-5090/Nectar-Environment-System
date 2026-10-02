"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Empty, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { getTrainingAssignments as fetchAssignments } from "@/lib/api/training";
import { getTrainingItems, useTrainingData } from "@/lib/training/store";
import { useAsync, useViewer } from "@/lib/training/hooks";
import type { TrainingItem } from "@/lib/mock-data";
import FlagTrainingNeedModal, { flaggableIds } from "./FlagTrainingNeedModal";

const STATUS: Record<TrainingItem["status"], { color: string; label: string }> = {
  overdue: { color: "red", label: "Overdue" },
  "due-soon": { color: "gold", label: "Due soon" },
  scheduled: { color: "blue", label: "In progress" },
  completed: { color: "green", label: "Completed" },
};

/** Employee profile → Training: real rows from the database, open weak-area flags, and Flag / assign. */
export default function EmployeeTrainingSection({ employeeId }: { employeeId: string }) {
  const viewer = useViewer();
  const { version, ready } = useTrainingData();
  const [flagOpen, setFlagOpen] = useState(false);
  const canFlag = flaggableIds(viewer).has(employeeId);
  const rows = useMemo(() => {
    void version;
    return getTrainingItems({ employeeId });
  }, [employeeId, version]);
  const flags = useAsync(() => fetchAssignments({ employeeId, kind: "suggested", status: "open" }), [employeeId, flagOpen]);

  const columns: ColumnsType<TrainingItem> = [
    { title: "Course", dataIndex: "course" },
    { title: "Due", dataIndex: "dueDate", render: (d: string) => d || "—" },
    { title: "Completed", dataIndex: "completedAt", render: (d?: string) => d ?? "—" },
    { title: "Score", dataIndex: "score", render: (s?: number) => (typeof s === "number" ? `${s}%` : "—") },
    { title: "Status", dataIndex: "status", render: (s: TrainingItem["status"]) => <Tag color={STATUS[s].color}>{STATUS[s].label}</Tag> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Training</div>
        <div style={{ display: "flex", gap: 8 }}>
          {canFlag && <Button type="primary" onClick={() => setFlagOpen(true)}>Flag / assign training</Button>}
          <Link href="/training"><Button>Training</Button></Link>
        </div>
      </div>
      {(flags.data ?? []).length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ color: "#4A6375" }}>Open weak-area flags:</span>
          {(flags.data ?? []).map((f) => (
            <Tag key={f.id} color="purple" title={f.reason}>
              {f.topic || f.skills?.join(", ")} · {f.assignedByName}
            </Tag>
          ))}
        </div>
      )}
      {ready && rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No training records for this employee." />
      ) : (
        <Table rowKey="id" columns={columns} dataSource={rows} loading={!ready} pagination={{ pageSize: 8, hideOnSinglePage: true }} size="middle" scroll={{ x: 640 }} />
      )}
      <FlagTrainingNeedModal open={flagOpen} initialEmployeeIds={[employeeId]} onClose={() => setFlagOpen(false)} />
    </div>
  );
}
