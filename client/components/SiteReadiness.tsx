"use client";

import Link from "next/link";
import { Tooltip, theme } from "antd";
import { getSession } from "@/lib/auth";
import { scopedSiteId } from "@/lib/rbac";
import type { Site } from "@/lib/types/site.types";
import {
  READINESS_READY_THRESHOLD,
  READINESS_WEIGHTS,
  getSitesWithComputedReadiness,
} from "@/lib/workforce-metrics";
import { Section } from "@/components/quiet";

/**
 * One readiness score per running plant, lowest first. Plant names and locations come from the
 * sites API (`sites`); the score itself is the same computed readiness the Sites page shows.
 */
export default function SiteReadiness({ sites = [] }: { sites?: Site[] }) {
  const { token } = theme.useToken();
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const byId = new Map(sites.map((s) => [s.id, s]));
  const rows = getSitesWithComputedReadiness(siteScope)
    .filter((s) => !sites.length || byId.has(s.id))
    .sort((a, b) => a.readiness - b.readiness);

  const w = READINESS_WEIGHTS;
  const formula = `${Math.round(w.staffing * 100)}% staffing · ${Math.round(w.training * 100)}% training · ${Math.round(
    w.skill * 100,
  )}% skills · ${Math.round(w.coverage * 100)}% absence cover`;

  return (
    <Section title="Site readiness" extra={<Link href="/sites">All sites</Link>} flush>
      <div style={{ padding: "12px 16px 0", fontSize: 13, color: token.colorTextSecondary }}>
        Can each plant run safely today? {READINESS_READY_THRESHOLD}% or more counts as ready. Built from {formula}.
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: "4px 0 8px" }}>
        {rows.map((site) => {
          const b = site.readinessBreakdown;
          const api = byId.get(site.id);
          const color =
            site.readiness < 70 ? token.colorError : site.readiness < READINESS_READY_THRESHOLD ? token.colorWarning : token.colorPrimary;
          return (
            <li key={site.id} style={{ padding: "10px 16px" }}>
              <Tooltip
                title={
                  <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <div>Staffing {b.staffingPct}% ({b.activeStaff}/{b.requiredStaff})</div>
                    <div>Training {b.trainingPct}% ({b.overdueTrainingCount} overdue)</div>
                    <div>Skills {b.skillPct}%</div>
                    <div>Cover {b.coveragePct}% · {b.openAbsences} open absences</div>
                  </div>
                }
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6, fontSize: 13 }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ color: token.colorText, fontWeight: 500 }}>{api?.name ?? site.name}</span>
                      <span style={{ color: token.colorTextSecondary }}> · {api?.location ?? site.location}</span>
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums", color: site.readiness < 70 ? token.colorError : token.colorText }}>
                      {site.readiness}%
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: token.colorFillSecondary }}>
                    <div data-anim="bar" style={{ width: `${site.readiness}%`, height: "100%", borderRadius: 2, background: color }} />
                  </div>
                </div>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
