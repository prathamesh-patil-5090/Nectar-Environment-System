"use client";

import { Tag } from "antd";
import {
  SAFETY_SEVERITY_LABELS,
  SAFETY_STATUS_LABELS,
  SAFETY_TYPE_LABELS,
  type SafetyEventType,
  type SafetySeverity,
  type SafetyStatus,
} from "@/lib/safety/rules";

const SEVERITY_COLOR: Record<SafetySeverity, string> = {
  low: "default",
  medium: "gold",
  high: "orange",
  critical: "red",
};

const STATUS_COLOR: Record<SafetyStatus, string> = {
  REPORTED: "red",
  ACKNOWLEDGED: "volcano",
  INVESTIGATING: "gold",
  ACTION_PENDING: "orange",
  RESOLVED: "green",
  CLOSED: "default",
  REOPENED: "magenta",
};

const TYPE_COLOR: Record<SafetyEventType, string> = {
  incident: "red",
  near_miss: "blue",
  breakdown: "purple",
};

export function SeverityTag({ severity }: { severity: SafetySeverity }) {
  return <Tag color={SEVERITY_COLOR[severity]}>{SAFETY_SEVERITY_LABELS[severity]}</Tag>;
}

export function StatusTag({ status }: { status: SafetyStatus }) {
  return <Tag color={STATUS_COLOR[status]}>{SAFETY_STATUS_LABELS[status]}</Tag>;
}

export function TypeTag({ type }: { type: SafetyEventType }) {
  return <Tag color={TYPE_COLOR[type]}>{SAFETY_TYPE_LABELS[type]}</Tag>;
}
