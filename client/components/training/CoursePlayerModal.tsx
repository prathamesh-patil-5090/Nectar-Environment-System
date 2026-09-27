"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Progress,
  Tag,
  Radio,
  Space,
  Alert,
  Tooltip,
  Divider,
  message,
} from "antd";
import {
  LockOutlined,
  CheckCircleFilled,
  PlayCircleOutlined,
  ReadOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
  FastForwardOutlined,
  TrophyOutlined,
  ArrowRightOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type {
  Course,
  Ability,
  CourseEnrollment,
  AbilityProgress,
} from "@/lib/training/types";
import {
  getEnrollment,
  isAbilityUnlocked,
  updateVideoProgress,
  acknowledgeReading,
  submitMicroQuiz,
  canTakeSkillMapping,
  submitSkillMapping,
  submitWrittenTest,
  getAssessmentResults,
} from "@/lib/training/store";
import { nectarColors } from "@/lib/theme";

interface CoursePlayerModalProps {
  course: Course | null;
  employeeId: string;
  onClose: () => void;
  onEnrollmentUpdated?: () => void;
}

export default function CoursePlayerModal({
  course,
  employeeId,
  onClose,
  onEnrollmentUpdated,
}: CoursePlayerModalProps) {
  if (!course) return null;

  // Local state
  const [enrollment, setEnrollment] = useState<CourseEnrollment>(() =>
    getEnrollment(employeeId, course.id),
  );
  const [activeAbilityId, setActiveAbilityId] = useState<string>(
    course.abilities[0]?.id,
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeQuizAbility, setActiveQuizAbility] = useState<Ability | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [quizResult, setQuizResult] = useState<{ scorePct: number; passed: boolean } | null>(null);

  // Course-end tests
  const [skillMapOpen, setSkillMapOpen] = useState<boolean>(false);
  const [skillMapAnswers, setSkillMapAnswers] = useState<Record<string, string>>({});
  const [skillMapResult, setSkillMapResult] = useState<{ scorePct: number; passed: boolean } | null>(null);

  const [writtenOpen, setWrittenOpen] = useState<boolean>(false);
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, string>>({});
  const [writtenResult, setWrittenResult] = useState<{ scorePct: number; passed: boolean } | null>(null);

  const reloadEnrollment = () => {
    const updated = getEnrollment(employeeId, course.id);
    setEnrollment(updated);
    if (onEnrollmentUpdated) onEnrollmentUpdated();
  };

  const activeAbility =
    course.abilities.find((a) => a.id === activeAbilityId) || course.abilities[0];
  const activeProgress: AbilityProgress = enrollment.abilityProgress[
    activeAbility.id
  ] || {
    abilityId: activeAbility.id,
    videoWatchedPct: 0,
    videoComplete: false,
    readingAcknowledged: false,
    quizAttempts: 0,
    quizPassed: false,
    unlockedAt: activeAbility.order === 1 ? new Date().toISOString() : "",
  };

  const assessmentResults = getAssessmentResults(enrollment.id);

  // Video playback simulator ticker
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && activeProgress.videoWatchedPct < 100) {
      timer = setInterval(() => {
        setEnrollment((prev) => {
          const current = prev.abilityProgress[activeAbility.id]?.videoWatchedPct || 0;
          const next = Math.min(100, current + 5);
          updateVideoProgress(prev.id, activeAbility.id, next);
          return getEnrollment(employeeId, course.id);
        });
      }, 600);
    }
    return () => clearInterval(timer);
  }, [isPlaying, activeAbility.id, activeProgress.videoWatchedPct]);

  // Overall course progress percentage
  const completedAbilitiesCount = course.abilities.filter((a) => {
    const p = enrollment.abilityProgress[a.id];
    return p && p.completedAt;
  }).length;
  const overallCourseProgress = Math.round(
    (completedAbilitiesCount / course.abilities.length) * 100,
  );

  const handleSimulateFullWatch = () => {
    updateVideoProgress(enrollment.id, activeAbility.id, 100);
    reloadEnrollment();
    message.success("Video watch simulated to 100%! Gating micro-quiz is now unlocked.");
  };

  const handleStartMicroQuiz = (ab: Ability) => {
    setActiveQuizAbility(ab);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizResult(null);
  };

  const handleSubmitMicroQuiz = () => {
    if (!activeQuizAbility) return;
    const res = submitMicroQuiz(enrollment.id, activeQuizAbility.id, quizAnswers);
    setQuizResult(res);
    setQuizSubmitted(true);
    reloadEnrollment();

    if (res.passed) {
      message.success("Congratulations! Micro-quiz passed with distinction. Next module unlocked!");
    } else {
      message.error("Score fell below 70%. Please review the reading and try again.");
    }
  };

  const handleSubmitSkillMapping = () => {
    const res = submitSkillMapping(enrollment.id, skillMapAnswers);
    setSkillMapResult(res);
    reloadEnrollment();
    if (res.passed) {
      message.success(
        "Skill Mapping Assessment passed! Your enrollment is now queued for Manager Practical & Oral evaluation.",
      );
    }
  };

  const handleSubmitWrittenTest = () => {
    const res = submitWrittenTest(enrollment.id, writtenAnswers);
    setWrittenResult(res);
    reloadEnrollment();
    if (res.passed) {
      message.success("Written Engineering Examination passed successfully!");
    }
  };

  const allAbilitiesDone = canTakeSkillMapping(enrollment, course);

  return (
    <Modal
      open={Boolean(course)}
      onCancel={onClose}
      footer={null}
      width={1060}
      centered
      bodyStyle={{ padding: 0, height: 720, overflow: "hidden" }}
    >
      <div style={{ display: "flex", height: "100%", background: "#F8FAFC" }}>
        {/* ================= LEFT SYLLABUS SIDEBAR ================= */}
        <div
          style={{
            width: 340,
            background: "#FFFFFF",
            borderRight: "1px solid rgba(28, 68, 99, 0.1)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Syllabus Header */}
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(28, 68, 99, 0.08)" }}>
            <Tag color="cyan" style={{ borderRadius: 10, fontSize: 11, marginBottom: 6 }}>
              {course.section}
            </Tag>
            <h3
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 700,
                color: nectarColors.ink,
                fontFamily: "var(--font-fraunces), Georgia, serif",
                lineHeight: 1.3,
              }}
            >
              {course.title}
            </h3>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: nectarColors.muted, marginBottom: 4 }}>
                <span>Course Progress</span>
                <span style={{ fontWeight: 600, color: nectarColors.leaf }}>{overallCourseProgress}%</span>
              </div>
              <Progress
                percent={overallCourseProgress}
                showInfo={false}
                strokeColor={nectarColors.leaf}
                railColor="rgba(28, 68, 99, 0.08)"
                size="small"
              />
            </div>
          </div>

          {/* Sequential Ability Modules */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: nectarColors.muted,
                textTransform: "uppercase",
                marginBottom: 8,
                paddingLeft: 6,
              }}
            >
              Sequential Learning Modules
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {course.abilities.map((ab) => {
                const isUnlocked = isAbilityUnlocked(enrollment, ab, course);
                const prog = enrollment.abilityProgress[ab.id];
                const isCompleted = Boolean(prog && prog.completedAt);
                const isActive = activeAbility.id === ab.id;

                return (
                  <div
                    key={ab.id}
                    onClick={() => {
                      if (isUnlocked) {
                        setActiveAbilityId(ab.id);
                        setIsPlaying(false);
                      } else {
                        message.warning("This module is locked. Complete previous modules and pass the micro-quiz first!");
                      }
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: isActive
                        ? "rgba(28, 68, 99, 0.08)"
                        : isUnlocked
                          ? "#FFFFFF"
                          : "rgba(11, 26, 36, 0.03)",
                      border: `1px solid ${
                        isActive
                          ? nectarColors.leaf
                          : isUnlocked
                            ? "rgba(28, 68, 99, 0.1)"
                            : "rgba(28, 68, 99, 0.05)"
                      }`,
                      cursor: isUnlocked ? "pointer" : "not-allowed",
                      opacity: isUnlocked ? 1 : 0.65,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ marginTop: 2 }}>
                      {isCompleted ? (
                        <CheckCircleFilled style={{ color: "#16A34A", fontSize: 16 }} />
                      ) : isUnlocked ? (
                        <PlayCircleOutlined style={{ color: nectarColors.leaf, fontSize: 16 }} />
                      ) : (
                        <LockOutlined style={{ color: nectarColors.muted, fontSize: 15 }} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: nectarColors.leaf }}>
                        MODULE {ab.code}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: isActive ? 600 : 500,
                          color: isUnlocked ? nectarColors.ink : nectarColors.muted,
                          lineHeight: 1.3,
                          marginTop: 2,
                        }}
                      >
                        {ab.title}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, fontSize: 10, color: nectarColors.muted }}>
                        <span>{ab.videoDurationMinutes} mins</span>
                        {isCompleted && <Tag color="success" style={{ margin: 0, padding: "0 6px", fontSize: 10, borderRadius: 6 }}>Passed</Tag>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Assessment Gates Section */}
            <Divider style={{ margin: "16px 0 12px" }} />
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: nectarColors.muted,
                textTransform: "uppercase",
                marginBottom: 8,
                paddingLeft: 6,
              }}
            >
              Course-End Certification Gates
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Skill Mapping Test */}
              <div
                onClick={() => {
                  if (allAbilitiesDone) {
                    setSkillMapOpen(true);
                    setSkillMapAnswers({});
                    setSkillMapResult(null);
                  } else {
                    message.warning("Complete all sequential modules to unlock the Skill Mapping Test.");
                  }
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: allAbilitiesDone ? "#F0FDF4" : "rgba(11, 26, 36, 0.03)",
                  border: `1px solid ${allAbilitiesDone ? "#DCFCE7" : "rgba(28, 68, 99, 0.06)"}`,
                  cursor: allAbilitiesDone ? "pointer" : "not-allowed",
                  opacity: allAbilitiesDone ? 1 : 0.6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <TrophyOutlined style={{ color: allAbilitiesDone ? "#166534" : nectarColors.muted, fontSize: 16 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: allAbilitiesDone ? "#166534" : nectarColors.ink }}>
                      1. Skill Mapping Test
                    </div>
                    <div style={{ fontSize: 10, color: nectarColors.muted }}>
                      {assessmentResults.skillMap ? `Score: ${assessmentResults.skillMap.scorePct}% (Passed)` : "Course-End Auto Test"}
                    </div>
                  </div>
                </div>
                {!allAbilitiesDone && <LockOutlined style={{ fontSize: 13, color: nectarColors.muted }} />}
              </div>

              {/* Written Test */}
              <div
                onClick={() => {
                  if (assessmentResults.skillMap?.passed) {
                    setWrittenOpen(true);
                    setWrittenAnswers({});
                    setWrittenResult(null);
                  } else {
                    message.warning("Pass the Skill Mapping Test first to unlock the Written Exam.");
                  }
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: assessmentResults.skillMap?.passed ? "#EFF6FF" : "rgba(11, 26, 36, 0.03)",
                  border: `1px solid ${assessmentResults.skillMap?.passed ? "#DBEAFE" : "rgba(28, 68, 99, 0.06)"}`,
                  cursor: assessmentResults.skillMap?.passed ? "pointer" : "not-allowed",
                  opacity: assessmentResults.skillMap?.passed ? 1 : 0.6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <SafetyCertificateOutlined style={{ color: assessmentResults.skillMap?.passed ? "#1E40AF" : nectarColors.muted, fontSize: 16 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: assessmentResults.skillMap?.passed ? "#1E40AF" : nectarColors.ink }}>
                      2. Written Exam
                    </div>
                    <div style={{ fontSize: 10, color: nectarColors.muted }}>
                      {assessmentResults.written ? `Score: ${assessmentResults.written.scorePct}% (Passed)` : "Engineering Theory Test"}
                    </div>
                  </div>
                </div>
                {!assessmentResults.skillMap?.passed && <LockOutlined style={{ fontSize: 13, color: nectarColors.muted }} />}
              </div>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(28, 68, 99, 0.08)", fontSize: 11, color: nectarColors.muted, textAlign: "center" }}>
            Sequential Integrity Server-Verified
          </div>
        </div>

        {/* ================= RIGHT MAIN PLAYER CONSOLE ================= */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {/* Active Module Header */}
          <div
            style={{
              padding: "16px 24px",
              background: "#FFFFFF",
              borderBottom: "1px solid rgba(28, 68, 99, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: nectarColors.leaf, fontWeight: 700, letterSpacing: "0.06em" }}>
                MODULE {activeAbility.code}
              </div>
              <h2
                style={{
                  margin: "2px 0 0",
                  fontSize: 18,
                  fontWeight: 600,
                  color: nectarColors.ink,
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                }}
              >
                {activeAbility.title}
              </h2>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {activeProgress.completedAt ? (
                <Tag color="success" icon={<CheckCircleFilled />}>
                  Module Completed
                </Tag>
              ) : (
                <Tag color="processing">In Progress</Tag>
              )}
            </div>
          </div>

          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* 1. SIMULATED VIDEO PLAYER SCREEN */}
            <div
              style={{
                background: "#0B1A24",
                borderRadius: 14,
                overflow: "hidden",
                position: "relative",
                aspectRatio: "16/9",
                maxHeight: 330,
                boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Video Poster Background */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${course.thumbnailUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: isPlaying ? "brightness(0.85)" : "brightness(0.65)",
                  transition: "all 0.3s ease",
                }}
              />

              {/* Center Play Indicator */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 2,
                }}
              >
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.9)",
                    border: "none",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <PlayCircleOutlined style={{ fontSize: 32, color: nectarColors.leaf }} />
                </button>
              </div>

              {/* Top Video Overlay Bar */}
              <div
                style={{
                  position: "relative",
                  zIndex: 3,
                  padding: "12px 18px",
                  background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
                  color: "#FFFFFF",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                }}
              >
                <span>NEIPL Technical Training Video · {activeAbility.title}</span>
                <span>{activeAbility.videoDurationMinutes}:00 HD</span>
              </div>

              {/* Bottom Video Controls & Progress */}
              <div
                style={{
                  position: "relative",
                  zIndex: 3,
                  padding: "16px 20px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", color: "#FFFFFF", fontSize: 12, marginBottom: 6 }}>
                  <span>
                    Watch Progress: <strong>{activeProgress.videoWatchedPct}%</strong>
                  </span>
                  <span>{activeProgress.videoWatchedPct >= 90 ? "✓ 90% Requirement Met" : "Requires >= 90% to unlock quiz"}</span>
                </div>
                <Progress
                  percent={activeProgress.videoWatchedPct}
                  showInfo={false}
                  strokeColor="#22C55E"
                  railColor="rgba(255, 255, 255, 0.2)"
                  size="small"
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <Button
                    size="small"
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{ background: "rgba(255, 255, 255, 0.2)", border: "none", color: "#FFFFFF" }}
                  >
                    {isPlaying ? "Pause Stream" : "Play Lecture"}
                  </Button>

                  <Button
                    size="small"
                    icon={<FastForwardOutlined />}
                    onClick={handleSimulateFullWatch}
                    style={{ background: "#22C55E", border: "none", color: "#FFFFFF", fontWeight: 600 }}
                  >
                    Simulate Complete (100%)
                  </Button>
                </div>
              </div>
            </div>

            {/* 2. GATING MICRO-QUIZ CALL-TO-ACTION CARD */}
            <div
              style={{
                background: activeProgress.quizPassed
                  ? "#F0FDF4"
                  : activeProgress.videoWatchedPct >= 90
                    ? "#EFF6FF"
                    : "#FFFFFF",
                border: `1px solid ${
                  activeProgress.quizPassed
                    ? "#DCFCE7"
                    : activeProgress.videoWatchedPct >= 90
                      ? "#BFDBFE"
                      : "rgba(28, 68, 99, 0.08)"
                }`,
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: activeProgress.quizPassed ? "#DCFCE7" : "#DBEAFE",
                    color: activeProgress.quizPassed ? "#166534" : "#1E40AF",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 18,
                  }}
                >
                  {activeProgress.quizPassed ? <CheckCircleFilled /> : <ThunderboltOutlined />}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: nectarColors.ink }}>
                    {activeProgress.quizPassed
                      ? "Micro-Quiz Completed (Score: 100%)"
                      : "Gating Micro-Quiz (Pass Mark: 70%)"}
                  </div>
                  <div style={{ fontSize: 12, color: nectarColors.muted, marginTop: 2 }}>
                    {activeProgress.quizPassed
                      ? "Module mastery verified. You can proceed to the next module."
                      : activeProgress.videoWatchedPct >= 90
                        ? "Video completed! Click to answer 3 gating questions to unlock next module."
                        : `Watch at least 90% of the video to unlock the micro-quiz (Current: ${activeProgress.videoWatchedPct}%).`}
                  </div>
                </div>
              </div>

              <div>
                <Button
                  type="primary"
                  disabled={activeProgress.videoWatchedPct < 90}
                  onClick={() => handleStartMicroQuiz(activeAbility)}
                  style={{
                    borderRadius: 8,
                    background: activeProgress.videoWatchedPct >= 90 ? nectarColors.leaf : undefined,
                    fontWeight: 600,
                  }}
                >
                  {activeProgress.quizPassed ? "Review Quiz" : "Take Micro-Quiz →"}
                </Button>
              </div>
            </div>

            {/* 3. TECHNICAL READING NOTES */}
            {activeAbility.readingContent && (
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(28, 68, 99, 0.08)",
                  borderRadius: 12,
                  padding: "18px 20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <ReadOutlined style={{ color: nectarColors.leaf }} />
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: nectarColors.ink }}>
                    Standard Operating Procedure (SOP) Reference Notes
                  </h4>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: nectarColors.ink, lineHeight: 1.6 }}>
                  {activeAbility.readingContent}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= MICRO-QUIZ MODAL ================= */}
      <Modal
        open={Boolean(activeQuizAbility)}
        onCancel={() => setActiveQuizAbility(null)}
        footer={null}
        width={620}
        centered
        title={`Micro-Quiz: Module ${activeQuizAbility?.code}`}
      >
        {activeQuizAbility && (
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 13, color: nectarColors.muted, marginBottom: 16 }}>
              Answer all questions. You need at least <strong>70%</strong> to pass and unlock the next module.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {activeQuizAbility.microQuiz.questions.map((q, idx) => (
                <div
                  key={q.id}
                  style={{
                    background: nectarColors.sand,
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(28, 68, 99, 0.08)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: nectarColors.ink, marginBottom: 10 }}>
                    {idx + 1}. {q.text}
                  </div>

                  <Radio.Group
                    onChange={(e) =>
                      setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })
                    }
                    value={quizAnswers[q.id]}
                    disabled={quizSubmitted && quizResult?.passed}
                  >
                    <Space direction="vertical">
                      {q.options.map((opt) => (
                        <Radio key={opt.id} value={opt.id}>
                          <span style={{ fontSize: 13, color: nectarColors.ink }}>{opt.text}</span>
                        </Radio>
                      ))}
                    </Space>
                  </Radio.Group>

                  {quizSubmitted && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      {quizAnswers[q.id] === q.correctOptionId ? (
                        <span style={{ color: "#16A34A", fontWeight: 600 }}>✓ Correct</span>
                      ) : (
                        <span style={{ color: "#DC2626", fontWeight: 600 }}>✗ Incorrect</span>
                      )}
                      {q.explanation && (
                        <div style={{ color: nectarColors.muted, marginTop: 2 }}>{q.explanation}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quiz Result banner */}
            {quizSubmitted && quizResult && (
              <div
                style={{
                  marginTop: 18,
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: quizResult.passed ? "#F0FDF4" : "#FEF2F2",
                  border: `1px solid ${quizResult.passed ? "#DCFCE7" : "#FEE2E2"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: quizResult.passed ? "#166534" : "#991B1B" }}>
                    Score: {quizResult.scorePct}% · {quizResult.passed ? "PASSED" : "NEEDS RETRY"}
                  </div>
                  <div style={{ fontSize: 12, color: quizResult.passed ? "#15803D" : "#B91C1C" }}>
                    {quizResult.passed ? "Next module is now accessible." : "Pass mark is 70%. Please retry."}
                  </div>
                </div>

                {!quizResult.passed && (
                  <Button
                    size="small"
                    onClick={() => {
                      setQuizSubmitted(false);
                      setQuizAnswers({});
                    }}
                  >
                    Retry Quiz
                  </Button>
                )}
              </div>
            )}

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button onClick={() => setActiveQuizAbility(null)}>Close</Button>
              {!quizResult?.passed && (
                <Button
                  type="primary"
                  onClick={handleSubmitMicroQuiz}
                  style={{ background: nectarColors.leaf }}
                  disabled={
                    Object.keys(quizAnswers).length <
                    activeQuizAbility.microQuiz.questions.length
                  }
                >
                  Submit Answers
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ================= SKILL MAPPING TEST MODAL ================= */}
      <Modal
        open={skillMapOpen}
        onCancel={() => setSkillMapOpen(false)}
        footer={null}
        width={680}
        centered
        title="Course-End Skill Mapping Assessment"
      >
        <div style={{ padding: "8px 0" }}>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: nectarColors.muted }}>
            This comprehensive 5-question objective examination assesses entire plant operations competency. Passing this test unlocks manager hands-on practical and oral evaluations.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {course.skillMappingQuestions.map((q, idx) => (
              <div
                key={q.id}
                style={{
                  background: nectarColors.sand,
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(28, 68, 99, 0.08)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: nectarColors.ink, marginBottom: 8 }}>
                  {idx + 1}. {q.text}
                </div>
                <Radio.Group
                  onChange={(e) =>
                    setSkillMapAnswers({ ...skillMapAnswers, [q.id]: e.target.value })
                  }
                  value={skillMapAnswers[q.id]}
                  disabled={Boolean(skillMapResult?.passed)}
                >
                  <Space direction="vertical">
                    {q.options.map((opt) => (
                      <Radio key={opt.id} value={opt.id}>
                        <span style={{ fontSize: 13, color: nectarColors.ink }}>{opt.text}</span>
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </div>
            ))}
          </div>

          {skillMapResult && (
            <Alert
              style={{ marginTop: 16 }}
              type={skillMapResult.passed ? "success" : "error"}
              message={`Score: ${skillMapResult.scorePct}% · ${skillMapResult.passed ? "Passed Skill Mapping!" : "Failed - Review modules and retry"}`}
              description={
                skillMapResult.passed
                  ? "Your candidacy is now updated to SKILL_MAP_DONE and queued for Manager Practical and Oral evaluations."
                  : "Threshold is 70%. Please re-study the video modules."
              }
              showIcon
            />
          )}

          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button onClick={() => setSkillMapOpen(false)}>Close</Button>
            {!skillMapResult?.passed && (
              <Button
                type="primary"
                onClick={handleSubmitSkillMapping}
                style={{ background: nectarColors.leaf }}
                disabled={
                  Object.keys(skillMapAnswers).length <
                  course.skillMappingQuestions.length
                }
              >
                Submit Skill Mapping Test
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* ================= WRITTEN TEST MODAL ================= */}
      <Modal
        open={writtenOpen}
        onCancel={() => setWrittenOpen(false)}
        footer={null}
        width={680}
        centered
        title="Engineering Written Knowledge Examination"
      >
        <div style={{ padding: "8px 0" }}>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: nectarColors.muted }}>
            Deep biochemical, stoichiometric, and operational troubleshooting examination. Contributes 25% to final competency certification.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {course.writtenTestQuestions.map((q, idx) => (
              <div
                key={q.id}
                style={{
                  background: nectarColors.sand,
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(28, 68, 99, 0.08)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: nectarColors.ink, marginBottom: 8 }}>
                  {idx + 1}. {q.text}
                </div>
                <Radio.Group
                  onChange={(e) =>
                    setWrittenAnswers({ ...writtenAnswers, [q.id]: e.target.value })
                  }
                  value={writtenAnswers[q.id]}
                  disabled={Boolean(writtenResult?.passed)}
                >
                  <Space direction="vertical">
                    {q.options.map((opt) => (
                      <Radio key={opt.id} value={opt.id}>
                        <span style={{ fontSize: 13, color: nectarColors.ink }}>{opt.text}</span>
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </div>
            ))}
          </div>

          {writtenResult && (
            <Alert
              style={{ marginTop: 16 }}
              type={writtenResult.passed ? "success" : "error"}
              message={`Written Score: ${writtenResult.scorePct}% · ${writtenResult.passed ? "Passed Examination" : "Failed"}`}
              description={
                writtenResult.passed
                  ? "Written score logged in permanent competency ledger."
                  : "Pass threshold is 70%."
              }
              showIcon
            />
          )}

          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button onClick={() => setWrittenOpen(false)}>Close</Button>
            {!writtenResult?.passed && (
              <Button
                type="primary"
                onClick={handleSubmitWrittenTest}
                style={{ background: nectarColors.leaf }}
                disabled={
                  Object.keys(writtenAnswers).length <
                  course.writtenTestQuestions.length
                }
              >
                Submit Written Exam
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
