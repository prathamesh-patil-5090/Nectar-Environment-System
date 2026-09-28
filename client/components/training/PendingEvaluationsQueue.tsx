"use client";

import React from "react";
import { Table, Tag, Button, Empty } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  FileProtectOutlined,
  CommentOutlined,
} from "@ant-design/icons";
import type { Course, CourseEnrollment } from "@/lib/training/types";
import { getPendingEvaluations } from "@/lib/training/store";
import { nectarColors } from "@/lib/theme";

interface PendingEvaluationsQueueProps {
  siteScope?: string;
  canEvaluate?: boolean;
  onScorePractical: (enrollment: CourseEnrollment, candidateName: string, course: Course) => void;
  onScoreOral: (enrollment: CourseEnrollment, candidateName: string, course: Course) => void;
}

export default function PendingEvaluationsQueue({
  siteScope,
  canEvaluate = true,
  onScorePractical,
  onScoreOral,
}: PendingEvaluationsQueueProps) {
  const [selectedSite, setSelectedSite] = React.useState<string>(siteScope ?? "all");
  const activeSite = siteScope ?? (selectedSite === "all" ? undefined : selectedSite);
  const pending = getPendingEvaluations(activeSite);

  const columns: ColumnsType<any> = [
    {
      title: "Candidate Operator",
      key: "employee",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: nectarColors.ink, fontSize: 14 }}>
            {r.employeeName}
          </div>
          <div style={{ fontSize: 11, color: nectarColors.muted }}>
            {r.employeeDesignation} · {r.siteName}
          </div>
        </div>
      ),
    },
    {
      title: "Course Curriculum",
      dataIndex: "course",
      key: "course",
      render: (c: Course) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: nectarColors.ink }}>
            {c?.title}
          </div>
          <div style={{ fontSize: 11, color: nectarColors.muted }}>
            Code: {c?.code} · {c?.section}
          </div>
        </div>
      ),
    },
    {
      title: "Skill Map Score",
      dataIndex: "skillMapScore",
      key: "skillMapScore",
      align: "center",
      render: (s: number) => (
        <Tag color="success" style={{ borderRadius: 12, fontWeight: 700, fontSize: 12 }}>
          {s}% Passed
        </Tag>
      ),
    },
    {
      title: "Written Exam",
      key: "writtenScore",
      align: "center",
      render: (_, r) => {
        if (r.writtenScore !== undefined && r.writtenScore !== null) {
          return (
            <Tag color="success" style={{ borderRadius: 12, fontWeight: 700, fontSize: 12 }}>
              {r.writtenScore}% Passed
            </Tag>
          );
        }
        return (
          <Tag
            color="orange"
            style={{
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 11,
              background: "#FFFBEB",
              color: "#D97706",
              border: "1px dashed #F59E0B",
            }}
          >
            Not Taken (Pending)
          </Tag>
        );
      },
    },
    {
      title: "Practical Status",
      key: "practical",
      align: "center",
      render: (_, r) => {
        if (r.hasPractical) {
          return (
            <span style={{ color: "#166534", fontWeight: 600, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <CheckCircleFilled /> Evaluated
            </span>
          );
        }
        if (!canEvaluate) {
          return (
            <Tag color="default" style={{ fontSize: 11, borderRadius: 6 }}>
              Manager Evaluated
            </Tag>
          );
        }
        return (
          <Button
            size="small"
            type="primary"
            icon={<FileProtectOutlined />}
            onClick={() => onScorePractical(r.enrollment, r.employeeName, r.course)}
            style={{
              background: "#166534",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Score Practical (1–5)
          </Button>
        );
      },
    },
    {
      title: "Oral Viva Status",
      key: "oral",
      align: "center",
      render: (_, r) => {
        if (r.hasOral) {
          return (
            <span style={{ color: "#166534", fontWeight: 600, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <CheckCircleFilled /> Evaluated
            </span>
          );
        }
        if (!canEvaluate) {
          return (
            <Tag color="default" style={{ fontSize: 11, borderRadius: 6 }}>
              Manager Evaluated
            </Tag>
          );
        }
        return (
          <Button
            size="small"
            type="primary"
            icon={<CommentOutlined />}
            onClick={() => onScoreOral(r.enrollment, r.employeeName, r.course)}
            style={{
              background: nectarColors.leaf,
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Conduct Oral Viva (1–5)
          </Button>
        );
      },
    },
  ];

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 14,
        padding: 24,
        border: "1px solid rgba(28, 68, 99, 0.12)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1C4463" }}>
              Manager Assessment & In-Person Scoring Queue
            </h3>
            <Tag color="orange" style={{ borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
              {pending.length} Pending
            </Tag>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: nectarColors.muted }}>
            Candidates who completed their online module learning and passed the skill mapping exam.
          </p>
        </div>
        {!siteScope && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: nectarColors.muted }}>Filter Plant:</span>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                fontSize: 12,
                color: nectarColors.ink,
                background: "#F8FAFC",
              }}
            >
              <option value="all">All Plants (ETP, RO, MEE)</option>
              <option value="s-etp">ETP Plant</option>
              <option value="s-ro">RO Plant</option>
              <option value="s-mee">MEE Plant</option>
            </select>
          </div>
        )}
      </div>

      {pending.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No candidates currently waiting for evaluations in this plant scope."
          style={{ margin: "24px 0" }}
        />
      ) : (
        <Table
          rowKey={(r) => r.enrollment.id}
          columns={columns}
          dataSource={pending}
          pagination={false}
          size="middle"
        />
      )}
    </div>
  );
}
