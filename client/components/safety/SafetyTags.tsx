"use client";

import { theme } from "antd";
import {
  SAFETY_SEVERITY_LABELS,
  SAFETY_STATUS_LABELS,
  SAFETY_TYPE_LABELS,
  type SafetyEventType,
  type SafetySeverity,
  type SafetyStatus,
} from "@/lib/safety/rules";
import { Dot, severityColor, statusColor } from "./ui";

/** Status / severity as a small dot + label; type as plain text. Colours come from the theme (see ./ui). */

export function SeverityTag({ severity }: { severity: SafetySeverity }) {
  const { token } = theme.useToken();
  return <Dot color={severityColor(token, severity)} label={SAFETY_SEVERITY_LABELS[severity]} />;
}

export function StatusTag({ status }: { status: SafetyStatus }) {
  const { token } = theme.useToken();
  return <Dot color={statusColor(token, status)} label={SAFETY_STATUS_LABELS[status]} />;
}

export function TypeTag({ type }: { type: SafetyEventType }) {
  return <span style={{ whiteSpace: "nowrap" }}>{SAFETY_TYPE_LABELS[type]}</span>;
}
