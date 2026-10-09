"use client";

import Link from "next/link";
import { useMemo } from "react";
import { theme } from "antd";
import { NumberRow } from "@/components/quiet";
import { safetyKpis } from "@/lib/safety/kpis";
import { useSafetyEvents } from "@/lib/safety/hooks";
import { useT } from "@/lib/i18n";

/** Safety numbers for the dashboard (one site, or all sites when siteId is omitted). */
export default function SafetySummaryPanel({ siteId }: { siteId?: string }) {
  const { token } = theme.useToken();
  const t = useT();
  const { events } = useSafetyEvents();
  const k = useMemo(() => safetyKpis(events, siteId), [events, siteId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: token.colorText }}>{t("nav.safety")}</h3>
        <Link href="/safety" style={{ fontSize: 13 }}>{t("dash.openSafety")}</Link>
      </div>
      <NumberRow
        items={[
          {
            label: t("dash.openCases"),
            value: k.open,
            hint: t("dash.highOrCritical", { n: k.openCritical }),
            alert: k.openCritical > 0,
          },
          {
            label: t("dash.returnPending"),
            value: k.pendingClearances,
            hint: t("dash.leaveCantClose"),
            alert: k.pendingClearances > 0,
          },
          {
            label: t("dash.plantsDown"),
            value: k.activeBreakdowns,
            hint: t("dash.repairOtHint", { n: k.breakdownOtHours30d }),
            alert: k.activeBreakdowns > 0,
          },
          {
            label: t("dash.daysSinceLti"),
            value: k.daysSinceLti ?? "—",
            hint:
              k.daysSinceLti === null
                ? t("dash.noneRecorded")
                : siteId
                  ? t("dash.thisPlant")
                  : t("dash.allPlants"),
          },
        ]}
      />
    </div>
  );
}
