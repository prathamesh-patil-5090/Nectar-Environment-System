"use client";

import { Timeline, theme } from "antd";
import type { SafetyTimelineEntry } from "@/lib/safety/types";
import { roleLabel } from "@/lib/rbac";
import type { UserRole } from "@/lib/auth";

export default function EventTimeline({ entries }: { entries: SafetyTimelineEntry[] }) {
  const { token } = theme.useToken();
  // Quiet by default; only the moments that change the case's course get a colour.
  const color = (kind: SafetyTimelineEntry["kind"]) =>
    kind === "created" || kind === "promote"
      ? token.colorError
      : kind === "status" || kind === "clearance"
        ? token.colorPrimary
        : token.colorTextQuaternary;

  const items = [...entries].reverse().map((t, i) => ({
    key: `${t.at}-${i}`,
    color: color(t.kind),
    content: (
      <div>
        <div style={{ fontWeight: 500, color: token.colorText }}>{t.title}</div>
        <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
          {t.actorName} · {roleLabel(t.actorRole as UserRole)} · {new Date(t.at).toLocaleString("en-IN")}
        </div>
        {t.detail ? (
          <div style={{ marginTop: 4, whiteSpace: "pre-wrap", wordBreak: "break-word", color: token.colorText }}>{t.detail}</div>
        ) : null}
      </div>
    ),
  }));
  return <Timeline items={items} />;
}
