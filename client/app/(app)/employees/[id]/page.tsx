"use client";

import { use, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Button,
  Descriptions,
  Empty,
  Progress,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowLeftOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  getEmployeeById,
  getEmployeeSkills,
  getEmployeeTraining,
  getSiteById,
  skillLabels,
  type SkillKey,
  type TrainingItem,
  type TrainingPriority,
} from "@/lib/mock-data";
import { getSession } from "@/lib/auth";
import {
  defaultOtFilters,
  formatHours,
  formatInr,
  getEmployeeOtDetail,
  OT_REASON_LABELS,
  OT_STATUS_LABELS,
  type OtRecord,
} from "@/lib/overtime";
import { canAccessEmployeeRecord, canViewOtModule, scopedEmployeeId } from "@/lib/rbac";
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

const priorityColor: Record<TrainingPriority, string> = {
  critical: nectarColors.alert,
  high: "#D97706",
  medium: nectarColors.sky,
  low: nectarColors.muted,
};

const trainingStatusLabel: Record<TrainingItem["status"], string> = {
  overdue: "Overdue",
  "due-soon": "Due soon",
  scheduled: "Scheduled",
  completed: "Completed",
};

const trainingColumns: ColumnsType<TrainingItem> = [
  {
    title: "Course",
    dataIndex: "course",
    key: "course",
  },
  {
    title: "Provider",
    dataIndex: "provider",
    key: "provider",
    render: (v?: string) => v ?? "—",
  },
  {
    title: "Date",
    key: "date",
    render: (_, r) =>
      r.status === "completed" && r.completedAt
        ? r.completedAt
        : r.dueDate,
  },
  {
    title: "Score",
    dataIndex: "score",
    key: "score",
    width: 80,
    render: (score?: number) =>
      score != null ? (
        <span style={{ fontWeight: 600 }}>{score}%</span>
      ) : (
        "—"
      ),
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
              : status === "completed"
                ? "success"
                : "default"
        }
      >
        {trainingStatusLabel[status]}
      </Tag>
    ),
  },
];

function OtStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 140px",
        minWidth: 120,
        padding: "12px 16px",
        background: nectarColors.sand,
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 12, color: nectarColors.muted }}>{label}</div>
      <div
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontSize: 22,
          color: nectarColors.ink,
          marginTop: 2,
        }}
      >
        {value}
      </div>
      {hint ? (
        <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 2 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const session = getSession();
  const selfId = scopedEmployeeId(session);
  const showOt = canViewOtModule(session) || Boolean(session?.employeeId);

  useEffect(() => {
    if (selfId && selfId !== id) {
      router.replace(`/employees/${selfId}`);
    }
  }, [selfId, id, router]);

  const employee = getEmployeeById(selfId && selfId !== id ? selfId : id);

  useEffect(() => {
    if (employee && !canAccessEmployeeRecord(session, employee) && !selfId) {
      router.replace("/employees");
    }
  }, [employee, session, selfId, router]);

  const otDetail = useMemo(() => {
    if (!employee || !showOt) return null;
    return getEmployeeOtDetail(employee.id, defaultOtFilters());
  }, [employee, showOt]);

  const recentOt = useMemo(
    () => (otDetail?.records ?? []).slice(0, 8),
    [otDetail],
  );

  if (!employee) {
    return (
      <div style={{ background: nectarColors.white, padding: 40 }}>
        <Empty description="Employee not found">
          <Button type="primary" onClick={() => router.push("/employees")}>
            Back to employees
          </Button>
        </Empty>
      </div>
    );
  }

  const site = getSiteById(employee.siteId);
  const skills = getEmployeeSkills(employee);
  const skillKeys = Object.keys(skillLabels) as SkillKey[];
  const training = getEmployeeTraining(employee.id);

  const otColumns: ColumnsType<OtRecord> = [
    { title: "Date", dataIndex: "date", width: 110 },
    {
      title: "Hours",
      dataIndex: "otHours",
      width: 80,
      render: (h: number) => formatHours(h),
    },
    {
      title: "Cost",
      dataIndex: "otCost",
      width: 100,
      render: (c: number) => formatInr(c),
    },
    {
      title: "Reason",
      dataIndex: "reason",
      render: (r: OtRecord["reason"]) => OT_REASON_LABELS[r],
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (s: OtRecord["status"]) => (
        <Tag style={{ margin: 0 }}>{OT_STATUS_LABELS[s]}</Tag>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push(selfId ? "/dashboard" : "/employees")}
          style={{ paddingInline: 0, color: nectarColors.muted, marginBottom: 8 }}
        >
          {selfId ? "Dashboard" : "Employees"}
        </Button>

        <div
          style={{
            background: nectarColors.white,
            padding: "24px 28px",
            display: "flex",
            gap: 20,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <Avatar
            size={72}
            icon={<UserOutlined />}
            style={{ background: nectarColors.leaf, flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              style={{
                fontFamily: "var(--font-fraunces), Georgia, serif",
                fontSize: 28,
                color: nectarColors.ink,
                lineHeight: 1.2,
              }}
            >
              {employee.name}
            </div>
            <div style={{ color: nectarColors.muted, marginTop: 4 }}>
              {employee.role}
              {site ? ` · ${site.name}` : ""}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Tag color={statusColor[employee.trainingStatus]}>
                {statusLabel[employee.trainingStatus]}
              </Tag>
              <Tag style={{ borderColor: "rgba(15,42,36,0.12)" }}>
                Skill score {employee.skillScore}%
              </Tag>
              {employee.otEligible ? (
                <Tag color={nectarColors.sky} style={{ border: "none" }}>
                  OT eligible
                </Tag>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="nectar-employee-detail-grid">
        <div style={{ background: nectarColors.white, padding: 24 }}>
          <div
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: 18,
              color: nectarColors.ink,
              marginBottom: 16,
            }}
          >
            Profile
          </div>
          <Descriptions
            column={1}
            size="small"
            styles={{ label: { color: nectarColors.muted, width: 140 } }}
          >
            <Descriptions.Item
              label={
                <span>
                  <MailOutlined /> Email
                </span>
              }
            >
              {employee.email}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span>
                  <PhoneOutlined /> Phone
                </span>
              }
            >
              {employee.phone}
            </Descriptions.Item>
            <Descriptions.Item label="Joined">
              {employee.joinedAt}
            </Descriptions.Item>
            <Descriptions.Item label="Experience">
              {employee.yearsExperience} years
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span>
                  <EnvironmentOutlined /> Site
                </span>
              }
            >
              {site ? (
                <span>
                  {site.name}{" "}
                  <Tag color={nectarColors.leaf} style={{ border: "none" }}>
                    {site.plantType}
                  </Tag>
                  <span style={{ color: nectarColors.muted }}>
                    · {site.location} · readiness {site.readiness}%
                  </span>
                </span>
              ) : (
                "Unassigned"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Designation">
              {employee.designation}
            </Descriptions.Item>
            <Descriptions.Item label="Department">
              {employee.department}
            </Descriptions.Item>
            <Descriptions.Item label="Category">
              {employee.employeeCategory.replace(/_/g, " ")}
            </Descriptions.Item>
            <Descriptions.Item label="Manager">
              {employee.managerId
                ? (getEmployeeById(employee.managerId)?.name ?? "—")
                : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Shift In-Charge">
              {employee.shiftInChargeId
                ? (getEmployeeById(employee.shiftInChargeId)?.name ?? "—")
                : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Supervisor">
              {employee.supervisorId
                ? (getEmployeeById(employee.supervisorId)?.name ?? "—")
                : "—"}
            </Descriptions.Item>
          </Descriptions>
        </div>

        <div style={{ background: nectarColors.white, padding: 24 }}>
          <div
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: 18,
              color: nectarColors.ink,
              marginBottom: 4,
            }}
          >
            Skill map
          </div>
          <p style={{ margin: "0 0 8px", color: nectarColors.muted, fontSize: 13 }}>
            This person&apos;s competency scores (0–100) for each O&amp;M skill,
            adjusted from their role baseline by their overall skill score.
          </p>
          <p style={{ margin: "0 0 16px", color: nectarColors.muted, fontSize: 12 }}>
            Example: if the role baseline for Safety is 90 and this employee&apos;s
            skill score is above average, their Safety bar rises accordingly —
            used when choosing who covers OT or leave.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {skillKeys.map((key) => {
              const score = skills[key];
              return (
                <div key={key}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 13, color: nectarColors.ink }}>
                      {skillLabels[key]}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color:
                          score < 70 ? nectarColors.alert : nectarColors.ink,
                      }}
                    >
                      {score}%
                    </span>
                  </div>
                  <Progress
                    percent={score}
                    showInfo={false}
                    size={["100%", 8]}
                    strokeColor={
                      score < 70
                        ? nectarColors.alert
                        : score < 85
                          ? nectarColors.sky
                          : nectarColors.mint
                    }
                    railColor="#E5EDE9"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showOt && otDetail ? (
        <div style={{ background: nectarColors.white, padding: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  fontSize: 18,
                  color: nectarColors.ink,
                }}
              >
                Overtime
              </div>
              <p style={{ margin: "4px 0 0", color: nectarColors.muted, fontSize: 13 }}>
                Engine-generated OT history for this employee
                {otDetail.shift ? ` · ${otDetail.shift.name}` : ""}.
              </p>
            </div>
            <Link
              href={`/overtime/employees/${employee.id}`}
              style={{ fontSize: 13, color: nectarColors.leaf }}
            >
              Full OT profile
            </Link>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <OtStat
              label="This month"
              value={formatHours(otDetail.summary.currentMonthHours)}
              hint={`${otDetail.summary.currentMonthDays} days · ${formatInr(otDetail.summary.currentMonthCost)}`}
            />
            <OtStat
              label="Year to date"
              value={formatHours(otDetail.summary.currentYearHours)}
              hint={`${otDetail.summary.currentYearDays} days · ${formatInr(otDetail.summary.currentYearCost)}`}
            />
            <OtStat
              label="Prev. month"
              value={formatHours(otDetail.summary.previousMonthHours)}
            />
            <OtStat
              label="Site OT share"
              value={`${otDetail.siteSharePct}%`}
              hint="Of filtered site OT"
            />
          </div>

          {recentOt.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No overtime records in the selected period."
            />
          ) : (
            <Table
              rowKey="id"
              columns={otColumns}
              dataSource={recentOt}
              pagination={false}
              size="middle"
              scroll={{ x: 560 }}
            />
          )}
        </div>
      ) : null}

      <div style={{ background: nectarColors.white, padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: 18,
              color: nectarColors.ink,
            }}
          >
            Training history
          </div>
          <Link
            href="/training"
            style={{ fontSize: 13, color: nectarColors.leaf }}
          >
            View all training
          </Link>
        </div>
        {training.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No training records for this employee."
          />
        ) : (
          <Table
            rowKey="id"
            columns={trainingColumns}
            dataSource={training}
            pagination={{ pageSize: 8 }}
            size="middle"
            scroll={{ x: 640 }}
          />
        )}
      </div>
    </div>
  );
}
