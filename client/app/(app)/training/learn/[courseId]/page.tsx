"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Row,
  Col,
  Button,
  Progress,
  Tag,
  Radio,
  Alert,
  Slider,
  Tooltip,
  App,
  Modal,
} from "antd";
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleFilled,
  LockOutlined,
  FastForwardOutlined,
  BookOutlined,
  QuestionCircleOutlined,
  DashboardOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  RightOutlined,
  LeftOutlined,
  CheckOutlined,
  WarningOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileTextOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  UndoOutlined,
  RedoOutlined,
  CaretRightOutlined,
  PauseOutlined,
  FileDoneOutlined,
  AuditOutlined,
  PrinterOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  CustomerServiceOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import {
  getCourseById,
  getEnrollment,
  isAbilityUnlocked,
  updateVideoProgress,
  submitMicroQuiz,
  canTakeSkillMapping,
  submitSkillMapping,
  submitWrittenTest,
  submitPracticalAssessment,
  submitOralAssessment,
  checkAndTriggerCertification,
  getAssessmentResults,
  getCertificates,
} from "@/lib/training/store";
import { getSession } from "@/lib/auth";
import { scopedEmployeeId, selfEmployeeId, normalizeRole } from "@/lib/rbac";
import { getEmployeeById } from "@/lib/mock-data";
import { CourseraRecommendationsGrid } from "@/components/training/CourseraRecommendationsGrid";
import EvaluatorScoringModal from "@/components/training/EvaluatorScoringModal";
import { VideoPlayerEngine } from "@/lib/training/VideoPlayerEngine";
import type {
  Course,
  CourseEnrollment,
  AbilityProgress,
  QuizQuestion,
} from "@/lib/training/types";

function CourseLearningInner() {
  const params = useParams();
  const router = useRouter();
  const courseId = Array.isArray(params.courseId) ? params.courseId[0] : params.courseId;

  const session = getSession();
  const userRole = normalizeRole(session?.role);
  const isManager = userRole !== "employee";
  const employeeId = scopedEmployeeId(session) ?? selfEmployeeId(session) ?? "e-etp-op1";
  const employee = getEmployeeById(employeeId);

  // ── Core data state ──────────────────────────────────────────────────────
  const [course, setCourse] = useState<Course | null>(null);
  const [activeAbilityId, setActiveAbilityId] = useState<string>("");

  /**
   * enrollmentVersion is an integer counter. We bump it whenever we write to
   * the store so the UI re-reads enrollment fresh from localStorage.
   * We NEVER store the enrollment object itself in state — that caused infinite
   * loops because getEnrollment() returns a new object reference every call.
   */
  const [enrollmentVersion, setEnrollmentVersion] = useState(0);
  const bumpEnrollment = useCallback(() => setEnrollmentVersion((v) => v + 1), []);

  // Derive enrollment from store on every render (cheap localStorage read)
  const enrollment: CourseEnrollment | null =
    course ? getEnrollment(employeeId, course.id) : null;

  // ── UI-only state ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<string>("sop");
  const [focusMode, setFocusMode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // ── Contextual message API (fixes antd static message warning) ────────────
  const { message: msg } = App.useApp();

  // ── Video engine (OOP — lives in a ref, never causes renders itself) ──────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  // Tracks whether video-end auto-opened the quiz (so we don't flash it twice)
  const videoEndFiredRef = useRef(false);

  const engineRef = useRef<VideoPlayerEngine | null>(null);

  // Create engine once on mount
  useEffect(() => {
    const engine = new VideoPlayerEngine({
      onTimeUpdate: (sec) => setCurrentTimeSec(sec),
      onPlayStateChange: (playing) => {
        setIsPlaying(playing);
        // Video just ended → auto-open quiz tab
        if (!playing) {
          const course = courseCacheRef.current;
          const abilityId = abilityIdRef.current;
          if (!course || !abilityId) return;
          const ability = course.abilities.find((a) => a.id === abilityId) || course.abilities[0];
          const duration = (ability.videoDurationMinutes || 1) * 60;
          // Only trigger if we reached the very end (within 2 sec)
          const currentSec = engine.currentSec;
          if (currentSec >= duration - 2 && !videoEndFiredRef.current) {
            videoEndFiredRef.current = true;
            const enr = getEnrollment(employeeIdRef.current, course.id);
            if (enr) {
              updateVideoProgress(enr.id, abilityId, 100);
              bumpEnrollment();
            }
            setActiveTab("quiz");
            setQuizModalOpen(true);
            msg.success("Lesson video completed! Micro-quiz knowledge check is now open.");
          }
        } else {
          videoEndFiredRef.current = false;
        }
      },
      onProgressCommit: (sec) => {
        // Commit progress to store without touching React state
        const course = engineRef.current && courseCacheRef.current;
        const abilityId = abilityIdRef.current;
        if (!course || !abilityId) return;
        const ability = course.abilities.find((a) => a.id === abilityId) || course.abilities[0];
        const duration = (ability.videoDurationMinutes || 1) * 60;
        const pct = Math.round((Math.min(sec, duration) / duration) * 100);
        const enr = getEnrollment(employeeIdRef.current, course.id);
        if (!enr) return;
        const currentPct = enr.abilityProgress[abilityId]?.videoWatchedPct || 0;
        if (pct > currentPct) {
          updateVideoProgress(enr.id, abilityId, pct);
          bumpEnrollment();
        }
      },
      onSeekBlocked: () => {
        msg.warning("Fast-forwarding past unwatched video is restricted. Please watch continuously.");
      },
    });
    engineRef.current = engine;
    return () => engine.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable refs so engine callbacks can read latest values without re-creating the engine
  const courseCacheRef = useRef<Course | null>(null);
  const abilityIdRef = useRef<string>("");
  const employeeIdRef = useRef<string>(employeeId);

  useEffect(() => { employeeIdRef.current = employeeId; }, [employeeId]);
  useEffect(() => { courseCacheRef.current = course; }, [course]);
  useEffect(() => {
    abilityIdRef.current = activeAbilityId;
    // Reset video-end flag when switching modules
    videoEndFiredRef.current = false;
  }, [activeAbilityId]);

  // ── Speed change ─────────────────────────────────────────────────────────
  useEffect(() => {
    engineRef.current?.setSpeed(playbackSpeed);
  }, [playbackSpeed]);

  // ── Fullscreen listener ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // ── Initial course load ───────────────────────────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    const found = getCourseById(courseId);
    if (!found) return;
    setCourse(found);
    courseCacheRef.current = found;
    if (found.abilities.length > 0) {
      const first = found.abilities[0];
      setActiveAbilityId(first.id);
      abilityIdRef.current = first.id;
      const enr = getEnrollment(employeeId, found.id);
      const watchedPct = enr?.abilityProgress[first.id]?.videoWatchedPct || 0;
      const dur = (first.videoDurationMinutes || 1) * 60;
      const initialSec = Math.round((watchedPct / 100) * dur);
      engineRef.current?.switchAbility(initialSec, dur);
    }
  }, [courseId, employeeId]);

  // ── Micro-Quiz State ──────────────────────────────────────────────────────
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [quizResult, setQuizResult] = useState<{ scorePct: number; passed: boolean } | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [quizModalOpen, setQuizModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizResult(null);
    setCurrentQuestionIdx(0);
  }, [activeAbilityId]);

  // ── SCADA Simulation State ────────────────────────────────────────────────
  const [simInfluentFlow, setSimInfluentFlow] = useState<number>(250);
  const [simCoagulantPpm, setSimCoagulantPpm] = useState<number>(45);
  const [simAerationDO, setSimAerationDO] = useState<number>(2.4);

  // ── Final Qualification Gates State (5 Sequential Gates) ──────────────────
  // Gate 1: Practical Test
  const [skillMapOpen, setSkillMapOpen] = useState<boolean>(false);
  const [skillMapAnswers, setSkillMapAnswers] = useState<Record<string, string>>({});
  const [skillMapResult, setSkillMapResult] = useState<{ scorePct: number; passed: boolean } | null>(null);

  // Gate 2: Written Theory Exam
  const [writtenOpen, setWrittenOpen] = useState<boolean>(false);
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, string>>({});
  const [writtenResult, setWrittenResult] = useState<{ scorePct: number; passed: boolean } | null>(null);

  // Gate 3: Oral Technical Viva Interview
  const [oralOpen, setOralOpen] = useState<boolean>(false);
  const [oralAnswers, setOralAnswers] = useState<Record<string, string>>({});
  const [oralResult, setOralResult] = useState<{ overallPct: number; passed: boolean } | null>(null);

  // Gate 4: Test Report Summary
  const [reportOpen, setReportOpen] = useState<boolean>(false);

  // Gate 5: Plant Qualification Certificate
  const [certModalOpen, setCertModalOpen] = useState<boolean>(false);

  // In-Person Manager Evaluation Modal Mode
  const [evalScoringType, setEvalScoringType] = useState<"practical" | "oral" | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  /** Switch to a different module — engine handles timer reset atomically */
  const selectAbility = (newAbilityId: string) => {
    const course = courseCacheRef.current;
    if (!course) return;
    const targetAbility = course.abilities.find((a) => a.id === newAbilityId);
    if (!targetAbility) return;
    setActiveAbilityId(newAbilityId);
    abilityIdRef.current = newAbilityId;
    const enr = getEnrollment(employeeId, course.id);
    const watchedPct = enr?.abilityProgress[newAbilityId]?.videoWatchedPct || 0;
    const dur = (targetAbility.videoDurationMinutes || 1) * 60;
    const targetSec = Math.round((watchedPct / 100) * dur);
    engineRef.current?.switchAbility(targetSec, dur);
  };

  // ── Guard: wait for course data ────────────────────────────────────────────
  if (!course || !enrollment) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center", minHeight: "60vh", background: "#FFFFFF" }}>
        <h2 style={{ fontSize: 22, color: "#1F2937", marginBottom: 16 }}>Course Not Found</h2>
        <p style={{ color: "#64748B", marginBottom: 24 }}>
          The requested course could not be loaded.
        </p>
        <Link href="/training">
          <Button type="primary" icon={<ArrowLeftOutlined />}>
            Back to Training Catalog
          </Button>
        </Link>
      </div>
    );
  }
  const activeAbility =
    course.abilities.find((a) => a.id === activeAbilityId) || course.abilities[0];
  const activeIndex = course.abilities.findIndex((a) => a.id === activeAbility.id);
  const totalDurationSec = (activeAbility.videoDurationMinutes || 1) * 60;

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

  const completedAbilitiesCount = course.abilities.filter(
    (a) => enrollment.abilityProgress[a.id]?.quizPassed,
  ).length;
  const overallProgress = Math.round(
    (completedAbilitiesCount / course.abilities.length) * 100,
  );

  const isCurrentUnlocked = activeAbility ? isAbilityUnlocked(enrollment, activeAbility, course) : true;
  const isVideoWatchDone = activeProgress.videoWatchedPct >= 90;
  const assessmentResults = getAssessmentResults(enrollment.id);
  const certificate = getCertificates(employeeId).find((c) => c.courseId === course.id);

  // Submit micro-quiz
  const handleQuizSubmit = () => {
    const res = submitMicroQuiz(enrollment.id, activeAbility.id, quizAnswers);
    setQuizResult(res);
    setQuizSubmitted(true);
    bumpEnrollment();
    if (res.passed) {
      msg.success(`Passed with ${res.scorePct}%! Moving to next module...`);
      // Auto-advance to next module after a short delay
      const nextIndex = activeIndex + 1;
      if (nextIndex < course.abilities.length) {
        const nextAbility = course.abilities[nextIndex];
        setTimeout(() => {
          selectAbility(nextAbility.id);
          setActiveTab("sop");
          setQuizModalOpen(false);
        }, 1500);
      } else {
        msg.success("All module quizzes passed! Gate 1 (Practical Test) is now unlocked.");
        setTimeout(() => {
          setQuizModalOpen(false);
          setSkillMapOpen(true);
        }, 1500);
      }
    } else {
      msg.error(`Scored ${res.scorePct}%. 70% required to pass. Please review SOP and retry.`);
    }
  };

  // Gate 3: Oral Technical Viva Questions
  const oralVivaQuestions = [
    {
      id: "oral-1",
      scenario: "Emergency Scenario 1: Chemical Shock Load",
      prompt: "Influent COD surges from 2,000 mg/L to 7,500 mg/L within 20 minutes due to an upstream pharmaceutical reactor dump. Explain your exact immediate operational protocol:",
      options: [
        { id: "opt-a", text: "Immediately divert raw feed to the Emergency Equalization Basin, throttle forward feed pumps to aeration by 50%, increase Return Activated Sludge (RAS) flow, and step up aeration blower output to maintain DO > 2.0 ppm." },
        { id: "opt-b", text: "Shut down all aeration blowers to let biomass settle to the bottom and bypass the shock load directly to municipal sewers." },
        { id: "opt-c", text: "Add concentrated hydrochloric acid to lower COD by chemical neutralization." },
      ],
      correctOptionId: "opt-a",
    },
    {
      id: "oral-2",
      scenario: "Diagnostic Scenario 2: Clarifier Sludge Bulking",
      prompt: "Secondary clarifier SVI rises to 280 mL/g with a cloudy, billowy sludge blanket escaping the effluent weir. How do you diagnose and arrest this condition?",
      options: [
        { id: "opt-a", text: "Perform microscopic smear to verify filamentous overgrowth; apply low-dose chlorine/hypochlorite (2–3 mg/L based on MLSS) to RAS line to clip filaments, and adjust DO in aeration above 2.5 ppm." },
        { id: "opt-b", text: "Stop returning sludge and dump all activated biomass to the drying beds immediately." },
        { id: "opt-c", text: "Increase mixer speed in clarifier to break up the sludge blanket physically." },
      ],
      correctOptionId: "opt-a",
    },
    {
      id: "oral-3",
      scenario: "Safety & Compliance Scenario 3: Basin Confined Space Entry",
      prompt: "Before operators enter an empty equalization basin or aeration tank for diffuser grid cleaning, what statutory safety sequence is legally mandatory?",
      options: [
        { id: "opt-a", text: "Execute electrical LOTO on all mixers/blowers, continuous 4-gas testing (O2, H2S, CO, LEL), forced draft mechanical ventilation for 30 minutes, and post an active standby attendant with safety harness rescue tripod." },
        { id: "opt-b", text: "Operators can enter immediately as long as they wear safety shoes and a hard hat." },
        { id: "opt-c", text: "Sprinkle room freshener to eliminate sulfur odors before walking inside." },
      ],
      correctOptionId: "opt-a",
    },
  ];

  const handleOralSubmit = () => {
    let correct = 0;
    oralVivaQuestions.forEach((q) => {
      if (oralAnswers[q.id] === q.correctOptionId) correct++;
    });
    const overallPct = Math.round((correct / oralVivaQuestions.length) * 100);
    const passed = overallPct >= 70;
    submitOralAssessment(
      enrollment.id,
      "eval-lead-1",
      "Er. Vikram Sengupta (Lead Assessor)",
      course.abilities.map((a) => ({
        abilityId: a.id,
        abilityTitle: a.title,
        score: passed ? 6 : 4,
        remark: passed ? "Competent in Emergency Scenarios" : "Needs Further Field Practice",
      })),
      "Candidate demonstrated rigorous emergency management, SOP adherence, and hazardous chemical control."
    );
    setOralResult({ overallPct, passed });
    bumpEnrollment();
    if (passed) {
      msg.success(`Oral Viva passed with ${overallPct}%! Gate 4 (Test Report Summary) is now unlocked.`);
      setOralOpen(false);
      setReportOpen(true);
    } else {
      msg.error(`Scored ${overallPct}%. 70% required to pass oral viva. Please review emergency protocols and retry.`);
    }
  };

  /** Seek + commit via engine */
  const handleSeek = (sec: number) => engineRef.current?.seekTo(sec);
  /** Skip ±N seconds via engine */
  const handleSkip = (delta: number) => engineRef.current?.skip(delta);

  // Next / Previous navigation
  const handlePreviousModule = () => {
    if (activeIndex > 0) {
      selectAbility(course.abilities[activeIndex - 1].id);
    }
  };

  const handleNextModule = () => {
    if (activeIndex < course.abilities.length - 1) {
      const nextAbility = course.abilities[activeIndex + 1];
      if (isAbilityUnlocked(enrollment, nextAbility, course)) {
        selectAbility(nextAbility.id);
      } else {
        msg.warning("Complete the current module's quiz to unlock the next module.");
      }
    } else if (canTakeSkillMapping(enrollment, course)) {
      setSkillMapOpen(true);
    }
  };

  // Simulated SCADA dynamic calculation
  const simEffluentCOD = Math.max(
    18,
    Math.round(280 - simCoagulantPpm * 3.2 - simAerationDO * 22 + (simInfluentFlow - 250) * 0.15),
  );
  const simEffluentBOD = Math.max(6, Math.round(simEffluentCOD * 0.28));
  const simComplianceOK = simEffluentCOD <= 100 && simEffluentBOD <= 30;

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh", color: "#0F172A" }}>
      {/* ---------------- 1. STICKY TOP STUDIO BAR (CLEAN WHITE) ---------------- */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "#FFFFFF",
          borderBottom: "1px solid #E2E8F0",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Left: Back Link & Breadcrumbs */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/training"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#334155",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: 6,
              background: "#F1F5F9",
              border: "1px solid #CBD5E1",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#1C4463";
              e.currentTarget.style.borderColor = "#1C4463";
              e.currentTarget.style.background = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#334155";
              e.currentTarget.style.borderColor = "#CBD5E1";
              e.currentTarget.style.background = "#F1F5F9";
            }}
          >
            <ArrowLeftOutlined style={{ fontSize: 11 }} />
            Back to Portal
          </Link>

          <span style={{ color: "#CBD5E1" }}>|</span>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Tag color="#1C4463" style={{ border: "none", fontWeight: 700, borderRadius: 4 }}>
              {course.code}
            </Tag>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
              {course.title}
            </span>
          </div>
        </div>

        {/* Right: Progress Ring & Focus Mode */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Progress
              type="circle"
              percent={overallProgress}
              size={36}
              strokeColor="#16A34A"
              railColor="#E2E8F0"
            />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>
                Course Progress
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                {completedAbilitiesCount} of {course.abilities.length} Completed
              </div>
            </div>
          </div>

          <Button
            size="small"
            icon={focusMode ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setFocusMode(!focusMode)}
            style={{
              background: "#F8FAFC",
              borderColor: "#CBD5E1",
              color: "#334155",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {focusMode ? "Show Syllabus" : "Focus Mode"}
          </Button>
        </div>
      </header>

      {/* ---------------- 2. MAIN LMS WORKSPACE (SIDEBAR + STAGE) ---------------- */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        {/* LEFT SYLLABUS RAIL (CLEAN WHITE) */}
        {!focusMode && (
          <aside
            style={{
              width: 340,
              minWidth: 340,
              background: "#FFFFFF",
              borderRight: "1px solid #E2E8F0",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              maxHeight: "calc(100vh - 60px)",
            }}
          >
            {/* Header info */}
            <div
              style={{
                padding: "20px 18px",
                borderBottom: "1px solid #E2E8F0",
                background: "#F8FAFC",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#1C4463",
                  marginBottom: 6,
                }}
              >
                {course.section}
              </div>
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0F172A",
                  margin: "0 0 8px 0",
                  lineHeight: 1.35,
                }}
              >
                {course.title}
              </h2>
              <div style={{ fontSize: 12, color: "#64748B" }}>
                Pass Threshold: <strong>{course.passThreshold}%</strong> • Approx.{" "}
                {course.estimatedHours} hrs
              </div>
            </div>

            {/* Modules List */}
            <div style={{ padding: "16px 12px", flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#475569",
                  marginBottom: 10,
                  paddingLeft: 6,
                }}
              >
                Learning Modules & Abilities
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {course.abilities.map((ability) => {
                  const unlocked = isAbilityUnlocked(enrollment, ability, course);
                  const isCurrent = ability.id === activeAbilityId;
                  const abProgress = enrollment.abilityProgress[ability.id];
                  const passed = abProgress?.quizPassed;

                  return (
                    <div
                      key={ability.id}
                      onClick={() => {
                        if (unlocked) {
                          selectAbility(ability.id);
                        } else {
                          msg.warning("Complete previous module quiz to unlock this lesson.");
                        }
                      }}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: isCurrent
                          ? "#EFF6FF"
                          : unlocked
                          ? "#FFFFFF"
                          : "#F8FAFC",
                        border: isCurrent
                          ? "1.5px solid #0284C7"
                          : unlocked
                          ? "1px solid #E2E8F0"
                          : "1px solid #F1F5F9",
                        cursor: unlocked ? "pointer" : "not-allowed",
                        opacity: unlocked ? 1 : 0.6,
                        boxShadow: isCurrent ? "0 2px 8px rgba(2, 132, 199, 0.08)" : "none",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: isCurrent ? "#0284C7" : "#64748B",
                          }}
                        >
                          Module {ability.order}
                        </span>

                        {passed ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              color: "#16A34A",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <CheckCircleFilled /> Done
                          </span>
                        ) : unlocked ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              color: isCurrent ? "#0284C7" : "#0284C7",
                              fontWeight: 600,
                            }}
                          >
                            ● Active
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 10.5,
                              color: "#94A3B8",
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <LockOutlined /> Locked
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isCurrent ? "#0F172A" : "#1E293B",
                          lineHeight: 1.35,
                          marginBottom: 6,
                        }}
                      >
                        {ability.title}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 11,
                          color: "#64748B",
                        }}
                      >
                        <span>{ability.videoDurationMinutes}m video</span>
                        <span>
                          {passed
                            ? "Quiz 100%"
                            : (abProgress?.videoWatchedPct || 0) >= 90
                            ? "Quiz Ready"
                            : `${abProgress?.videoWatchedPct || 0}% watched`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Course-End Certification Gates */}
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: "1px solid #E2E8F0",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#475569",
                    marginBottom: 10,
                    paddingLeft: 6,
                  }}
                >
                  Final Qualification Gates
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Gate 1: Practical Test */}
                  <div
                    onClick={() => {
                      if (canTakeSkillMapping(enrollment, course)) {
                        setSkillMapOpen(true);
                      } else {
                        msg.warning("Complete all module video lessons and micro-quizzes to unlock Practical Test.");
                      }
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: assessmentResults.practical
                        ? "#F0FDF4"
                        : canTakeSkillMapping(enrollment, course)
                        ? "#F0FDF4"
                        : "#F8FAFC",
                      border: assessmentResults.practical
                        ? "1px solid #BBF7D0"
                        : canTakeSkillMapping(enrollment, course)
                        ? "1.5px solid #22C55E"
                        : "1px solid #E2E8F0",
                      cursor: canTakeSkillMapping(enrollment, course) ? "pointer" : "not-allowed",
                      opacity: canTakeSkillMapping(enrollment, course) ? 1 : 0.6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A" }}>
                        1. Practical Test
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: assessmentResults.practical
                            ? "#16A34A"
                            : canTakeSkillMapping(enrollment, course)
                            ? "#15803D"
                            : "#64748B",
                        }}
                      >
                        {assessmentResults.practical
                          ? `Passed (${assessmentResults.practical.overallPct}%)`
                          : canTakeSkillMapping(enrollment, course)
                          ? "Unlocked · In-Person Field Scoring"
                          : "Hands-on plant simulation"}
                      </div>
                    </div>
                    {assessmentResults.practical ? (
                      <CheckCircleFilled style={{ color: "#16A34A" }} />
                    ) : canTakeSkillMapping(enrollment, course) ? (
                      <Tag color="green" style={{ margin: 0, fontWeight: 700, fontSize: 10, borderRadius: 10 }}>
                        Ready
                      </Tag>
                    ) : (
                      <LockOutlined style={{ color: "#94A3B8" }} />
                    )}
                  </div>

                  {/* Gate 2: Theory Exam */}
                  <div
                    onClick={() => {
                      if (assessmentResults.practical) {
                        setWrittenOpen(true);
                      } else {
                        msg.warning("Pass Gate 1 (Practical Test) first to unlock Written Theory Exam.");
                      }
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: assessmentResults.written
                        ? "#F0FDF4"
                        : assessmentResults.practical
                        ? "#F0FDF4"
                        : "#F8FAFC",
                      border: assessmentResults.written
                        ? "1px solid #BBF7D0"
                        : assessmentResults.practical
                        ? "1.5px solid #22C55E"
                        : "1px solid #E2E8F0",
                      cursor: assessmentResults.practical ? "pointer" : "not-allowed",
                      opacity: assessmentResults.practical ? 1 : 0.6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A" }}>
                        2. Written Test
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: assessmentResults.written
                            ? "#16A34A"
                            : assessmentResults.practical
                            ? "#15803D"
                            : "#64748B",
                        }}
                      >
                        {assessmentResults.written
                          ? `Passed (${assessmentResults.written.scorePct}%)`
                          : assessmentResults.practical
                          ? "Unlocked · Ready to take"
                          : "Comprehensive theory exam"}
                      </div>
                    </div>
                    {assessmentResults.written ? (
                      <CheckCircleFilled style={{ color: "#16A34A" }} />
                    ) : assessmentResults.practical ? (
                      <Tag color="green" style={{ margin: 0, fontWeight: 700, fontSize: 10, borderRadius: 10 }}>
                        Ready
                      </Tag>
                    ) : (
                      <LockOutlined style={{ color: "#94A3B8" }} />
                    )}
                  </div>

                  {/* Gate 3: Oral Technical Viva */}
                  <div
                    onClick={() => {
                      if (assessmentResults.written?.passed) {
                        setOralOpen(true);
                      } else {
                        msg.warning("Pass Gate 2 (Written Theory Exam) first to unlock Oral Technical Viva.");
                      }
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: assessmentResults.oral
                        ? "#F0FDF4"
                        : assessmentResults.written?.passed
                        ? "#F0FDF4"
                        : "#F8FAFC",
                      border: assessmentResults.oral
                        ? "1px solid #BBF7D0"
                        : assessmentResults.written?.passed
                        ? "1.5px solid #22C55E"
                        : "1px solid #E2E8F0",
                      cursor: assessmentResults.written?.passed ? "pointer" : "not-allowed",
                      opacity: assessmentResults.written?.passed ? 1 : 0.6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A" }}>
                        3. Oral Test
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: assessmentResults.oral
                            ? "#16A34A"
                            : assessmentResults.written?.passed
                            ? "#15803D"
                            : "#64748B",
                        }}
                      >
                        {assessmentResults.oral
                          ? `Passed (${assessmentResults.oral.overallPct}%)`
                          : assessmentResults.written?.passed
                          ? "Unlocked · Ready for Viva Interview"
                          : "Technical evaluator viva"}
                      </div>
                    </div>
                    {assessmentResults.oral ? (
                      <CheckCircleFilled style={{ color: "#16A34A" }} />
                    ) : assessmentResults.written?.passed ? (
                      <Tag color="green" style={{ margin: 0, fontWeight: 700, fontSize: 10, borderRadius: 10 }}>
                        Ready
                      </Tag>
                    ) : (
                      <LockOutlined style={{ color: "#94A3B8" }} />
                    )}
                  </div>

                  {/* Gate 4: Test Report Summary */}
                  <div
                    onClick={() => {
                      if (assessmentResults.oral) {
                        setReportOpen(true);
                      } else {
                        msg.warning("Complete Gate 3 (Oral Technical Viva) first to view Test Report Summary.");
                      }
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: assessmentResults.oral ? "#EFF6FF" : "#F8FAFC",
                      border: assessmentResults.oral ? "1px solid #93C5FD" : "1px solid #E2E8F0",
                      cursor: assessmentResults.oral ? "pointer" : "not-allowed",
                      opacity: assessmentResults.oral ? 1 : 0.6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A" }}>
                        4. Test Report Summary
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        {assessmentResults.oral
                          ? "Evaluation scorecard ready"
                          : "Awaiting exam completion"}
                      </div>
                    </div>
                    {assessmentResults.oral ? (
                      <FileDoneOutlined style={{ color: "#2563EB", fontSize: 14 }} />
                    ) : (
                      <LockOutlined style={{ color: "#94A3B8" }} />
                    )}
                  </div>

                  {/* Gate 5: Plant Qualification Certificate */}
                  <div
                    onClick={() => {
                      if (certificate) {
                        setCertModalOpen(true);
                      } else if (assessmentResults.oral) {
                        setReportOpen(true);
                        msg.info("Review your Test Report Summary to claim your official certificate.");
                      } else {
                        msg.warning("Certificate is unlocked upon passing all 3 qualification gates.");
                      }
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: certificate ? "#F0FDF4" : "#F8FAFC",
                      border: certificate ? "1.5px solid #16A34A" : "1px solid #E2E8F0",
                      cursor: certificate || assessmentResults.oral ? "pointer" : "not-allowed",
                      opacity: certificate || assessmentResults.oral ? 1 : 0.6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A" }}>
                        5. Plant Qualification Certificate
                      </div>
                      <div style={{ fontSize: 11, color: certificate ? "#15803D" : "#64748B" }}>
                        {certificate ? "✓ Issued & Verifiable" : "Awaiting qualification report"}
                      </div>
                    </div>
                    {certificate ? (
                      <SafetyCertificateOutlined style={{ color: "#16A34A", fontSize: 15 }} />
                    ) : (
                      <LockOutlined style={{ color: "#94A3B8" }} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* RIGHT MAIN CENTER STAGE (CLEAN LIGHT BACKGROUND) */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 32px 80px 32px",
            background: "#F8FAFC",
          }}
        >
          <div style={{ maxWidth: 1040, margin: "0 auto" }}>
            {/* 1. CINEMATIC VIDEO DECK */}
            <div
              ref={videoContainerRef}
              style={{
                borderRadius: 16,
                overflow: "hidden",
                background: "#000000",
                border: "1px solid #CBD5E1",
                boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
                marginBottom: 24,
                position: "relative",
              }}
            >
              {/* 16:9 Video Canvas */}
              <div
                onClick={() => engineRef.current?.toggle()}
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16 / 9",
                  background: "#081018",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
              >
                {/* CSS Animation Keyframes for Live Stream & Aeration */}
                <style>{`
                  @keyframes pulseLiveDot {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.3; transform: scale(0.85); }
                    100% { opacity: 1; transform: scale(1); }
                  }
                  @keyframes aerationShimmer {
                    0% { opacity: 0.2; transform: scale(1) translateY(0); }
                    50% { opacity: 0.45; transform: scale(1.02) translateY(-2px); }
                    100% { opacity: 0.2; transform: scale(1) translateY(0); }
                  }
                `}</style>

                <Image
                  src={course.thumbnailUrl}
                  alt={activeAbility?.title || course.title}
                  fill
                  sizes="(max-width: 1200px) 100vw, 1000px"
                  style={{
                    objectFit: "cover",
                    opacity: isPlaying ? 0.95 : 0.65,
                    transform: isPlaying ? "scale(1.04)" : "scale(1.0)",
                    transition: "transform 12s ease-out, opacity 0.4s ease",
                  }}
                />

                {/* Animated Aeration Water Surface Turbulence (Active when Playing) */}
                {isPlaying && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      background:
                        "radial-gradient(circle at 45% 65%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 40%, transparent 70%)",
                      mixBlendMode: "overlay",
                      animation: "aerationShimmer 2s ease-in-out infinite",
                    }}
                  />
                )}

                {/* Gradient vignette */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(11,26,36,0.35) 0%, rgba(11,26,36,0.7) 100%)",
                    pointerEvents: "none",
                  }}
                />

                {/* Big Center Play Overlay - ONLY SHOWS WHEN PAUSED! */}
                {!isPlaying && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      engineRef.current?.play();
                    }}
                    style={{
                      width: 78,
                      height: 78,
                      borderRadius: "50%",
                      background: "rgba(28, 68, 99, 0.92)",
                      border: "3px solid #FFFFFF",
                      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      zIndex: 10,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
                  >
                    <CaretRightOutlined style={{ fontSize: 38, color: "#FFFFFF", marginLeft: 4 }} />
                  </div>
                )}

                {/* Top Title & Live Status Overlay */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    top: 18,
                    left: 20,
                    right: 20,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    zIndex: 5,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        background: "#1C4463",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#FFFFFF",
                        letterSpacing: "0.04em",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                      }}
                    >
                      MODULE {activeAbility?.order || 1}
                    </span>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#FFFFFF",
                        textShadow: "0 2px 8px rgba(0, 0, 0, 0.7)",
                      }}
                    >
                      {activeAbility?.title}
                    </span>
                  </div>

                  {isPlaying ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "rgba(15, 23, 42, 0.8)",
                        border: "1px solid rgba(239, 68, 68, 0.6)",
                        borderRadius: 20,
                        padding: "3px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#FFFFFF",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#EF4444",
                          boxShadow: "0 0 8px #EF4444",
                          animation: "pulseLiveDot 1.2s infinite",
                        }}
                      />
                      LIVE FEED • HD 1080p
                    </div>
                  ) : (
                    <Tag
                      color="#16A34A"
                      style={{
                        border: "none",
                        fontWeight: 600,
                        borderRadius: 4,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                      }}
                    >
                      HD 1080p Plant Cam
                    </Tag>
                  )}
                </div>

                {/* Real-time SCADA HUD Watermark when Playing */}
                {isPlaying && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 72,
                      right: 20,
                      background: "rgba(11, 26, 36, 0.75)",
                      backdropFilter: "blur(6px)",
                      borderRadius: 8,
                      padding: "6px 12px",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "#93C5FD",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      zIndex: 8,
                      pointerEvents: "none",
                    }}
                  >
                    <span>DO: {(simAerationDO + Math.sin(currentTimeSec * 0.1) * 0.08).toFixed(2)} mg/L</span>
                    <span>FLOW: {(simInfluentFlow + Math.sin(currentTimeSec * 0.15) * 4).toFixed(1)} m³/h</span>
                    <span>MLSS: {Math.round(3450 + Math.cos(currentTimeSec * 0.08) * 35)} mg/L</span>
                  </div>
                )}

                {/* Bottom Scrubber & Controls Bar */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "16px 20px 14px 20px",
                    background:
                      "linear-gradient(0deg, rgba(11, 26, 36, 0.96) 0%, rgba(11, 26, 36, 0.8) 70%, transparent 100%)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    zIndex: 10,
                  }}
                >
                  {/* Interactive Seek Scrubber Slider */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                     <Slider
                      min={0}
                      max={totalDurationSec}
                      value={currentTimeSec}
                      onChange={(val) => engineRef.current?.scrubTo(val)}
                      onChangeComplete={(val) => engineRef.current?.seekTo(val)}
                      tooltip={{
                        formatter: (val) => formatTime(val || 0),
                      }}
                      trackStyle={{ background: "#7EA6C4" }}
                      handleStyle={{
                        borderColor: "#FFFFFF",
                        background: "#1C4463",
                        boxShadow: "0 0 8px rgba(255, 255, 255, 0.8)",
                      }}
                      railStyle={{ background: "rgba(255, 255, 255, 0.25)" }}
                      style={{ margin: 0, flex: 1 }}
                    />
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        color: "#E2E8F0",
                        whiteSpace: "nowrap",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {formatTime(currentTimeSec)} / {formatTime(totalDurationSec)}
                    </div>
                  </div>

                  {/* Player Action Buttons Bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 12,
                    }}
                  >
                    {/* Left Controls: 5s Back, Play/Pause, 5s Forward, Speed */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* 5s Back Button */}
                      <Tooltip title="Rewind 5 seconds">
                        <button
                          type="button"
                          onClick={() => handleSkip(-5)}
                          style={{
                            background: "rgba(255, 255, 255, 0.12)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "#FFFFFF",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "rgba(255, 255, 255, 0.24)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)")
                          }
                        >
                          <UndoOutlined style={{ fontSize: 11 }} /> -5s
                        </button>
                      </Tooltip>

                      {/* Play / Pause Toggle */}
                      <button
                        type="button"
                        onClick={() => engineRef.current?.toggle()}
                        style={{
                          background: "#1C4463",
                          border: "1px solid rgba(255, 255, 255, 0.25)",
                          color: "#FFFFFF",
                          borderRadius: 6,
                          padding: "5px 14px",
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          transition: "all 0.2s",
                          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#23557C")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#1C4463")}
                      >
                        {isPlaying ? (
                          <>
                            <PauseOutlined style={{ fontSize: 12 }} /> Pause
                          </>
                        ) : (
                          <>
                            <CaretRightOutlined style={{ fontSize: 13 }} /> Play
                          </>
                        )}
                      </button>

                      {/* 5s Forward Button */}
                      <Tooltip title="Forward 5 seconds">
                        <button
                          type="button"
                          onClick={() => handleSkip(5)}
                          style={{
                            background: "rgba(255, 255, 255, 0.12)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "#FFFFFF",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "rgba(255, 255, 255, 0.24)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)")
                          }
                        >
                          +5s <RedoOutlined style={{ fontSize: 11 }} />
                        </button>
                      </Tooltip>

                      <span style={{ color: "rgba(255, 255, 255, 0.3)", margin: "0 2px" }}>|</span>

                      {/* Playback Speed selector (NEIPL Navy matching) */}
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ color: "#CBD5E1", fontSize: 11, fontWeight: 500 }}>
                          Speed:
                        </span>
                        {[1.0, 1.25, 1.5].map((spd) => (
                          <button
                            key={spd}
                            type="button"
                            onClick={() => setPlaybackSpeed(spd)}
                            style={{
                              background:
                                playbackSpeed === spd
                                  ? "#1C4463"
                                  : "rgba(255, 255, 255, 0.1)",
                              border:
                                playbackSpeed === spd
                                  ? "1px solid #7EA6C4"
                                  : "1px solid rgba(255, 255, 255, 0.15)",
                              color: "#FFFFFF",
                              fontSize: 11,
                              fontWeight: playbackSpeed === spd ? 700 : 500,
                              padding: "2px 7px",
                              borderRadius: 4,
                              cursor: "pointer",
                              transition: "all 0.18s",
                            }}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Right Controls: Fullscreen */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* Fullscreen Button */}
                      <Tooltip title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}>
                        <button
                          type="button"
                          onClick={toggleFullscreen}
                          style={{
                            background: "rgba(255, 255, 255, 0.12)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "#FFFFFF",
                            borderRadius: 6,
                            padding: "4px 9px",
                            fontSize: 13,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "rgba(255, 255, 255, 0.24)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)")
                          }
                        >
                          {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>

              {/* Watch time gating status bar (Clean light design) */}
              <div
                style={{
                  padding: "12px 20px",
                  background: isVideoWatchDone ? "#ECFDF5" : "#FFFBEB",
                  borderTop: isVideoWatchDone ? "1px solid #A7F3D0" : "1px solid #FDE68A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 12.5,
                  color: isVideoWatchDone ? "#065F46" : "#92400E",
                  transition: "background 0.3s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {isVideoWatchDone ? (
                    <CheckCircleFilled style={{ color: "#16A34A", fontSize: 15 }} />
                  ) : (
                    <LockOutlined style={{ color: "#D97706", fontSize: 14 }} />
                  )}
                  <span>
                    {isVideoWatchDone ? (
                      <strong>
                        Watch requirement satisfied (≥ 90%). Micro-quiz knowledge check is unlocked!
                      </strong>
                    ) : (
                      <>
                        Requires at least 90% watch time to unlock the knowledge check (Current:{" "}
                        <strong>{activeProgress.videoWatchedPct}%</strong>).
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. TABBED STUDY & ENGINEERING WORKSPACE (CLEAN WHITE CARD) */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E2E8F0",
                overflow: "hidden",
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.04)",
                marginBottom: 32,
              }}
            >
              {/* Workspace Navigation Tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                }}
              >
                {[
                  { id: "sop", label: "SOP Reference Notes", icon: <BookOutlined /> },
                  {
                    id: "quiz",
                    label: `Knowledge Check (${activeProgress.quizPassed ? "Passed ✓" : "Quiz"})`,
                    icon: <QuestionCircleOutlined />,
                  },
                  { id: "scada", label: "Live SCADA Simulator", icon: <DashboardOutlined /> },
                  { id: "mentor", label: "Senior Mentor Notes", icon: <TeamOutlined /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === "quiz" && !isVideoWatchDone) {
                        msg.warning("Knowledge Check is locked. You must watch at least 90% of the video lesson first.");
                        return;
                      }
                      setActiveTab(tab.id);
                    }}
                    style={{
                      flex: 1,
                      padding: "14px 16px",
                      background: activeTab === tab.id ? "#FFFFFF" : "transparent",
                      border: "none",
                      borderBottom:
                        activeTab === tab.id
                          ? "2.5px solid #1C4463"
                          : "2.5px solid transparent",
                      color: activeTab === tab.id ? "#1C4463" : "#64748B",
                      fontSize: 13.5,
                      fontWeight: activeTab === tab.id ? 700 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.2s ease",
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Panes */}
              <div style={{ padding: "28px" }}>
                {/* TAB 1: SOP REFERENCE NOTES */}
                {activeTab === "sop" && (
                  <div>
                    <div style={{ marginBottom: 20 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "#1C4463",
                          marginBottom: 4,
                        }}
                      >
                        STANDARD OPERATING PROCEDURE (SOP)
                      </div>
                      <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                        {activeAbility.title} — Technical Procedure & Dosing Matrix
                      </h3>
                    </div>

                    <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "#334155", marginBottom: 20 }}>
                      {activeAbility.readingContent || activeAbility.description}
                    </p>

                    {/* Operational Safety Alert */}
                    <Alert
                      type="warning"
                      showIcon
                      title="Critical Operating Threshold & Safety Protocol"
                      description="Ensure hydraulic retention time (HRT) does not fall below 14 hours during peak industrial discharge. Monitor aeration basin dissolved oxygen (DO) continuously between 2.0 and 2.5 mg/L to prevent filamentous sludge bulking and anaerobic conditions."
                      style={{
                        marginBottom: 24,
                        borderRadius: 8,
                      }}
                    />

                    {/* Technical Parameter Matrix Table (Clean White) */}
                    <div
                      style={{
                        background: "#F8FAFC",
                        borderRadius: 10,
                        border: "1px solid #E2E8F0",
                        padding: "18px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: "#1C4463",
                          textTransform: "uppercase",
                          marginBottom: 12,
                        }}
                      >
                        Plant Supervisory Setpoints
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: 14,
                        }}
                      >
                        <div style={{ background: "#FFFFFF", padding: "12px 16px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                          <div style={{ fontSize: 11, color: "#64748B" }}>Influent pH Range</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                            6.5 – 8.5
                          </div>
                        </div>
                        <div style={{ background: "#FFFFFF", padding: "12px 16px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                          <div style={{ fontSize: 11, color: "#64748B" }}>Target MLSS</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                            3,500 – 4,800 mg/L
                          </div>
                        </div>
                        <div style={{ background: "#FFFFFF", padding: "12px 16px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                          <div style={{ fontSize: 11, color: "#64748B" }}>PAC Dosing Ratio</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                            35 – 55 ppm
                          </div>
                        </div>
                        <div style={{ background: "#FFFFFF", padding: "12px 16px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                          <div style={{ fontSize: 11, color: "#64748B" }}>Sludge Volume Index</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                            80 – 120 ml/g
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: MICRO-QUIZ KNOWLEDGE CHECK */}
                {activeTab === "quiz" && (
                  <div>
                    {!isVideoWatchDone ? (
                      <div style={{ textAlign: "center", padding: "36px 0" }}>
                        <LockOutlined style={{ fontSize: 42, color: "#D97706", marginBottom: 16 }} />
                        <h3 style={{ fontSize: 18, color: "#0F172A", marginBottom: 8, fontWeight: 700 }}>
                          Knowledge Check Locked
                        </h3>
                        <p style={{ color: "#64748B", maxWidth: 480, margin: "0 auto 20px auto", fontSize: 14 }}>
                          You must watch at least 90% of the technical lesson video before
                          attempting the gating micro-quiz. Current watch progress:{" "}
                          <strong>{activeProgress.videoWatchedPct}%</strong>.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 20,
                            paddingBottom: 16,
                            borderBottom: "1px solid #E2E8F0",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 11, color: "#1C4463", fontWeight: 700 }}>
                              MODULE {activeAbility.order} GATING EVALUATION
                            </div>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                              Practical Knowledge Check
                            </h3>
                          </div>

                          <Tag color="success" style={{ fontSize: 12, padding: "3px 10px", fontWeight: 700 }}>
                            Passing Score: {activeAbility.microQuiz.passThreshold}%
                          </Tag>
                        </div>

                        {/* Interactive Step-by-Step Question Stepper */}
                        {(() => {
                          const questions = activeAbility.microQuiz.questions;
                          const totalQ = questions.length;
                          const safeIdx = Math.min(currentQuestionIdx, totalQ - 1);
                          const q = questions[safeIdx];
                          const isCurrentAnswered = Boolean(quizAnswers[q.id]);
                          const allAnswered = Object.keys(quizAnswers).length >= totalQ;

                          return (
                            <div>
                              {/* Stepper Progress Bar */}
                              <div style={{ marginBottom: 20 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1C4463" }}>
                                    Question {safeIdx + 1} of {totalQ}
                                  </span>
                                  <span style={{ fontSize: 12, color: "#64748B" }}>
                                    {Object.keys(quizAnswers).length} of {totalQ} Answered
                                  </span>
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                  {questions.map((item, idx) => (
                                    <div
                                      key={item.id}
                                      onClick={() => setCurrentQuestionIdx(idx)}
                                      style={{
                                        flex: 1,
                                        height: 6,
                                        borderRadius: 3,
                                        background:
                                          idx === safeIdx
                                            ? "#1C4463"
                                            : quizAnswers[item.id]
                                            ? "#16A34A"
                                            : "#CBD5E1",
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>

                              {/* Active Question Card */}
                              <div
                                key={q.id}
                                style={{
                                  background: "#F8FAFC",
                                  borderRadius: 12,
                                  padding: "24px",
                                  border: "1px solid #E2E8F0",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                                }}
                              >
                                <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>
                                  {safeIdx + 1}. {q.text}
                                </div>

                                <Radio.Group
                                  value={quizAnswers[q.id]}
                                  onChange={(e) =>
                                    setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })
                                  }
                                  disabled={quizSubmitted && quizResult?.passed}
                                  style={{ width: "100%" }}
                                >
                                  <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 10 }}>
                                    {q.options.map((opt) => (
                                      <Radio
                                        key={opt.id}
                                        value={opt.id}
                                        style={{
                                          color: "#334155",
                                          padding: "10px 14px",
                                          borderRadius: 8,
                                          background:
                                            quizAnswers[q.id] === opt.id
                                              ? "#EFF6FF"
                                              : "#FFFFFF",
                                          border:
                                            quizAnswers[q.id] === opt.id
                                              ? "1.5px solid #2563EB"
                                              : "1px solid #E2E8F0",
                                          width: "100%",
                                          fontSize: 13.5,
                                          transition: "all 0.15s ease",
                                        }}
                                      >
                                        {opt.text}
                                      </Radio>
                                    ))}
                                  </div>
                                </Radio.Group>

                                {/* Feedback explanation if submitted */}
                                {quizSubmitted && (
                                  <div
                                    style={{
                                      marginTop: 18,
                                      padding: "12px 16px",
                                      borderRadius: 8,
                                      background:
                                        quizAnswers[q.id] === q.correctOptionId
                                          ? "#ECFDF5"
                                          : "#FEF2F2",
                                      border:
                                        quizAnswers[q.id] === q.correctOptionId
                                          ? "1px solid #A7F3D0"
                                          : "1px solid #FECACA",
                                      fontSize: 13,
                                      color:
                                        quizAnswers[q.id] === q.correctOptionId
                                          ? "#065F46"
                                          : "#991B1B",
                                    }}
                                  >
                                    <strong>
                                      {quizAnswers[q.id] === q.correctOptionId
                                        ? "✓ Correct!"
                                        : "✗ Incorrect."}
                                    </strong>{" "}
                                    {q.explanation}
                                  </div>
                                )}
                              </div>

                              {/* Stepper Navigation Buttons */}
                              <div
                                style={{
                                  marginTop: 24,
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <Button
                                  onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
                                  disabled={safeIdx === 0}
                                  icon={<LeftOutlined />}
                                  style={{ height: 42, padding: "0 18px", fontWeight: 600 }}
                                >
                                  Previous Question
                                </Button>

                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  {safeIdx < totalQ - 1 ? (
                                    <Button
                                      type="primary"
                                      onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                                      disabled={!isCurrentAnswered}
                                      style={{
                                        background: "#1C4463",
                                        borderColor: "#1C4463",
                                        fontWeight: 700,
                                        height: 42,
                                        padding: "0 24px",
                                      }}
                                    >
                                      Next Question <RightOutlined />
                                    </Button>
                                  ) : (
                                    <Button
                                      type="primary"
                                      onClick={handleQuizSubmit}
                                      disabled={!allAnswered}
                                      style={{
                                        background: "#16A34A",
                                        borderColor: "#16A34A",
                                        fontWeight: 700,
                                        height: 42,
                                        padding: "0 28px",
                                      }}
                                    >
                                      Submit Knowledge Check
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {quizResult && (
                                <div
                                  style={{
                                    marginTop: 18,
                                    padding: "14px 18px",
                                    borderRadius: 8,
                                    background: quizResult.passed ? "#F0FDF4" : "#FEF2F2",
                                    border: quizResult.passed ? "1px solid #BBF7D0" : "1px solid #FECACA",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 14,
                                      fontWeight: 700,
                                      color: quizResult.passed ? "#16A34A" : "#DC2626",
                                    }}
                                  >
                                    Score: {quizResult.scorePct}% —{" "}
                                    {quizResult.passed
                                      ? "Passed! Advancing to the next module..."
                                      : "70% required to pass. Please review SOP and retry."}
                                  </span>
                                  {!quizResult.passed && (
                                    <Button
                                      size="small"
                                      onClick={() => {
                                        setQuizAnswers({});
                                        setQuizSubmitted(false);
                                        setQuizResult(null);
                                        setCurrentQuestionIdx(0);
                                      }}
                                      style={{ fontWeight: 600 }}
                                    >
                                      Retry Quiz
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: LIVE SCADA SIMULATOR */}
                {activeTab === "scada" && (
                  <div>
                    <div style={{ marginBottom: 20 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "#1C4463",
                          marginBottom: 4,
                        }}
                      >
                        INTERACTIVE PROCESS CONTROLLER
                      </div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                        Live Chemical & Aeration Dosing Telemetry Simulator
                      </h3>
                      <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                        Adjust operational plant parameters to observe real-time biological
                        reactions and verify final CPCB effluent compliance limits.
                      </p>
                    </div>

                    <Row gutter={[24, 24]}>
                      {/* Left: Interactive Sliders */}
                      <Col xs={24} md={12}>
                        <div
                          style={{
                            background: "#F8FAFC",
                            borderRadius: 12,
                            padding: "20px",
                            border: "1px solid #E2E8F0",
                          }}
                        >
                          <div style={{ marginBottom: 18 }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 13,
                                color: "#334155",
                                marginBottom: 6,
                              }}
                            >
                              <span>Influent Hydraulic Flow Rate</span>
                              <strong style={{ color: "#1C4463" }}>{simInfluentFlow} m³/day</strong>
                            </div>
                            <Slider
                              min={100}
                              max={500}
                              value={simInfluentFlow}
                              onChange={(val) => setSimInfluentFlow(val)}
                            />
                          </div>

                          <div style={{ marginBottom: 18 }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 13,
                                color: "#334155",
                                marginBottom: 6,
                              }}
                            >
                              <span>Coagulant Dosing (PAC)</span>
                              <strong style={{ color: "#1C4463" }}>{simCoagulantPpm} ppm</strong>
                            </div>
                            <Slider
                              min={10}
                              max={80}
                              value={simCoagulantPpm}
                              onChange={(val) => setSimCoagulantPpm(val)}
                            />
                          </div>

                          <div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 13,
                                color: "#334155",
                                marginBottom: 6,
                              }}
                            >
                              <span>Basin Dissolved Oxygen (DO)</span>
                              <strong style={{ color: "#1C4463" }}>{simAerationDO} mg/L</strong>
                            </div>
                            <Slider
                              min={0.5}
                              max={5.0}
                              step={0.1}
                              value={simAerationDO}
                              onChange={(val) => setSimAerationDO(val)}
                            />
                          </div>
                        </div>
                      </Col>

                      {/* Right: Telemetry Readouts */}
                      <Col xs={24} md={12}>
                        <div
                          style={{
                            background: "#F8FAFC",
                            borderRadius: 12,
                            padding: "20px",
                            border: "1px solid #E2E8F0",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            height: "100%",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                color: "#475569",
                                marginBottom: 12,
                              }}
                            >
                              Predicted Effluent Quality
                            </div>

                            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                              <div
                                style={{
                                  flex: 1,
                                  background: "#FFFFFF",
                                  padding: "14px",
                                  borderRadius: 8,
                                  border: "1px solid #E2E8F0",
                                }}
                              >
                                <div style={{ fontSize: 11, color: "#64748B" }}>Effluent COD</div>
                                <div
                                  style={{
                                    fontSize: 22,
                                    fontWeight: 800,
                                    color: simEffluentCOD <= 100 ? "#16A34A" : "#DC2626",
                                  }}
                                >
                                  {simEffluentCOD} mg/L
                                </div>
                                <div style={{ fontSize: 10, color: "#94A3B8" }}>Limit: ≤ 250 mg/L</div>
                              </div>

                              <div
                                style={{
                                  flex: 1,
                                  background: "#FFFFFF",
                                  padding: "14px",
                                  borderRadius: 8,
                                  border: "1px solid #E2E8F0",
                                }}
                              >
                                <div style={{ fontSize: 11, color: "#64748B" }}>Effluent BOD</div>
                                <div
                                  style={{
                                    fontSize: 22,
                                    fontWeight: 800,
                                    color: simEffluentBOD <= 30 ? "#16A34A" : "#DC2626",
                                  }}
                                >
                                  {simEffluentBOD} mg/L
                                </div>
                                <div style={{ fontSize: 10, color: "#94A3B8" }}>Limit: ≤ 30 mg/L</div>
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              padding: "10px 14px",
                              borderRadius: 8,
                              background: simComplianceOK ? "#ECFDF5" : "#FEF2F2",
                              border: simComplianceOK
                                ? "1px solid #A7F3D0"
                                : "1px solid #FECACA",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 12.5,
                              color: simComplianceOK ? "#065F46" : "#991B1B",
                            }}
                          >
                            {simComplianceOK ? (
                              <>
                                <CheckCircleFilled />
                                <strong>CPCB Discharge Compliant</strong>
                              </>
                            ) : (
                              <>
                                <WarningOutlined />
                                <strong>Warning: Out of discharge specification</strong>
                              </>
                            )}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </div>
                )}

                {/* TAB 4: SENIOR MENTOR NOTES */}
                {activeTab === "mentor" && (
                  <div>
                    <div style={{ marginBottom: 18 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "#1C4463",
                          marginBottom: 4,
                        }}
                      >
                        FIELD ADVICE FROM SENIOR OPERATORS
                      </div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                        Practical Shift Advice & Troubleshooting Nuances
                      </h3>
                    </div>

                    <div
                      style={{
                        background: "#F8FAFC",
                        borderRadius: 12,
                        padding: "20px",
                        border: "1px solid #E2E8F0",
                        lineHeight: 1.65,
                        fontSize: 14,
                        color: "#334155",
                      }}
                    >
                      <p style={{ margin: 0 }}>
                        &ldquo;During night shifts when ambient temperature dips, biological activity in
                        the aeration tank slows down by approximately 15–20%. Shift operators should
                        never immediately hike the chemical coagulant dose, which increases sludge
                        production unnecessarily. Instead, verify DO levels and extend hydraulic
                        retention time slightly by throttling the equalized feed pump.&rdquo;
                      </p>
                      <div style={{ marginTop: 12, fontSize: 12, color: "#1C4463", fontWeight: 700 }}>
                        — Senior Plant Commissioning Lead
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. STICKY BOTTOM STEPPER BAR (CLEAN WHITE) */}
            <div
              style={{
                position: "sticky",
                bottom: 16,
                zIndex: 90,
                background: "#FFFFFF",
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                padding: "14px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
              }}
            >
              <Button
                icon={<LeftOutlined />}
                onClick={handlePreviousModule}
                disabled={activeIndex === 0}
                style={{
                  background: "#F1F5F9",
                  borderColor: "#CBD5E1",
                  color: "#334155",
                  fontWeight: 600,
                }}
              >
                Previous Module
              </Button>

              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 13, color: "#64748B" }}>
                  Module {activeIndex + 1} of {course.abilities.length}:{" "}
                  <strong style={{ color: "#0F172A" }}>{activeAbility.title}</strong>
                </span>
              </div>

              {activeIndex < course.abilities.length - 1 ? (
                <Button
                  type="primary"
                  onClick={handleNextModule}
                  style={{
                    background: "#1C4463",
                    borderColor: "#1C4463",
                    fontWeight: 700,
                  }}
                >
                  Next Module <RightOutlined />
                </Button>
              ) : (
                <Button
                  type="primary"
                  onClick={() => setSkillMapOpen(true)}
                  disabled={!canTakeSkillMapping(enrollment, course)}
                  style={{
                    background: "#16A34A",
                    borderColor: "#16A34A",
                    fontWeight: 700,
                  }}
                >
                  Proceed to Skill Mapping Assessment <RightOutlined />
                </Button>
              )}
            </div>

            {/* 4. COURSERA-GRADE BOTTOM RECOMMENDATIONS */}
            <div style={{ marginTop: 60 }}>
              <CourseraRecommendationsGrid
                currentCourseId={course.id}
                category={course.section}
                title="Recommended Next Specializations & Companion Programs"
                subtitle="After mastering this unit, learners proceed to these comprehensive Nectar Enviro multi-course engineering specializations."
              />
            </div>
          </div>
        </main>
      </div>

      {/* ---------------- 0. MODULE MICRO-QUIZ AUTO POP-UP MODAL ---------------- */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SafetyCertificateOutlined style={{ color: "#1C4463", fontSize: 20 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                Module {activeIndex + 1} Knowledge Check
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "#64748B" }}>
                {activeAbility.title}
              </div>
            </div>
          </div>
        }
        open={quizModalOpen}
        onCancel={() => setQuizModalOpen(false)}
        footer={null}
        width={700}
      >
        <div style={{ padding: "12px 0" }}>
          {activeAbility.microQuiz?.questions && activeAbility.microQuiz.questions.length > 0 ? (
            (() => {
              const questions: QuizQuestion[] = activeAbility.microQuiz.questions;
              const totalQ = questions.length;
              const safeIdx = Math.min(Math.max(0, currentQuestionIdx), totalQ - 1);
              const q = questions[safeIdx];
              const isCurrentAnswered = Boolean(quizAnswers[q.id]);
              const answeredCount = questions.filter((item: QuizQuestion) => quizAnswers[item.id]).length;

              return (
                <div>
                  {/* Step Header with Indicators */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                      paddingBottom: 12,
                      borderBottom: "1px solid #E2E8F0",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1C4463" }}>
                        Question {safeIdx + 1} of {totalQ}
                      </span>
                      <span style={{ fontSize: 12, color: "#64748B", marginLeft: 8 }}>
                        ({answeredCount}/{totalQ} answered)
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      {questions.map((item: QuizQuestion, idx: number) => (
                        <div
                          key={item.id}
                          onClick={() => setCurrentQuestionIdx(idx)}
                          style={{
                            width: idx === safeIdx ? 24 : 10,
                            height: 10,
                            borderRadius: 5,
                            background:
                              idx === safeIdx
                                ? "#1C4463"
                                : quizAnswers[item.id]
                                ? "#16A34A"
                                : "#CBD5E1",
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Question Card */}
                  <div
                    key={q.id}
                    style={{
                      background: "#F8FAFC",
                      borderRadius: 12,
                      padding: "20px",
                      border: "1px solid #E2E8F0",
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>
                      {safeIdx + 1}. {q.text}
                    </div>

                    <Radio.Group
                      value={quizAnswers[q.id]}
                      onChange={(e) =>
                        setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })
                      }
                      disabled={quizSubmitted && quizResult?.passed}
                      style={{ width: "100%" }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 10 }}>
                        {q.options.map((opt: { id: string; text: string }) => (
                          <Radio
                            key={opt.id}
                            value={opt.id}
                            style={{
                              color: "#334155",
                              padding: "10px 14px",
                              borderRadius: 8,
                              background:
                                quizAnswers[q.id] === opt.id ? "#EFF6FF" : "#FFFFFF",
                              border:
                                quizAnswers[q.id] === opt.id
                                  ? "1.5px solid #2563EB"
                                  : "1px solid #E2E8F0",
                              width: "100%",
                              fontSize: 13.5,
                            }}
                          >
                            {opt.text}
                          </Radio>
                        ))}
                      </div>
                    </Radio.Group>

                    {quizSubmitted && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: "12px 16px",
                          borderRadius: 8,
                          background:
                            quizAnswers[q.id] === q.correctOptionId ? "#ECFDF5" : "#FEF2F2",
                          border:
                            quizAnswers[q.id] === q.correctOptionId
                              ? "1px solid #A7F3D0"
                              : "1px solid #FECACA",
                          fontSize: 13,
                          color:
                            quizAnswers[q.id] === q.correctOptionId ? "#065F46" : "#991B1B",
                        }}
                      >
                        <strong>
                          {quizAnswers[q.id] === q.correctOptionId
                            ? "✓ Correct!"
                            : "✗ Incorrect."}
                        </strong>{" "}
                        {q.explanation}
                      </div>
                    )}
                  </div>

                  {/* Navigation & Submit Buttons */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Button
                      onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
                      disabled={safeIdx === 0}
                      icon={<LeftOutlined />}
                    >
                      Previous
                    </Button>

                    <div style={{ display: "flex", gap: 10 }}>
                      {safeIdx < totalQ - 1 ? (
                        <Button
                          type="primary"
                          onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                          disabled={!isCurrentAnswered}
                          style={{ background: "#1C4463", borderColor: "#1C4463" }}
                        >
                          Next Question <RightOutlined />
                        </Button>
                      ) : (
                        <Button
                          type="primary"
                          onClick={handleQuizSubmit}
                          disabled={answeredCount < totalQ}
                          style={{
                            background: answeredCount === totalQ ? "#16A34A" : "#94A3B8",
                            borderColor: answeredCount === totalQ ? "#16A34A" : "#94A3B8",
                            fontWeight: 700,
                          }}
                        >
                          Submit Knowledge Check <CheckCircleFilled />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <p style={{ color: "#64748B" }}>No quiz available for this module.</p>
          )}
        </div>
      </Modal>

      {/* ---------------- 1. GATE 1: PRACTICAL TEST (FIELD & SIMULATION) MODAL ---------------- */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ExperimentOutlined style={{ color: "#1C4463", fontSize: 20 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                Gate 1: Practical Assessment Test — {course.code}
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "#64748B" }}>
                In-Person Plant Practical Evaluation & SCADA Simulation
              </div>
            </div>
          </div>
        }
        open={skillMapOpen}
        onCancel={() => setSkillMapOpen(false)}
        footer={null}
        width={750}
      >
        <div style={{ padding: "12px 0" }}>
          {assessmentResults.practical ? (
            <div>
              <div
                style={{
                  padding: "16px 20px",
                  background: "#F0FDF4",
                  borderRadius: 10,
                  border: "1px solid #BBF7D0",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckCircleFilled style={{ color: "#16A34A", fontSize: 22 }} />
                    <div>
                      <div style={{ fontWeight: 700, color: "#166534", fontSize: 15 }}>
                        Practical Field Evaluation Complete ({assessmentResults.practical.overallPct}%)
                      </div>
                      <div style={{ fontSize: 12, color: "#15803D" }}>
                        Evaluated on-site by: <strong>{assessmentResults.practical.evaluatorName}</strong>
                      </div>
                    </div>
                  </div>
                  {isManager && (
                    <Button
                      size="small"
                      onClick={() => setEvalScoringType("practical")}
                      style={{ fontSize: 12, fontWeight: 600, borderColor: "#16A34A", color: "#16A34A" }}
                    >
                      Re-Score (Manager)
                    </Button>
                  )}
                </div>
                {assessmentResults.practical.generalNotes && (
                  <div style={{ marginTop: 12, fontSize: 12.5, color: "#14532D", background: "#FFFFFF", padding: "10px 14px", borderRadius: 8, border: "1px solid #DCFCE7" }}>
                    <strong>Manager Observations & Sign-off:</strong> {assessmentResults.practical.generalNotes}
                  </div>
                )}
              </div>

              {/* Ability ratings and remarks */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
                  Ability-Level Practical Ratings (1–5 Scale) & Qualitative Remarks
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {assessmentResults.practical.scores.map((s) => (
                    <div key={s.abilityId} style={{ background: "#F8FAFC", padding: "12px 16px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 600, color: "#0F172A", fontSize: 13 }}>
                          {s.abilityTitle}
                        </div>
                        <Tag color="cyan" style={{ fontWeight: 700 }}>Rating: {s.score}/5</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                        <strong>Observation:</strong> {s.remark}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <Button
                  type="primary"
                  onClick={() => {
                    setSkillMapOpen(false);
                    setTimeout(() => setWrittenOpen(true), 400);
                  }}
                  style={{ background: "#1C4463", borderColor: "#1C4463", fontWeight: 700, height: 42, padding: "0 24px" }}
                >
                  Proceed to Gate 2: Written Theory Exam <RightOutlined />
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  padding: "20px 24px",
                  background: "#EFF6FF",
                  borderRadius: 12,
                  border: "1.5px solid #BFDBFE",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <SafetyCertificateOutlined style={{ color: "#1D4ED8", fontSize: 20 }} />
                  <span style={{ fontWeight: 800, color: "#1E40AF", fontSize: 16 }}>
                    In-Person Plant Practical Assessment Pending
                  </span>
                </div>
                <div style={{ fontSize: 13.5, color: "#1E3A8A", lineHeight: 1.6 }}>
                  This hands-on test is conducted on-site in real life by your <strong>Plant Operations Manager / Technical Evaluator (Rajesh Kulkarni / Anand Dakave)</strong>.
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#3B82F6",
                    background: "#FFFFFF",
                    padding: "14px 16px",
                    borderRadius: 8,
                    border: "1px solid #DBEAFE",
                    marginTop: 14,
                    lineHeight: 1.6,
                  }}
                >
                  <strong>Operational Protocol:</strong> The manager will observe your physical equipment lineups, sampling technique, and SCADA adjustments on the plant floor, evaluating you on a <strong>1–5 competency scale</strong>.
                  <div style={{ marginTop: 8, color: "#D97706", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>⏳ Awaiting Plant Manager evaluation in the Manager Console. Gate 2 (Written Theory Exam) will automatically unlock once scored.</span>
                  </div>
                </div>

                {isManager && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed #BFDBFE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#1E40AF", fontWeight: 600 }}>
                      Evaluator Mode (Plant Manager Access Only):
                    </span>
                    <Button
                      type="primary"
                      onClick={() => setEvalScoringType("practical")}
                      style={{ background: "#1C4463", borderColor: "#1C4463", fontWeight: 700 }}
                    >
                      Score Practical Assessment (Evaluator)
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ---------------- 2. GATE 2: WRITTEN THEORY EXAM MODAL ---------------- */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileDoneOutlined style={{ color: "#1C4463", fontSize: 20 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                Gate 2: Written Theory Exam — {course.code}
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "#64748B" }}>
                Theoretical Chemistry, CPCB Regulations & Equipment Physics
              </div>
            </div>
          </div>
        }
        open={writtenOpen}
        onCancel={() => setWrittenOpen(false)}
        footer={null}
        width={750}
      >
        <div style={{ padding: "12px 0" }}>
          <div
            style={{
              padding: "12px 16px",
              background: "#F0FDF4",
              borderRadius: 8,
              border: "1px solid #BBF7D0",
              color: "#166534",
              fontSize: 13,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircleFilled />
            <span>
              <strong>Gate 2 Requirement:</strong> 70% passing score is required to unlock Gate 3 (Oral Technical Viva).
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {course.writtenTestQuestions.map((q, idx) => (
              <div
                key={q.id}
                style={{
                  background: "#F8FAFC",
                  padding: "18px",
                  borderRadius: 10,
                  border: "1px solid #E2E8F0",
                }}
              >
                <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: 12, fontSize: 14 }}>
                  {idx + 1}. {q.text}
                </div>
                <Radio.Group
                  value={writtenAnswers[q.id]}
                  onChange={(e) =>
                    setWrittenAnswers({ ...writtenAnswers, [q.id]: e.target.value })
                  }
                  style={{ width: "100%" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 8 }}>
                    {q.options.map((opt) => (
                      <Radio
                        key={opt.id}
                        value={opt.id}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background:
                            writtenAnswers[q.id] === opt.id ? "#EFF6FF" : "#FFFFFF",
                          border:
                            writtenAnswers[q.id] === opt.id
                              ? "1px solid #3B82F6"
                              : "1px solid #E2E8F0",
                          width: "100%",
                          fontSize: 13,
                        }}
                      >
                        {opt.text}
                      </Radio>
                    ))}
                  </div>
                </Radio.Group>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, textAlign: "right" }}>
            <Button
              type="primary"
              onClick={() => {
                const res = submitWrittenTest(enrollment.id, writtenAnswers);
                setWrittenResult(res);
                bumpEnrollment();
                if (res.passed) {
                  msg.success(`Written Exam passed with ${res.scorePct}%! Advancing to Gate 3 (Oral Viva).`);
                  setWrittenOpen(false);
                  setTimeout(() => setOralOpen(true), 600);
                } else {
                  msg.error(`Scored ${res.scorePct}%. 70% required. Please review theory materials and retry.`);
                }
              }}
              style={{
                background: "#1C4463",
                borderColor: "#1C4463",
                fontWeight: 700,
                height: 42,
                padding: "0 24px",
              }}
            >
              Submit Written Exam & Advance <RightOutlined />
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------------- 3. GATE 3: ORAL TECHNICAL VIVA MODAL ---------------- */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CustomerServiceOutlined style={{ color: "#1C4463", fontSize: 20 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                Gate 3: Oral Technical Viva Interview — {course.code}
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "#64748B" }}>
                In-Person Technical Assessor Viva on Plant Emergency Protocols
              </div>
            </div>
          </div>
        }
        open={oralOpen}
        onCancel={() => setOralOpen(false)}
        footer={null}
        width={750}
      >
        <div style={{ padding: "12px 0" }}>
          {assessmentResults.oral ? (
            <div>
              <div
                style={{
                  padding: "16px 20px",
                  background: "#F0FDF4",
                  borderRadius: 10,
                  border: "1px solid #BBF7D0",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckCircleFilled style={{ color: "#16A34A", fontSize: 22 }} />
                    <div>
                      <div style={{ fontWeight: 700, color: "#166534", fontSize: 15 }}>
                        Oral Technical Viva Complete ({assessmentResults.oral.overallPct}%)
                      </div>
                      <div style={{ fontSize: 12, color: "#15803D" }}>
                        Conducted by Lead Evaluator: <strong>{assessmentResults.oral.evaluatorName}</strong>
                      </div>
                    </div>
                  </div>
                  {isManager && (
                    <Button
                      size="small"
                      onClick={() => setEvalScoringType("oral")}
                      style={{ fontSize: 12, fontWeight: 600, borderColor: "#7C3AED", color: "#7C3AED" }}
                    >
                      Re-Score (Evaluator)
                    </Button>
                  )}
                </div>
                {assessmentResults.oral.generalNotes && (
                  <div style={{ marginTop: 12, fontSize: 12.5, color: "#14532D", background: "#FFFFFF", padding: "10px 14px", borderRadius: 8, border: "1px solid #DCFCE7" }}>
                    <strong>Evaluator Sign-off Remarks:</strong> {assessmentResults.oral.generalNotes}
                  </div>
                )}
              </div>

              {/* Scenario breakdown */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
                  Viva Scenario Assessment & Observations (1–5 Scale)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {assessmentResults.oral.scores.map((s) => (
                    <div key={s.abilityId} style={{ background: "#F8FAFC", padding: "12px 16px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 600, color: "#0F172A", fontSize: 13 }}>
                          {s.abilityTitle}
                        </div>
                        <Tag color="purple" style={{ fontWeight: 700 }}>Rating: {s.score}/5</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                        <strong>Observation:</strong> {s.remark}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <Button
                  type="primary"
                  onClick={() => {
                    setOralOpen(false);
                    setTimeout(() => setReportOpen(true), 400);
                  }}
                  style={{ background: "#1C4463", borderColor: "#1C4463", fontWeight: 700, height: 42, padding: "0 24px" }}
                >
                  Proceed to Gate 4: Test Report Summary <RightOutlined />
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  padding: "20px 24px",
                  background: "#FAF5FF",
                  borderRadius: 12,
                  border: "1.5px solid #E9D5FF",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <CustomerServiceOutlined style={{ color: "#7E22CE", fontSize: 20 }} />
                  <span style={{ fontWeight: 800, color: "#6B21A8", fontSize: 16 }}>
                    In-Person Oral Technical Viva Pending
                  </span>
                </div>
                <div style={{ fontSize: 13.5, color: "#581C87", lineHeight: 1.6 }}>
                  This technical scenario viva is conducted face-to-face by your <strong>Plant Operations Manager / Lead Evaluator</strong>.
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#7E22CE",
                    background: "#FFFFFF",
                    padding: "14px 16px",
                    borderRadius: 8,
                    border: "1px solid #F3E8FF",
                    marginTop: 14,
                    lineHeight: 1.6,
                  }}
                >
                  <strong>Interview Scope:</strong> Critical plant emergency protocols (Chemical Shock Load, SVI Clarifier Bulking, Confined Space Entry, and LOTO), scored on a <strong>1–5 competency scale</strong>.
                  <div style={{ marginTop: 8, color: "#D97706", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>⏳ Awaiting viva evaluation in the Manager Console. Gate 4 (Test Report Summary) will automatically unlock once scored.</span>
                  </div>
                </div>

                {isManager && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed #E9D5FF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#6B21A8", fontWeight: 600 }}>
                      Evaluator Mode (Plant Manager Access Only):
                    </span>
                    <Button
                      type="primary"
                      onClick={() => setEvalScoringType("oral")}
                      style={{ background: "#7C3AED", borderColor: "#7C3AED", fontWeight: 700 }}
                    >
                      Conduct Oral Viva Interview (Evaluator)
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ---------------- 4. GATE 4: TEST REPORT SUMMARY MODAL ---------------- */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AuditOutlined style={{ color: "#1C4463", fontSize: 20 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                Gate 4: Operational Qualification Test Report Summary
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "#64748B" }}>
                Document Ref: NEIPL-OQTR-{course.code}-2026
              </div>
            </div>
          </div>
        }
        open={reportOpen}
        onCancel={() => setReportOpen(false)}
        footer={null}
        width={760}
      >
        <div style={{ padding: "8px 0" }}>
          {/* Legacy Nectar Header Banner */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 10,
              padding: "16px 20px",
              border: "1.5px solid #1C4463",
              marginBottom: 18,
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ textAlign: "left" }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#1C4463", letterSpacing: 1 }}>nėctar</span>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: 0.5 }}>
                  ENVIRO INDIA PVT. LTD.
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Tag color="cyan" style={{ fontSize: 11, fontWeight: 700, borderRadius: 4 }}>
                  OFFICIAL EVALUATION RECORD
                </Tag>
              </div>
            </div>

            <h2
              style={{
                margin: "4px 0 2px",
                fontSize: 22,
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: 0.5,
              }}
            >
              Test Summary Report
            </h2>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C4463", textTransform: "uppercase" }}>
              TRADE NAME :— Shift Incharge / {course.title}
            </div>

            {/* Assessee Bar */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1fr 1.5fr",
                background: "#F8FAFC",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                padding: "8px 14px",
                marginTop: 12,
                fontSize: 12.5,
                textAlign: "left",
              }}
            >
              <div>
                <strong style={{ color: "#1C4463" }}>NAME :</strong> Mr. Akshay Jamble (Operator)
              </div>
              <div>
                <strong style={{ color: "#1C4463" }}>EMP CODE :</strong> NEIPL125
              </div>
              <div>
                <strong style={{ color: "#1C4463" }}>TL / ASSESSOR :</strong> Mr. Anand Dakave
              </div>
            </div>
          </div>

          {/* Assessment Breakdown Table */}
          {(() => {
            const sScore = skillMapResult ? skillMapResult.scorePct : 54.14;
            const pScore = assessmentResults.practical?.overallPct ?? 61.0;
            const wScore = assessmentResults.written?.scorePct ?? 90.0;
            const oScore = assessmentResults.oral?.overallPct ?? 63.0;
            const compScore = Math.round(((sScore + pScore + wScore + oScore) / 4) * 100) / 100;
            const evalNotes =
              assessmentResults.practical?.generalNotes ||
              assessmentResults.oral?.generalNotes ||
              "Candidate demonstrated verified physical valve alignments and safely managed sudden plant upset simulation. Recommended for shift incharge qualification.";

            return (
              <>
                <div
                  style={{
                    borderRadius: 8,
                    border: "1.5px solid #1C4463",
                    overflow: "hidden",
                    marginBottom: 20,
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#F1F5F9", textAlign: "left", color: "#1E293B", borderBottom: "1.5px solid #1C4463" }}>
                        <th style={{ padding: "10px 14px", borderRight: "1px solid #CBD5E1" }}>Annexure</th>
                        <th style={{ padding: "10px 14px", borderRight: "1px solid #CBD5E1" }}>FRAMEWORK PARAMETER</th>
                        <th style={{ padding: "10px 14px", textAlign: "center", borderRight: "1px solid #CBD5E1" }}>MAX Mark</th>
                        <th style={{ padding: "10px 14px", textAlign: "center", borderRight: "1px solid #CBD5E1" }}>Actual Mark</th>
                        <th style={{ padding: "10px 14px", textAlign: "center", borderRight: "1px solid #CBD5E1" }}>Sign</th>
                        <th style={{ padding: "10px 14px", textAlign: "center" }}>TL Name & Sign</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #CBD5E1" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1C4463", borderRight: "1px solid #CBD5E1" }}>Annexure 1</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, borderRight: "1px solid #CBD5E1" }}>Skill Mapping</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748B", borderRight: "1px solid #CBD5E1" }}>100%</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: "#0F172A", borderRight: "1px solid #CBD5E1" }}>{sScore.toFixed(2)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontStyle: "italic", color: "#2563EB", borderRight: "1px solid #CBD5E1" }}>Verified</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, color: "#334155" }}>Anand Dakave</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #CBD5E1" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1C4463", borderRight: "1px solid #CBD5E1" }}>Annexure 2</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, borderRight: "1px solid #CBD5E1" }}>Practical Test</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748B", borderRight: "1px solid #CBD5E1" }}>100%</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: "#0F172A", borderRight: "1px solid #CBD5E1" }}>{pScore.toFixed(2)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontStyle: "italic", color: "#2563EB", borderRight: "1px solid #CBD5E1" }}>Verified</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, color: "#334155" }}>Anand Dakave</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #CBD5E1" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1C4463", borderRight: "1px solid #CBD5E1" }}>Annexure 3</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, borderRight: "1px solid #CBD5E1" }}>Written Test</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748B", borderRight: "1px solid #CBD5E1" }}>100%</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: "#0F172A", borderRight: "1px solid #CBD5E1" }}>{wScore.toFixed(2)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontStyle: "italic", color: "#2563EB", borderRight: "1px solid #CBD5E1" }}>Verified</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, color: "#334155" }}>Anand Dakave</td>
                      </tr>
                      <tr style={{ borderBottom: "1.5px solid #1C4463" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1C4463", borderRight: "1px solid #CBD5E1" }}>Annexure 4</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, borderRight: "1px solid #CBD5E1" }}>Oral</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748B", borderRight: "1px solid #CBD5E1" }}>100%</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: "#0F172A", borderRight: "1px solid #CBD5E1" }}>{oScore.toFixed(2)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontStyle: "italic", color: "#2563EB", borderRight: "1px solid #CBD5E1" }}>Verified</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, color: "#334155" }}>Anand Dakave</td>
                      </tr>
                      {/* Authentic Yellow Highlight Total Row */}
                      <tr style={{ background: "#FEF08A", fontWeight: 800, color: "#0F172A" }}>
                        <td style={{ padding: "12px 14px", borderRight: "1px solid #CBD5E1", textAlign: "right" }} colSpan={2}>
                          Overall Competency Level-
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center", borderRight: "1px solid #CBD5E1" }}>100%</td>
                        <td style={{ padding: "12px 14px", textAlign: "center", fontSize: 16, color: "#0F172A", borderRight: "1px solid #CBD5E1" }}>
                          {compScore.toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center", fontStyle: "italic", color: "#166534", borderRight: "1px solid #CBD5E1" }}>
                          Qualified
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center", fontSize: 12 }}>
                          Signed
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Evaluator Notes */}
                <div
                  style={{
                    padding: "14px 18px",
                    background: "#F8FAFC",
                    borderRadius: 8,
                    border: "1px solid #CBD5E1",
                    fontSize: 13,
                    color: "#334155",
                    marginBottom: 20,
                  }}
                >
                  <strong style={{ color: "#1C4463" }}>Team Leader & Evaluator Assessment Signoff (Mr. Anand Dakave):</strong> {evalNotes}
                </div>
              </>
            );
          })()}

          {/* Action to Issue Certificate */}
          <div style={{ textAlign: "right" }}>
            <Button
              type="primary"
              icon={<TrophyOutlined />}
              onClick={() => {
                checkAndTriggerCertification(enrollment.id);
                bumpEnrollment();
                setReportOpen(false);
                setTimeout(() => setCertModalOpen(true), 500);
              }}
              style={{
                background: "#16A34A",
                borderColor: "#16A34A",
                fontWeight: 700,
                height: 44,
                padding: "0 28px",
                fontSize: 14,
              }}
            >
              Issue Plant Qualification Certificate <RightOutlined />
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------------- 5. GATE 5: PLANT QUALIFICATION CERTIFICATE MODAL ---------------- */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TrophyOutlined style={{ color: "#EAB308", fontSize: 20 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                Gate 5: Plant Operations Qualification Credential
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "#64748B" }}>
                Nectar Environmental Academy of Technical Excellence
              </div>
            </div>
          </div>
        }
        open={certModalOpen}
        onCancel={() => setCertModalOpen(false)}
        footer={null}
        width={760}
      >
        <div style={{ padding: "16px 0" }}>
          {certificate ? (
            <div
              style={{
                padding: "36px 32px",
                textAlign: "center",
                background: "linear-gradient(135deg, #FCFBF7 0%, #F5F3ED 100%)",
                borderRadius: 16,
                border: "4px double #C2A649",
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
                position: "relative",
              }}
            >
              {/* Header Badges */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#92722A", letterSpacing: "0.12em" }}>
                    NECTA ENVIRO OPERATIONS ACADEMY
                  </div>
                  <div style={{ fontSize: 10, color: "#78716C" }}>
                    Certified Industrial Environmental Operations
                  </div>
                </div>
                <SafetyCertificateOutlined style={{ fontSize: 32, color: "#C2A649" }} />
              </div>

              {/* Title */}
              <h2
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#1C4463",
                  margin: "12px 0 6px 0",
                  fontFamily: "serif",
                  letterSpacing: "0.02em",
                }}
              >
                Certificate of Operational Competence
              </h2>
              <div style={{ fontSize: 13, color: "#78716C", marginBottom: 20 }}>
                This is to certify that under stringent 5-Gate examination protocols
              </div>

              {/* Recipient */}
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#0F172A",
                  marginBottom: 10,
                  fontFamily: "serif",
                  borderBottom: "2px solid #C2A649",
                  display: "inline-block",
                  paddingBottom: 4,
                  minWidth: 280,
                }}
              >
                {certificate.employeeName}
              </div>

              <div style={{ fontSize: 13, color: "#57534E", maxWidth: 540, margin: "14px auto" }}>
                has successfully satisfied all practical, theoretical, and oral viva standards for:
              </div>

              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#1C4463",
                  background: "#F1EEDB",
                  display: "inline-block",
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "1px solid #D7C99F",
                  marginBottom: 24,
                }}
              >
                {certificate.courseTitle} ({course.code})
              </div>

              {/* Signatures */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 28,
                  paddingTop: 20,
                  borderTop: "1px solid #E7E5E4",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#1C4463" }}>
                    Er. Vikram Sengupta
                  </div>
                  <div style={{ fontSize: 11, color: "#78716C" }}>
                    Lead Technical Evaluator
                  </div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: "#92722A", textTransform: "uppercase" }}>
                    OFFICIAL VERIFIED SEAL
                  </div>
                  <div style={{ fontSize: 10, color: "#A8A29E" }}>
                    ID: {certificate.certificateNo}
                  </div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#1C4463" }}>
                    Dr. Arundhati Bose
                  </div>
                  <div style={{ fontSize: 11, color: "#78716C" }}>
                    Director of Environmental Training
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 20, fontSize: 10, color: "#A8A29E" }}>
                Verification Hash: {certificate.verificationHash} • Issued: {new Date(certificate.issuedAt).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <TrophyOutlined style={{ fontSize: 48, color: "#EAB308", marginBottom: 16 }} />
              <p style={{ color: "#64748B" }}>
                Certificate is ready to be issued upon completing the 5-Gate qualification progression.
              </p>
              <Button
                type="primary"
                onClick={() => {
                  checkAndTriggerCertification(enrollment.id);
                  bumpEnrollment();
                }}
                style={{ background: "#1C4463", borderColor: "#1C4463" }}
              >
                Verify & Claim Certificate
              </Button>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
            <Button
              icon={<PrinterOutlined />}
              onClick={() => window.print()}
              style={{ fontWeight: 600 }}
            >
              Print Certificate
            </Button>
            <Button
              type="primary"
              onClick={() => setCertModalOpen(false)}
              style={{ background: "#1C4463", borderColor: "#1C4463", fontWeight: 600 }}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------------- 6. IN-PERSON EVALUATOR SCORING MODAL (PRACTICAL / ORAL) ---------------- */}
      {evalScoringType && isManager && (
        <EvaluatorScoringModal
          enrollment={enrollment}
          candidateName="Rajesh Kumar (Operator)"
          course={course}
          type={evalScoringType}
          evaluatorName="Rajesh Kulkarni (Plant Operations Manager)"
          evaluatorId="e-mgr-1"
          onClose={() => setEvalScoringType(null)}
          onSubmitted={() => {
            bumpEnrollment();
            const currentType = evalScoringType;
            setEvalScoringType(null);
            if (currentType === "practical") {
              setSkillMapOpen(false);
              setTimeout(() => setWrittenOpen(true), 500);
            } else {
              setOralOpen(false);
              setTimeout(() => setReportOpen(true), 500);
            }
          }}
        />
      )}
    </div>
  );
}

export default function CourseLearningPage() {
  return (
    <App>
      <CourseLearningInner />
    </App>
  );
}
