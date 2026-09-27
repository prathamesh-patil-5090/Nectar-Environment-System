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
import {
  submitPracticalAssessment,
  submitOralAssessment,
} from "@/lib/training/store";
import { nectarColors } from "@/lib/theme";

interface EvaluatorScoringModalProps {
  enrollment: CourseEnrollment | null;
  candidateName: string;
  course: Course | null;
  type: "practical" | "oral";
  evaluatorName?: string;
  evaluatorId?: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const RUBRIC_LABELS: Record<number, string> = {
  1: "1 · Unsatisfactory",
  2: "2 · Below Standard",
  3: "3 · Competent (Standard)",
  4: "4 · Proficient",
  5: "5 · Exemplary",
};

export default function EvaluatorScoringModal({
  enrollment,
  candidateName,
  course,
  type,
  evaluatorName = "Rajesh Kulkarni (Plant Manager)",
  evaluatorId = "e-mgr-1",
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

  if (!enrollment || !course) return null;

  // Calculate live score (1 to 5 scale)
  const totalPoints = Object.values(scores).reduce((sum, v) => sum + v, 0);
  const maxPossible = course.abilities.length * 5;
  const computedPct = Math.round((totalPoints / maxPossible) * 1000) / 10;

  const handleSubmit = () => {
    const scoreItems: AbilityScore[] = course.abilities.map((a) => ({
      abilityId: a.id,
      abilityTitle: a.title,
      score: scores[a.id] || 4,
      remark: remarks[a.id] || "Demonstrated required plant competence under supervision.",
    }));

    if (isPractical) {
      submitPracticalAssessment(
        enrollment.id,
        evaluatorId,
        evaluatorName,
        scoreItems,
        generalNotes,
      );
      message.success(`Practical field evaluation scored (${computedPct}%). Ledger updated!`);
    } else {
      submitOralAssessment(
        enrollment.id,
        evaluatorId,
        evaluatorName,
        scoreItems,
        generalNotes,
      );
      message.success(`Oral technical interview evaluation scored (${computedPct}%). Ledger updated!`);
    }

    onSubmitted();
    onClose();
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
              ? "Live Practical Field Observation Rubric (1–5 Scale)"
              : "Oral Technical Viva & Competency Interview (1–5 Scale)"}
          </span>
        </div>
      }
    >
      <div style={{ padding: "8px 0" }}>
        {/* Candidate & Evaluator Matrix Banner */}
        <div
          style={{
            background: nectarColors.sand,
            border: "1px solid rgba(28, 68, 99, 0.08)",
            borderRadius: 10,
            padding: "14px 18px",
            display: "grid",
            gridTemplateColumns: "1.4fr 1.2fr 1fr",
            gap: 16,
            fontSize: 12,
            marginBottom: 20,
          }}
        >
          <div>
            <span style={{ color: nectarColors.muted, display: "block", fontSize: 11 }}>
              CANDIDATE OPERATOR
            </span>
            <span style={{ fontWeight: 700, fontSize: 13, color: nectarColors.ink }}>
              {candidateName}
            </span>
            <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 2 }}>
              Course: {course.title}
            </div>
          </div>

          <div>
            <span style={{ color: nectarColors.muted, display: "block", fontSize: 11 }}>
              OFFICIAL EVALUATOR
            </span>
            <span style={{ fontWeight: 600, color: nectarColors.ink }}>
              {evaluatorName}
            </span>
            <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 2 }}>
              Role: Site Manager / O&M Assessor
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <span style={{ color: nectarColors.muted, display: "block", fontSize: 11 }}>
              LIVE RESULT PREVIEW
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: computedPct >= 70 ? "#166534" : "#D97706",
                fontFamily: "var(--font-fraunces), Georgia, serif",
              }}
            >
              {computedPct}%
            </span>
            <div style={{ fontSize: 11, color: nectarColors.muted }}>
              {totalPoints} / {maxPossible} Points
            </div>
          </div>
        </div>

        {/* Evaluation Rubrics per Ability */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxHeight: 420, overflowY: "auto", paddingRight: 6 }}>
          {course.abilities.map((ab, idx) => (
            <div
              key={ab.id}
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(28, 68, 99, 0.12)",
                borderRadius: 10,
                padding: "16px 18px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: nectarColors.leaf }}>
                    ABILITY {ab.code}
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: nectarColors.ink, marginTop: 2 }}>
                    {ab.title}
                  </div>
                  <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 2 }}>
                    {ab.description}
                  </div>
                </div>
                <Tag color="blue" style={{ borderRadius: 8, fontSize: 11, margin: 0 }}>
                  Rating: {scores[ab.id]}/5
                </Tag>
              </div>

              {/* 1 to 5 Radio Buttons */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: nectarColors.muted, marginBottom: 6 }}>
                  {isPractical ? "Demonstrated Field Performance:" : "Technical Articulation & Understanding:"}
                </div>
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
                      style={{
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "0 12px",
                        textAlign: "center",
                      }}
                    >
                      {num} {num === 3 ? "(Standard)" : num === 5 ? "(Exemplary)" : ""}
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
                      ? "Enter field observation (e.g. calibration accuracy, valve alignments, PPE adherence)..."
                      : "Enter interview observations (e.g. clarity on shock loading, SVI diagnostics, confined space)..."
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
                        "✓ Flawless physical lineup",
                        "✓ Strict PPE & LOTO observed",
                        "⚠️ Needs closer DO sparger monitoring",
                        "⚠️ Review jar test calibration",
                      ]
                    : [
                        "✓ Thorough protocol articulation",
                        "✓ Clear shock load containment",
                        "⚠️ Review 4-gas testing thresholds",
                        "⚠️ Hesitant on clarifier bulking SVI",
                      ]
                  ).map((chip) => (
                    <Tag
                      key={chip}
                      onClick={() => {
                        const curr = remarks[ab.id] || "";
                        setRemarks({
                          ...remarks,
                          [ab.id]: curr ? `${curr}; ${chip}` : chip,
                        });
                      }}
                      style={{
                        cursor: "pointer",
                        fontSize: 10,
                        padding: "1px 8px",
                        borderRadius: 10,
                        border: "1px dashed #CBD5E1",
                        background: "#F8FAFC",
                      }}
                    >
                      {chip}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* General Notes */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(28, 68, 99, 0.12)",
              borderRadius: 10,
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: nectarColors.ink, marginBottom: 6 }}>
              Overall Evaluator Concluding Remarks & Sign-off
            </div>
            <Input.TextArea
              rows={2}
              placeholder="Summary observations, recommendations for ongoing shift supervision..."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              style={{ borderRadius: 6, fontSize: 12 }}
            />
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 14,
            borderTop: "1px solid rgba(28, 68, 99, 0.08)",
          }}
        >
          <div style={{ fontSize: 12, color: nectarColors.muted }}>
            Submitting seals score into the 4-tier competency ledger.
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              style={{
                borderRadius: 8,
                fontWeight: 600,
                background: nectarColors.leaf,
              }}
            >
              Confirm & Save Assessment ({computedPct}%)
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
