/**
 * Training store — an in-memory cache of DATABASE data, loaded through the NestJS API.
 *
 * - Nothing here is seeded from mock files and nothing is kept in localStorage.
 * - Reads are synchronous over the cache (the course player relies on that); call
 *   `loadTrainingData()` (or `useTrainingData()`) before reading.
 * - Writes update the cache optimistically for instant feedback, then the server
 *   (which scores quizzes/tests and issues certificates) replaces the cached copy.
 *
 * Exception agreed with the client: specialization tracks and the LNI competency list
 * are still client-side mock content (lib/training/data.ts).
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import * as api from "@/lib/api/training";
import { getEmployees } from "@/lib/api/employees";
import { getSites } from "@/lib/api/sites";
import { mockSpecializationTracks } from "./data";
import type {
  Course,
  CourseEnrollment,
  Ability,
  AbilityProgress,
  SkillMappingResult,
  WrittenTestResult,
  PracticalTestResult,
  OralTestResult,
  AbilityScore,
  Certificate,
  LearningNeedRecord,
  TrainingSession,
  SpecializationTrack,
  TrainingAssignment,
} from "./types";
import type { TrainingItem, TrainingPriority } from "@/lib/mock-data";

type PersonLite = {
  id: string;
  name: string;
  designation?: string;
  siteId?: string;
  managerId?: string;
  supervisorId?: string;
  shiftInChargeId?: string;
  employeeCategory?: string;
};
type SiteLite = { id: string; name: string; plantType?: string };

const cache = {
  courses: [] as Course[],
  enrollments: [] as CourseEnrollment[],
  certificates: [] as Certificate[],
  sessions: [] as TrainingSession[],
  assignments: [] as TrainingAssignment[],
  people: new Map<string, PersonLite>(),
  sites: new Map<string, SiteLite>(),
  loaded: false,
  error: null as string | null,
  version: 0,
};

// ----------------------------------------------------
// Change notification (React re-renders on cache updates)
// ----------------------------------------------------
const listeners = new Set<() => void>();
function emit() {
  cache.version++;
  listeners.forEach((l) => l());
}
export function subscribeTraining(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getTrainingVersion(): number {
  return cache.version;
}
/** Re-render on every cache change. */
export function useTrainingVersion(): number {
  return useSyncExternalStore(subscribeTraining, getTrainingVersion, () => 0);
}

let inflight: Promise<void> | null = null;

/** Load everything the training screens read synchronously. Safe to call repeatedly. */
export function loadTrainingData(force = false): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (cache.loaded && !force) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [courses, enrollments, certificates, sessions, assignments, employees, sites] = await Promise.all([
        api.getCourses(),
        api.getEnrollments(),
        api.getCertificates(),
        api.getSessions(),
        api.getTrainingAssignments(),
        getEmployees(),
        getSites(),
      ]);
      cache.courses = courses;
      cache.enrollments = enrollments;
      postedPct.clear(); // fresh server copy → save steps restart from it
      cache.certificates = certificates;
      cache.sessions = sessions;
      cache.assignments = assignments;
      cache.people = new Map((employees as unknown as PersonLite[]).map((e) => [e.id, e]));
      cache.sites = new Map((sites as unknown as SiteLite[]).map((s) => [s.id, s]));
      cache.loaded = true;
      cache.error = null;
    } catch (err) {
      cache.error = (err as Error).message || "Could not load training data";
    } finally {
      inflight = null;
      emit();
    }
  })();
  return inflight;
}

/** Kept for existing callers (AppShell hydration). */
export const syncTrainingWithApi = () => loadTrainingData(true);

/** Hook: loads once and re-renders on changes. */
export function useTrainingData(): { ready: boolean; error: string | null; version: number; reload: () => Promise<void> } {
  const version = useTrainingVersion();
  const [, setTick] = useState(0);
  useEffect(() => {
    void loadTrainingData().then(() => setTick((t) => t + 1));
  }, []);
  return { ready: cache.loaded, error: cache.error, version, reload: () => loadTrainingData(true) };
}

export function resetTrainingStore(): void {
  cache.loaded = false;
  void loadTrainingData(true);
}

/**
 * Server copy wins, except watch progress: responses can arrive out of order while the video keeps playing,
 * so each ability keeps the higher watched % (the server keeps the max too). `force` replaces outright.
 */
const replaceEnrollment = (e: CourseEnrollment, opts?: { force?: boolean }) => {
  const i = cache.enrollments.findIndex((x) => x.id === e.id || (x.employeeId === e.employeeId && x.courseId === e.courseId));
  const local = i >= 0 ? cache.enrollments[i] : undefined;
  if (local && !opts?.force) {
    for (const [abilityId, p] of Object.entries(e.abilityProgress ?? {})) {
      const mine = local.abilityProgress[abilityId];
      if (mine && mine.videoWatchedPct > p.videoWatchedPct) {
        p.videoWatchedPct = mine.videoWatchedPct;
        p.videoComplete = p.videoComplete || mine.videoComplete;
      }
    }
  }
  if (i >= 0) cache.enrollments[i] = e;
  else cache.enrollments.push(e);
  emit();
};
const reportError = (err: unknown) => {
  cache.error = (err as Error)?.message ?? String(err);
  emit();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("training-error", { detail: cache.error }));
};
/** A write was rejected: show why, then reload this enrollment from the server so the screen matches the database. */
const resync = (enr: Pick<CourseEnrollment, "employeeId" | "courseId">) => (err: unknown) => {
  reportError(err);
  api.enroll(enr.employeeId, enr.courseId).then((e) => replaceEnrollment(e, { force: true })).catch(() => undefined);
};
const refreshCertificates = async (employeeId: string) => {
  try {
    const mine = await api.getCertificates(employeeId);
    cache.certificates = [...cache.certificates.filter((c) => c.employeeId !== employeeId), ...mine];
    emit();
  } catch (err) {
    reportError(err);
  }
};

// ----------------------------------------------------
// People (from the employees API)
// ----------------------------------------------------
export function getPersonName(id: string): string | undefined {
  return cache.people.get(id)?.name;
}
export function getSiteName(siteId?: string): string | undefined {
  return siteId ? cache.sites.get(siteId)?.name : undefined;
}
export function getPeople(): PersonLite[] {
  return [...cache.people.values()];
}
export function getPerson(id: string): PersonLite | undefined {
  return cache.people.get(id);
}
export function getSite(siteId?: string): (SiteLite & { managerName?: string; managerId?: string }) | undefined {
  return siteId ? (cache.sites.get(siteId) as SiteLite & { managerName?: string; managerId?: string }) : undefined;
}

// ----------------------------------------------------
// Courses
// ----------------------------------------------------
export function getAllCourses(): Course[] {
  return cache.courses;
}

export function getCourseById(courseId: string): Course | undefined {
  return cache.courses.find((c) => c.id === courseId || c.courseId === courseId || c.code === courseId);
}

/** Exact title match only (no guessing). */
export function getCourseByTitle(title: string): Course | undefined {
  const t = title.trim().toLowerCase();
  return cache.courses.find((c) => c.title.trim().toLowerCase() === t);
}

// ----------------------------------------------------
// Enrollments
// ----------------------------------------------------
export function getAllEnrollments(): CourseEnrollment[] {
  return cache.enrollments;
}

export function getEnrollmentsForEmployee(employeeId: string): CourseEnrollment[] {
  return cache.enrollments.filter((e) => e.employeeId === employeeId);
}

const freshProgress = (abilityId: string, unlocked: boolean): AbilityProgress => ({
  abilityId,
  videoWatchedPct: 0,
  videoComplete: false,
  readingAcknowledged: false,
  quizAttempts: 0,
  quizPassed: false,
  unlockedAt: unlocked ? new Date().toISOString() : "",
});

/** Cached enrollment; if missing, enrolls on the server (get-or-create) and shows a local copy meanwhile. */
export function getEnrollment(employeeId: string, courseId: string): CourseEnrollment {
  const course = getCourseById(courseId);
  const cid = course?.id ?? courseId;
  const existing = cache.enrollments.find((e) => e.employeeId === employeeId && e.courseId === cid);
  if (existing) return existing;
  const local: CourseEnrollment = {
    id: `enr-${employeeId}-${cid}`,
    employeeId,
    courseId: cid,
    status: "IN_PROGRESS",
    startedAt: new Date().toISOString(),
    abilityProgress: Object.fromEntries((course?.abilities ?? []).map((a) => [a.id, freshProgress(a.id, a.order === 1)])),
    assessments: {},
  };
  cache.enrollments.push(local);
  api.enroll(employeeId, cid).then(replaceEnrollment).catch(reportError);
  return local;
}

/** Explicit enroll (course page button). */
export async function enrollInCourse(employeeId: string, courseId: string): Promise<CourseEnrollment> {
  const e = await api.enroll(employeeId, courseId);
  replaceEnrollment(e);
  return e;
}

export function isAbilityUnlocked(enrollment: CourseEnrollment, ability: Ability, course: Course): boolean {
  if (ability.order === 1) return true;
  const prev = course.abilities.find((a) => a.order === ability.order - 1);
  if (!prev) return true;
  return Boolean(enrollment.abilityProgress[prev.id]?.completedAt);
}

const hasQuiz = (a?: Ability) => Boolean(a?.microQuiz?.questions?.length);

function findEnrollment(enrollmentId: string) {
  const enr = cache.enrollments.find((e) => e.id === enrollmentId);
  if (!enr) throw new Error("Enrollment not found");
  return enr;
}

/** Mirrors the server: quiz-less abilities complete after video (+ reading if any). */
function completeIfNoQuiz(enr: CourseEnrollment, abilityId: string) {
  const course = getCourseById(enr.courseId);
  const ability = course?.abilities.find((a) => a.id === abilityId);
  if (!course || !ability || hasQuiz(ability)) return;
  const p = enr.abilityProgress[abilityId];
  if (p.videoComplete && (!ability.readingContent || p.readingAcknowledged) && !p.completedAt) {
    p.completedAt = new Date().toISOString();
    const next = course.abilities.find((a) => a.order === ability.order + 1);
    if (next) (enr.abilityProgress[next.id] ??= freshProgress(next.id, true)).unlockedAt ||= new Date().toISOString();
  }
}

/** Last watch % sent to the server per enrollment+ability, so playback saves in steps instead of every second. */
const postedPct = new Map<string, number>();

/**
 * Records watch progress locally at once; saves to the server every 10%, on reaching 90% / 100%, or when `flush` is set
 * (pause, lesson switch, leaving the page).
 */
export function updateVideoProgress(enrollmentId: string, abilityId: string, watchedPct: number, opts?: { flush?: boolean }): AbilityProgress {
  const enr = findEnrollment(enrollmentId);
  const p = (enr.abilityProgress[abilityId] ??= freshProgress(abilityId, true));
  const before = p.videoWatchedPct;
  p.videoWatchedPct = Math.min(100, Math.max(p.videoWatchedPct, Math.round(watchedPct)));
  if (p.videoWatchedPct >= 90) p.videoComplete = true;
  completeIfNoQuiz(enr, abilityId);
  if (p.videoWatchedPct > before) emit();
  const key = `${enrollmentId}:${abilityId}`;
  // Nothing new beyond what the database already has → no request
  if (!postedPct.has(key)) postedPct.set(key, before);
  const last = postedPct.get(key)!;
  const pct = p.videoWatchedPct;
  const due = pct - last >= 10 || (pct >= 90 && last < 90) || (pct === 100 && last < 100) || (opts?.flush && pct > last);
  if (due) {
    postedPct.set(key, pct);
    api
      .postVideoProgress(enrollmentId, abilityId, pct)
      .then((e) => replaceEnrollment(e))
      .catch((err) => {
        postedPct.delete(key);
        resync(enr)(err);
      });
  }
  return p;
}

export function acknowledgeReading(enrollmentId: string, abilityId: string): void {
  const enr = findEnrollment(enrollmentId);
  (enr.abilityProgress[abilityId] ??= freshProgress(abilityId, true)).readingAcknowledged = true;
  completeIfNoQuiz(enr, abilityId);
  emit();
  api.postReading(enrollmentId, abilityId).then((e) => replaceEnrollment(e)).catch(resync(enr));
}

const scoreOf = (questions: { id: string; correctOptionId: string }[], answers: Record<string, string>) =>
  questions.length ? Math.round((questions.filter((q) => answers[q.id] === q.correctOptionId).length / questions.length) * 100) : 0;

export function submitMicroQuiz(
  enrollmentId: string,
  abilityId: string,
  answers: Record<string, string>,
): { scorePct: number; passed: boolean } {
  const enr = findEnrollment(enrollmentId);
  const course = getCourseById(enr.courseId);
  const ability = course?.abilities.find((a) => a.id === abilityId);
  if (!course || !ability?.microQuiz?.questions?.length) return { scorePct: 0, passed: false };
  const scorePct = scoreOf(ability.microQuiz.questions, answers);
  const passed = scorePct >= ability.microQuiz.passThreshold;
  const p = (enr.abilityProgress[abilityId] ??= freshProgress(abilityId, true));
  p.quizAttempts += 1;
  p.quizScorePct = scorePct;
  if (passed) {
    p.quizPassed = true;
    p.completedAt ??= new Date().toISOString();
    const next = course.abilities.find((a) => a.order === ability.order + 1);
    if (next) (enr.abilityProgress[next.id] ??= freshProgress(next.id, true)).unlockedAt ||= new Date().toISOString();
  }
  api
    .postMicroQuiz(enrollmentId, abilityId, answers)
    .then((r) => replaceEnrollment(r.enrollment))
    .catch(resync(enr));
  emit();
  return { scorePct, passed };
}

export function canTakeSkillMapping(enrollment: CourseEnrollment, course: Course): boolean {
  if (!enrollment || !course?.abilities?.length) return false;
  return course.abilities.every((a) => enrollment.abilityProgress[a.id]?.completedAt);
}

/** True when the course has the questions for this gate (they are authored in the database). */
export function hasGateQuestions(course: Course, gate: "skillMap" | "written"): boolean {
  return Boolean((gate === "skillMap" ? course.skillMappingQuestions : course.writtenTestQuestions)?.length);
}

function quizGate(
  enrollmentId: string,
  gate: "skillMap" | "written",
  answers: Record<string, string>,
): SkillMappingResult {
  const enr = findEnrollment(enrollmentId);
  const course = getCourseById(enr.courseId);
  const questions = (gate === "skillMap" ? course?.skillMappingQuestions : course?.writtenTestQuestions) ?? [];
  const scorePct = scoreOf(questions, answers);
  const result: SkillMappingResult = {
    id: `${gate}-${Date.now()}`,
    enrollmentId,
    scorePct,
    passed: questions.length > 0 && scorePct >= (course?.passThreshold ?? 70),
    takenAt: new Date().toISOString(),
    answers,
  };
  if (!questions.length) {
    reportError(new Error("The questions for this test are not set up yet"));
    return result;
  }
  enr.assessments = { ...(enr.assessments ?? {}), [gate]: result };
  if (gate === "skillMap" && result.passed && enr.status === "IN_PROGRESS") enr.status = "SKILL_MAP_DONE";
  emit();
  (gate === "skillMap" ? api.postSkillMap : api.postWritten)(enrollmentId, answers)
    .then((r) => {
      replaceEnrollment(r.enrollment);
      if (r.certificate) void refreshCertificates(enr.employeeId);
    })
    .catch(resync(enr));
  return result;
}

export function submitSkillMapping(enrollmentId: string, answers: Record<string, string>): SkillMappingResult {
  return quizGate(enrollmentId, "skillMap", answers);
}

export function submitWrittenTest(enrollmentId: string, answers: Record<string, string>): WrittenTestResult {
  return quizGate(enrollmentId, "written", answers);
}

const rubricPct = (scores: AbilityScore[]) =>
  scores.length ? Math.round((scores.reduce((s, x) => s + x.score, 0) / (scores.length * 5)) * 1000) / 10 : 0;

/** Practical / oral by the Director or the learner's allotted manager (checked on the server). */
async function evaluate(
  gate: "practical" | "oral",
  enrollmentId: string,
  evaluatorId: string,
  scores: AbilityScore[],
  notes?: string,
) {
  const call = gate === "practical" ? api.postPractical : api.postOral;
  const r = await call(enrollmentId, evaluatorId, scores, notes);
  replaceEnrollment(r.enrollment);
  if (r.certificate) await refreshCertificates(r.enrollment.employeeId);
  return r;
}

export function submitPracticalAssessment(
  enrollmentId: string,
  evaluatorId: string,
  evaluatorName: string,
  scores: AbilityScore[],
  generalNotes?: string,
): PracticalTestResult {
  const local: PracticalTestResult = {
    id: `ptr-${Date.now()}`,
    enrollmentId,
    evaluatorId,
    evaluatorName,
    scores,
    overallPct: rubricPct(scores),
    conductedAt: new Date().toISOString(),
    signatureVerified: true,
    generalNotes,
  };
  evaluate("practical", enrollmentId, evaluatorId, scores, generalNotes).catch(reportError);
  return local;
}

export function submitOralAssessment(
  enrollmentId: string,
  evaluatorId: string,
  evaluatorName: string,
  scores: AbilityScore[],
  interviewNotes?: string,
): OralTestResult {
  const local: OralTestResult = {
    id: `otr-${Date.now()}`,
    enrollmentId,
    evaluatorId,
    evaluatorName,
    scores,
    overallPct: rubricPct(scores),
    conductedAt: new Date().toISOString(),
    interviewNotes,
    generalNotes: interviewNotes,
  };
  evaluate("oral", enrollmentId, evaluatorId, scores, interviewNotes).catch(reportError);
  return local;
}

/** Promise versions for new screens that want to await the server. */
export const evaluatePractical = (enrollmentId: string, evaluatorId: string, scores: AbilityScore[], notes?: string) =>
  evaluate("practical", enrollmentId, evaluatorId, scores, notes);
export const evaluateOral = (enrollmentId: string, evaluatorId: string, scores: AbilityScore[], notes?: string) =>
  evaluate("oral", enrollmentId, evaluatorId, scores, notes);

export function getAssessmentResults(enrollmentId: string): {
  skillMap?: SkillMappingResult;
  written?: WrittenTestResult;
  practical?: PracticalTestResult;
  oral?: OralTestResult;
} {
  return cache.enrollments.find((e) => e.id === enrollmentId)?.assessments ?? {};
}

/** The server issues certificates when all 4 gates pass; this just returns it. */
export function checkAndTriggerCertification(enrollmentId: string): Certificate | null {
  return cache.certificates.find((c) => c.enrollmentId === enrollmentId) ?? null;
}

// ----------------------------------------------------
// Certificates
// ----------------------------------------------------
export function getCertificates(employeeId?: string): Certificate[] {
  return employeeId ? cache.certificates.filter((c) => c.employeeId === employeeId) : cache.certificates;
}

export type CertificateStatus = "valid" | "expiring_soon" | "expired";

export interface ViewCertificateItem {
  id: string;
  certificateNo: string;
  enrollmentId: string;
  employeeId: string;
  employeeName: string;
  siteName: string;
  name: string;
  courseTitle: string;
  issuer: string;
  issuedOn: string;
  expiresOn: string;
  status: CertificateStatus;
  overallPct: number;
  managerSignatory: string;
  verificationHash: string;
  raw: Certificate;
}

export const CERT_STATUS_LABELS: Record<CertificateStatus, string> = {
  valid: "Valid",
  expiring_soon: "Expiring soon",
  expired: "Expired",
};

export function getCertificateStatus(expiresAt?: string): CertificateStatus {
  if (!expiresAt) return "valid";
  const days = (new Date(expiresAt).getTime() - Date.now()) / 86400000;
  if (days < 0) return "expired";
  if (days <= 60) return "expiring_soon";
  return "valid";
}

export function getAllCertificates(siteId?: string): ViewCertificateItem[] {
  return cache.certificates
    .map((c) => {
      const emp = cache.people.get(c.employeeId);
      return {
        id: c.id,
        certificateNo: c.certificateNo,
        enrollmentId: c.enrollmentId,
        employeeId: c.employeeId,
        employeeName: c.employeeName,
        siteName: getSiteName(emp?.siteId) ?? "—",
        name: c.courseTitle,
        courseTitle: c.courseTitle,
        issuer: c.managerSignatory || "Nectar Enviro Academy",
        issuedOn: c.issuedAt?.slice(0, 10) ?? "",
        expiresOn: c.expiresAt?.slice(0, 10) ?? "",
        status: getCertificateStatus(c.expiresAt),
        overallPct: c.overallPct,
        managerSignatory: c.managerSignatory,
        verificationHash: c.verificationHash,
        raw: c,
        siteId: emp?.siteId,
      };
    })
    .filter((c) => !siteId || c.siteId === siteId)
    .map(({ siteId: _s, ...c }) => c)
    .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));
}

export function getCertificatesForEmployee(employeeId: string): ViewCertificateItem[] {
  return getAllCertificates().filter((c) => c.employeeId === employeeId);
}

// ----------------------------------------------------
// LNI records — derived from database assessment results (not stored, not mocked)
// ----------------------------------------------------
export function getLearningNeedRecords(employeeId?: string): LearningNeedRecord[] {
  return cache.enrollments
    .filter((e) => !employeeId || e.employeeId === employeeId)
    .map((e) => {
      const course = getCourseById(e.courseId);
      if (!course) return null;
      const r = e.assessments ?? {};
      const skillMap = r.skillMap?.scorePct ?? null;
      const written = r.written?.scorePct ?? null;
      const practical = r.practical?.overallPct ?? null;
      const oral = r.oral?.overallPct ?? null;
      if (skillMap === null && written === null && practical === null && oral === null) return null;

      let level: "LOW" | "MED" | "HIGH" = "MED";
      if ((practical !== null && practical < 60) || (written !== null && written < 60)) level = "LOW";
      else if (written !== null && practical !== null && practical >= 80 && written >= 80 && (oral ?? 0) >= 70) level = "HIGH";

      let insight: string;
      if (written === null) insight = practical !== null ? `Practical ${practical}%. Written test not taken yet.` : "Assessment in progress. Written test not taken yet.";
      else if (practical === null) insight = `Written test ${written}%. Practical evaluation pending.`;
      else if (written >= 75 && practical < 65) insight = `Theory is strong (${written}%) but hands-on execution shows a gap (${practical}%).`;
      else if (practical >= 75 && written < 65) insight = `Hands-on work is confident (${practical}%) but theory needs reinforcement (${written}%).`;
      else if (level === "HIGH") insight = `Strong in theory (${written}%) and practice (${practical}%).`;
      else insight = `Written ${written}% · practical ${practical}%.`;

      return {
        id: `lni-${e.employeeId}-${course.id}`,
        employeeId: e.employeeId,
        competencyAreaId: course.abilities[0]?.competencyAreaId ?? "",
        competencyAreaName: course.title,
        currentLevel: level,
        skillMapScorePct: skillMap,
        writtenScorePct: written,
        practicalScorePct: practical,
        oralScorePct: oral,
        trainingRequired: level !== "HIGH" || written === null,
        aiInsight: insight,
        recommendedCourseId: course.id,
        recommendedCourseTitle: course.title,
        generatedAt: e.completedAt ?? e.startedAt,
      } satisfies LearningNeedRecord;
    })
    .filter(Boolean) as LearningNeedRecord[];
}

/** Learners waiting for an on-site practical / oral (sync view over the cache). */
export function getPendingEvaluations(siteId?: string): {
  enrollment: CourseEnrollment;
  employeeName: string;
  employeeDesignation: string;
  siteId: string;
  siteName: string;
  course: Course;
  skillMapScore: number;
  writtenScore?: number;
  hasPractical: boolean;
  hasOral: boolean;
}[] {
  return cache.enrollments
    .filter((e) => ["SKILL_MAP_DONE", "PRACTICAL_DONE", "ORAL_DONE"].includes(e.status))
    .map((e) => {
      const emp = cache.people.get(e.employeeId);
      const course = getCourseById(e.courseId);
      const r = e.assessments ?? {};
      if (!emp || !course || !r.skillMap || (r.practical && r.oral)) return null;
      if (siteId && emp.siteId !== siteId) return null;
      return {
        enrollment: e,
        employeeName: emp.name,
        employeeDesignation: emp.designation ?? "",
        siteId: emp.siteId ?? "",
        siteName: getSiteName(emp.siteId) ?? "—",
        course,
        skillMapScore: r.skillMap.scorePct,
        writtenScore: r.written?.scorePct,
        hasPractical: Boolean(r.practical),
        hasOral: Boolean(r.oral),
      };
    })
    .filter(Boolean) as ReturnType<typeof getPendingEvaluations>;
}

// ----------------------------------------------------
// Assessment schedule
// ----------------------------------------------------
export function getTrainingSessions(employeeId?: string): TrainingSession[] {
  return employeeId ? cache.sessions.filter((s) => s.employeeIds.includes(employeeId)) : cache.sessions;
}

export async function createTrainingSession(
  session: Omit<TrainingSession, "id" | "status"> & { actorId: string },
): Promise<TrainingSession> {
  const row = await api.createSession(session);
  cache.sessions = [...cache.sessions, row];
  emit();
  return row;
}

// ----------------------------------------------------
// Assignments & flags
// ----------------------------------------------------
export function getTrainingAssignments(employeeId?: string): TrainingAssignment[] {
  return employeeId ? cache.assignments.filter((a) => a.employeeId === employeeId) : cache.assignments;
}

export async function createTrainingAssignment(
  data: Partial<TrainingAssignment> & { employeeIds?: string[] },
): Promise<TrainingAssignment[]> {
  const rows = await api.createTrainingAssignments({
    ...data,
    employeeIds: data.employeeIds ?? (data.employeeId ? [data.employeeId] : []),
    assignedByEmployeeId: data.assignedByEmployeeId ?? "",
  });
  cache.assignments = [...rows, ...cache.assignments];
  emit();
  return rows;
}

// ----------------------------------------------------
// Specialization tracks — client-side mock content (agreed exception, plan §7 Q12)
// ----------------------------------------------------
export function getSpecializationTrackById(id: string): SpecializationTrack | undefined {
  return mockSpecializationTracks.find((t) => t.id === id || t.slug === id);
}

// ----------------------------------------------------
// Training items (dashboard / employee views) — derived from database rows only
// ----------------------------------------------------
const OPEN = ["open", "in_progress", "assigned"];

export function getTrainingItems(opts?: { employeeId?: string; siteEmployeeIds?: string[] }): TrainingItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const keep = (empId: string) =>
    (!opts?.employeeId || empId === opts.employeeId) && (!opts?.siteEmployeeIds || opts.siteEmployeeIds.includes(empId));

  const rows: TrainingItem[] = [];
  const seen = new Set<string>();
  // Mandatory assignments carry the real due dates
  for (const a of cache.assignments) {
    if (a.kind === "suggested" || !a.courseId || !keep(a.employeeId)) continue;
    const course = getCourseById(a.courseId);
    const enr = cache.enrollments.find((e) => e.employeeId === a.employeeId && e.courseId === a.courseId);
    const certified = enr?.status === "CERTIFIED";
    const due = a.dueDate?.slice(0, 10) ?? "";
    const emp = cache.people.get(a.employeeId);
    seen.add(`${a.employeeId}|${a.courseId}`);
    rows.push({
      id: a.id,
      employeeId: a.employeeId,
      employeeName: emp?.name ?? a.employeeId,
      siteName: getSiteName(emp?.siteId) ?? "—",
      course: course?.title ?? a.courseId,
      priority: (a.priority === "critical" ? "critical" : a.priority === "high" ? "high" : "medium") as TrainingPriority,
      dueDate: due,
      completedAt: enr?.completedAt?.slice(0, 10),
      status: certified || !OPEN.includes(a.status) ? "completed" : due && due < today ? "overdue" : due && due <= soon ? "due-soon" : "scheduled",
      score: enr?.assessments?.oral?.overallPct ?? enr?.assessments?.practical?.overallPct ?? enr?.assessments?.written?.scorePct,
    } as TrainingItem);
  }
  // Self-started enrollments (no due date)
  for (const e of cache.enrollments) {
    if (!keep(e.employeeId) || seen.has(`${e.employeeId}|${e.courseId}`)) continue;
    const course = getCourseById(e.courseId);
    const emp = cache.people.get(e.employeeId);
    rows.push({
      id: e.id,
      employeeId: e.employeeId,
      employeeName: emp?.name ?? e.employeeId,
      siteName: getSiteName(emp?.siteId) ?? "—",
      course: course?.title ?? e.courseId,
      priority: "medium",
      dueDate: "",
      completedAt: e.completedAt?.slice(0, 10),
      status: e.status === "CERTIFIED" ? "completed" : "scheduled",
      score: e.assessments?.oral?.overallPct ?? e.assessments?.practical?.overallPct ?? e.assessments?.written?.scorePct,
    } as TrainingItem);
  }
  return rows;
}

export function getUrgentTrainingItems(siteId?: string): TrainingItem[] {
  return getTrainingItems()
    .filter((t) => t.status === "overdue" || t.status === "due-soon")
    .filter((t) => !siteId || cache.people.get(t.employeeId)?.siteId === siteId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
