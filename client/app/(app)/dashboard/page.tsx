"use client";

import KpiStat from "@/components/KpiStat";
import SkillHeatmap from "@/components/SkillHeatmap";
import UrgentTrainingList from "@/components/UrgentTrainingList";
import SiteReadiness from "@/components/SiteReadiness";
import { getDashboardKpis } from "@/lib/mock-data";
import { nectarColors } from "@/lib/theme";

export default function DashboardPage() {
  const kpis = getDashboardKpis();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p
          style={{
            margin: 0,
            color: nectarColors.muted,
            fontSize: 14,
          }}
        >
          O&amp;M workforce posture across active treatment sites.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          background: "rgba(15,42,36,0.06)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <KpiStat
          label="Total employees"
          value={kpis.totalEmployees}
          hint="Deputed O&M staff"
        />
        <KpiStat
          label="Active sites"
          value={kpis.activeSites}
          hint="ETP · STP · WTP · RO"
          tone="info"
        />
        <KpiStat
          label="Skill coverage"
          value={`${kpis.skillCoverage}%`}
          hint="Avg mapped vs required"
          tone="positive"
        />
        <KpiStat
          label="Urgent training"
          value={kpis.urgentTraining}
          hint="Overdue or critical"
          tone="alert"
        />
        <KpiStat
          label="Compliance-ready sites"
          value={`${kpis.complianceReadySites}/${kpis.activeSites}`}
          hint="Readiness ≥ 80%"
          tone="positive"
        />
      </div>

      <div className="nectar-dash-grid">
        <SkillHeatmap />
        <UrgentTrainingList />
      </div>

      <SiteReadiness />
    </div>
  );
}
