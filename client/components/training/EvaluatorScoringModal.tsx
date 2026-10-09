"use client";

import React, { useState } from "react";
import { Modal, Button, Radio, Input, Space, Divider, Tag, App } from "antd";
import {
  CheckCircleFilled,
  SafetyCertificateOutlined,
  UserOutlined,
  CommentOutlined,
  FileProtectOutlined,
} from "@ant-design/icons";
import type { Course, CourseEnrollment, AbilityScore } from "@/lib/training/types";
import { evaluatePractical, evaluateOral } from "@/lib/training/store";
import { nectarColors } from "@/lib/theme";
import type { CSSProperties } from "react";
import { tr, trTable, trData } from "@/lib/i18n";

const sWhitePadR10Border2: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(28, 68, 99, 0.12)",
  borderRadius: 10,
  padding: "16px 18px",
};

interface EvaluatorScoringModalProps {
  enrollment: CourseEnrollment | null;
  candidateName: string;
  course: Course | null;
  type: "practical" | "oral";
  evaluatorName?: string;
  /** Logged-in evaluator (Director or the learner's allotted manager — checked by the server) */
  evaluatorId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const RUBRIC_LABELS: Record<number, string> = trTable({
  1: "1 · Unsatisfactory",
  2: "2 · Below Standard",
  3: "3 · Competent (Standard)",
  4: "4 · Proficient",
  5: "5 · Exemplary",
});

export default function EvaluatorScoringModal({
  enrollment,
  candidateName,
  course,
  type,
  evaluatorName,
  evaluatorId,
  onClose,
  onSubmitted,
}: EvaluatorScoringModalProps) {
  const { message } = App.useApp();
  const isPractical = type === "practical";

  // State: ratings per ability (1-5) and remarks
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    if (course?.abilities) {
      course.abilities.forEach((a) => {
        init[a.id] = 4; // default to proficient 4 on 1-5 scale
      });
    }
    return init;
  });

  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [generalNotes, setGeneralNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  if (!enrollment || !course) return null;

  // Calculate live score (1 to 5 scale)
  const totalPoints = Object.values(scores).reduce((sum, v) => sum + v, 0);
  const maxPossible = course.abilities.length * 5;
  const computedPct = Math.round((totalPoints / maxPossible) * 1000) / 10;

  const handleSubmit = async () => {
    const scoreItems: AbilityScore[] = course.abilities.map((a) => ({
      abilityId: a.id,
      abilityTitle: a.title,
      score: scores[a.id] || 4,
      remark: remarks[a.id] ?? "",
    }));
    setSaving(true);
    try {
      const res = await (isPractical ? evaluatePractical : evaluateOral)(enrollment.id, evaluatorId, scoreItems, generalNotes);
      message.success(
        tr("{stage} scored ({overallPct}%).", { stage: isPractical ? tr("Practical") : tr("Oral viva"), overallPct: res.result.overallPct }) +
            (res.certificate ? " " + tr("Certificate {certificateNo} issued.", { certificateNo: res.certificate.certificateNo }) : ""),
      );
      onSubmitted();
      onClose();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(enrollment)}
      onCancel={onClose}
      footer={null}
      width={760}
      centered
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileProtectOutlined style={{ color: nectarColors.leaf, fontSize: 18 }} />
          <span>
            {isPractical
              ? tr("Live Practical Field Observation Rubric (1–5 Scale)")
              : tr("Oral Technical Viva & Competency Interview (1–5 Scale)")}
          </span>
        </div>
      }
    >
      <div style={{ padding: "8px 0" }}>
        {/* Candidate & Evaluator Matrix Banner */}
        <div
          style={{
            background: nectarColors.sand, border: "1px solid rgba(28, 68, 99, 0.08)", borderRadius: 10,
            padding: "14px 18px", display: "grid", gridTemplateColumns: "1.4fr 1.2fr 1fr", gap: 16, fontSize: 12,
            marginBottom: 20,
          }}
        >
          <div>
            <span style={{ color: nectarColors.muted, display: "block", fontSize: 11 }}>{tr("CANDIDATE OPERATOR")}</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: nectarColors.ink }}>{trData(candidateName)}</span>
            <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 2 }}>{tr("Course: {title}", { title: trData(course.title) })}</div>
          </div>

          <div>
            <span style={{ color: nectarColors.muted, display: "block", fontSize: 11 }}>{tr("OFFICIAL EVALUATOR")}</span>
            <span style={{ fontWeight: 600, color: nectarColors.ink }}>{trData(evaluatorName)}</span>
            <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 2 }}>{tr("Role: Plant Operations Manager (Authorized Assessor)")}</div>
          </div>

          <div style={{ textAlign: "right" }}>
            <span style={{ color: nectarColors.muted, display: "block", fontSize: 11 }}>{tr("LIVE RESULT PREVIEW")}</span>
            <span
              style={{
                fontSize: 20, fontWeight: 700, color: computedPct >= 70 ? "#166534" : "#D97706",
                fontFamily: "var(--font-fraunces), Georgia, serif",
              }}
            >
              {computedPct}%
            </span>
            <div style={{ fontSize: 11, color: nectarColors.muted }}>{tr("{totalPoints} / {maxPossible} Points", { totalPoints, maxPossible })}</div>
          </div>
        </div>

        {/* Evaluation Rubrics per Ability */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxHeight: 420, overflowY: "auto", paddingRight: 6 }}>
          {course.abilities.map((ab, idx) => (
            <div key={ab.id} style={sWhitePadR10Border2}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: nectarColors.leaf }}>{tr("ABILITY {code}", { code: ab.code })}</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: nectarColors.ink, marginTop: 2 }}>{trData(ab.title)}</div>
                  <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 2 }}>{trData(ab.description)}</div>
                </div>
                <Tag color="blue" style={{ borderRadius: 8, fontSize: 11, margin: 0 }}>{tr("Rating: {scores}/5", { scores: scores[ab.id] })}</Tag>
              </div>

              {/* 1 to 5 Radio Buttons */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: nectarColors.muted, marginBottom: 6 }}>{isPractical ? tr("Demonstrated Field Performance:") : tr("Technical Articulation & Understanding:")}</div>
                <Radio.Group
                  value={scores[ab.id]}
                  onChange={(e) =>
                    setScores({ ...scores, [ab.id]: Number(e.target.value) })
                  }
                  buttonStyle="solid"
                  size="small"
                  style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                >
                  {[1, 2, 3, 4, 5].map((num) => (
                    <Radio.Button
                      key={num}
                      value={num}
                      style={{ borderRadius: 6, fontSize: 12, fontWeight: 600, padding: "0 12px", textAlign: "center" }}
                    >
                      {num} {num === 3 ? tr("(Standard)") : num === 5 ? tr("(Exemplary)") : ""}
                    </Radio.Button>
                  ))}
                </Radio.Group>
              </div>

              {/* Specific Observation Remark */}
              <div style={{ marginTop: 12 }}>
                <Input
                  size="small"
                  placeholder={
                    isPractical
                      ? tr("Enter field observation (e.g. calibration accuracy, valve alignments, PPE adherence)...")
                      : tr("Enter interview observations (e.g. clarity on shock loading, SVI diagnostics, confined space)...")
                  }
                  value={remarks[ab.id] || ""}
                  onChange={(e) =>
                    setRemarks({ ...remarks, [ab.id]: e.target.value })
                  }
                  style={{ borderRadius: 6, fontSize: 12 }}
                />

                {/* Quick Feedback Chips for Strengths / Weaknesses */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {(isPractical
                    ? [
                        tr("✓ Flawless physical lineup"),
                        tr("✓ Strict PPE & LOTO observed"),
                        tr("⚠️ Needs closer DO sparger monitoring"),
                        tr("⚠️ Review jar test calibration"),
                      ]
                    : [
                        tr("✓ Thorough protocol articulation"),
                        tr("✓ Clear shock load containment"),
                        tr("⚠️ Review 4-gas testing thresholds"),
                        tr("⚠️ Hesitant on clarifier bulking SVI"),
                      ]
                  ).map((chip) => (
                    <Tag
                      key={chip}
                      onClick={() => {
                        const curr = remarks[ab.id] || "";
                        setRemarks({ ...remarks, [ab.id]: curr ? `${curr}; ${chip}` : chip });
                      }}
                      style={{
                        cursor: "pointer", fontSize: 10, padding: "1px 8px", borderRadius: 10,
                        border: "1px dashed #CBD5E1", background: "#F8FAFC",
                      }}
                    >
                      {trData(chip)}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* General Notes */}
          <div style={sWhitePadR10Border2}>
            <div style={{ fontSize: 13, fontWeight: 600, color: nectarColors.ink, marginBottom: 6 }}>{tr("Overall Evaluator Concluding Remarks & Sign-off")}</div>
            <Input.TextArea
              rows={2}
              placeholder={tr("Summary observations, recommendations for ongoing shift supervision...")}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              style={{ borderRadius: 6, fontSize: 12 }}
            />
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div
          style={{
            marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14,
            borderTop: "1px solid rgba(28, 68, 99, 0.08)",
          }}
        >
          <div style={{ fontSize: 12, color: nectarColors.muted }}>{tr("Submitting seals score into the 4-tier competency ledger.")}</div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose}>{tr("Cancel")}</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={saving}
              style={{ borderRadius: 8, fontWeight: 600, background: nectarColors.leaf }}
            >
              {tr("Confirm & Save Assessment ({computedPct}%)", { computedPct })}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
