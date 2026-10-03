"use client";

import { theme } from "antd";
import type { SafetySeverity, SafetyStatus } from "@/lib/safety/rules";

/** Safety status / severity colours from the theme; the generic building blocks live in components/quiet. */
export { Dot, Facts, NumberRow, Panel, Person, Prose, Quiet, Section, SubHeading, initials } from "@/components/quiet";

type Token = ReturnType<typeof theme.useToken>["token"];

export const statusColor = (token: Token, status: SafetyStatus) =>
  status === "RESOLVED"
    ? token.colorSuccess
    : status === "CLOSED"
      ? token.colorTextQuaternary
      : status === "REPORTED" || status === "REOPENED"
        ? token.colorError
        : token.colorWarning;

export const severityColor = (token: Token, severity: SafetySeverity) =>
  severity === "critical" || severity === "high"
    ? token.colorError
    : severity === "medium"
      ? token.colorWarning
      : token.colorTextQuaternary;
