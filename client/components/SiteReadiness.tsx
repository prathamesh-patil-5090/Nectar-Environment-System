"use client";

import { Progress, Tooltip } from "antd";
import { getSession } from "@/lib/auth";
import { scopedSiteId } from "@/lib/rbac";
import {
  READINESS_READY_THRESHOLD,
  READINESS_WEIGHTS,
  getSitesWithComputedReadiness,
} from "@/lib/workforce-metrics";
import { nectarColors } from "@/lib/theme";

export default function SiteReadiness() {
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const sorted = getSitesWithComputedReadiness(siteScope).sort(
    (a, b) => a.readiness - b.readiness,
  );

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
      <p style={{ margin: "0 0 8px", color: nectarColors.muted, fontSize: 13 }}>
        One score per plant: “can we safely run O&amp;M today?” Built from
        staffing, training, skills, and open absences (≥{READINESS_READY_THRESHOLD}
        % = ready).
      </p>
      <p style={{ margin: "0 0 16px", color: nectarColors.muted, fontSize: 12 }}>
        Formula: {Math.round(READINESS_WEIGHTS.staffing * 100)}% staffing +{" "}
        {Math.round(READINESS_WEIGHTS.training * 100)}% training +{" "}
        {Math.round(READINESS_WEIGHTS.skill * 100)}% skills +{" "}
        {Math.round(READINESS_WEIGHTS.coverage * 100)}% absence cover. Hover a
        plant for the breakdown.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {sorted.map((site) => {
          const b = site.readinessBreakdown;
          const tip = (
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              <div>
                Staffing {b.staffingPct}% ({b.activeStaff}/{b.requiredStaff})
              </div>
              <div>
                Training {b.trainingPct}% ({b.overdueTrainingCount} overdue)
              </div>
              <div>Skills {b.skillPct}%</div>
              <div>
                Cover {b.coveragePct}% ({b.openAbsences} open absences)
              </div>
            </div>
          );
          return (
            <Tooltip key={site.id} title={tip}>
              <div>
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
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
