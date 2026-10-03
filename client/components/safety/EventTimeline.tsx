"use client";

import { Timeline, Typography } from "antd";
import type { SafetyTimelineEntry } from "@/lib/safety/types";
import { roleLabel } from "@/lib/rbac";
import type { UserRole } from "@/lib/auth";

const COLOR: Partial<Record<SafetyTimelineEntry["kind"], string>> = {
  created: "red",
  status: "blue",
  clearance: "green",
  action: "orange",
  call: "purple",
  promote: "red",
};

export default function EventTimeline({ entries }: { entries: SafetyTimelineEntry[] }) {
  const items = [...entries].reverse().map((t, i) => ({
    key: `${t.at}-${i}`,
    color: COLOR[t.kind] ?? "gray",
    content: (
      <div>
        <Typography.Text strong>{t.title}</Typography.Text>
        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
          {t.actorName} · {roleLabel(t.actorRole as UserRole)} · {new Date(t.at).toLocaleString("en-IN")}
        </div>
        {t.detail ? (
          <div style={{ marginTop: 4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{t.detail}</div>
        ) : null}
      </div>
    ),
  }));
  return <Timeline items={items} />;
}
