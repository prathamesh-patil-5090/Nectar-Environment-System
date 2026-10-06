"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { App, Button, Empty, Modal, Radio, Result, Select, Skeleton } from "antd";
import {
  ArrowLeftOutlined,
  CaretRightFilled,
  CheckCircleFilled,
  CheckOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PauseOutlined,
  RedoOutlined,
  TrophyOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import {
  acknowledgeReading,
  canTakeSkillMapping,
  getAssessmentResults,
  getCertificates,
  getCourseById,
  getEnrollment,
  getPerson,
  getPersonName,
  hasGateQuestions,
  isAbilityUnlocked,
  submitMicroQuiz,
  submitWrittenTest,
  updateVideoProgress,
  useTrainingData,
} from "@/lib/training/store";
import { useViewer } from "@/lib/training/hooks";
import { VideoPlayerEngine } from "@/lib/training/VideoPlayerEngine";
import type { Course, CourseEnrollment, QuizQuestion } from "@/lib/training/types";
import SkillMapGateModal from "@/components/training/SkillMapGateModal";
import CertificateModal from "@/components/training/CertificateModal";
import Cover from "@/components/training/ui/Cover";
import { tr, trTable, trData } from "@/lib/i18n";

type Ability = Course["abilities"][number];
type View = { kind: "lesson"; abilityId: string } | { kind: "assessment" };

const WATCH_TO_UNLOCK = 90;
const durationSec = (a: Ability) => (a.videoDurationMinutes || 1) * 60;
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/* ─────────────────────────── Journey rail ─────────────────────────── */

type StepState = "done" | "current" | "open" | "locked" | "waiting";

const STEP_DOT: Record<StepState, string> = {
  done: "bg-emerald-600 text-white",
  current: "bg-[#1C4463] text-white ring-4 ring-[#1C4463]/15",
  open: "bg-white text-[#1C4463] border-2 border-[#1C4463]",
  waiting: "bg-amber-100 text-amber-700",
  locked: "bg-slate-100 text-slate-400",
};

function RailStep({
  state,
  index,
  title,
  meta,
  active,
  onClick,
}: {
  state: StepState;
  index: ReactNode;
  title: string;
  meta: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <li className="group relative pl-12 pb-5 last:pb-0">
      <span className="absolute left-[17px] top-9 bottom-0 w-px bg-slate-200 group-last:hidden" aria-hidden />
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`w-full text-left rounded-xl px-3 py-2 -ml-3 transition-colors bg-transparent ${
          active ? "bg-[#1C4463]/[0.06]" : onClick ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"
        }`}
      >
        <span className={`absolute left-0 top-1.5 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${STEP_DOT[state]}`}>
          {state === "done" ? <CheckOutlined /> : state === "locked" ? <LockOutlined /> : index}
        </span>
        <span className={`block text-sm font-semibold leading-snug ${state === "locked" ? "text-slate-400" : "text-slate-900"}`}>{trData(title)}</span>
        <span className="block text-xs text-slate-500 mt-0.5">{trData(meta)}</span>
      </button>
    </li>
  );
}

/* ─────────────────────────── Quiz (inline) ─────────────────────────── */

/** One question at a time; answers are scored by the store (and confirmed by the server). */
function QuizRunner({
  questions,
  passMark,
  onSubmit,
  submitLabel = "Submit answers",
}: {
  questions: QuizQuestion[];
  passMark: number;
  onSubmit: (answers: Record<string, string>) => { scorePct: number; passed: boolean };
  submitLabel?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [i, setI] = useState(0);
  const [result, setResult] = useState<{ scorePct: number; passed: boolean } | null>(null);
  const q = questions[i];
  const last = i === questions.length - 1;

  if (result) {
    return (
      <div className={`rounded-2xl p-6 text-center ${result.passed ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"}`}>
        <div className={`text-4xl font-extrabold ${result.passed ? "text-emerald-700" : "text-rose-700"}`}>{result.scorePct}%</div>
        <div className="mt-1 font-semibold text-slate-900">{result.passed ? tr("Passed") : tr("Not passed — {passMark}% needed", { passMark })}</div>
        {!result.passed && (
          <Button
            className="mt-4 rounded-xl!"
            onClick={() => {
              setResult(null);
              setAnswers({});
              setI(0);
            }}
          >
            {tr("Try again")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5" aria-hidden>
        {questions.map((x, n) => (
          <span key={x.id} className={`h-1.5 flex-1 rounded-full ${answers[x.id] ? "bg-[#1C4463]" : n === i ? "bg-[#1C4463]/40" : "bg-slate-200"}`} />
        ))}
      </div>
      <div className="text-xs font-semibold text-slate-500">
        {tr("Question {n} of {total} · pass mark {passMark}%", { n: i + 1, total: questions.length, passMark })}
      </div>
      <div className="text-lg font-semibold text-slate-900 leading-snug">{trData(q.text)}</div>
      <Radio.Group value={answers[q.id]} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} className="w-full">
        <div className="flex flex-col gap-2">
          {q.options.map((o) => (
            <label
              key={o.id}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                answers[q.id] === o.id ? "border-[#1C4463] bg-[#1C4463]/[0.04]" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <Radio value={o.id} className="mt-0.5" />
              <span className="text-sm text-slate-800">{trData(o.text)}</span>
            </label>
          ))}
        </div>
      </Radio.Group>
      <div className="flex justify-between gap-2">
        <Button onClick={() => setI((n) => n - 1)} disabled={i === 0} className="rounded-xl!">{tr("Back")}</Button>
        {last ? (
          <Button
            type="primary"
            disabled={questions.some((x) => !answers[x.id])}
            onClick={() => setResult(onSubmit(answers))}
            className="rounded-xl! font-semibold!"
          >
            {trData(submitLabel)}
          </Button>
        ) : (
          <Button type="primary" disabled={!answers[q.id]} onClick={() => setI((n) => n + 1)} className="rounded-xl!">{tr("Next question")}</Button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Player ─────────────────────────── */

function LessonPlayer({
  course,
  ability,
  enrollment,
  onFinished,
}: {
  course: Course;
  ability: Ability;
  enrollment: CourseEnrollment;
  onFinished: () => void;
}) {
  const { message } = App.useApp();
  const [playing, setPlaying] = useState(false);
  const [sec, setSec] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VideoPlayerEngine | null>(null);
  const dur = durationSec(ability);
  const watched = enrollment.abilityProgress[ability.id]?.videoWatchedPct ?? 0;

  // Latest values for engine callbacks without re-creating the engine
  const live = useRef({ enrollmentId: enrollment.id, abilityId: ability.id, dur, onFinished });
  useEffect(() => {
    live.current = { enrollmentId: enrollment.id, abilityId: ability.id, dur, onFinished };
  });

  const save = useCallback((at: number, flush = false) => {
    const { enrollmentId, abilityId, dur: d } = live.current;
    updateVideoProgress(enrollmentId, abilityId, Math.round((Math.min(at, d) / d) * 100), { flush });
  }, []);

  useEffect(() => {
    const engine = new VideoPlayerEngine({
      onTimeUpdate: setSec,
      onPlayStateChange: (p) => {
        setPlaying(p);
        if (!p) {
          const at = engine.currentSec;
          save(at, true);
          if (at >= live.current.dur - 1) live.current.onFinished();
        }
      },
      onProgressCommit: (at) => save(at),
      onSeekBlocked: () => message.warning(tr("You can't skip ahead of what you've watched.")),
    });
    engineRef.current = engine;
    const flushOnHide = () => document.visibilityState === "hidden" && save(engine.currentSec, true);
    document.addEventListener("visibilitychange", flushOnHide);
    return () => {
      document.removeEventListener("visibilitychange", flushOnHide);
      save(engine.currentSec, true);
      engine.destroy();
    };
  }, [message, save]);

  // New lesson: resume where the learner left off
  useEffect(() => {
    const start = Math.round((watched / 100) * dur);
    engineRef.current?.switchAbility(start >= dur ? 0 : start, dur);
    if (start >= dur) engineRef.current?.seekTo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the lesson changes
  }, [ability.id]);

  useEffect(() => engineRef.current?.setSpeed(speed), [speed]);

  useEffect(() => {
    const h = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const pct = Math.min(100, (sec / dur) * 100);
  const frontier = Math.max(pct, watched);

  return (
    <div ref={boxRef} className={`relative bg-slate-950 overflow-hidden ${fullscreen ? "" : "rounded-3xl"}`}>
      <div className={`relative w-full ${fullscreen ? "h-screen" : "aspect-[16/9]"}`}>
        <Cover src={ability.videoPosterUrl || course.thumbnailUrl} label={trData(ability.title)} className={`transition-opacity ${playing ? "opacity-40" : "opacity-60"}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-slate-950/40" />
        <div className="absolute top-4 left-5 right-5 hidden sm:flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">{tr("Lesson {order}", { order: ability.order })}</div>
            <div className="text-white text-lg sm:text-xl font-bold leading-snug line-clamp-2">{trData(ability.title)}</div>
          </div>
        </div>
        <button
          type="button"
          aria-label={playing ? tr("Pause") : tr("Play")}
          onClick={() => engineRef.current?.toggle()}
          className="absolute inset-0 m-auto w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-white/95 hover:bg-white text-[#1C4463] text-2xl sm:text-3xl flex items-center justify-center shadow-2xl cursor-pointer transition-transform hover:scale-105"
        >
          {playing ? <PauseOutlined /> : <CaretRightFilled className="ml-1" />}
        </button>

        {/* Controls */}
        <div className="absolute inset-x-0 bottom-0 px-3 sm:px-5 pb-2 sm:pb-4 pt-8 flex flex-col gap-1.5 sm:gap-2.5">
          <div
            className="relative h-1.5 rounded-full bg-white/20 cursor-pointer group"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              engineRef.current?.seekTo(((e.clientX - r.left) / r.width) * dur);
            }}
            role="slider"
            aria-label={tr("Seek")}
            aria-valuemin={0}
            aria-valuemax={dur}
            aria-valuenow={Math.round(sec)}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: `${frontier}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 -ml-2 w-4 h-4 rounded-full bg-white shadow" style={{ left: `${pct}%` }} />
          </div>
          <div className="flex items-center gap-2 text-white">
            <button type="button" aria-label={tr("Back 10 seconds")} onClick={() => engineRef.current?.skip(-10)} className="w-9 h-9 rounded-full hover:bg-white/10 cursor-pointer bg-transparent text-white">
              <UndoOutlined />
            </button>
            <button type="button" aria-label={playing ? tr("Pause") : tr("Play")} onClick={() => engineRef.current?.toggle()} className="w-9 h-9 rounded-full hover:bg-white/10 cursor-pointer bg-transparent text-white">
              {playing ? <PauseOutlined /> : <CaretRightFilled />}
            </button>
            <button type="button" aria-label={tr("Forward 10 seconds")} onClick={() => engineRef.current?.skip(10)} className="w-9 h-9 rounded-full hover:bg-white/10 cursor-pointer bg-transparent text-white">
              <RedoOutlined />
            </button>
            <span className="hidden sm:inline text-xs tabular-nums text-white/80 ml-1">{trData(clock(sec))} / {trData(clock(dur))}</span>
            <span className="flex-1" />
            <span className="hidden sm:inline text-xs text-white/60">{tr("Watched {math}%", { math: Math.round(frontier) })}</span>
            <Select
              size="small"
              value={speed}
              onChange={setSpeed}
              options={[1, 1.25, 1.5].map((v) => ({ value: v, label: `${v}×` }))}
              popupMatchSelectWidth={false}
              aria-label={tr("Playback speed")}
              className="w-[72px]"
            />
            <button
              type="button"
              aria-label={fullscreen ? tr("Exit full screen") : tr("Full screen")}
              onClick={() => (document.fullscreenElement ? document.exitFullscreen() : boxRef.current?.requestFullscreen())?.catch(() => undefined)}
              className="w-9 h-9 rounded-full hover:bg-white/10 cursor-pointer bg-transparent text-white"
            >
              {fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Assessment hub ─────────────────────────── */

const GATES = trTable([
  { key: "skillMap", title: "Skill mapping test", weight: 25, how: "Online test on the abilities" },
  { key: "written", title: "Written test", weight: 25, how: "Online theory test" },
  { key: "practical", title: "Practical on site", weight: 30, how: "Your manager scores each ability 1–5 at the plant" },
  { key: "oral", title: "Oral viva", weight: 20, how: "Your manager asks and scores each ability 1–5" },
] as const);

function AssessmentHub({
  course,
  enrollment,
  managerName,
  onSkillMap,
  onWritten,
  onCertificate,
}: {
  course: Course;
  enrollment: CourseEnrollment;
  managerName?: string;
  onSkillMap: () => void;
  onWritten: () => void;
  onCertificate: () => void;
}) {
  const res = getAssessmentResults(enrollment.id);
  const cert = getCertificates(enrollment.employeeId).find((c) => c.courseId === course.id);
  const ready = canTakeSkillMapping(enrollment, course);

  const status = (key: (typeof GATES)[number]["key"]): { tone: "done" | "todo" | "wait" | "locked" | "missing"; text: string; action?: ReactNode } => {
    if (key === "skillMap" || key === "written") {
      const r = res[key];
      if (r?.passed) return { tone: "done", text: tr("Passed · {scorePct}%", { scorePct: r.scorePct }) };
      if (!hasGateQuestions(course, key)) return { tone: "missing", text: tr("Questions not set up yet — HR or the Director adds them") };
      if (!ready) return { tone: "locked", text: tr("Finish every lesson first") };
      if (key === "written" && !res.skillMap?.passed) return { tone: "locked", text: tr("Pass the skill map first") };
      return {
        tone: "todo",
        text: r ? tr("Last try {scorePct}% · {passThreshold}% needed", { scorePct: r.scorePct, passThreshold: course.passThreshold }) : tr("{passThreshold}% to pass", { passThreshold: course.passThreshold }),
        action: (
          <Button type="primary" onClick={key === "skillMap" ? onSkillMap : onWritten} className="rounded-xl! font-semibold!">
            {r ? tr("Retake") : tr("Start test")}
          </Button>
        ),
      };
    }
    const r = res[key];
    if (r) return { tone: "done", text: tr("Scored {overallPct}% by {evaluatorName}", { overallPct: r.overallPct, evaluatorName: trData(r.evaluatorName) }) };
    if (!res.skillMap?.passed) return { tone: "locked", text: tr("Opens after the skill map") };
    if (key === "oral" && !res.practical) return { tone: "locked", text: tr("After the practical") };
    return { tone: "wait", text: tr("Waiting for {managerName} to score it on site", { managerName: managerName ?? tr("your manager") }) };
  };

  const TONE = {
    done: "bg-emerald-50 text-emerald-700",
    todo: "bg-[#1C4463]/10 text-[#1C4463]",
    wait: "bg-amber-50 text-amber-700",
    locked: "bg-slate-100 text-slate-500",
    missing: "bg-rose-50 text-rose-700",
  } as const;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-3xl bg-gradient-to-br from-[#1C4463] to-[#0B1A24] text-white p-6 sm:p-8">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">{tr("Get certified")}</div>
        <h2 className="m-0 mt-1 text-2xl font-extrabold text-white">{tr("4 steps to your {code} certificate", { code: course.code })}</h2>
        <p className="m-0 mt-2 text-white/75 max-w-2xl">
          {ready ? tr("All lessons are done. ") : tr("Finish every lesson to open the online tests. ")}
          {tr("The certificate is issued automatically when all 4 steps pass, valid {months} months.", { months: course.certificateValidityMonths ?? 12 })}
        </p>
      </div>

      <ol className="m-0 p-0 list-none grid gap-3 sm:grid-cols-2">
        {GATES.map((g, n) => {
          const s = status(g.key);
          return (
            <li key={g.key} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-bold ${s.tone === "done" ? "bg-emerald-600 text-white" : "bg-[#1C4463] text-white"}`}>
                  {s.tone === "done" ? <CheckOutlined /> : n + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{trData(g.title)}</span>
                    <span className="text-xs font-semibold text-slate-400">{g.weight}%</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{trData(g.how)}</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap mt-auto">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${TONE[s.tone]}`}>{trData(s.text)}</span>
                {s.action}
              </div>
            </li>
          );
        })}
      </ol>

      <div className={`rounded-2xl border p-5 flex items-center gap-4 flex-wrap ${cert ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
        <span className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${cert ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>
          <TrophyOutlined />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-900">{cert ? tr("Certificate issued") : tr("Certificate")}</div>
          <div className="text-sm text-slate-500">
            {cert ? tr("No. {certificateNo} · valid until {expiresAt}", { certificateNo: cert.certificateNo, expiresAt: cert.expiresAt?.slice(0, 10) ?? "—" }) : tr("Issued automatically when all 4 steps pass.")}
          </div>
        </div>
        {cert && (
          <Button type="primary" onClick={onCertificate} className="rounded-xl! font-semibold!">{tr("View certificate")}</Button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

/** Course player: lesson stage + knowledge check, a journey rail (lessons → 4 assessment steps → certificate). */
export default function CourseLearningPage() {
  const { message } = App.useApp();
  const params = useParams();
  const courseId = String(Array.isArray(params?.courseId) ? params.courseId[0] : params?.courseId ?? "");
  const viewer = useViewer();
  const me = viewer.personId ?? "";
  const { ready, error, version } = useTrainingData();
  const [chosenView, setView] = useState<View | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [skillMapOpen, setSkillMapOpen] = useState(false);
  const [writtenOpen, setWrittenOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);

  // Surface server-side rejections (the store re-syncs the enrollment after each one)
  useEffect(() => {
    const h = (e: Event) => message.error((e as CustomEvent<string>).detail);
    window.addEventListener("training-error", h);
    return () => window.removeEventListener("training-error", h);
  }, [message]);

  const course = ready ? getCourseById(courseId) : undefined;
  // Get-or-create: opening the player enrols on the server if needed
  const enrollment = useMemo(() => {
    void version;
    return course && me ? getEnrollment(me, course.id) : null;
  }, [course, me, version]);

  const abilities = useMemo(() => [...(course?.abilities ?? [])].sort((a, b) => a.order - b.order), [course]);

  // Until the learner picks a step: the first unfinished lesson, or the assessment once all are done
  const firstOpen = enrollment ? abilities.find((a) => !enrollment.abilityProgress[a.id]?.completedAt) : undefined;
  const view: View | null =
    chosenView ?? (enrollment ? (firstOpen ? { kind: "lesson", abilityId: firstOpen.id } : { kind: "assessment" }) : null);

  if (!ready && !error) return <Skeleton active style={{ padding: 24 }} />;
  if (!course) return <Result status="404" title={tr("Course not found")} subTitle={error ?? undefined} extra={<Link href="/training/explore">{tr("Browse courses")}</Link>} />;
  if (!me) return <Result status="info" title={tr("Training needs a profile on your login")} />;
  if (!enrollment || !view) return <Skeleton active style={{ padding: 24 }} />;

  const doneCount = abilities.filter((a) => enrollment.abilityProgress[a.id]?.completedAt).length;
  const results = getAssessmentResults(enrollment.id);
  const gatesDone = (["skillMap", "written"] as const).filter((k) => results[k]?.passed).length + (results.practical ? 1 : 0) + (results.oral ? 1 : 0);
  const totalSteps = abilities.length + 4;
  const overall = Math.round(((doneCount + gatesDone) / totalSteps) * 100);
  const cert = getCertificates(me).find((c) => c.courseId === course.id);
  const managerId = getPerson(me)?.managerId;
  const managerName = managerId ? getPersonName(managerId) : undefined;

  const ability = view.kind === "lesson" ? abilities.find((a) => a.id === view.abilityId) ?? abilities[0] : undefined;
  const idx = ability ? abilities.indexOf(ability) : -1;
  const progress = ability ? enrollment.abilityProgress[ability.id] : undefined;
  const watchedEnough = (progress?.videoWatchedPct ?? 0) >= WATCH_TO_UNLOCK;
  const hasQuiz = Boolean(ability?.microQuiz?.questions?.length);
  const needsReading = Boolean(ability?.readingContent) && !progress?.readingAcknowledged;
  const lessonDone = Boolean(progress?.completedAt);
  const nextAbility = idx >= 0 ? abilities[idx + 1] : undefined;
  const nextUnlocked = nextAbility ? isAbilityUnlocked(enrollment, nextAbility, course) : false;

  const goLesson = (a: Ability) => {
    if (!isAbilityUnlocked(enrollment, a, course)) {
      message.info(tr("Finish the previous lesson first."));
      return;
    }
    setView({ kind: "lesson", abilityId: a.id });
  };

  const lessonState = (a: Ability): StepState =>
    enrollment.abilityProgress[a.id]?.completedAt ? "done" : view.kind === "lesson" && view.abilityId === a.id ? "current" : isAbilityUnlocked(enrollment, a, course) ? "open" : "locked";

  return (
    <div className="flex flex-col gap-5 min-w-0">
      {/* Top bar */}
      <header className="rounded-2xl bg-white border border-slate-200 px-4 sm:px-5 py-3 flex items-center gap-4">
        <Link href={`/training/course/${course.id}`} aria-label={tr("Back to course")} className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-slate-100! text-slate-700! hover:bg-slate-200!">
          <ArrowLeftOutlined />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-500">{course.code} · {trData(course.section)}</div>
          <div className="font-bold text-slate-900 truncate">{trData(course.title)}</div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-1 w-56">
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-900">{tr("{overall}% complete", { overall })}</span> · {tr("{done}/{total} lessons · {gates}/4 steps", { done: doneCount, total: abilities.length, gates: gatesDone })}
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${overall}%` }} />
          </div>
        </div>
        <Button
          icon={railOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
          onClick={() => setRailOpen((o) => !o)}
          className="hidden! lg:inline-flex! rounded-xl!"
        >
          {railOpen ? tr("Hide steps") : tr("Show steps")}
        </Button>
      </header>

      <div className={`grid gap-6 items-start ${railOpen ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <main className="flex flex-col gap-5 min-w-0">
          {view.kind === "assessment" || !ability ? (
            <AssessmentHub
              course={course}
              enrollment={enrollment}
              managerName={managerName}
              onSkillMap={() => setSkillMapOpen(true)}
              onWritten={() => setWrittenOpen(true)}
              onCertificate={() => setCertOpen(true)}
            />
          ) : (
            <>
              <LessonPlayer
                course={course}
                ability={ability}
                enrollment={enrollment}
                onFinished={() => hasQuiz && message.success(tr("Lesson watched — the knowledge check is open below."))}
              />

              <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-500">{tr("Lesson {n} of {total} · {minutes} min", { n: idx + 1, total: abilities.length, minutes: ability.videoDurationMinutes })}</div>
                    <h1 className="m-0 mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">{trData(ability.title)}</h1>
                  </div>
                  {lessonDone && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                      <CheckCircleFilled />{" "}{tr("Completed")}
                    </span>
                  )}
                </div>
                <p className="m-0 text-slate-700 leading-relaxed">{trData(ability.description)}</p>

                {ability.readingContent && (
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{tr("Reading")}</div>
                    <p className="m-0 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{trData(ability.readingContent)}</p>
                    {needsReading ? (
                      <Button className="mt-4 rounded-xl!" onClick={() => acknowledgeReading(enrollment.id, ability.id)}>
                        {tr("I've read this")}
                      </Button>
                    ) : (
                      <div className="mt-3 text-xs font-semibold text-emerald-700"><CheckOutlined />{" "}{tr("Read")}</div>
                    )}
                  </div>
                )}

                {/* Knowledge check */}
                <div className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="font-bold text-slate-900">{tr("Knowledge check")}</div>
                    {progress?.quizPassed && <span className="text-xs font-semibold text-emerald-700">{tr("Passed · {quizScorePct}%", { quizScorePct: progress.quizScorePct })}</span>}
                  </div>
                  {!hasQuiz ? (
                    <p className="m-0 text-sm text-slate-500">
                      {ability.readingContent
                        ? tr("No quiz for this lesson — it completes once you've watched {pct}% of it and read the reading.", { pct: WATCH_TO_UNLOCK })
                        : tr("No quiz for this lesson — it completes once you've watched {pct}% of it.", { pct: WATCH_TO_UNLOCK })}
                    </p>
                  ) : progress?.quizPassed ? (
                    <p className="m-0 text-sm text-slate-500">{tr("You passed this lesson's check.")}</p>
                  ) : !watchedEnough ? (
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <LockOutlined className="text-slate-400" />
                      {tr("Opens after you've watched {pct}% of the lesson (now {now}%).", { pct: WATCH_TO_UNLOCK, now: progress?.videoWatchedPct ?? 0 })}
                    </div>
                  ) : (
                    <QuizRunner
                      key={ability.id}
                      questions={ability.microQuiz.questions}
                      passMark={ability.microQuiz.passThreshold}
                      onSubmit={(answers) => submitMicroQuiz(enrollment.id, ability.id, answers)}
                    />
                  )}
                </div>

                {/* Lesson navigation */}
                <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                  <Button disabled={idx === 0} onClick={() => goLesson(abilities[idx - 1])} className="rounded-xl!">
                    {tr("Previous lesson")}
                  </Button>
                  {nextAbility ? (
                    <Button type="primary" disabled={!nextUnlocked} onClick={() => goLesson(nextAbility)} className="rounded-xl! font-semibold!">
                      {tr("Next lesson")}
                    </Button>
                  ) : (
                    <Button type="primary" disabled={!lessonDone} onClick={() => setView({ kind: "assessment" })} className="rounded-xl! font-semibold!">
                      {tr("Go to assessment")}
                    </Button>
                  )}
                </div>
              </section>
            </>
          )}
        </main>

        {/* Journey rail */}
        {railOpen && (
          <aside aria-label={tr("Course steps")} className="bg-white border border-slate-200 rounded-3xl p-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{tr("Lessons")}</div>
            <ol className="m-0 p-0 list-none">
              {abilities.map((a) => {
                const p = enrollment.abilityProgress[a.id];
                const state = lessonState(a);
                return (
                  <RailStep
                    key={a.id}
                    state={state}
                    index={a.order}
                    title={trData(a.title)}
                    meta={[
                    tr("{minutes} min", { minutes: a.videoDurationMinutes }),
                    a.microQuiz?.questions?.length ? tr("quiz") : null,
                    !p?.completedAt && p?.videoWatchedPct ? tr("{pct}% watched", { pct: p.videoWatchedPct }) : null,
                  ].filter(Boolean).join(" · ")}
                    active={state === "current"}
                    onClick={state === "locked" ? undefined : () => goLesson(a)}
                  />
                );
              })}
            </ol>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-5 mb-3">{tr("Get certified")}</div>
            <ol className="m-0 p-0 list-none">
              {GATES.map((g, n) => {
                const r = results[g.key];
                const passed = g.key === "skillMap" || g.key === "written" ? Boolean((r as { passed?: boolean } | undefined)?.passed) : Boolean(r);
                const state: StepState = passed
                  ? "done"
                  : !canTakeSkillMapping(enrollment, course)
                    ? "locked"
                    : g.key === "practical" || g.key === "oral"
                      ? results.skillMap?.passed ? "waiting" : "locked"
                      : "open";
                return (
                  <RailStep
                    key={g.key}
                    state={state}
                    index={n + 1}
                    title={trData(g.title)}
                    meta={passed ? tr("Done") : g.key === "practical" || g.key === "oral" ? tr("Scored by your manager") : tr("{weight}% of the result", { weight: g.weight })}
                    active={view.kind === "assessment"}
                    onClick={() => setView({ kind: "assessment" })}
                  />
                );
              })}
              <RailStep
                state={cert ? "done" : "locked"}
                index={<TrophyOutlined />}
                title={tr("Certificate")}
                meta={cert ? tr("Valid until {expiresAt}", { expiresAt: cert.expiresAt?.slice(0, 10) ?? "—" }) : tr("After all 4 steps")}
                onClick={cert ? () => setCertOpen(true) : undefined}
              />
            </ol>
          </aside>
        )}
      </div>

      <SkillMapGateModal
        open={skillMapOpen}
        course={course}
        enrollmentId={enrollment.id}
        onClose={() => setSkillMapOpen(false)}
        onPassed={() => setSkillMapOpen(false)}
      />

      <Modal open={writtenOpen} title={tr("Written test · {code}", { code: course.code })} onCancel={() => setWrittenOpen(false)} footer={null} width={720} destroyOnHidden>
        {course.writtenTestQuestions?.length ? (
          <QuizRunner
            questions={course.writtenTestQuestions}
            passMark={course.passThreshold}
            submitLabel={tr("Submit test")}
            onSubmit={(answers) => {
              const r = submitWrittenTest(enrollment.id, answers);
              return { scorePct: r.scorePct, passed: r.passed };
            }}
          />
        ) : (
          <Empty description={tr("The written test questions for this course are not set up yet.")} />
        )}
      </Modal>

      <CertificateModal certificate={certOpen ? cert ?? null : null} onClose={() => setCertOpen(false)} />
    </div>
  );
}
