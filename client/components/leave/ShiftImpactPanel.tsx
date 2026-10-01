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
        background: nectarColors.white,
        border: "1px solid rgba(28, 68, 99, 0.12)",
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
          Shift impact
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
        {report ? ` → ${report.to}` : ""}
      </div>

      {affected.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Planned shifts affected ({affected.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {affected.map((d) => (
              <Tag
                key={d.date + d.shiftCode}
                color={
                  d.replacementRequired ? nectarColors.alert : nectarColors.muted
                }
              >
                {d.date} → {d.shiftName}
                {d.replacementRequired ? " · cover needed" : ""}
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
          marginBottom: focusVacancies.length ? 16 : 0,
        }}
      >
        <Metric label="Current manpower" value={String(impact.currentManpower)} />
        <Metric label="Required manpower" value={String(impact.requiredManpower)} />
        <Metric
          label="Available pool"
          value={String(impact.availableRelievers)}
        />
        <Metric
          label="Nearby / cluster"
          value={String(impact.nearbyAvailableWorkers)}
        />
        <Metric
          label="Uncovered shifts"
          value={String(report?.uncoveredCount ?? 0)}
          alert={(report?.uncoveredCount ?? 0) > 0}
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

      {focusVacancies.length > 0 ? (
        <VacancyList
          title="Coverage needed"
          vacancies={focusVacancies}
        />
      ) : null}

      {competing.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <VacancyList
            title="Competing plant overlaps"
            vacancies={competing}
          />
        </div>
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
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {vacancies.map((v) => (
          <div
            key={v.id}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: nectarColors.sand,
              border: "1px solid rgba(11, 26, 36, 0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 10px",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {v.date} · {v.shiftCode} · {getSiteName(v.siteId)}
              </span>
              <Tag style={{ margin: 0 }}>
                {v.source === "leave" ? "Leave" : "Roster gap"}
              </Tag>
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
                {v.status}
              </Tag>
              {v.absentEmployeeName ? (
                <span style={{ fontSize: 12, color: nectarColors.muted }}>
                  Absent: {v.absentEmployeeName}
                </span>
              ) : null}
              {v.leaveId && v.leaveId !== vacancies[0]?.leaveId ? (
                <Link
                  href={`/leave/requests/${v.leaveId}`}
                  style={{ fontSize: 12, color: nectarColors.leaf }}
                >
                  Open leave
                </Link>
              ) : null}
            </div>
            {v.status === "open" ? (
              <div style={{ fontSize: 12, color: nectarColors.muted }}>
                {v.candidates.length ? (
                  <>
                    Top cover:{" "}
                    {v.candidates.slice(0, 3).map((c, i) => (
                      <span key={c.id}>
                        {i > 0 ? " · " : ""}
                        <strong style={{ color: nectarColors.ink }}>
                          {c.name}
                        </strong>{" "}
                        ({candidateDisplaySource(c.source)})
                      </span>
                    ))}
                  </>
                ) : (
                  <span style={{ color: nectarColors.alert }}>
                    No employee or pool match — OT last resort
                  </span>
                )}
              </div>
            ) : v.chosenCoverName ? (
              <div style={{ fontSize: 12, color: nectarColors.muted }}>
                Covered: {v.chosenCoverName}
              </div>
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
