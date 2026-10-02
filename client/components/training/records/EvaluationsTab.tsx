"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Empty, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { getPendingEvaluations } from "@/lib/api/training";
import { useAsync, useViewer } from "@/lib/training/hooks";
import type { PendingEvaluation } from "@/lib/training/types";
import EvaluatorScoringModal from "../EvaluatorScoringModal";

/**
 * Learners who passed the skill map and wait for an on-site practical or oral viva.
 * The Director sees everyone; a manager sees their allotted employees; HR can view only.
 */
export default function EvaluationsTab() {
  const viewer = useViewer();
  const canScore = viewer.role === "director" || viewer.role === "manager";
  const { data, loading, error, reload } = useAsync(
    () => getPendingEvaluations(canScore ? viewer.personId : undefined),
    [viewer.personId, canScore],
  );
  const [scoring, setScoring] = useState<{ row: PendingEvaluation; type: "practical" | "oral" } | null>(null);

  const columns: ColumnsType<PendingEvaluation> = [
    {
      title: "Learner",
      key: "who",
      render: (_, r) => (
        <div>
          <Link href={`/employees/${r.enrollment.employeeId}`} style={{ fontWeight: 600 }}>{r.employee?.name ?? r.enrollment.employeeId}</Link>
          <div style={{ fontSize: 12, color: "#4A6375" }}>{[r.employee?.designation, r.employee?.siteName].filter(Boolean).join(" · ")}</div>
        </div>
      ),
    },
    { title: "Course", key: "course", render: (_, r) => (r.course ? `${r.course.code} · ${r.course.title}` : r.enrollment.courseId) },
    {
      title: "Skill map / written",
      key: "scores",
      render: (_, r) => {
        const a = r.enrollment.assessments ?? {};
        return `${a.skillMap?.scorePct ?? "—"}% / ${a.written ? `${a.written.scorePct}%` : "not taken"}`;
      },
    },
    {
      title: "Next step",
      key: "next",
      render: (_, r) =>
        canScore ? (
          <Button type="primary" size="small" onClick={() => setScoring({ row: r, type: r.needs })}>
            {r.needs === "practical" ? "Score practical" : "Conduct oral viva"}
          </Button>
        ) : (
          <Tag>{r.needs === "practical" ? "Practical pending" : "Oral pending"}</Tag>
        ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Alert
        type="info"
        showIcon
        title="Practical and oral evaluations are done on site. Score each ability 1–5; the certificate is issued automatically when all 4 gates pass."
      />
      {error && <Alert type="error" title={error} action={<Button onClick={reload}>Try again</Button>} />}
      <Table<PendingEvaluation>
        rowKey={(r) => r.enrollment.id}
        loading={loading}
        columns={columns}
        dataSource={data ?? []}
        scroll={{ x: 800 }}
        pagination={{ pageSize: 15, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="Nobody is waiting for an evaluation" /> }}
      />
      {scoring?.row.course && viewer.personId && (
        <EvaluatorScoringModal
          enrollment={scoring.row.enrollment}
          course={scoring.row.course}
          candidateName={scoring.row.employee?.name ?? scoring.row.enrollment.employeeId}
          type={scoring.type}
          evaluatorId={viewer.personId}
          evaluatorName={viewer.session?.name}
          onClose={() => setScoring(null)}
          onSubmitted={reload}
        />
      )}
    </div>
  );
}
