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
} from "./mock-data";
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
} from "./types";
import { getEmployeeById } from "@/lib/mock-data";

const STORAGE_KEYS = {
  ENROLLMENTS: "neipl_training_enrollments_v1",
  SKILL_MAPPING: "neipl_training_skill_mapping_v1",
  WRITTEN_TESTS: "neipl_training_written_tests_v1",
  PRACTICAL_TESTS: "neipl_training_practical_tests_v1",
  ORAL_TESTS: "neipl_training_oral_tests_v1",
  CERTIFICATES: "neipl_training_certificates_v1",
  LNI_RECORDS: "neipl_training_lni_records_v1",
  SESSIONS: "neipl_training_sessions_v1",
};

function readStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Error writing to localStorage", err);
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
  "PPE & Site Induction": "course-safety-101",
  "Confined Space Entry": "course-confined-space",
  "Hazardous Waste Handling": "course-haz-waste",
  "First Aid Refresh": "course-safety-101",
  "Factory Safety Audit & Statutory Compliance": "course-safety-101",
  "Environmental Risk Assessment & Crisis Management": "course-etp-101",
  "STP Operation & Biological Nutrient Removal": "course-stp-101",
  "WTP Clarification, Filtration & Disinfection": "course-wtp-101",
  "Zero Liquid Discharge (ZLD) Thermal & Evaporator Operations": "course-zld-101",
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
    issuedAt: new Date().toISOString(),
    managerSignatory: "Rajesh Kulkarni (Head of Treatment Plants)",
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

export function getPendingEvaluations(): {
  enrollment: CourseEnrollment;
  employeeName: string;
  employeeDesignation: string;
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

      return {
        enrollment: e,
        employeeName: emp.name,
        employeeDesignation: emp.designation,
        siteName: emp.siteId,
        course,
        skillMapScore: res.skillMap?.scorePct ?? avgQuizScore,
        writtenScore: res.written?.scorePct,
        hasPractical: Boolean(res.practical),
        hasOral: Boolean(res.oral),
      };
    })
    .filter(Boolean) as any[];
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

