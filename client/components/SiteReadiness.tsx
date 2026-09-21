"use client";

import { Progress } from "antd";
import { sites } from "@/lib/mock-data";
import { nectarColors } from "@/lib/theme";

export default function SiteReadiness() {
  const sorted = [...sites].sort((a, b) => a.readiness - b.readiness);

  return (
    <div
      style={{
        background: nectarColors.white,
        padding: 20,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontSize: 18,
          color: nectarColors.ink,
          marginBottom: 4,
        }}
      >
        Site readiness
      </div>
      <p style={{ margin: "0 0 16px", color: nectarColors.muted, fontSize: 13 }}>
        Skill-mix compliance by treatment plant.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {sorted.map((site) => (
          <div key={site.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
                gap: 8,
              }}
            >
              <span style={{ fontSize: 13, color: nectarColors.ink }}>
                {site.name}
                <span style={{ color: nectarColors.muted }}>
                  {" "}
                  · {site.plantType} · {site.headcount} staff
                </span>
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  color:
                    site.readiness < 70
                      ? nectarColors.alert
                      : nectarColors.ink,
                }}
              >
                {site.readiness}%
              </span>
            </div>
            <Progress
              percent={site.readiness}
              showInfo={false}
              strokeColor={
                site.readiness < 70
                  ? nectarColors.alert
                  : site.readiness < 85
                    ? nectarColors.sky
                    : nectarColors.mint
              }
              railColor="#E5EDE9"
              size={["100%", 8]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
