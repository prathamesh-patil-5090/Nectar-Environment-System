"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { App, Button, Switch, Table, Tag, Segmented } from "antd";
import {
  SafetyCertificateOutlined,
  AuditOutlined,
  BookOutlined,
  DashboardOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { getSession } from "@/lib/auth";
import {
  getEmployeeById,
  type TrainingItem,
  type TrainingPriority,
} from "@/lib/mock-data";
import { getTrainingItems } from "@/lib/training/store";
import {
  canEnterLeaveForOthers,
  canEvaluateAssessments,
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
  checkAndTriggerCertification,
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

  // Dual-mode state for supervisory / managerial roles
  const [activeConsoleMode, setActiveConsoleMode] = useState<"console" | "personal">(
    mineParam ? "personal" : "console"
  );

  // 1. Pure employees are routed exclusively to the dedicated Coursera Employee Training Portal
  if (isPureEmployee) {
    return <EmployeeTrainingPortal employeeId={selfId} />;
  }

  // 2. For managerial / supervisory roles with dual view toggling:
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Dual Mode Switcher Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 18px",
          background: "#FFFFFF",
          borderRadius: 12,
          border: "1px solid rgba(28, 68, 99, 0.1)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: nectarColors.leaf,
              fontWeight: 700,
            }}
          >
            <SafetyCertificateOutlined style={{ fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1C4463" }}>
              Nectar Enviro Operational Training & Certification
            </div>
            <div style={{ fontSize: 11, color: nectarColors.muted }}>
              {session?.name ?? "Authorized Operator"} · {session?.role?.toUpperCase() ?? "MANAGEMENT"}{" "}
              {siteScope ? `(${siteScope.toUpperCase()})` : "(All Plants)"}
            </div>
          </div>
        </div>

        <Segmented
          value={activeConsoleMode}
          onChange={(val) => setActiveConsoleMode(val as "console" | "personal")}
          options={[
            {
              label: (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 8px" }}>
                  <DashboardOutlined />
                  <span style={{ fontWeight: 600 }}>Plant Evaluation & LNI Console</span>
                </div>
              ),
              value: "console",
            },
            {
              label: (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 8px" }}>
                  <BookOutlined />
                  <span style={{ fontWeight: 600 }}>My Personal Learning Portal</span>
                </div>
              ),
              value: "personal",
            },
          ]}
          style={{ background: "#F1F5F9", padding: 3, borderRadius: 8 }}
        />
      </div>

      {activeConsoleMode === "personal" ? (
        <EmployeeTrainingPortal employeeId={selfId} />
      ) : (
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
      )}
    </div>
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
  const router = useRouter();
  const session = getSession();
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
            key: "employeeName",
            sorter: (a: TrainingItem, b: TrainingItem) =>
              a.employeeName.localeCompare(b.employeeName),
            render: (_, record: TrainingItem) => {
              const emp = getEmployeeById(record.employeeId);
              return (
                <div>
                  <Link
                    href={`/employees/${record.employeeId}`}
                    style={{ color: nectarColors.leaf, fontWeight: 600, fontSize: 13.5 }}
                  >
                    {record.employeeName}
                  </Link>
                  <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#475569" }}>{record.employeeId}</span>
                    {emp?.designation && <span>· {emp.designation}</span>}
                  </div>
                </div>
              );
            },
          },
          {
            title: "Site",
            dataIndex: "siteName",
            key: "siteName",
            render: (site: string) => (
              <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
                {site}
              </Tag>
            ),
          },
        ] as ColumnsType<TrainingItem>)
      : []),
    {
      title: "Course Curriculum",
      dataIndex: "course",
      key: "course",
      render: (courseTitle: string) => {
        const course = getCourseByTitle(courseTitle);
        return (
          <div>
            <div style={{ fontWeight: 600, color: "#0F172A", fontSize: 13 }}>{course.title || courseTitle}</div>
            <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 8, marginTop: 2 }}>
              <span style={{ fontWeight: 600, color: "#0284C7" }}>Code: {course.code}</span>
              {course.section && <span>· {course.section}</span>}
            </div>
          </div>
        );
      },
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (p: TrainingPriority) => (
        <Tag color={priorityColor[p]} style={{ border: "none", textTransform: "capitalize", fontWeight: 600 }}>
          {p}
        </Tag>
      ),
    },
    {
      title: "Target Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      sorter: (a, b) => a.dueDate.localeCompare(b.dueDate),
      render: (due: string, record: TrainingItem) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: record.status === "overdue" ? "#DC2626" : "#334155" }}>
            {due}
          </div>
          {record.completedAt && (
            <div style={{ fontSize: 11, color: "#166534" }}>
              Completed: {record.completedAt}
            </div>
          )}
        </div>
      ),
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
          style={{ fontWeight: 600, borderRadius: 6, fontSize: 11.5 }}
        >
          {statusLabel[status]}
        </Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_, row: TrainingItem) => {
        const course = getCourseByTitle(row.course);
        return (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Button
              size="small"
              type="link"
              onClick={() => course ? router.push(`/training/learn/${course.id}`) : router.push("/training")}
              style={{ padding: 0, fontWeight: 600, fontSize: 12, color: "#0284C7" }}
            >
              View Curriculum →
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
        <LniMatrixView
          siteScope={siteScope}
          onOpenCourse={(c) => {
            router.push(`/training/learn/${c.id}`);
          }}
        />
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
                Plant Managers observe hands-on physical operation and oral viva responses on-site, recording 1–5 rubric scores and tailored qualitative remarks per ability.
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
                siteScope={siteScope}
                canEvaluate={canEvaluateAssessments(session)}
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
              evaluatorName={
                session?.name
                  ? `${session.name} (${session.role || "Plant Manager"})`
                  : undefined
              }
              evaluatorId={session?.employeeId || selfEmployeeId(session) || undefined}
              onClose={() => setEvalModal((prev) => ({ ...prev, open: false }))}
              onSubmitted={() => {
                if (evalModal.enrollment) {
                  checkAndTriggerCertification(evalModal.enrollment.id);
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
