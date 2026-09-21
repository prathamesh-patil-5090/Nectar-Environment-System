"use client";

import { nectarColors } from "@/lib/theme";

type KpiStatProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "positive" | "alert" | "info";
};

const toneColor = {
  default: nectarColors.ink,
  positive: nectarColors.mint,
  alert: nectarColors.alert,
  info: nectarColors.sky,
} as const;

export default function KpiStat({
  label,
  value,
  hint,
  tone = "default",
}: KpiStatProps) {
  return (
    <div
      style={{
        flex: "1 1 140px",
        minWidth: 140,
        padding: "16px 18px",
        borderLeft: `3px solid ${toneColor[tone]}`,
        background: nectarColors.white,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: nectarColors.muted,
          marginBottom: 6,
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 650,
          lineHeight: 1.1,
          color: nectarColors.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {hint ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: toneColor[tone],
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}
