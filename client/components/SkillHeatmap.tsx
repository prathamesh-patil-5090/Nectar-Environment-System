"use client";

import { skillLabels, skillMatrix, type SkillKey } from "@/lib/mock-data";
import { nectarColors } from "@/lib/theme";

const skillKeys = Object.keys(skillLabels) as SkillKey[];

function cellColor(score: number): string {
  if (score >= 85) return "rgba(63, 174, 124, 0.35)";
  if (score >= 70) return "rgba(63, 174, 124, 0.18)";
  if (score >= 55) return "rgba(196, 92, 38, 0.16)";
  return "rgba(196, 92, 38, 0.32)";
}

export default function SkillHeatmap() {
  return (
    <div
      style={{
        background: nectarColors.white,
        padding: 20,
        height: "100%",
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
        Skill mapping
      </div>
      <p style={{ margin: "0 0 16px", color: nectarColors.muted, fontSize: 13 }}>
        Role coverage across critical O&amp;M competencies (0–100).
      </p>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 4,
            minWidth: 520,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  fontWeight: 500,
                  fontSize: 12,
                  color: nectarColors.muted,
                  padding: "4px 8px",
                }}
              >
                Role
              </th>
              {skillKeys.map((key) => (
                <th
                  key={key}
                  style={{
                    fontWeight: 500,
                    fontSize: 11,
                    color: nectarColors.muted,
                    padding: "4px 6px",
                    textAlign: "center",
                  }}
                >
                  {skillLabels[key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skillMatrix.map((row) => (
              <tr key={row.role}>
                <td
                  style={{
                    fontSize: 13,
                    color: nectarColors.ink,
                    padding: "4px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.role}
                </td>
                {skillKeys.map((key) => {
                  const score = row[key];
                  return (
                    <td key={key} style={{ padding: 0 }}>
                      <div
                        title={`${row.role} · ${skillLabels[key]}: ${score}`}
                        style={{
                          background: cellColor(score),
                          color: nectarColors.ink,
                          textAlign: "center",
                          fontSize: 12,
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 600,
                          padding: "10px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {score}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
