"use client";

import Link from "next/link";
import { Tag } from "antd";
import { getUrgentTraining, type TrainingPriority } from "@/lib/mock-data";
import { nectarColors } from "@/lib/theme";

const priorityColor: Record<TrainingPriority, string> = {
  critical: nectarColors.alert,
  high: "#D97706",
  medium: nectarColors.sky,
  low: nectarColors.muted,
};

export default function UrgentTrainingList() {
  const items = getUrgentTraining().slice(0, 6);

  return (
    <div
      style={{
        background: nectarColors.white,
        padding: 20,
        height: "100%",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontSize: 18,
          color: nectarColors.ink,
          marginBottom: 4,
        }}
      >
        Urgent training
      </div>
      <p style={{ margin: "0 0 16px", color: nectarColors.muted, fontSize: 13 }}>
        Overdue and soon-due certifications by site priority.
      </p>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 0",
              borderBottom: `1px solid ${nectarColors.sand}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Link
                href={`/employees/${item.employeeId}`}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: nectarColors.leaf,
                  textDecoration: "none",
                }}
              >
                {item.employeeName}
              </Link>
              <div style={{ fontSize: 12, color: nectarColors.muted }}>
                {item.course} · {item.siteName}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 4,
                flexShrink: 0,
              }}
            >
              <Tag
                color={priorityColor[item.priority]}
                style={{ margin: 0, border: "none" }}
              >
                {item.priority}
              </Tag>
              <span
                style={{
                  fontSize: 11,
                  color:
                    item.status === "overdue"
                      ? nectarColors.alert
                      : nectarColors.muted,
                }}
              >
                {item.status === "overdue" ? "Overdue" : "Due"} {item.dueDate}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
