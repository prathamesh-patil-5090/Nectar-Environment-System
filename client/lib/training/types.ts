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

/** Manager assignment (mandatory) or weak-area flag (suggested). */
export interface TrainingAssignment {
  id: string;
  employeeId: string;
  assignedByEmployeeId: string;
  assignedByName: string;
  courseId?: string;
  moduleId?: string;
  reason: string;
  priority: "critical" | "high" | "normal";
  /** "assigned" / "completed" are legacy values */
  status: "open" | "in_progress" | "resolved" | "dismissed" | "assigned" | "completed";
  dueDate?: string;
  kind?: "mandatory" | "suggested";
  topic?: string;
  skills?: string[];
  abilityIds?: string[];
  source?: "manager" | "lni" | "evaluation" | "role_path";
  resolvedAt?: string;
  resolvedBy?: string;
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
  skills?: string[];
  prerequisites?: string[];
  audience?: { roles?: string[]; designations?: string[]; plantTypes?: string[] };
  type?: "course" | "micro" | "specialization";
  /** Most 12, some 6 */
  certificateValidityMonths?: number;
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
  /** The 4 gates, stored with the enrollment in the database */
  assessments?: {
    skillMap?: SkillMappingResult;
    written?: WrittenTestResult;
    practical?: PracticalTestResult;
    oral?: OralTestResult;
  };
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

// ---------------------------------------------------------------------------
// Database-backed training: people, events (Meetup model), feed, notifications
// ---------------------------------------------------------------------------

/** Employee or leader (e.g. the Director) as the training API returns them. */
export interface Person {
  id: string;
  name: string;
  designation?: string;
  siteId?: string;
  siteName?: string;
  plantType?: string;
  role: string;
  photoUrl?: string;
  managerId?: string;
  isLeader?: boolean;
}

export type EventFormat = "online" | "in_person";
export type EventStatus = "draft" | "published" | "cancelled" | "completed";
export type RsvpStatus = "going" | "waitlist" | "cancelled" | "attended" | "no_show";

export interface TrainingEvent {
  id: string;
  seriesId?: string;
  communityId?: string;
  type: "masterclass" | "seminar" | "workshop" | "clinic";
  title: string;
  description: string;
  agenda: { time: string; item: string }[];
  topics: string[];
  audience: { roles?: string[]; plantTypes?: string[] };
  coverUrl?: string;
  /** The manager who assigned this session to their site (the host runs it) */
  assignedBy?: { id: string; name: string };
  hostEmployeeIds: string[];
  startsAt: string;
  endsAt: string;
  format: EventFormat;
  /** Only present for hosts and attendees */
  meetLink?: string;
  venue?: { siteId: string; room?: string };
  capacity: number;
  waitlistEnabled: boolean;
  rsvpOpensAt?: string;
  rsvpClosesAt?: string;
  rsvpQuestion?: string;
  status: EventStatus;
  cancelReason?: string;
  recordingUrl?: string;
  // Computed by the server
  hosts: Person[];
  /** First few people going — only sent to hosts and registered viewers */
  attendeePreview?: Person[];
  community?: { id: string; name: string; slug: string };
  goingCount: number;
  waitlistCount: number;
  spotsLeft: number;
  isHost: boolean;
  myRsvp?: { id: string; status: RsvpStatus; answer?: string; waitlistPosition?: number };
}

export interface EventAttendee {
  id?: string;
  status?: RsvpStatus;
  answer?: string;
  rsvpAt?: string;
  employee: Person;
}

export interface EventPost {
  id: string;
  eventId: string;
  authorEmployeeId: string;
  text: string;
  kind: "question" | "comment" | "announcement";
  parentId?: string;
  pinned: boolean;
  createdAt: string;
  author?: Person;
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  domain?: string;
  coverUrl?: string;
  organizerEmployeeIds: string[];
  organizers: Person[];
  memberCount: number;
  isMember: boolean;
  /** Default community: everyone is a member and nobody can leave */
  everyone?: boolean;
}

export interface MentorProfileRecord {
  id: string;
  employeeId: string;
  name: string;
  title?: string;
  department?: string;
  bio?: string;
  photoUrl?: string;
  specialties: string[];
  active: boolean;
}

/** Course fields for cards (no question banks). */
export interface CourseCardData {
  id: string;
  code: string;
  title: string;
  description: string;
  section: string;
  thumbnailUrl?: string;
  provider?: string;
  rating?: number;
  reviewCount?: number;
  level?: string;
  estimatedHours?: number;
  skills: string[];
  abilityCount: number;
  moduleCount: number;
  certificateValidityMonths: number;
  type: string;
}

export interface CatalogItem extends CourseCardData {
  abilityTitles: string[];
  plantType?: string;
  myStatus?: EnrollmentStatus;
  myProgressPct?: number;
}

export interface Recommendation {
  course: CourseCardData;
  score: number;
  reasons: string[];
  reason: string;
  suggestedBy?: string;
}

export interface EnrollmentSummary {
  id: string;
  status: EnrollmentStatus;
  done: number;
  total: number;
  pct: number;
}

export interface TrainingFeed {
  me: Person;
  stats: { assigned: number; inProgress: number; certified: number };
  /** Open weak-area flags from the manager (always shown, even with no matching course) */
  suggestions: { assignment: TrainingAssignment; course?: CourseCardData; matches: CourseCardData[] }[];
  assigned: { assignment: TrainingAssignment; course: CourseCardData; enrollment?: EnrollmentSummary; overdue: boolean }[];
  continueLearning: { course: CourseCardData; enrollment: EnrollmentSummary }[];
  /** Safety courses with this person's status; compulsory for employee, site manager, shift in-charge, manager and safety in-charge */
  safety: {
    compulsory: boolean;
    done: number;
    courses: {
      course: CourseCardData;
      status: "certified" | "in_progress" | "not_started";
      enrollment?: EnrollmentSummary;
      certExpiresAt?: string;
    }[];
  };
  recommended: Recommendation[];
  requiredPaths: {
    id: string;
    title: string;
    steps: { courseId: string; mandatory: boolean; order: number; course: CourseCardData; certified: boolean }[];
  }[];
  upcomingEvents: TrainingEvent[];
  popularAtSite: { course: CourseCardData; learners: number }[];
}

export interface PendingEvaluation {
  enrollment: CourseEnrollment;
  employee?: Person;
  course?: Course;
  needs: "practical" | "oral";
}

export interface ServerNotification {
  id: string;
  employeeId: string;
  kind: string;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  meta?: Record<string, string>;
  createdAt: string;
}

export interface RolePath {
  id: string;
  role: string;
  designation?: string;
  plantType?: string;
  title: string;
  steps: { courseId: string; mandatory: boolean; order: number }[];
  renewEveryMonths?: number;
}
