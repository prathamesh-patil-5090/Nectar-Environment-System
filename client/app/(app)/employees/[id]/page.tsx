"use client";

import { use } from "react";
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

const trainingColumns: ColumnsType<TrainingItem> = [
  {
    title: "Course",
    dataIndex: "course",
    key: "course",
  },
  {
    title: "Due date",
    dataIndex: "dueDate",
    key: "dueDate",
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
              : "default"
        }
      >
        {status === "overdue"
          ? "Overdue"
          : status === "due-soon"
            ? "Due soon"
            : "Scheduled"}
      </Tag>
    ),
  },
];

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const employee = getEmployeeById(id);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/employees")}
          style={{ paddingInline: 0, color: nectarColors.muted, marginBottom: 8 }}
        >
          Employees
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
          <p style={{ margin: "0 0 16px", color: nectarColors.muted, fontSize: 13 }}>
            Personal levels vs role-critical O&amp;M competencies.
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
            description="No scheduled or overdue training for this employee."
          />
        ) : (
          <Table
            rowKey="id"
            columns={trainingColumns}
            dataSource={training}
            pagination={false}
            size="middle"
          />
        )}
      </div>
    </div>
  );
}
