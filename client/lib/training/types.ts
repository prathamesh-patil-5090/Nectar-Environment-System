export type PlantSection =
  | "Effluent Treatment Plants (ETP)"
  | "Sewage Treatment Plants (STP)"
  | "Water Treatment Plants (WTP)"
  | "Zero Liquid Discharge (ZLD)"
  | "Environmental Consulting Services"
  | "Operation and Maintenance (O&M)"
  | "Plant Operations & Core Knowledge"
  | "Safety & Site Compliance";

export interface ClinicTimeSlot {
  id: string;
  topic?: string;
  dayTime: string;
  location: string;
  capacity: number;
  registeredCount: number;
}

export interface MentorProfile {
  id: string;
  name: string;
  role: string;
  department: string;
  photoUrl: string;
  specialty: string;
  nextSlot: string;
  rating: number;
  sessionCount: number;
  availableDays: string[];
  publishedClinics: ClinicTimeSlot[];
}

export interface CourseRecommendation {
  id: string;
  courseId: string;
  title: string;
  code: string;
  category: string;
  provider: string;
  thumbnailUrl: string;
  rating: number;
  reviewCount: number;
  level: "Foundation" | "Intermediate" | "Advanced";
  durationHours: number;
  matchScorePct: number;
  badge: string;
  badgeColor: string;
}

export interface RoleCredential {
  id: string;
  title: string;
  issuer: string;
  issuerLogoText: string;
  issuerBg: string;
  issuerColor: string;
}

export interface RoleProgressionTrack {
  id: string;
  roleTitle: string;
  description: string;
  medianSalary: string;
  openPositions: number;
  avatarUrl: string;
  credentials: RoleCredential[];
}

export type CompetencyLevel = "LOW" | "MED" | "HIGH";

export type SessionType = "ONLINE_VIDEO" | "PRACTICAL" | "ORAL";

export type EnrollmentStatus =
  | "IN_PROGRESS"
  | "SKILL_MAP_DONE"
  | "PRACTICAL_DONE"
  | "ORAL_DONE"
  | "CERTIFIED";

export interface JobCategory {
  id: string;
  name: string;
  description: string;
}

export interface CompetencyArea {
  id: string;
  jobCategoryId: string;
  name: string;
  weightPct: number;
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation?: string;
}

export interface MicroQuiz {
  id: string;
  abilityId: string;
  passThreshold: number; // e.g. 70%
  questions: QuizQuestion[];
}

export interface Ability {
  id: string;
  courseId: string;
  order: number; // 1, 2, 3... sequence order
  title: string;
  code: string; // "1.1", "1.2"
  description: string;
  videoDurationMinutes: number;
  videoPosterUrl?: string;
  readingContent?: string;
  competencyAreaId: string;
  microQuiz: MicroQuiz;
}

export interface Course {
  id: string;
  title: string;
  code: string; // e.g. "ETP-101"
  section: PlantSection;
  jobCategoryId: string;
  description: string;
  thumbnailUrl: string;
  estimatedHours: number;
  passThreshold: number; // e.g. 70%
  abilities: Ability[];
  skillMappingQuestions: QuizQuestion[];
  writtenTestQuestions: QuizQuestion[];
}

export interface AbilityProgress {
  abilityId: string;
  videoWatchedPct: number; // >= 90 required to unlock microquiz
  videoComplete: boolean;
  readingAcknowledged: boolean;
  quizAttempts: number;
  quizPassed: boolean;
  quizScorePct?: number;
  unlockedAt: string;
  completedAt?: string;
}

export interface CourseEnrollment {
  id: string;
  employeeId: string;
  courseId: string;
  status: EnrollmentStatus;
  startedAt: string;
  completedAt?: string;
  abilityProgress: Record<string, AbilityProgress>; // abilityId -> AbilityProgress
}

export interface SkillMappingResult {
  id: string;
  enrollmentId: string;
  scorePct: number;
  passed: boolean;
  takenAt: string;
  answers: Record<string, string>;
}

export interface WrittenTestResult {
  id: string;
  enrollmentId: string;
  scorePct: number;
  passed: boolean;
  takenAt: string;
  answers: Record<string, string>;
}

export interface AbilityScore {
  abilityId: string;
  abilityTitle: string;
  score: number; // 1 to 7 scale
  remark: string;
}

export interface PracticalTestResult {
  id: string;
  enrollmentId: string;
  evaluatorId: string;
  evaluatorName: string;
  scores: AbilityScore[];
  overallPct: number; // (sum / maxPossible) * 100
  conductedAt: string;
  signatureVerified: boolean;
  generalNotes?: string;
}

export interface OralTestResult {
  id: string;
  enrollmentId: string;
  evaluatorId: string;
  evaluatorName: string;
  scores: AbilityScore[];
  overallPct: number;
  conductedAt: string;
  interviewNotes?: string;
  generalNotes?: string;
}

export interface Certificate {
  id: string;
  certificateNo: string; // "NEIPL-CERT-2026-0842"
  enrollmentId: string;
  employeeId: string;
  employeeName: string;
  courseId: string;
  courseTitle: string;
  overallPct: number;
  skillMapPct: number;
  writtenPct: number;
  practicalPct: number;
  oralPct: number;
  issuedAt: string;
  managerSignatory: string;
  verificationHash: string;
}

export interface LearningNeedRecord {
  id: string;
  employeeId: string;
  competencyAreaId: string;
  competencyAreaName: string;
  currentLevel: CompetencyLevel;
  skillMapScorePct: number | null;
  writtenScorePct: number | null;
  practicalScorePct: number | null;
  oralScorePct: number | null;
  trainingRequired: boolean;
  aiInsight: string;
  recommendedCourseId?: string;
  recommendedCourseTitle?: string;
  generatedAt: string;
}

export interface TrainingSession {
  id: string;
  title: string;
  type: SessionType;
  scheduledBy: string;
  scheduledByName: string;
  scheduledAt: string;
  venueOrLink: string;
  employeeIds: string[];
  courseId?: string;
  status: "scheduled" | "completed" | "cancelled";
}

export interface SpecializationTrack {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  heroBadge: string;
  category: PlantSection;
  provider: string;
  partnerLogoText: string;
  partnerLogoBg: string;
  rating: number;
  reviewCount: number;
  enrolledCount: number;
  durationWeeks: number;
  hoursPerWeek: number;
  level: "Foundation" | "Intermediate" | "Advanced";
  language: string;
  whatYouWillLearn: {
    title: string;
    description: string;
  }[];
  skillsGained: string[];
  courseIds: string[];
  appliedLearningProject: {
    title: string;
    facilityType: string;
    description: string;
    keyDeliverables: string[];
  };
  leadMentorId: string;
  bannerImage: string;
  recommendedTrackIds: string[];
}
