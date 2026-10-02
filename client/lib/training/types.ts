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

export interface SessionDoubt {
  id: string;
  employeeId: string;
  employeeName: string;
  question: string;
  submittedAt: string;
}

export interface MeetingSlot {
  id: string;
  timeRange: string;
  dayLabel: string;
  dateStr: string;
  isBooked?: boolean;
}

export interface MentorLiveSession {
  id: string;
  mentorName: string;
  mentorRole: string;
  mentorDepartment: string;
  isFounder: boolean;
  badgeText: string;
  photoDataUrl: string;
  mentorRating: number;
  topic: string;
  description: string;
  scheduledAt: string;
  durationMinutes: number;
  maxCapacity: number; // 30 - 35 max slots
  registeredCount: number;
  enrolledEmployeeIds: string[];
  questions: SessionDoubt[];
  meetingPlatform: "google_meet" | string;
  platformStatus: "coming_soon" | "live" | "completed" | string;
  meetingLink?: string;
  slots?: MeetingSlot[];
  selectedSlotMap?: Record<string, string>; // employeeId -> slotId
  selectedAgendaMap?: Record<string, string>; // employeeId -> agenda
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
  isAssignedByManager?: boolean;
  assignedByName?: string;
  directiveReason?: string;
  priority?: "critical" | "high" | "normal";
  dueDate?: string;
  moduleCount?: number;
  videoCount?: number;
}

export interface TrainingAssignment {
  id: string;
  employeeId: string;
  assignedByEmployeeId: string;
  assignedByName: string;
  courseId: string;
  moduleId?: string;
  reason: string;
  priority: "critical" | "high" | "normal";
  status: "assigned" | "in_progress" | "completed";
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseVideo {
  id?: string;
  videoId: string;
  order: number;
  title: string;
  durationMinutes: number;
  videoUrl?: string;
  videoPosterUrl?: string;
  description?: string;
}

export interface CourseModule {
  id?: string;
  moduleId: string;
  order: number;
  title: string;
  description?: string;
  videos: CourseVideo[];
}

export type CompetencyLevel = "LOW" | "MED" | "HIGH";

export type SessionType =
  | "ONLINE_VIDEO"
  | "PRACTICAL"
  | "ORAL"
  | "classroom"
  | "on_site";

export type EnrollmentStatus =
  | "IN_PROGRESS"
  | "SKILL_MAP_DONE"
  | "PRACTICAL_DONE"
  | "ORAL_DONE"
  | "CERTIFIED";

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
  courseId?: string;
  title: string;
  code: string; // e.g. "ETP-101"
  section: PlantSection;
  department?: string;
  category?: string;
  jobCategoryId: string;
  description: string;
  thumbnailUrl: string;
  provider?: string;
  rating?: number;
  reviewCount?: number;
  level?: "Foundation" | "Intermediate" | "Advanced" | string;
  estimatedHours: number;
  passThreshold: number; // e.g. 70%
  modules?: CourseModule[];
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
  expiresAt?: string; // 1-year certificate validation rule (expires 12 months after issuedAt)
  status?: "active" | "expired" | "expiring_soon";
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
