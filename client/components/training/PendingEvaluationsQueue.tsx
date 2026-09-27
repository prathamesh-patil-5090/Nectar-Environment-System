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
  onScorePractical: (enrollment: CourseEnrollment, candidateName: string, course: Course) => void;
  onScoreOral: (enrollment: CourseEnrollment, candidateName: string, course: Course) => void;
}

export default function PendingEvaluationsQueue({
  onScorePractical,
  onScoreOral,
}: PendingEvaluationsQueueProps) {
  const pending = getPendingEvaluations();

  if (pending.length === 0) {
    return (
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 14,
          padding: 40,
          textAlign: "center",
          border: "1px solid rgba(28, 68, 99, 0.08)",
        }}
      >
        <Empty description="No candidates currently waiting for Practical or Oral evaluations. Once an employee passes the course-end Skill Mapping test, they appear here." />
      </div>
    );
  }

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
            {c.title}
          </div>
          <div style={{ fontSize: 11, color: nectarColors.muted }}>
            Code: {c.code} · {c.section}
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
            <span style={{ color: "#166534", fontWeight: 600, fontSize: 12 }}>
              <CheckCircleFilled /> Evaluated
            </span>
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
            <span style={{ color: "#166534", fontWeight: 600, fontSize: 12 }}>
              <CheckCircleFilled /> Evaluated
            </span>
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
        border: "1px solid rgba(28, 68, 99, 0.08)",
        boxShadow: "0 2px 10px rgba(11, 26, 36, 0.03)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(28, 68, 99, 0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: nectarColors.ink }}>
            Manager Assessment & Scoring Queue
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: nectarColors.muted }}>
            Candidates who completed all sequential modules and passed the Skill Mapping auto-test. Awaiting hands-on evaluation.
          </p>
        </div>
        <Tag color="orange" style={{ borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
          {pending.length} Pending Actions
        </Tag>
      </div>

      <Table rowKey={(r) => r.enrollment.id} columns={columns} dataSource={pending} pagination={false} />
    </div>
  );
}
