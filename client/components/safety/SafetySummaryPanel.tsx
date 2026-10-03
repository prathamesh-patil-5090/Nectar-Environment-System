"use client";

import Link from "next/link";
import { useMemo } from "react";
import { theme } from "antd";
import { NumberRow } from "@/components/quiet";
import { safetyKpis } from "@/lib/safety/kpis";
import { useSafetyEvents } from "@/lib/safety/hooks";

/** Safety numbers for the dashboard (one site, or all sites when siteId is omitted). */
export default function SafetySummaryPanel({ siteId }: { siteId?: string }) {
  const { token } = theme.useToken();
  const { events } = useSafetyEvents();
  const k = useMemo(() => safetyKpis(events, siteId), [events, siteId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: token.colorText }}>Safety</h3>
        <Link href="/safety" style={{ fontSize: 13 }}>Open safety</Link>
      </div>
      <NumberRow
        items={[
          { label: "Open safety cases", value: k.open, hint: `${k.openCritical} high or critical`, alert: k.openCritical > 0 },
          { label: "Return to work pending", value: k.pendingClearances, hint: "Leave can't close until cleared", alert: k.pendingClearances > 0 },
          { label: "Plants down now", value: k.activeBreakdowns, hint: `${k.breakdownOtHours30d} repair OT hours, 30 days`, alert: k.activeBreakdowns > 0 },
          {
            label: "Days since lost-time injury",
            value: k.daysSinceLti ?? "—",
            hint: k.daysSinceLti === null ? "None recorded" : siteId ? "This plant" : "All plants",
          },
        ]}
      />
    </div>
  );
}
