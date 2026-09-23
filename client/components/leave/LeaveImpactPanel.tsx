"use client";

import { Tag } from "antd";
import type { LeaveImpact } from "@/lib/leave";
import type { LeaveShiftImpactDay } from "@/lib/leave/store";
import { nectarColors } from "@/lib/theme";

export default function LeaveImpactPanel({
  impact,
}: {
  impact: LeaveImpact & { affectedShiftDays?: LeaveShiftImpactDay[] };
}) {
  const riskColor =
    impact.risk === "high"
      ? nectarColors.alert
      : impact.risk === "low"
        ? "#D97706"
        : nectarColors.mint;

  const affected = impact.affectedShiftDays ?? [];

  return (
    <div
      style={{
        background: nectarColors.white,
        border: `1px solid ${riskColor}33`,
        borderLeft: `4px solid ${riskColor}`,
        borderRadius: 10,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 18,
            color: nectarColors.ink,
          }}
        >
          Leave impact
        </div>
        <Tag color={riskColor} style={{ border: "none", margin: 0 }}>
          {impact.risk === "none"
            ? "OT risk: None"
            : impact.risk === "low"
              ? "OT risk: Low"
              : "OT risk: High"}
        </Tag>
      </div>

      <div style={{ fontSize: 13, color: nectarColors.muted, marginBottom: 14 }}>
        {impact.employeeName} · {impact.siteName} · {impact.shiftName} ·{" "}
        {impact.date}
      </div>

      {affected.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Planned shifts affected ({affected.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {affected.map((d) => (
              <Tag
                key={d.date}
                color={
                  d.replacementRequired ? nectarColors.alert : nectarColors.muted
                }
              >
                {d.date} → {d.shiftName}
                {d.replacementRequired ? " · replacement required" : ""}
              </Tag>
            ))}
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        <Metric label="Current manpower" value={String(impact.currentManpower)} />
        <Metric label="Required manpower" value={String(impact.requiredManpower)} />
        <Metric
          label="Available relievers"
          value={String(impact.availableRelievers)}
        />
        <Metric
          label="Nearby available"
          value={String(impact.nearbyAvailableWorkers)}
        />
        <Metric
          label="Potential OT"
          value={`${impact.potentialOtHours} hrs`}
          alert={impact.potentialOtHours > 0}
        />
        <Metric
          label="Est. OT cost"
          value={
            impact.potentialOtCost
              ? `₹${impact.potentialOtCost.toLocaleString("en-IN")}`
              : "₹0"
          }
          alert={impact.potentialOtCost > 0}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      style={{
        background: nectarColors.sand,
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 11, color: nectarColors.muted }}>{label}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 650,
          color: alert ? nectarColors.alert : nectarColors.ink,
        }}
      >
        {value}
      </div>
    </div>
  );
}
