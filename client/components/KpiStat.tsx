"use client";

import { nectarColors } from "@/lib/theme";
import { trData } from "@/lib/i18n";

type KpiStatProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "positive" | "alert" | "info";
};

export default function KpiStat({
  label,
  value,
  hint,
  tone = "default",
}: KpiStatProps) {
  return (
    <div style={{ flex: "1 1 140px", minWidth: 140, padding: "16px 20px", background: nectarColors.white }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: nectarColors.muted, marginBottom: 6, lineHeight: 1.3 }}>{trData(label)}</div>
      <div
        style={{
          fontSize: 26, fontWeight: 650, lineHeight: 1.15, color: nectarColors.ink, fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {hint ? (
        <div style={{ marginTop: 6, fontSize: 12, color: tone === "alert" ? nectarColors.alert : nectarColors.muted }}>{trData(hint)}</div>
      ) : null}
    </div>
  );
}
