"use client";

import { theme } from "antd";
import { skillLabels, skillMatrix, type SkillKey } from "@/lib/mock-data";
import { Section } from "@/components/quiet";
import { useT, trData } from "@/lib/i18n";

const skillKeys = Object.keys(skillLabels) as SkillKey[];

/**
 * Skill matrix: rows are job roles, columns are skills, cells are the expected strength (0–100) for that kind of job.
 * Plain numbers; only weak cells are coloured (amber 55–69, red below 55) so the gaps are what you see.
 */
export default function SkillHeatmap() {
  const { token } = theme.useToken();
  const t = useT();
  const cell = (score: number) =>
    score < 55
      ? { color: token.colorError, background: token.colorErrorBg }
      : score < 70
        ? { color: token.colorWarningText, background: token.colorWarningBg }
        : { color: token.colorText, background: "transparent" };

  return (
    <Section title={t("dash.skillMatrix")} extra={t("dash.skillMatrixExtra")} flush>
      <div style={{ padding: "12px 16px 0", fontSize: 13, color: token.colorTextSecondary }}>
        {t("dash.skillMatrixIntro")}
      </div>
      <div style={{ overflowX: "auto", padding: "8px 8px 12px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontWeight: 500, color: token.colorTextSecondary, padding: "8px" }}>{t("common.role")}</th>
              {skillKeys.map((key) => (
                <th key={key} style={{ fontWeight: 500, color: token.colorTextSecondary, padding: "8px 6px", textAlign: "right" }}>
                  {trData(skillLabels[key])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skillMatrix.map((row) => (
              <tr key={row.role} style={{ borderTop: `1px solid ${token.colorSplit}` }}>
                <td style={{ color: token.colorText, padding: "8px", whiteSpace: "nowrap" }}>{trData(row.role)}</td>
                {skillKeys.map((key) => {
                  const score = row[key];
                  const c = cell(score);
                  return (
                    <td key={key} style={{ padding: "4px 6px", textAlign: "right" }}>
                      <span
                        title={`${trData(row.role)} · ${trData(skillLabels[key])}: ${score}`}
                        style={{
                          display: "inline-block",
                          minWidth: 34,
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontVariantNumeric: "tabular-nums",
                          ...c,
                        }}
                      >
                        {score}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
