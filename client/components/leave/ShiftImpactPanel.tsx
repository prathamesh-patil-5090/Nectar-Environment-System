"use client";

import Link from "next/link";
import { Tag } from "antd";
import type { LeaveImpact } from "@/lib/leave";
import type { LeaveShiftImpactDay } from "@/lib/leave/store";
import {
  candidateDisplaySource,
  type ShiftImpactReport,
  type ShiftVacancy,
} from "@/lib/shift-impact";
import { getSiteName } from "@/lib/mock-data";
import { nectarColors } from "@/lib/theme";
import { sSerifText18Ink } from "@/lib/styles";
import { tr, intlLocale, trData } from "@/lib/i18n";

export default function ShiftImpactPanel({
  impact,
  report,
}: {
  impact: LeaveImpact & { affectedShiftDays?: LeaveShiftImpactDay[] };
  report?: ShiftImpactReport;
}) {
  const riskColor =
    impact.risk === "high"
      ? nectarColors.alert
      : impact.risk === "low"
        ? "#D97706"
        : nectarColors.mint;

  const affected = impact.affectedShiftDays ?? [];
  const vacancies = report?.vacancies ?? [];
  const focusVacancies = vacancies.filter(
    (v) =>
      !report?.focusLeaveId ||
      v.leaveId === report.focusLeaveId ||
      v.source === "roster_gap",
  );
  const competing = vacancies.filter(
    (v) =>
      report?.focusLeaveId &&
      v.leaveId &&
      v.leaveId !== report.focusLeaveId,
  );

  return (
    <div
      style={{
        background: nectarColors.white, border: "1px solid rgba(28, 68, 99, 0.12)", borderRadius: 10, padding: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={sSerifText18Ink}>{tr("Shift impact")}</div>
        <Tag color={riskColor} style={{ border: "none", margin: 0 }}>
          {impact.risk === "none"
            ? tr("OT risk: None")
            : impact.risk === "low"
              ? tr("OT risk: Low")
              : tr("OT risk: High")}
        </Tag>
      </div>

      <div style={{ fontSize: 13, color: nectarColors.muted, marginBottom: 14 }}>
        {trData(impact.employeeName)} · {trData(impact.siteName)} · {trData(impact.shiftName)} ·{" "}
        {impact.date}
        {report ? ` → ${report.to}` : ""}
      </div>

      {affected.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{tr("Planned shifts affected ({affectedCount})", { affectedCount: affected.length })}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {affected.map((d) => (
              <Tag
                key={d.date + d.shiftCode}
                color={
                  d.replacementRequired ? nectarColors.alert : nectarColors.muted
                }
              >
                {d.date} → {trData(d.shiftName)}
                {d.replacementRequired ? tr(" · cover needed") : ""}
              </Tag>
            ))}
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10,
          marginBottom: focusVacancies.length ? 16 : 0,
        }}
      >
        <Metric label={tr("Current manpower")} value={String(impact.currentManpower)} />
        <Metric label={tr("Required manpower")} value={String(impact.requiredManpower)} />
        <Metric label={tr("Available pool")} value={String(impact.availableRelievers)} />
        <Metric label={tr("Nearby / cluster")} value={String(impact.nearbyAvailableWorkers)} />
        <Metric
          label={tr("Uncovered shifts")}
          value={String(report?.uncoveredCount ?? 0)}
          alert={(report?.uncoveredCount ?? 0) > 0}
        />
        <Metric label={tr("Potential OT")} value={`${impact.potentialOtHours} hrs`} alert={impact.potentialOtHours > 0} />
        <Metric
          label={tr("Est. OT cost")}
          value={
            impact.potentialOtCost
              ? `₹${impact.potentialOtCost.toLocaleString(intlLocale())}`
              : "₹0"
          }
          alert={impact.potentialOtCost > 0}
        />
      </div>

      {focusVacancies.length > 0 ? (
        <VacancyList title={tr("Coverage needed")} vacancies={focusVacancies} />
      ) : null}

      {competing.length > 0 ? (
        <div style={{ marginTop: 14 }}><VacancyList title={tr("Competing plant overlaps")} vacancies={competing} /></div>
      ) : null}
    </div>
  );
}

function VacancyList({
  title,
  vacancies,
}: {
  title: string;
  vacancies: ShiftVacancy[];
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{trData(title)}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {vacancies.map((v) => (
          <div
            key={v.id}
            style={{
              padding: "10px 12px", borderRadius: 8, background: nectarColors.sand,
              border: "1px solid rgba(11, 26, 36, 0.06)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{v.date} · {v.shiftCode} · {trData(getSiteName(v.siteId))}</span>
              <Tag style={{ margin: 0 }}>{v.source === "leave" ? tr("Leave") : tr("Roster gap")}</Tag>
              <Tag
                color={
                  v.status === "open"
                    ? nectarColors.alert
                    : v.status === "ot_fallback"
                      ? "#D97706"
                      : nectarColors.mint
                }
                style={{ margin: 0 }}
              >
                {trData(v.status)}
              </Tag>
              {v.absentEmployeeName ? (
                <span style={{ fontSize: 12, color: nectarColors.muted }}>{tr("Absent: {absentEmployeeName}", { absentEmployeeName: trData(v.absentEmployeeName) })}</span>
              ) : null}
              {v.leaveId && v.leaveId !== vacancies[0]?.leaveId ? (
                <Link href={`/leave/requests/${v.leaveId}`} style={{ fontSize: 12, color: nectarColors.leaf }}>{tr("Open leave")}</Link>
              ) : null}
            </div>
            {v.status === "open" ? (
              <div style={{ fontSize: 12, color: nectarColors.muted }}>
                {v.candidates.length ? (
                  <>
                    {tr("Top cover:")}{" "}
                    {v.candidates.slice(0, 3).map((c, i) => (
                      <span key={c.id}>
                        {i > 0 ? " · " : ""}
                        <strong style={{ color: nectarColors.ink }}>{trData(c.name)}</strong>{" "}
                        ({trData(candidateDisplaySource(c.source))})
                      </span>
                    ))}
                  </>
                ) : (
                  <span style={{ color: nectarColors.alert }}>{tr("No employee or pool match — OT last resort")}</span>
                )}
              </div>
            ) : v.chosenCoverName ? (
              <div style={{ fontSize: 12, color: nectarColors.muted }}>{tr("Covered: {chosenCoverName}", { chosenCoverName: trData(v.chosenCoverName) })}</div>
            ) : null}
          </div>
        ))}
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
    <div style={{ background: nectarColors.sand, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: nectarColors.muted }}>{trData(label)}</div>
      <div style={{ fontSize: 18, fontWeight: 650, color: alert ? nectarColors.alert : nectarColors.ink }}>{trData(value)}</div>
    </div>
  );
}
