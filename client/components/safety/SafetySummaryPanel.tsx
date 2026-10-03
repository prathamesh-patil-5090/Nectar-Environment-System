"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SafetyOutlined } from "@ant-design/icons";
import KpiStat from "@/components/KpiStat";
import { safetyKpis } from "@/lib/safety/kpis";
import { useSafetyEvents } from "@/lib/safety/hooks";
import { rowWrapGap1BgR8 } from "@/lib/styles";
import { nectarColors } from "@/lib/theme";

/** Safety KPIs for the dashboard (one site, or all sites when siteId is omitted). */
export default function SafetySummaryPanel({ siteId }: { siteId?: string }) {
  const { events } = useSafetyEvents();
  const k = useMemo(() => safetyKpis(events, siteId), [events, siteId]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: nectarColors.ink }}>
          <SafetyOutlined /> Safety
        </div>
        <Link href="/safety">Open safety →</Link>
      </div>
      <div style={rowWrapGap1BgR8}>
        <KpiStat label="Open safety cases" value={k.open} hint={`${k.openCritical} high / critical`} tone={k.openCritical ? "alert" : "default"} />
        <KpiStat label="Return-to-work pending" value={k.pendingClearances} tone={k.pendingClearances ? "alert" : "default"} hint="Leave can't close until cleared" />
        <KpiStat label="Plants down now" value={k.activeBreakdowns} tone={k.activeBreakdowns ? "alert" : "default"} hint={`${k.breakdownOtHours30d} repair OT h (30 d)`} />
        <KpiStat label="Days since lost-time injury" value={k.daysSinceLti ?? "—"} hint={k.daysSinceLti === null ? "None recorded" : siteId ? "This plant" : "All plants"} tone="positive" />
      </div>
    </div>
  );
}
