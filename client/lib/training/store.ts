import {
  mockCourses,
  mockJobCategories,
  mockCompetencyAreas,
  initialEnrollments,
  initialSkillMappingResults,
  initialWrittenTestResults,
  initialPracticalTestResults,
  initialOralTestResults,
  initialCertificates,
  initialLearningNeedRecords,
  initialTrainingSessions,
  mockRecommendations,
  mockMentors,
  mockRoleTracks,
  mockSpecializationTracks,
  initialMentorLiveSessions,
} from "./data";
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
  CourseRecommendation,
  MentorProfile,
  RoleProgressionTrack,
  SpecializationTrack,
  MentorLiveSession,
} from "./types";
import { getEmployeeById } from "@/lib/mock-data";

const STORAGE_KEYS = {
  ENROLLMENTS: "neipl_training_enrollments_v3",
  SKILL_MAPPING: "neipl_training_skill_mapping_v3",
  WRITTEN_TESTS: "neipl_training_written_tests_v3",
  PRACTICAL_TESTS: "neipl_training_practical_tests_v3",
  ORAL_TESTS: "neipl_training_oral_tests_v3",
  CERTIFICATES: "neipl_training_certificates_v3",
  LNI_RECORDS: "neipl_training_lni_records_v3",
  SESSIONS: "neipl_training_sessions_v3",
  MENTOR_LIVE_SESSIONS: "neipl_mentor_live_sessions_v5",
};

const STATIC_MENTOR_PHOTOS: Record<string, string> = {
  "session-director-adsul": "/mentors/director_prashant.jpg",
  "session-etp-dakave": "/mentors/mentor_sanjay.jpg",
  "session-ro-patil": "/mentors/mentor_rajesh.jpg",
  "session-mee-waghaskar": "/mentors/mentor_vikram.jpg",
};

function cleanOldStorageKeys(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("neipl_mentor_live_sessions_") && k !== STORAGE_KEYS.MENTOR_LIVE_SESSIONS) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Graceful fallback
  }
}

function sanitizeStorageValue<T>(key: string, value: T): T {
  if (key === STORAGE_KEYS.MENTOR_LIVE_SESSIONS && Array.isArray(value)) {
    return value.map((item: any) => {
      if (item && typeof item === "object") {
        const photo = item.photoDataUrl;
        if (typeof photo === "string" && (photo.startsWith("data:") || photo.length > 500)) {
          return {
            ...item,
            photoDataUrl: STATIC_MENTOR_PHOTOS[item.id] || "/mentors/director_prashant.jpg",
          };
        }
      }
      return item;
    }) as unknown as T;
  }
  return value;
}

function readStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    cleanOldStorageKeys();
    const raw = localStorage.getItem(key);
    if (!raw) {
      writeStorage(key, defaultValue);
      return defaultValue;
    }
    const parsed = JSON.parse(raw) as T;
    return sanitizeStorageValue(key, parsed);
  } catch {
    return defaultValue;
  }
}

function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  const sanitized = sanitizeStorageValue(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(sanitized));
  } catch (err: any) {
    if (err?.name === "QuotaExceededError" || err?.code === 22 || err?.number === -2147024882) {
      cleanOldStorageKeys();
      try {
        localStorage.setItem(key, JSON.stringify(sanitized));
      } catch {
        // Graceful non-blocking quota absorption
      }
    }
  }
}

// ----------------------------------------------------
// Public Training API
// ----------------------------------------------------

export function getAllCourses(): Course[] {
  return mockCourses;
}

export function getCourseById(courseId: string): Course | undefined {
  return mockCourses.find((c) => c.id === courseId);
}

export const COURSE_TITLE_TO_ID_MAP: Record<string, string> = {
  "ETP Process Fundamentals": "course-etp-101",
  "ETP Biological & Chemical Treatment Operations": "course-etp-101",
  "PPE & Site Induction": "course-saf-202",
  "Confined Space Entry": "course-saf-203",
  "Hazardous Waste Handling": "course-saf-202",
  "First Aid Refresh": "course-saf-202",
  "Lockout / Tagout": "course-saf-203",
  "Factory Safety Audit & Statutory Compliance": "course-saf-203",
  "Environmental Risk Assessment & Crisis Management": "course-qac-401",
  "STP Operation & Biological Nutrient Removal": "course-stp-101",
  "WTP Clarification, Filtration & Disinfection": "course-ops-301",
  "Zero Liquid Discharge (ZLD) Thermal & Evaporator Operations": "course-zld-301",
  "Industrial RO Membrane Operations & CIP Descaling": "course-ops-301",
  "Advanced Membrane Bio-Reactor (MBR) for Industrial Effluents": "course-etp-102",
  "Sludge Thickening, Dewatering & Filter Press Operations": "course-slu-104",
  "Ultrafiltration (UF) Hollow-Fiber Membrane Backwash": "course-ops-304",
  "High-Pressure Booster Pumps & Energy Recovery Devices": "course-ops-303",
  "Electro-Deionization (EDI) & High-Purity Demineralization": "course-ops-302",
  "Multiple Effect Evaporator (MEE) Thermo-Compressor Dynamics": "course-zld-301",
  "Agitated Thin Film Dryer (ATFD) Salt Crystallization": "course-zld-302",
  "Centrifuge Salt Dewatering & Mother Liquor Recycling": "course-zld-303",
  "Industrial Water Balance Audits & CPCB / MPCB Consents": "course-qac-401",
  "Industrial Bench Treatability Studies & Jar Testing Protocols": "course-env-402",
  "Continuous Online Effluent Telemetry (OCEMS) Calibration": "course-qac-403",
  "Environmental Clearances (CTE/CTO) & Form-V Filings": "course-qac-404",
  "Hazardous Chemical Handling & Spillage Emergency Response": "course-saf-202",
  "Electrical Safety, LOTO Protocols & Arc-Flash Protection": "course-saf-203",
  "Industrial Water Plant Manpower Operations & Shift Logbooks": "course-onm-501",
  "Safe Workplace: Confined Space Entry & H2S Gas Rescue": "course-saf-202",
  "Electrical Safety, Lockout / Tagout (LOTO) & Arc Flash": "course-saf-203",
  "Ultrafiltration (UF) & Membrane Integrity Testing": "course-ops-304",
  "Multiple Effect Evaporator (MEE) & Steam Economy Optimization": "course-zld-301",
  "Agitated Thin Film Dryer (ATFD) & Salt Crystallization": "course-zld-302",
  "Preventive Maintenance Scheduling & Rotary Equipment Overhauls": "course-onm-502",
};

export function getCourseByTitle(title: string): Course {
  const directId = COURSE_TITLE_TO_ID_MAP[title];
  if (directId) {
    const found = getCourseById(directId);
    if (found) return found;
  }
  const match = mockCourses.find(
    (c) =>
      c.title.toLowerCase().includes(title.toLowerCase()) ||
      title.toLowerCase().includes(c.title.toLowerCase()),
  );
  return match || mockCourses[0];
}

export function getAllEnrollments(): CourseEnrollment[] {
  return readStorage<CourseEnrollment[]>(STORAGE_KEYS.ENROLLMENTS, initialEnrollments);
}

export function getEnrollmentsForEmployee(employeeId: string): CourseEnrollment[] {
  const all = getAllEnrollments();
  return all.filter((e) => e.employeeId === employeeId);
}

export function getEnrollment(
  employeeId: string,
  courseId: string,
): CourseEnrollment {
  const all = getAllEnrollments();
  let enr = all.find((e) => e.employeeId === employeeId && e.courseId === courseId);
  if (!enr) {
    // Auto-create initial enrollment if not exists
    const course = getCourseById(courseId);
    const initialProgress: Record<string, AbilityProgress> = {};
    if (course) {
      course.abilities.forEach((ab) => {
        initialProgress[ab.id] = {
          abilityId: ab.id,
          videoWatchedPct: 0,
          videoComplete: false,
          readingAcknowledged: false,
          quizAttempts: 0,
          quizPassed: false,
          unlockedAt: ab.order === 1 ? new Date().toISOString() : "",
        };
      });
    }
    enr = {
      id: `enr-${employeeId}-${courseId}`,
      employeeId,
      courseId,
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
      abilityProgress: initialProgress,
    };
    all.push(enr);
    writeStorage(STORAGE_KEYS.ENROLLMENTS, all);
  }
  return enr;
}

export function isAbilityUnlocked(
  enrollment: CourseEnrollment,
  ability: Ability,
  course: Course,
): boolean {
  if (ability.order === 1) return true;
  const prevAbility = course.abilities.find((a) => a.order === ability.order - 1);
  if (!prevAbility) return true;
  const prevProgress = enrollment.abilityProgress[prevAbility.id];
  return Boolean(prevProgress && prevProgress.completedAt);
}

export function updateVideoProgress(
  enrollmentId: string,
  abilityId: string,
  watchedPct: number,
): AbilityProgress {
  const all = getAllEnrollments();
  const enr = all.find((e) => e.id === enrollmentId);
  if (!enr) throw new Error("Enrollment not found");

  if (!enr.abilityProgress[abilityId]) {
    enr.abilityProgress[abilityId] = {
      abilityId,
      videoWatchedPct: 0,
      videoComplete: false,
      readingAcknowledged: false,
      quizAttempts: 0,
      quizPassed: false,
      unlockedAt: new Date().toISOString(),
    };
  }

  const p = enr.abilityProgress[abilityId];
  p.videoWatchedPct = Math.min(100, Math.max(p.videoWatchedPct, Math.round(watchedPct)));
  if (p.videoWatchedPct >= 90) {
    p.videoComplete = true;
  }

  writeStorage(STORAGE_KEYS.ENROLLMENTS, all);
  return p;
}

export function acknowledgeReading(enrollmentId: string, abilityId: string): void {
  const all = getAllEnrollments();
  const enr = all.find((e) => e.id === enrollmentId);
  if (!enr) return;
  if (enr.abilityProgress[abilityId]) {
    enr.abilityProgress[abilityId].readingAcknowledged = true;
    writeStorage(STORAGE_KEYS.ENROLLMENTS, all);
  }
}

export function submitMicroQuiz(
  enrollmentId: string,
  abilityId: string,
  answers: Record<string, string>,
): { scorePct: number; passed: boolean } {
  const all = getAllEnrollments();
  const enr = all.find((e) => e.id === enrollmentId);
  if (!enr) throw new Error("Enrollment not found");

  const course = getCourseById(enr.courseId);
  const ability = course?.abilities.find((a) => a.id === abilityId);
  if (!ability) throw new Error("Ability not found");

  const questions = ability.microQuiz.questions;
  let correctCount = 0;
  questions.forEach((q) => {
    if (answers[q.id] === q.correctOptionId) {
      correctCount++;
    }
  });

  const scorePct = Math.round((correctCount / questions.length) * 100);
  const passed = scorePct >= ability.microQuiz.passThreshold;

  const prog = enr.abilityProgress[abilityId] || {
    abilityId,
    videoWatchedPct: 100,
    videoComplete: true,
    readingAcknowledged: true,
    quizAttempts: 0,
    quizPassed: false,
    unlockedAt: new Date().toISOString(),
  };

  prog.quizAttempts += 1;
  prog.quizScorePct = scorePct;

  if (passed) {
    prog.quizPassed = true;
    prog.completedAt = new Date().toISOString();

    // Check next ability and set its unlockedAt
    const nextAbility = course?.abilities.find((a) => a.order === ability.order + 1);
    if (nextAbility) {
      if (!enr.abilityProgress[nextAbility.id]) {
        enr.abilityProgress[nextAbility.id] = {
          abilityId: nextAbility.id,
          videoWatchedPct: 0,
          videoComplete: false,
          readingAcknowledged: false,
          quizAttempts: 0,
          quizPassed: false,
          unlockedAt: new Date().toISOString(),
        };
      } else {
        enr.abilityProgress[nextAbility.id].unlockedAt = new Date().toISOString();
      }
    }

    // Check if ALL abilities in course are now passed
    const allAbilitiesPassed = course?.abilities.every((a) => {
      if (a.id === abilityId) return true;
      const ap = enr.abilityProgress[a.id];
      return ap && (ap.completedAt || ap.quizPassed);
    });
    if (allAbilitiesPassed && enr.status === "IN_PROGRESS") {
      enr.status = "SKILL_MAP_DONE";
    }
  }

  enr.abilityProgress[abilityId] = prog;
  writeStorage(STORAGE_KEYS.ENROLLMENTS, all);
  return { scorePct, passed };
}

export function canTakeSkillMapping(enrollment: CourseEnrollment, course: Course): boolean {
  if (!enrollment || !course || !course.abilities || course.abilities.length === 0) return false;
  return course.abilities.every((a) => {
    const p = enrollment.abilityProgress[a.id];
    return p && (p.completedAt || p.quizPassed);
  });
}

export function submitSkillMapping(
  enrollmentId: string,
  answers: Record<string, string>,
): SkillMappingResult {
  const allEnrollments = getAllEnrollments();
  const enr = allEnrollments.find((e) => e.id === enrollmentId);
  if (!enr) throw new Error("Enrollment not found");

  const course = getCourseById(enr.courseId);
  if (!course) throw new Error("Course not found");

  let correct = 0;
  course.skillMappingQuestions.forEach((q) => {
    if (answers[q.id] === q.correctOptionId) {
      correct++;
    }
  });

  const scorePct = Math.round((correct / course.skillMappingQuestions.length) * 100);
  const passed = scorePct >= course.passThreshold;

  const results = readStorage<SkillMappingResult[]>(
    STORAGE_KEYS.SKILL_MAPPING,
    initialSkillMappingResults,
  );

  const existingIndex = results.findIndex((r) => r.enrollmentId === enrollmentId);
  const result: SkillMappingResult = {
    id: `smr-${Date.now()}`,
    enrollmentId,
    scorePct,
    passed,
    takenAt: new Date().toISOString(),
    answers,
  };

  if (existingIndex >= 0) {
    results[existingIndex] = result;
  } else {
    results.push(result);
  }
  writeStorage(STORAGE_KEYS.SKILL_MAPPING, results);

  if (passed) {
    enr.status = "SKILL_MAP_DONE";
    writeStorage(STORAGE_KEYS.ENROLLMENTS, allEnrollments);
  }

  return result;
}

export function submitWrittenTest(
  enrollmentId: string,
  answers: Record<string, string>,
): WrittenTestResult {
  const allEnrollments = getAllEnrollments();
  const enr = allEnrollments.find((e) => e.id === enrollmentId);
  if (!enr) throw new Error("Enrollment not found");

  const course = getCourseById(enr.courseId);
  if (!course) throw new Error("Course not found");

  let correct = 0;
  course.writtenTestQuestions.forEach((q) => {
    if (answers[q.id] === q.correctOptionId) {
      correct++;
    }
  });

  const scorePct = Math.round((correct / course.writtenTestQuestions.length) * 100);
  const passed = scorePct >= course.passThreshold;

  const results = readStorage<WrittenTestResult[]>(
    STORAGE_KEYS.WRITTEN_TESTS,
    initialWrittenTestResults,
  );

  const existingIndex = results.findIndex((r) => r.enrollmentId === enrollmentId);
  const result: WrittenTestResult = {
    id: `wtr-${Date.now()}`,
    enrollmentId,
    scorePct,
    passed,
    takenAt: new Date().toISOString(),
    answers,
  };

  if (existingIndex >= 0) {
    results[existingIndex] = result;
  } else {
    results.push(result);
  }
  writeStorage(STORAGE_KEYS.WRITTEN_TESTS, results);

  updateLniForEnrollment(enrollmentId);
  checkAndTriggerCertification(enrollmentId);
  return result;
}

export function submitPracticalAssessment(
  enrollmentId: string,
  evaluatorId: string,
  evaluatorName: string,
  scores: AbilityScore[],
  generalNotes?: string,
): PracticalTestResult {
  const maxPossible = scores.length * 5;
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const overallPct = Math.round((totalScore / maxPossible) * 1000) / 10;

  const results = readStorage<PracticalTestResult[]>(
    STORAGE_KEYS.PRACTICAL_TESTS,
    initialPracticalTestResults,
  );

  const newResult: PracticalTestResult = {
    id: `ptr-${Date.now()}`,
    enrollmentId,
    evaluatorId,
    evaluatorName,
    scores,
    overallPct,
    conductedAt: new Date().toISOString(),
    signatureVerified: true,
    generalNotes,
  };

  const existingIndex = results.findIndex((r) => r.enrollmentId === enrollmentId);
  if (existingIndex >= 0) {
    results[existingIndex] = newResult;
  } else {
    results.push(newResult);
  }
  writeStorage(STORAGE_KEYS.PRACTICAL_TESTS, results);

  // Update enrollment status
  const allEnrollments = getAllEnrollments();
  const enr = allEnrollments.find((e) => e.id === enrollmentId);
  if (enr && enr.status === "SKILL_MAP_DONE") {
    enr.status = "PRACTICAL_DONE";
    writeStorage(STORAGE_KEYS.ENROLLMENTS, allEnrollments);
  }

  // Generate / update LNI record with AI insights
  updateLniForEnrollment(enrollmentId);
  checkAndTriggerCertification(enrollmentId);

  return newResult;
}

export function submitOralAssessment(
  enrollmentId: string,
  evaluatorId: string,
  evaluatorName: string,
  scores: AbilityScore[],
  interviewNotes?: string,
): OralTestResult {
  const maxPossible = scores.length * 5;
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const overallPct = Math.round((totalScore / maxPossible) * 1000) / 10;

  const results = readStorage<OralTestResult[]>(
    STORAGE_KEYS.ORAL_TESTS,
    initialOralTestResults,
  );

  const newResult: OralTestResult = {
    id: `otr-${Date.now()}`,
    enrollmentId,
    evaluatorId,
    evaluatorName,
    scores,
    overallPct,
    conductedAt: new Date().toISOString(),
    interviewNotes,
    generalNotes: interviewNotes,
  };

  const existingIndex = results.findIndex((r) => r.enrollmentId === enrollmentId);
  if (existingIndex >= 0) {
    results[existingIndex] = newResult;
  } else {
    results.push(newResult);
  }
  writeStorage(STORAGE_KEYS.ORAL_TESTS, results);

  // Update enrollment status
  const allEnrollments = getAllEnrollments();
  const enr = allEnrollments.find((e) => e.id === enrollmentId);
  if (enr && enr.status === "PRACTICAL_DONE") {
    enr.status = "ORAL_DONE";
    writeStorage(STORAGE_KEYS.ENROLLMENTS, allEnrollments);
  }

  // Update LNI and attempt certificate
  updateLniForEnrollment(enrollmentId);
  checkAndTriggerCertification(enrollmentId);

  return newResult;
}

export function getAssessmentResults(enrollmentId: string): {
  skillMap?: SkillMappingResult;
  written?: WrittenTestResult;
  practical?: PracticalTestResult;
  oral?: OralTestResult;
} {
  const smList = readStorage<SkillMappingResult[]>(
    STORAGE_KEYS.SKILL_MAPPING,
    initialSkillMappingResults,
  );
  const wtList = readStorage<WrittenTestResult[]>(
    STORAGE_KEYS.WRITTEN_TESTS,
    initialWrittenTestResults,
  );
  const ptList = readStorage<PracticalTestResult[]>(
    STORAGE_KEYS.PRACTICAL_TESTS,
    initialPracticalTestResults,
  );
  const otList = readStorage<OralTestResult[]>(
    STORAGE_KEYS.ORAL_TESTS,
    initialOralTestResults,
  );

  return {
    skillMap: smList.find((r) => r.enrollmentId === enrollmentId),
    written: wtList.find((r) => r.enrollmentId === enrollmentId),
    practical: ptList.find((r) => r.enrollmentId === enrollmentId),
    oral: otList.find((r) => r.enrollmentId === enrollmentId),
  };
}

export function checkAndTriggerCertification(enrollmentId: string): Certificate | null {
  const results = getAssessmentResults(enrollmentId);
  const allEnrollments = getAllEnrollments();
  const enr = allEnrollments.find((e) => e.id === enrollmentId);
  if (!enr) return null;

  // Rule: Certificate requires all 4 assessments!
  if (
    !results.skillMap?.passed ||
    !results.written?.passed ||
    !results.practical ||
    !results.oral
  ) {
    return null;
  }

  // Weighted calculation:
  // Skill Map: 25%, Written: 25%, Practical: 30%, Oral: 20%
  const overallPct =
    Math.round(
      (results.skillMap.scorePct * 0.25 +
        results.written.scorePct * 0.25 +
        results.practical.overallPct * 0.3 +
        results.oral.overallPct * 0.2) *
        10,
    ) / 10;

  const certificates = readStorage<Certificate[]>(
    STORAGE_KEYS.CERTIFICATES,
    initialCertificates,
  );

  const existingCert = certificates.find((c) => c.enrollmentId === enrollmentId);
  if (existingCert) return existingCert;

  const emp = getEmployeeById(enr.employeeId);
  const course = getCourseById(enr.courseId);

  const randomHash =
    "SHA256-" +
    Math.random().toString(36).substring(2, 8).toUpperCase() +
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const issueDate = new Date();
  const expireDate = new Date(issueDate);
  expireDate.setFullYear(expireDate.getFullYear() + 1); // 1-year validity rule

  const newCert: Certificate = {
    id: `cert-${Date.now()}`,
    certificateNo: `NEIPL-CERT-2026-${String(Math.floor(1000 + Math.random() * 9000))}`,
    enrollmentId,
    employeeId: enr.employeeId,
    employeeName: emp?.name ?? "Nectar Operator",
    courseId: enr.courseId,
    courseTitle: course?.title ?? "Plant Competency Certification",
    overallPct,
    skillMapPct: results.skillMap.scorePct,
    writtenPct: results.written.scorePct,
    practicalPct: results.practical.overallPct,
    oralPct: results.oral.overallPct,
    issuedAt: issueDate.toISOString(),
    expiresAt: expireDate.toISOString(),
    status: "active",
    managerSignatory:
      emp?.siteId === "s-ro"
        ? "Uday Patil (RO Plant Manager)"
        : emp?.siteId === "s-mee"
          ? "Sanjay Waghaskar (MEE Plant Manager)"
          : emp?.siteId === "s-etp"
            ? "Anand Dakave (ETP Plant Manager)"
            : "Prashant Rohidas Adsul (Director)",
    verificationHash: randomHash,
  };

  certificates.push(newCert);
  writeStorage(STORAGE_KEYS.CERTIFICATES, certificates);

  enr.status = "CERTIFIED";
  enr.completedAt = new Date().toISOString();
  writeStorage(STORAGE_KEYS.ENROLLMENTS, allEnrollments);

  return newCert;
}

export function getCertificates(employeeId?: string): Certificate[] {
  const all = readStorage<Certificate[]>(STORAGE_KEYS.CERTIFICATES, initialCertificates);
  if (!employeeId) return all;
  return all.filter((c) => c.employeeId === employeeId);
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
  const exp = new Date(expiresAt).getTime();
  const now = Date.now();
  const days = (exp - now) / 86400000;
  if (days < 0) return "expired";
  if (days <= 60) return "expiring_soon";
  return "valid";
}

export function getAllCertificates(siteId?: string): ViewCertificateItem[] {
  const { employees } = require("@/lib/mock-data");
  const certs = getCertificates();
  return certs
    .map((c) => {
      const emp = (employees as import("@/lib/mock-data").Employee[]).find((e) => e.id === c.employeeId);
      const siteName =
        emp?.siteId === "s-ro"
          ? "RO Plant"
          : emp?.siteId === "s-mee"
            ? "MEE Plant"
            : emp?.siteId === "s-etp"
              ? "ETP Plant"
              : "Corporate HQ";
      const issuedOn = c.issuedAt ? c.issuedAt.slice(0, 10) : "2026-08-01";
      const expiresOn = c.expiresAt ? c.expiresAt.slice(0, 10) : "2027-08-01";
      return {
        id: c.id,
        certificateNo: c.certificateNo,
        enrollmentId: c.enrollmentId,
        employeeId: c.employeeId,
        employeeName: c.employeeName,
        siteName,
        name: c.courseTitle,
        courseTitle: c.courseTitle,
        issuer: c.managerSignatory || "Nectar Enviro Academy",
        issuedOn,
        expiresOn,
        status: getCertificateStatus(c.expiresAt),
        overallPct: c.overallPct,
        managerSignatory: c.managerSignatory,
        verificationHash: c.verificationHash,
        raw: c,
      };
    })
    .filter((c) => {
      if (!siteId) return true;
      const emp = (employees as import("@/lib/mock-data").Employee[]).find((e) => e.id === c.employeeId);
      return emp?.siteId === siteId;
    })
    .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn));
}

export function getCertificatesForEmployee(employeeId: string): ViewCertificateItem[] {
  return getAllCertificates().filter((c) => c.employeeId === employeeId);
}

export function getLearningNeedRecords(employeeId?: string): LearningNeedRecord[] {
  // Sync each active enrollment's LNI so that stale or fabricated mock scores are updated based on authentic completed test records
  const allEnrollments = getAllEnrollments();
  allEnrollments.forEach((e) => {
    updateLniForEnrollment(e.id);
  });

  const all = readStorage<LearningNeedRecord[]>(
    STORAGE_KEYS.LNI_RECORDS,
    initialLearningNeedRecords,
  );
  if (!employeeId) return all;
  return all.filter((r) => r.employeeId === employeeId);
}

// Generates or updates an LNI record based on 4-part assessment scores
function updateLniForEnrollment(enrollmentId: string) {
  const allEnrollments = getAllEnrollments();
  const enr = allEnrollments.find((e) => e.id === enrollmentId);
  if (!enr) return;

  const results = getAssessmentResults(enrollmentId);
  const course = getCourseById(enr.courseId);
  if (!course) return;

  const lniRecords = readStorage<LearningNeedRecord[]>(
    STORAGE_KEYS.LNI_RECORDS,
    initialLearningNeedRecords,
  );

  const skillMapScore = results.skillMap ? results.skillMap.scorePct : null;
  const writtenScore = results.written ? results.written.scorePct : null;
  const practicalScore = results.practical ? results.practical.overallPct : null;
  const oralScore = results.oral ? results.oral.overallPct : null;

  // Determine Level:
  // Cannot be certified HIGH if Written test is not taken/passed!
  let level: "LOW" | "MED" | "HIGH" = "MED";
  if (practicalScore !== null && practicalScore < 60) {
    level = "LOW";
  } else if (writtenScore !== null && writtenScore < 60) {
    level = "LOW";
  } else if (
    writtenScore !== null &&
    practicalScore !== null &&
    practicalScore >= 80 &&
    writtenScore >= 80 &&
    (oralScore ?? 0) >= 70
  ) {
    level = "HIGH";
  } else {
    level = "MED";
  }

  // AI-powered Gap Synthesis insight
  let aiInsight = "";
  if (writtenScore === null) {
    if (practicalScore !== null && practicalScore >= 75) {
      aiInsight = `Hands-on plant execution demonstrated high proficiency (${practicalScore}% in practical evaluation), but Formal Written Theory Exam is NOT YET CONDUCTED. Final qualification and autonomous sign-off pending written test.`;
    } else if (practicalScore !== null && practicalScore < 60) {
      aiInsight = `Practical plant execution shows operational gaps (${practicalScore}%). Written examination has not been taken yet. Remedial field coaching required before theoretical exam.`;
    } else {
      aiInsight = `Field assessment sequence in progress. Written examination has not been conducted yet.`;
    }
  } else if (practicalScore === null) {
    aiInsight = `Written theory exam cleared (${writtenScore}%). Practical field maneuvering evaluation by plant manager is pending.`;
  } else if (writtenScore >= 75 && practicalScore < 65) {
    aiInsight = `Theoretical understanding is strong (${writtenScore}%), but hands-on operational execution shows gap (${practicalScore}%). Candidate struggled with rapid field calibration. Recommend 1-day shadow with senior supervisor.`;
  } else if (practicalScore >= 75 && writtenScore < 65) {
    aiInsight = `Hands-on valve & pump maneuvering is confident (${practicalScore}%), but chemical stoichiometric equations need reinforcement (${writtenScore}%).`;
  } else if (level === "HIGH") {
    aiInsight = `Exemplary dual proficiency across theory (${writtenScore}%) and applied plant operation (${practicalScore}%). Qualified for autonomous shift operation.`;
  } else {
    aiInsight = `Standard operational baseline across written (${writtenScore}%) and field evaluations. Continuing periodic assessment recommended.`;
  }

  const existingIndex = lniRecords.findIndex(
    (r) => r.employeeId === enr.employeeId && r.recommendedCourseId === enr.courseId,
  );

  const rec: LearningNeedRecord = {
    id: `lni-${enr.employeeId}-${course.id}`,
    employeeId: enr.employeeId,
    competencyAreaId: course.abilities[0]?.competencyAreaId ?? "ca-design",
    competencyAreaName: course.title,
    currentLevel: level,
    skillMapScorePct: skillMapScore,
    writtenScorePct: writtenScore,
    practicalScorePct: practicalScore,
    oralScorePct: oralScore,
    trainingRequired: level !== "HIGH" || writtenScore === null,
    aiInsight,
    recommendedCourseId: course.id,
    recommendedCourseTitle: course.title,
    generatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    lniRecords[existingIndex] = rec;
  } else {
    lniRecords.push(rec);
  }
  writeStorage(STORAGE_KEYS.LNI_RECORDS, lniRecords);
}

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
  const allEnrollments = getAllEnrollments();
  let enrollmentsChanged = false;

  const eligible = allEnrollments.filter((e) => {
    if (e.status === "CERTIFIED") return false;
    const course = getCourseById(e.courseId);
    if (!course) return false;
    const emp = getEmployeeById(e.employeeId);
    if (!emp) return false;
    if (siteId && emp.siteId !== siteId) return false;

    // If candidate completed all module videos and quizzes, they are ready for manager evaluation!
    const modulesDone = canTakeSkillMapping(e, course);
    if (modulesDone && e.status === "IN_PROGRESS") {
      e.status = "SKILL_MAP_DONE";
      enrollmentsChanged = true;
    }

    return (
      modulesDone ||
      e.status === "SKILL_MAP_DONE" ||
      e.status === "PRACTICAL_DONE" ||
      e.status === "ORAL_DONE"
    );
  });

  if (enrollmentsChanged) {
    writeStorage(STORAGE_KEYS.ENROLLMENTS, allEnrollments);
  }

  return eligible
    .map((e) => {
      const emp = getEmployeeById(e.employeeId);
      const course = getCourseById(e.courseId);
      const res = getAssessmentResults(e.id);
      if (!emp || !course) return null;

      // Micro-quizzes average score or skill map score
      const abilityList = Object.values(e.abilityProgress);
      const avgQuizScore =
        abilityList.length > 0
          ? Math.round(
              abilityList.reduce((sum, a) => sum + (a.quizScorePct || 100), 0) /
                abilityList.length,
            )
          : 100;

      const siteLabel =
        emp.siteId === "s-etp"
          ? "ETP Plant"
          : emp.siteId === "s-ro"
            ? "RO Plant"
            : emp.siteId === "s-mee"
              ? "MEE Plant"
              : "Cross-Plant";

      return {
        enrollment: e,
        employeeName: emp.name,
        employeeDesignation: emp.designation,
        siteId: emp.siteId,
        siteName: siteLabel,
        course,
        skillMapScore: res.skillMap?.scorePct ?? avgQuizScore,
        writtenScore: res.written?.scorePct,
        hasPractical: Boolean(res.practical),
        hasOral: Boolean(res.oral),
      };
    })
    .filter(Boolean) as any[];
}

export function resetTrainingStore(): void {
  if (typeof window === "undefined") return;
  writeStorage(STORAGE_KEYS.ENROLLMENTS, initialEnrollments);
  writeStorage(STORAGE_KEYS.SKILL_MAPPING, initialSkillMappingResults);
  writeStorage(STORAGE_KEYS.WRITTEN_TESTS, initialWrittenTestResults);
  writeStorage(STORAGE_KEYS.PRACTICAL_TESTS, initialPracticalTestResults);
  writeStorage(STORAGE_KEYS.ORAL_TESTS, initialOralTestResults);
  writeStorage(STORAGE_KEYS.CERTIFICATES, initialCertificates);
  writeStorage(STORAGE_KEYS.LNI_RECORDS, initialLearningNeedRecords);
  writeStorage(STORAGE_KEYS.SESSIONS, initialTrainingSessions);
}

export function getTrainingSessions(employeeId?: string): TrainingSession[] {
  const all = readStorage<TrainingSession[]>(STORAGE_KEYS.SESSIONS, initialTrainingSessions);
  if (!employeeId) return all;
  return all.filter((s) => s.employeeIds.includes(employeeId));
}

export function createTrainingSession(
  session: Omit<TrainingSession, "id" | "status">,
): TrainingSession {
  const all = readStorage<TrainingSession[]>(STORAGE_KEYS.SESSIONS, initialTrainingSessions);
  const newSession: TrainingSession = {
    ...session,
    id: `sess-${Date.now()}`,
    status: "scheduled",
  };
  all.push(newSession);
  writeStorage(STORAGE_KEYS.SESSIONS, all);
  return newSession;
}

export function getRecommendedCourses(): CourseRecommendation[] {
  return mockRecommendations;
}

export function getMentorProfiles(): MentorProfile[] {
  return mockMentors;
}

export function getRoleProgressionTracks(): RoleProgressionTrack[] {
  return mockRoleTracks;
}

export function registerForDropInClinic(
  mentorId: string,
  employeeId: string,
  clinicId: string,
  notes?: string,
): { success: boolean; message: string; session?: TrainingSession } {
  const mentor = mockMentors.find((m) => m.id === mentorId);
  if (!mentor) {
    return { success: false, message: "Mentor not found" };
  }
  const clinic = mentor.publishedClinics.find((c) => c.id === clinicId);
  if (!clinic) {
    return { success: false, message: "Clinic time slot not found" };
  }
  if (clinic.registeredCount >= clinic.capacity) {
    return { success: false, message: "This clinic is already at full capacity" };
  }

  clinic.registeredCount += 1;

  const topicTitle = clinic.topic || mentor.specialty;

  const newSession: TrainingSession = {
    id: `clinic-reg-${Date.now()}`,
    title: `Shift Drop-In: ${topicTitle} with ${mentor.name}`,
    type: "PRACTICAL",
    scheduledBy: employeeId,
    scheduledByName: mentor.name,
    scheduledAt: clinic.dayTime,
    venueOrLink: clinic.location,
    employeeIds: [employeeId],
    courseId: "course-etp-101",
    status: "scheduled",
  };

  const all = readStorage<TrainingSession[]>(STORAGE_KEYS.SESSIONS, initialTrainingSessions);
  all.push(newSession);
  writeStorage(STORAGE_KEYS.SESSIONS, all);

  return {
    success: true,
    message: `Registered for "${topicTitle}" with ${mentor.name} on ${clinic.dayTime} at ${clinic.location}`,
    session: newSession,
  };
}

export function getSpecializationTracks(): SpecializationTrack[] {
  return mockSpecializationTracks;
}

export function getSpecializationTrackById(id: string): SpecializationTrack | undefined {
  return mockSpecializationTracks.find((t) => t.id === id || t.slug === id);
}

// ----------------------------------------------------
// Executive & Plant Lead Masterclasses (Mentor Live Sessions)
// ----------------------------------------------------
export function getLiveMasterclasses(): MentorLiveSession[] {
  return readStorage<MentorLiveSession[]>(
    STORAGE_KEYS.MENTOR_LIVE_SESSIONS,
    initialMentorLiveSessions,
  );
}

export async function enrollInLiveMasterclass(
  sessionId: string,
  employeeId: string,
  employeeName: string,
  question?: string,
  slotId?: string,
  agenda?: string,
): Promise<{ success: boolean; message: string; session?: MentorLiveSession }> {
  const sessions = getLiveMasterclasses();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) {
    return { success: false, message: "1:1 Session not found" };
  }

  if (!session.selectedSlotMap) session.selectedSlotMap = {};
  if (!session.selectedAgendaMap) session.selectedAgendaMap = {};

  if (slotId) session.selectedSlotMap[employeeId] = slotId;
  if (agenda) session.selectedAgendaMap[employeeId] = agenda;

  if (session.enrolledEmployeeIds.includes(employeeId)) {
    if (question?.trim()) {
      session.questions.push({
        id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        employeeId,
        employeeName: employeeName || "Employee",
        question: question.trim(),
        submittedAt: new Date().toISOString(),
      });
    }
    writeStorage(STORAGE_KEYS.MENTOR_LIVE_SESSIONS, sessions);
    return {
      success: true,
      message: `Your 1:1 slot & topic with ${session.mentorName} have been updated!`,
      session,
    };
  }

  if (session.registeredCount >= session.maxCapacity) {
    return {
      success: false,
      message: `This session is fully booked (${session.maxCapacity} seats max).`,
    };
  }

  session.enrolledEmployeeIds.push(employeeId);
  session.registeredCount = session.enrolledEmployeeIds.length;

  if (question?.trim()) {
    session.questions.push({
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      employeeId,
      employeeName: employeeName || "Employee",
      question: question.trim(),
      submittedAt: new Date().toISOString(),
    });
  }

  writeStorage(STORAGE_KEYS.MENTOR_LIVE_SESSIONS, sessions);

  // Sync with MongoDB backend in background
  try {
    const { enrollInLiveSession } = await import("../api/training");
    enrollInLiveSession(sessionId, employeeId, employeeName, question).catch(() => {});
  } catch {}

  return {
    success: true,
    message: `1:1 Session confirmed with ${session.mentorName}! Google Meet link is active.`,
    session,
  };
}

export async function cancelLiveMasterclassEnrollment(
  sessionId: string,
  employeeId: string,
): Promise<{ success: boolean; message: string }> {
  const sessions = getLiveMasterclasses();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) {
    return { success: false, message: "1:1 Session not found" };
  }

  session.enrolledEmployeeIds = session.enrolledEmployeeIds.filter((id) => id !== employeeId);
  session.registeredCount = session.enrolledEmployeeIds.length;
  if (session.selectedSlotMap) delete session.selectedSlotMap[employeeId];
  if (session.selectedAgendaMap) delete session.selectedAgendaMap[employeeId];
  writeStorage(STORAGE_KEYS.MENTOR_LIVE_SESSIONS, sessions);

  // Sync with MongoDB backend in background
  try {
    const { cancelLiveSessionEnrollment } = await import("../api/training");
    cancelLiveSessionEnrollment(sessionId, employeeId).catch(() => {});
  } catch {}

  return {
    success: true,
    message: `1:1 Meeting with ${session.mentorName} has been cancelled.`,
  };
}

export async function submitLiveMasterclassQuestion(
  sessionId: string,
  employeeId: string,
  employeeName: string,
  question: string,
): Promise<{ success: boolean; message: string }> {
  const sessions = getLiveMasterclasses();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) {
    return { success: false, message: "Masterclass not found" };
  }

  session.questions.push({
    id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    employeeId,
    employeeName: employeeName || "Employee",
    question: question.trim(),
    submittedAt: new Date().toISOString(),
  });

  writeStorage(STORAGE_KEYS.MENTOR_LIVE_SESSIONS, sessions);

  // Sync with MongoDB backend in background
  try {
    const { submitSessionQuestion } = await import("../api/training");
    submitSessionQuestion(sessionId, employeeId, employeeName, question).catch(() => {});
  } catch {}

  return {
    success: true,
    message: `Your question has been submitted to ${session.mentorName}!`,
  };
}

// ----------------------------------------------------
// Live NestJS Backend Synchronization
// ----------------------------------------------------
export async function syncTrainingWithApi(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const {
      getCourses,
      getCertificates,
      getSessions,
      getMentorLiveSessions,
    } = await import("../api/training");
    const [courses, certs, sessions, mentorSessions] = await Promise.all([
      getCourses().catch(() => []),
      getCertificates().catch(() => []),
      getSessions().catch(() => []),
      getMentorLiveSessions().catch(() => []),
    ]);

    if (certs && certs.length) {
      writeStorage(STORAGE_KEYS.CERTIFICATES, certs);
    }
    if (sessions && sessions.length) {
      writeStorage(STORAGE_KEYS.SESSIONS, sessions);
    }
    if (mentorSessions && mentorSessions.length) {
      writeStorage(STORAGE_KEYS.MENTOR_LIVE_SESSIONS, mentorSessions);
    }
  } catch {
    // Graceful offline fallback
  }
}

// ----------------------------------------------------
// Training Items View (Derived directly from live enrollments & courses)
// ----------------------------------------------------
export function getTrainingItems(opts?: {
  employeeId?: string;
  siteEmployeeIds?: string[];
}): import("@/lib/mock-data").TrainingItem[] {
  const enrollments = getAllEnrollments();
  const courses = getAllCourses();
  const { employees } = require("@/lib/mock-data");

  return enrollments
    .filter((enr) => {
      if (opts?.employeeId && enr.employeeId !== opts.employeeId) return false;
      if (opts?.siteEmployeeIds && !opts.siteEmployeeIds.includes(enr.employeeId)) return false;
      return true;
    })
    .map((enr) => {
      const course = courses.find((c) => c.id === enr.courseId);
      const emp = (employees as import("@/lib/mock-data").Employee[]).find((e) => e.id === enr.employeeId);
      const isCertified = enr.status === "CERTIFIED";
      const siteName =
        emp?.siteId === "s-ro"
          ? "RO Plant"
          : emp?.siteId === "s-mee"
            ? "MEE Plant"
            : emp?.siteId === "s-etp"
              ? "ETP Plant"
              : "Corporate HQ";

      const abilityList = Object.values(enr.abilityProgress || {});
      const abilitiesCompleted = abilityList.filter((a) => a.videoComplete && a.quizPassed).length;
      const totalAbilities = course?.abilities?.length || abilityList.length || 1;
      const progressPct = isCertified
        ? 100
        : Math.round((abilitiesCompleted / totalAbilities) * 100);

      const res = getAssessmentResults(enr.id);
      const score = res.oral?.overallPct ?? res.practical?.overallPct ?? res.written?.scorePct ?? (isCertified ? 92 : undefined);

      const isHighPriority = course?.section?.includes("ETP") || course?.section?.includes("ZLD");

      return {
        id: enr.id,
        employeeId: enr.employeeId,
        employeeName: emp?.name ?? "Operator",
        siteName,
        course: course?.title ?? "Industrial Plant Operations",
        priority: (isHighPriority ? "high" : "medium") as import("@/lib/mock-data").TrainingPriority,
        dueDate: enr.completedAt ? enr.completedAt.slice(0, 10) : "2026-10-15",
        completedAt: enr.completedAt?.slice(0, 10),
        status: (isCertified ? "completed" : progressPct > 0 ? "due-soon" : "scheduled") as import("@/lib/mock-data").TrainingItem["status"],
        score,
      };
    });
}

export function getUrgentTrainingItems(siteId?: string): import("@/lib/mock-data").TrainingItem[] {
  const { employees } = require("@/lib/mock-data");
  return getTrainingItems()
    .filter((t) => t.status === "overdue" || t.status === "due-soon")
    .filter((t) => {
      if (!siteId) return true;
      const emp = (employees as import("@/lib/mock-data").Employee[]).find((e) => e.id === t.employeeId);
      return emp?.siteId === siteId;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
