"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { App, Button, Switch, Table, Tag, Segmented } from "antd";
import {
  SafetyCertificateOutlined,
  AuditOutlined,
} from "@ant-design/icons";
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
  normalizeRole,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import EmployeeTrainingPortal from "@/components/training/EmployeeTrainingPortal";
import EvaluatorScoringModal from "@/components/training/EvaluatorScoringModal";
import PendingEvaluationsQueue from "@/components/training/PendingEvaluationsQueue";
import LniMatrixView from "@/components/training/LniMatrixView";
import {
  getCourseByTitle,
  getEnrollment,
  getAssessmentResults,
} from "@/lib/training/store";
import type { Course, CourseEnrollment } from "@/lib/training/types";

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
  const role = normalizeRole(session?.role);
  const isPureEmployee = role === "employee";

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

  // 1. Pure employees are routed exclusively to the dedicated Coursera Employee Training Portal
  if (isPureEmployee) {
    return <EmployeeTrainingPortal employeeId={selfId} />;
  }

  // 2. For everyone else (Manager, Admin, Shift In-Charge, Safety In-Charge, Supervisor):
  // Recovered original training status, site compliance & certification tracking
  return (
    <NonEmployeeTrainingView
      isPersonal={isPersonal}
      targetEmpId={targetEmpId}
      empScope={empScope}
      siteScope={siteScope}
      canMarkForOthers={canMarkForOthers}
      urgentOnly={urgentOnly}
      setUrgentOnly={setUrgentOnly}
      tick={tick}
      setTick={setTick}
      message={message}
    />
  );
}

function NonEmployeeTrainingView({
  isPersonal,
  targetEmpId,
  empScope,
  siteScope,
  canMarkForOthers,
  urgentOnly,
  setUrgentOnly,
  tick,
  setTick,
  message,
}: {
  isPersonal: boolean;
  targetEmpId?: string;
  empScope?: string;
  siteScope?: string;
  canMarkForOthers: boolean;
  urgentOnly: boolean;
  setUrgentOnly: (val: boolean) => void;
  tick: number;
  setTick: React.Dispatch<React.SetStateAction<number>>;
  message: any;
}) {
  const [managerTab, setManagerTab] = useState<"sessions" | "lni">("sessions");
  const [evalModal, setEvalModal] = useState<{
    open: boolean;
    type: "practical" | "oral";
    enrollment: CourseEnrollment | null;
    candidateName: string;
    course: Course | null;
  }>({
    open: false,
    type: "practical",
    enrollment: null,
    candidateName: "",
    course: null,
  });

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
      render: (courseTitle: string) => {
        const course = getCourseByTitle(courseTitle);
        return (
          <div>
            <div style={{ fontWeight: 600, color: "#0F172A" }}>{courseTitle}</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>Code: {course.code}</div>
          </div>
        );
      },
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
      title: "Field & Viva Evaluation",
      key: "evalStatus",
      render: (_, row: TrainingItem) => {
        const course = getCourseByTitle(row.course);
        const enr = getEnrollment(row.employeeId, course.id);
        const res = getAssessmentResults(enr.id);
        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {res.practical ? (
              <Tag color="cyan" style={{ fontSize: 11, fontWeight: 700, borderRadius: 6 }}>
                ✓ Practical: {res.practical.overallPct}%
              </Tag>
            ) : (
              <Tag color="default" style={{ fontSize: 11, color: "#64748B", borderRadius: 6 }}>
                Practical: Pending
              </Tag>
            )}
            {res.oral ? (
              <Tag color="purple" style={{ fontSize: 11, fontWeight: 700, borderRadius: 6 }}>
                ✓ Oral: {res.oral.overallPct}%
              </Tag>
            ) : (
              <Tag color="default" style={{ fontSize: 11, color: "#64748B", borderRadius: 6 }}>
                Oral: Pending
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "Evaluator Action",
      key: "action",
      render: (_, row) => {
        const allow =
          (canMarkForOthers && !empScope) || (empScope && row.employeeId === empScope);
        if (!allow) return "—";

        const course = getCourseByTitle(row.course);
        const enr = getEnrollment(row.employeeId, course.id);
        const res = getAssessmentResults(enr.id);

        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Button
              size="small"
              type={res.practical ? "default" : "primary"}
              onClick={() => {
                setEvalModal({
                  open: true,
                  type: "practical",
                  enrollment: enr,
                  candidateName: row.employeeName,
                  course,
                });
              }}
              style={{
                fontSize: 12,
                fontWeight: 600,
                ...(res.practical
                  ? { borderColor: "#0284C7", color: "#0284C7" }
                  : { background: "#1C4463", borderColor: "#1C4463" }),
              }}
            >
              {res.practical ? "Re-Score Practical" : "Score Practical"}
            </Button>

            <Button
              size="small"
              type={res.oral ? "default" : "primary"}
              onClick={() => {
                setEvalModal({
                  open: true,
                  type: "oral",
                  enrollment: enr,
                  candidateName: row.employeeName,
                  course,
                });
              }}
              style={{
                fontSize: 12,
                fontWeight: 600,
                ...(res.oral
                  ? { borderColor: "#7C3AED", color: "#7C3AED" }
                  : { background: "#D97706", borderColor: "#D97706" }),
              }}
            >
              {res.oral ? "Re-Score Oral" : "Score Oral"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* Top Manager Navigation Tabs */}
      {!isPersonal && (
        <div style={{ marginBottom: 20 }}>
          <Segmented
            value={managerTab}
            onChange={(val) => setManagerTab(val as any)}
            options={[
              {
                label: (
                  <div style={{ padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                    <SafetyCertificateOutlined style={{ color: "#1C4463" }} />
                    <span style={{ fontWeight: 600 }}>Field & Viva Evaluation Console</span>
                  </div>
                ),
                value: "sessions",
              },
              {
                label: (
                  <div style={{ padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                    <AuditOutlined style={{ color: "#0369A1" }} />
                    <span style={{ fontWeight: 600 }}>Learning Need Identification (LNI Matrix)</span>
                  </div>
                ),
                value: "lni",
              },
            ]}
            style={{ background: "#E2E8F0", padding: 4, borderRadius: 10 }}
          />
        </div>
      )}

      {managerTab === "lni" && !isPersonal ? (
        <LniMatrixView />
      ) : (
        <>
          {/* Manager Field & Viva Evaluation Directive Banner */}
          <div
            style={{
              background: "linear-gradient(135deg, #F0F9FF 0%, #EFF6FF 100%)",
              borderRadius: 12,
              padding: "16px 20px",
              border: "1px solid #BAE6FD",
              marginBottom: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0369A1" }}>
            In-Person Plant Practical & Oral Viva Evaluation Console
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
            Plant Managers observe hands-on physical operation and oral viva responses on-site, recording 1–7 rubric scores and tailored qualitative remarks per ability.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Tag color="cyan" style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px" }}>
            Gate 1: Practical Observation
          </Tag>
          <Tag color="purple" style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px" }}>
            Gate 3: Oral Technical Viva
          </Tag>
        </div>
      </div>

      {/* Pending Evaluations Queue for Plant Managers */}
      {!isPersonal && (
        <div style={{ marginBottom: 24 }}>
          <PendingEvaluationsQueue
            onScorePractical={(enrollment, candidateName, course) => {
              setEvalModal({
                open: true,
                type: "practical",
                enrollment,
                candidateName,
                course,
              });
            }}
            onScoreOral={(enrollment, candidateName, course) => {
              setEvalModal({
                open: true,
                type: "oral",
                enrollment,
                candidateName,
                course,
              });
            }}
          />
        </div>
      )}

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

      {evalModal.open && evalModal.enrollment && evalModal.course && (
        <EvaluatorScoringModal
          enrollment={evalModal.enrollment}
          candidateName={evalModal.candidateName}
          course={evalModal.course}
          type={evalModal.type}
          onClose={() => setEvalModal((prev) => ({ ...prev, open: false }))}
          onSubmitted={() => {
            if (evalModal.enrollment && evalModal.course) {
              const res = getAssessmentResults(evalModal.enrollment.id);
              if (res.practical && res.oral) {
                const allItems = getTrainingItems();
                const matched = allItems.find(
                  (t) =>
                    t.employeeId === evalModal.enrollment?.employeeId &&
                    t.course === evalModal.course?.title,
                );
                if (matched) {
                  markTrainingCompleted(matched.id);
                }
              }
            }
            setTick((t) => t + 1);
            message.success(
              `${evalModal.type === "practical" ? "Practical Field" : "Oral Viva"} evaluation recorded successfully!`
            );
          }}
        />
      )}
        </>
      )}
    </div>
  );
}
