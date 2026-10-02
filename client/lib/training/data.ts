import type {
  Course,
  CourseEnrollment,
  PracticalTestResult,
  OralTestResult,
  SkillMappingResult,
  WrittenTestResult,
  Certificate,
  LearningNeedRecord,
  TrainingSession,
  MentorProfile,
  SpecializationTrack,
  MentorLiveSession,
} from "./types";

// ============================================================================
// 2. Canonical Plant Courses (Synchronized with MongoDB Atlas `courses`)
// ============================================================================

import { coursesCatalog } from "./courses-data";

export const mockCourses: Course[] = coursesCatalog;

// ============================================================================
// 3. Active Student Enrollments (Synchronized with MongoDB Atlas `training_records`)
// ============================================================================

export const initialEnrollments: CourseEnrollment[] = [
  {
    id: "enr-etp-shilpa-cert",
    employeeId: "emp0126",
    courseId: "course-ops-301",
    status: "CERTIFIED",
    startedAt: "2026-08-01T09:00:00Z",
    completedAt: "2026-08-25T16:00:00Z",
    abilityProgress: {
      "ab-3-1": {
        abilityId: "ab-3-1",
        videoWatchedPct: 100,
        videoComplete: true,
        readingAcknowledged: true,
        quizAttempts: 1,
        quizPassed: true,
        quizScorePct: 95,
        unlockedAt: "2026-08-01T09:00:00Z",
        completedAt: "2026-08-20T16:00:00Z",
      },
    },
  },
  {
    id: "enr-etp-mohee-prog",
    employeeId: "emp0128",
    courseId: "course-etp-101",
    status: "SKILL_MAP_DONE",
    startedAt: "2026-09-01T10:00:00Z",
    abilityProgress: {
      "ab-1-1": {
        abilityId: "ab-1-1",
        videoWatchedPct: 100,
        videoComplete: true,
        readingAcknowledged: true,
        quizAttempts: 1,
        quizPassed: true,
        quizScorePct: 90,
        unlockedAt: "2026-09-01T10:00:00Z",
        completedAt: "2026-09-10T16:00:00Z",
      },
      "ab-1-2": {
        abilityId: "ab-1-2",
        videoWatchedPct: 80,
        videoComplete: false,
        readingAcknowledged: false,
        quizAttempts: 0,
        quizPassed: false,
        unlockedAt: "2026-09-11T09:00:00Z",
      },
    },
  },
  {
    id: "enr-ro-siddhant-prog",
    employeeId: "emp0135",
    courseId: "course-ops-301",
    status: "IN_PROGRESS",
    startedAt: "2026-09-10T09:00:00Z",
    abilityProgress: {
      "ab-3-1": {
        abilityId: "ab-3-1",
        videoWatchedPct: 95,
        videoComplete: true,
        readingAcknowledged: true,
        quizAttempts: 1,
        quizPassed: true,
        quizScorePct: 92,
        unlockedAt: "2026-09-10T09:00:00Z",
      },
    },
  },
  {
    id: "enr-mee-bhairavi-cert",
    employeeId: "emp0143",
    courseId: "course-zld-302",
    status: "CERTIFIED",
    startedAt: "2026-07-01T09:00:00Z",
    completedAt: "2026-07-26T16:00:00Z",
    abilityProgress: {
      "ab-4-1": {
        abilityId: "ab-4-1",
        videoWatchedPct: 100,
        videoComplete: true,
        readingAcknowledged: true,
        quizAttempts: 1,
        quizPassed: true,
        quizScorePct: 94,
        unlockedAt: "2026-07-01T09:00:00Z",
        completedAt: "2026-07-22T16:00:00Z",
      },
    },
  },
];

// ============================================================================
// 4. Assessment Results (Synchronized with MongoDB Atlas `training_records`)
// ============================================================================

export const initialSkillMappingResults: SkillMappingResult[] = [
  {
    id: "sm-etp-shilpa",
    enrollmentId: "enr-etp-shilpa-cert",
    scorePct: 92,
    passed: true,
    takenAt: "2026-08-02T11:00:00Z",
    answers: { "smq-ro-1": "opt-a" },
  },
  {
    id: "sm-etp-mohee",
    enrollmentId: "enr-etp-mohee-prog",
    scorePct: 90,
    passed: true,
    takenAt: "2026-09-02T11:00:00Z",
    answers: { "smq-etp-1": "opt-a" },
  },
  {
    id: "sm-mee-bhairavi",
    enrollmentId: "enr-mee-bhairavi-cert",
    scorePct: 90,
    passed: true,
    takenAt: "2026-07-02T11:00:00Z",
    answers: { "smq-zld-1": "opt-a" },
  },
];

export const initialWrittenTestResults: WrittenTestResult[] = [
  {
    id: "wt-etp-shilpa",
    enrollmentId: "enr-etp-shilpa-cert",
    scorePct: 95,
    passed: true,
    takenAt: "2026-08-20T14:00:00Z",
    answers: { "wtq-ro-1": "opt-a" },
  },
  {
    id: "wt-mee-bhairavi",
    enrollmentId: "enr-mee-bhairavi-cert",
    scorePct: 92,
    passed: true,
    takenAt: "2026-07-20T14:00:00Z",
    answers: { "wtq-zld-1": "opt-a" },
  },
];

export const initialPracticalTestResults: PracticalTestResult[] = [
  {
    id: "pt-etp-shilpa",
    enrollmentId: "enr-etp-shilpa-cert",
    evaluatorId: "emp0130",
    evaluatorName: "Uday Patil (RO Plant Manager)",
    scores: [{ abilityId: "ab-3-1", abilityTitle: "RO Normalization & CIP", score: 7, remark: "Flawless normalization calculation & CIP safety valve staging." }],
    overallPct: 94,
    conductedAt: "2026-08-23T15:30:00Z",
    signatureVerified: true,
    generalNotes: "Operator exhibits exceptional adherence to safety protocols and high-pressure system checks.",
  },
  {
    id: "pt-mee-bhairavi",
    enrollmentId: "enr-mee-bhairavi-cert",
    evaluatorId: "emp0137",
    evaluatorName: "Sanjay Waghaskar (MEE Plant Manager)",
    scores: [{ abilityId: "ab-4-1", abilityTitle: "MEE Steam Economy & Vacuum", score: 7, remark: "Accurate steam cascade regulation and vacuum level maintenance." }],
    overallPct: 94,
    conductedAt: "2026-07-24T15:30:00Z",
    signatureVerified: true,
    generalNotes: "Solid operational handling of high-temperature evaporator components.",
  },
];

export const initialOralTestResults: OralTestResult[] = [
  {
    id: "ot-etp-shilpa",
    enrollmentId: "enr-etp-shilpa-cert",
    evaluatorId: "emp0130",
    evaluatorName: "Uday Patil (RO Plant Manager)",
    scores: [{ abilityId: "ab-3-1", abilityTitle: "Oral Viva: Membrane Troubleshooting", score: 7, remark: "Correctly diagnosed biofouling vs scale symptoms." }],
    overallPct: 95,
    conductedAt: "2026-08-25T11:00:00Z",
    interviewNotes: "Excellent comprehension of differential pressure trends and clean-in-place chemical selection.",
  },
  {
    id: "ot-mee-bhairavi",
    enrollmentId: "enr-mee-bhairavi-cert",
    evaluatorId: "emp0137",
    evaluatorName: "Sanjay Waghaskar (MEE Plant Manager)",
    scores: [{ abilityId: "ab-4-1", abilityTitle: "Oral Viva: ATFD Maintenance", score: 6, remark: "Strong answers on vacuum integrity and thermal balance." }],
    overallPct: 92,
    conductedAt: "2026-07-26T11:00:00Z",
    interviewNotes: "Confident technical responses regarding tube scaling mitigation and salt cake removal.",
  },
];

// ============================================================================
// 5. Digital Certificates (1-Year Validity Enforced — MongoDB Atlas `certificates`)
// ============================================================================

export const initialCertificates: Certificate[] = [
  {
    id: "cert-shilpa-ro",
    certificateNo: "NEIPL-WTP-RO-2026-0042",
    enrollmentId: "enr-etp-shilpa-cert",
    employeeId: "emp0126",
    employeeName: "Shilpa Hotkar",
    courseId: "course-ops-301",
    courseTitle: "Industrial RO Membrane Operations & CIP Descaling",
    overallPct: 94,
    skillMapPct: 92,
    writtenPct: 95,
    practicalPct: 94,
    oralPct: 95,
    issuedAt: "2026-08-25T16:00:00Z",
    expiresAt: "2027-08-25T16:00:00Z", // Exactly 1-year validity rule
    status: "active",
    managerSignatory: "Uday Patil (RO Plant Manager)",
    verificationHash: "SHA256-8F9D0C2E4A1B6D5E7C8A9F0B1C2D3E4F",
  },
  {
    id: "cert-bhairavi-atfd",
    certificateNo: "NEIPL-ZLD-ATFD-2026-0204",
    enrollmentId: "enr-mee-bhairavi-cert",
    employeeId: "emp0143",
    employeeName: "Bhairavi Kadu",
    courseId: "course-zld-302",
    courseTitle: "Thermal Evaporation Systems: MEE & ATFD Operation",
    overallPct: 92,
    skillMapPct: 90,
    writtenPct: 92,
    practicalPct: 94,
    oralPct: 92,
    issuedAt: "2026-07-26T16:00:00Z",
    expiresAt: "2027-07-26T16:00:00Z", // Exactly 1-year validity rule
    status: "active",
    managerSignatory: "Sanjay Waghaskar (MEE Plant Manager)",
    verificationHash: "SHA256-7C8D9E0F1A2B3C4D5E6F7A8B9C0D1E2F",
  },
  {
    id: "cert-anand-mgr",
    certificateNo: "CPCB-IND-MGR-2026-9941",
    enrollmentId: "enr-anand-mgr-cert",
    employeeId: "emp0123",
    employeeName: "Anand Dakave",
    courseId: "course-etp-101",
    courseTitle: "Plant Operations & Safety Management",
    overallPct: 98,
    skillMapPct: 96,
    writtenPct: 98,
    practicalPct: 100,
    oralPct: 98,
    issuedAt: "2026-03-10T10:00:00Z",
    expiresAt: "2027-03-10T10:00:00Z", // Exactly 1-year validity rule
    status: "active",
    managerSignatory: "Prashant Rohidas Adsul (Director)",
    verificationHash: "SHA256-CPCB9941MGRADM01",
  },
  {
    id: "cert-uday-lead",
    certificateNo: "BV-ISO-14001-2026-4420",
    enrollmentId: "enr-uday-lead-cert",
    employeeId: "emp0130",
    employeeName: "Uday Patil",
    courseId: "course-ops-301",
    courseTitle: "ISO 14001:2015 Environmental Lead Auditor",
    overallPct: 95,
    skillMapPct: 94,
    writtenPct: 96,
    practicalPct: 95,
    oralPct: 96,
    issuedAt: "2026-07-15T11:00:00Z",
    expiresAt: "2027-07-15T11:00:00Z", // Exactly 1-year validity rule
    status: "active",
    managerSignatory: "Prashant Rohidas Adsul (Director)",
    verificationHash: "SHA256-BVISO14001UDAYRO",
  },
  {
    id: "cert-sanjay-effluent",
    certificateNo: "MPCB-ETP-DIR-2026-1120",
    enrollmentId: "enr-sanjay-effluent-cert",
    employeeId: "emp0137",
    employeeName: "Sanjay Waghaskar",
    courseId: "course-zld-302",
    courseTitle: "Hazardous Industrial Effluent Compliance",
    overallPct: 94,
    skillMapPct: 92,
    writtenPct: 95,
    practicalPct: 94,
    oralPct: 95,
    issuedAt: "2026-01-10T09:00:00Z",
    expiresAt: "2027-01-10T09:00:00Z", // Exactly 1-year validity rule
    status: "active",
    managerSignatory: "Prashant Rohidas Adsul (Director)",
    verificationHash: "SHA256-MPCB1120SANJAYMEE",
  },
];

// ============================================================================
// 6. Learning Needs & Training Sessions (Derived Competency Models)
// ============================================================================

export const initialLearningNeedRecords: LearningNeedRecord[] = [
  {
    id: "lni-shilpa-1",
    employeeId: "emp0126",
    competencyAreaId: "ca-wtp-ro",
    competencyAreaName: "RO Membrane Descaling & CIP Flushing",
    currentLevel: "HIGH",
    skillMapScorePct: 92,
    writtenScorePct: 95,
    practicalScorePct: 94,
    oralScorePct: 95,
    trainingRequired: false,
    aiInsight: "Excellent understanding of normalization formulas and CIP staging. Cleared for lead shift operator.",
    generatedAt: "2026-08-25T16:00:00Z",
  },
  {
    id: "lni-mohee-1",
    employeeId: "emp0128",
    competencyAreaId: "ca-etp-chem",
    competencyAreaName: "Physico-Chemical Coagulation & pH Neutralization",
    currentLevel: "MED",
    skillMapScorePct: 90,
    writtenScorePct: null,
    practicalScorePct: null,
    oralScorePct: null,
    trainingRequired: true,
    aiInsight: "Strong initial diagnostics. Practical field evaluation on jar testing and flash mixing scheduled.",
    generatedAt: "2026-09-02T11:00:00Z",
  },
];

export const initialTrainingSessions: TrainingSession[] = [
  {
    id: "sess-101",
    title: "Quarterly ETP Shock Load & pH Upset Emergency Drill",
    type: "on_site",
    scheduledBy: "emp0123",
    scheduledByName: "Anand Dakave (ETP Plant Manager)",
    scheduledAt: "2026-10-05T10:00:00Z",
    venueOrLink: "ETP Control Room & Equalization Bay",
    employeeIds: ["emp0126", "emp0128"],
    courseId: "course-etp-101",
    status: "scheduled",
  },
  {
    id: "sess-102",
    title: "RO Membrane CIP Safe Descaling Workshop",
    type: "on_site",
    scheduledBy: "emp0130",
    scheduledByName: "Uday Patil (RO Plant Manager)",
    scheduledAt: "2026-10-12T14:00:00Z",
    venueOrLink: "WTP Building — High-Pressure Skid Bay",
    employeeIds: ["emp0135"],
    courseId: "course-ops-301",
    status: "scheduled",
  },
];

export const initialMentorLiveSessions: MentorLiveSession[] = [
  {
    id: "session-director-adsul",
    mentorName: "Prashant Rohidas Adsul",
    mentorRole: "Founder & Managing Director",
    mentorDepartment: "Executive Leadership & Strategic Ops",
    isFounder: true,
    badgeText: "Founder Vision & Strategy",
    photoDataUrl: "/mentors/director_prashant.jpg",
    mentorRating: 5.0,
    topic: "Industrial Water Stewardship, SCADA Automation & Zero-Liquid-Discharge Strategy",
    description:
      "High-level executive group masterclass on environmental compliance governance, transitioning multi-plant operations to smart telemetry & SCADA automation, and scaling industrial wastewater stewardship.",
    scheduledAt: "Thursday, Oct 1 · 15:00 - 16:15 IST",
    durationMinutes: 45,
    maxCapacity: 35,
    registeredCount: 24,
    enrolledEmployeeIds: ["emp0127", "emp0134", "emp0139"],
    questions: [
      {
        id: "q-1",
        employeeId: "emp0127",
        employeeName: "Rohit Kumar Singh",
        question:
          "How to maintain biological floc stability under high-ammonia shock loads?",
        submittedAt: "2026-09-28T14:30:00Z",
      },
    ],
    meetingPlatform: "google_meet",
    platformStatus: "live",
    meetingLink: "https://meet.google.com/nec-lead-ops",
    slots: [
      { id: "slot-dir-1", dayLabel: "Today", dateStr: "29 Sep", timeRange: "16:30 - 17:15 IST" },
      { id: "slot-dir-2", dayLabel: "Tomorrow", dateStr: "30 Sep", timeRange: "11:00 - 11:45 IST" },
      { id: "slot-dir-3", dayLabel: "Thursday", dateStr: "01 Oct", timeRange: "15:00 - 15:45 IST" },
      { id: "slot-dir-4", dayLabel: "Friday", dateStr: "02 Oct", timeRange: "17:00 - 17:45 IST" },
    ],
  },
  {
    id: "session-etp-dakave",
    mentorName: "Anand Dakave",
    mentorRole: "ETP Plant Manager",
    mentorDepartment: "Wastewater Operations",
    isFounder: false,
    badgeText: "ETP Technical Lead",
    photoDataUrl: "/mentors/mentor_sanjay.jpg",
    mentorRating: 4.9,
    topic: "Clarifier Sludge Bulking, SVI Control & Biological Recovery",
    description:
      "Live operational masterclass on troubleshooting sudden MLSS washouts, filament proliferation, secondary clarifier blanket rise, and chemical polymer dosing calibration under shock organic COD loads.",
    scheduledAt: "Tomorrow · 14:00 - 14:45 IST",
    durationMinutes: 45,
    maxCapacity: 35,
    registeredCount: 28,
    enrolledEmployeeIds: ["emp0128", "emp0129", "emp0130"],
    questions: [
      {
        id: "q-3",
        employeeId: "emp0128",
        employeeName: "Rahul More",
        question:
          "When SVI spikes above 180 ml/g, should we increase RAS rate immediately or throttle feed pump?",
        submittedAt: "2026-09-28T15:20:00Z",
      },
    ],
    meetingPlatform: "google_meet",
    platformStatus: "live",
    meetingLink: "https://meet.google.com/etp-live-ment",
    slots: [
      { id: "slot-etp-1", dayLabel: "Today", dateStr: "29 Sep", timeRange: "14:00 - 14:45 IST" },
      { id: "slot-etp-2", dayLabel: "Tomorrow", dateStr: "30 Sep", timeRange: "10:30 - 11:15 IST" },
      { id: "slot-etp-3", dayLabel: "Tomorrow", dateStr: "30 Sep", timeRange: "16:00 - 16:45 IST" },
      { id: "slot-etp-4", dayLabel: "Thursday", dateStr: "01 Oct", timeRange: "11:30 - 12:15 IST" },
    ],
  },
  {
    id: "session-ro-patil",
    mentorName: "Uday Patil",
    mentorRole: "RO Plant Manager",
    mentorDepartment: "Membrane Desalination Systems",
    isFounder: false,
    badgeText: "RO & Membrane Lead",
    photoDataUrl: "/mentors/mentor_rajesh.jpg",
    mentorRating: 5.0,
    topic: "RO Membrane Normalization, Differential Pressure & 2-Stage CIP Descaling",
    description:
      "Live technical group masterclass on membrane telemetry: tracking normalized permeate flow decline, interpreting 15% delta-P rises, preventing biofouling, and executing low/high pH CIP descaling to restore flux.",
    scheduledAt: "Friday, Oct 2 · 10:00 - 10:45 IST",
    durationMinutes: 45,
    maxCapacity: 30,
    registeredCount: 21,
    enrolledEmployeeIds: ["emp0134", "emp0135"],
    questions: [
      {
        id: "q-4",
        employeeId: "emp0135",
        employeeName: "Amit Shinde",
        question:
          "What is the maximum allowable CIP soak time before membrane polyester backing degrades?",
        submittedAt: "2026-09-28T11:45:00Z",
      },
    ],
    meetingPlatform: "google_meet",
    platformStatus: "live",
    meetingLink: "https://meet.google.com/ro-tech-desk",
    slots: [
      { id: "slot-ro-1", dayLabel: "Tomorrow", dateStr: "30 Sep", timeRange: "09:30 - 10:15 IST" },
      { id: "slot-ro-2", dayLabel: "Thursday", dateStr: "01 Oct", timeRange: "14:00 - 14:45 IST" },
      { id: "slot-ro-3", dayLabel: "Friday", dateStr: "02 Oct", timeRange: "10:00 - 10:45 IST" },
      { id: "slot-ro-4", dayLabel: "Saturday", dateStr: "03 Oct", timeRange: "15:00 - 15:45 IST" },
    ],
  },
  {
    id: "session-mee-waghaskar",
    mentorName: "Sanjay Waghaskar",
    mentorRole: "MEE Plant Manager",
    mentorDepartment: "Thermal Systems & Zero Liquid Discharge",
    isFounder: false,
    badgeText: "Thermal ZLD Lead",
    photoDataUrl: "/mentors/mentor_vikram.jpg",
    mentorRating: 4.8,
    topic: "MEE Calandria Tube Scaling, Vacuum Cascade Maintenance & ATFD Salt Recovery",
    description:
      "Live practical group masterclass on preventing vacuum loss across multi-effect evaporators, solving calandria tube scaling bottlenecks, diagnosing steam traps, and harvesting dry salt cakes at ATFD.",
    scheduledAt: "Wednesday, Oct 7 · 15:00 - 15:45 IST",
    durationMinutes: 45,
    maxCapacity: 30,
    registeredCount: 19,
    enrolledEmployeeIds: ["emp0142", "emp0143"],
    questions: [
      {
        id: "q-5",
        employeeId: "emp0142",
        employeeName: "Ganesh Kadam",
        question:
          "How to detect whether vacuum loss is due to ejector nozzle wear or air leakage in the 3rd effect vapour duct?",
        submittedAt: "2026-09-28T18:15:00Z",
      },
    ],
    meetingPlatform: "google_meet",
    platformStatus: "live",
    meetingLink: "https://meet.google.com/zld-mee-sess",
    slots: [
      { id: "slot-mee-1", dayLabel: "Today", dateStr: "29 Sep", timeRange: "15:30 - 16:15 IST" },
      { id: "slot-mee-2", dayLabel: "Wednesday", dateStr: "30 Sep", timeRange: "11:00 - 11:45 IST" },
      { id: "slot-mee-3", dayLabel: "Friday", dateStr: "02 Oct", timeRange: "14:30 - 15:15 IST" },
      { id: "slot-mee-4", dayLabel: "Wednesday", dateStr: "07 Oct", timeRange: "15:00 - 15:45 IST" },
    ],
  },
];

export const mockMentors: MentorProfile[] = [
  {
    id: "men-0",
    name: "Prashant Rohidas Adsul",
    role: "Founder & Managing Director",
    department: "Executive Leadership",
    photoUrl: "/mentors/director_prashant.jpg",
    specialty: "Industrial Water Stewardship, SCADA Automation & Zero-Liquid-Discharge Strategy",
    nextSlot: "Thursday 15:00 – 16:15",
    rating: 5.0,
    sessionCount: 156,
    availableDays: ["Thu", "Sat"],
    publishedClinics: [
      { id: "c-0", topic: "Industrial Water Stewardship & Plant Automation", dayTime: "Thu 15:00 - 16:15", location: "Executive Boardroom & Online", capacity: 35, registeredCount: 24 },
    ],
  },
  {
    id: "men-1",
    name: "Anand Dakave",
    role: "ETP Plant Manager",
    department: "Wastewater Operations",
    photoUrl: "/mentors/mentor_sanjay.jpg",
    specialty: "Biological floc dynamics, clarifier sludge retention, and industrial effluent compliance",
    nextSlot: "Tomorrow 14:00 – 15:00",
    rating: 4.9,
    sessionCount: 84,
    availableDays: ["Wed", "Fri"],
    publishedClinics: [
      { id: "c-1", topic: "Clarifier Sludge Bulking & SVI Diagnosis", dayTime: "Wed 14:00 - 15:00", location: "ETP Control Room", capacity: 35, registeredCount: 28 },
    ],
  },
  {
    id: "men-2",
    name: "Uday Patil",
    role: "RO Plant Manager",
    department: "Membrane Systems",
    photoUrl: "/mentors/mentor_rajesh.jpg",
    specialty: "High-pressure membrane normalization, recovery optimization, and 2-stage CIP descaling",
    nextSlot: "Friday 10:00 – 11:15",
    rating: 5.0,
    sessionCount: 112,
    availableDays: ["Tue", "Fri"],
    publishedClinics: [
      { id: "c-2", topic: "RO Normalization & Silt Density Index (SDI) Clinic", dayTime: "Fri 10:00 - 11:15", location: "WTP Lab", capacity: 30, registeredCount: 21 },
    ],
  },
  {
    id: "men-3",
    name: "Sanjay Waghaskar",
    role: "MEE Plant Manager",
    department: "Thermal Systems",
    photoUrl: "/mentors/mentor_vikram.jpg",
    specialty: "Multiple Effect Evaporation, vacuum cascade maintenance, and ATFD salt crystallization",
    nextSlot: "Wednesday 15:00 – 16:15",
    rating: 4.8,
    sessionCount: 76,
    availableDays: ["Mon", "Wed"],
    publishedClinics: [
      { id: "c-3", topic: "MEE Calandria Tube Scaling & Vacuum Balance", dayTime: "Wed 15:00 - 16:15", location: "MEE Plant Office", capacity: 30, registeredCount: 19 },
    ],
  },
];

export const mockSpecializationTracks: SpecializationTrack[] = [
  {
    id: "track-etp-specialist",
    slug: "etp-specialist",
    title: "Industrial Wastewater & ETP Lead Specialist",
    subtitle: "Complete physico-chemical coagulation, biological aeration kinetics, and tertiary filtration.",
    heroBadge: "Industry Certified",
    category: "Effluent Treatment Plants (ETP)",
    provider: "Nectar Enviro Academy",
    partnerLogoText: "NEIPL",
    partnerLogoBg: "#16a34a",
    durationWeeks: 8,
    hoursPerWeek: 4,
    rating: 4.9,
    reviewCount: 180,
    enrolledCount: 310,
    level: "Intermediate",
    language: "English / Hindi / Marathi",
    whatYouWillLearn: [
      { title: "Clarifier SVI & Return Sludge Balancing", description: "Optimize return activated sludge (RAS) to maintain MLSS at 3,500 mg/L." },
      { title: "Coagulant Titration & Jar Testing", description: "Calibrate PAC and polyelectrolyte dosing against fluctuating raw effluent." },
      { title: "Effluent Regulatory Compliance", description: "Maintain COD < 250 mg/L and BOD < 30 mg/L under MPCB/CPCB statutory standards." },
    ],
    skillsGained: ["Clarifier Sludge Return", "Coagulant Dosing", "MPCB Compliance"],
    courseIds: ["course-etp-101", "course-ops-301"],
    appliedLearningProject: {
      title: "Full Plant Commissioning & Treatability Audit",
      facilityType: "Pharmaceutical Wastewater Treatment Hub",
      description: "Perform comprehensive shock load diagnosis, chemical optimization, and final treated water compliance audit.",
      keyDeliverables: [
        "Mass balance & hydraulic retention calculation",
        "Jar-test dosing matrix",
        "Statutory compliance verification report",
      ],
    },
    leadMentorId: "men-1",
    bannerImage: "/courses/etp_plant.jpg",
    recommendedTrackIds: ["track-wtp-ro"],
  },
  {
    id: "track-wtp-ro",
    slug: "wtp-ro-specialist",
    title: "High-Pressure RO & Membrane Separation Master",
    subtitle: "Operate high-pressure spiral-wound RO systems, perform SDI15 tests, and execute two-stage CIP descaling.",
    heroBadge: "Membrane Certified",
    category: "Water Treatment Plants (WTP)",
    provider: "Nectar Enviro Academy",
    partnerLogoText: "NEIPL",
    partnerLogoBg: "#0284c7",
    durationWeeks: 6,
    hoursPerWeek: 4,
    rating: 4.9,
    reviewCount: 140,
    enrolledCount: 240,
    level: "Advanced",
    language: "English / Hindi / Marathi",
    whatYouWillLearn: [
      { title: "Normalized Performance Tracking", description: "Track normalized permeate flow and differential pressure to forecast membrane fouling." },
      { title: "Two-Stage CIP Execution", description: "Execute high-pH organic dissolution followed by low-pH mineral descaling." },
    ],
    skillsGained: ["RO Normalization", "SDI Testing", "CIP Descaling"],
    courseIds: ["course-ops-301"],
    appliedLearningProject: {
      title: "RO Fouling Diagnosis & CIP Recovery",
      facilityType: "Chemical Manufacturing WTP",
      description: "Diagnose cause of 25% permeate flow decline and restore membrane performance via CIP.",
      keyDeliverables: ["SDI analysis report", "CIP chemical formulation", "Post-clean normalization comparison"],
    },
    leadMentorId: "men-2",
    bannerImage: "/courses/ro_membrane.jpg",
    recommendedTrackIds: ["track-etp-specialist"],
  },
];

export interface NectarLniItem {
  sNo: number;
  section: string;
  competencyArea: string;
  defaultLevel: "LOW" | "MED" | "HIGH";
  trainingRequired: "Yes" | "No";
  recommendedCourseId?: string;
}

export const NECTAR_LNI_COMPETENCIES: NectarLniItem[] = [
  { sNo: 1, section: "Basic Knowledge", competencyArea: "Understanding of ETP, RO & MEE processes", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 2, section: "Basic Knowledge", competencyArea: "Knowledge of plant components & systems", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 3, section: "Process", competencyArea: "Pre-treatment and overall process flow", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 4, section: "Process", competencyArea: "System operation and integration (ETP+RO+MEE)", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-ops-301" },
  { sNo: 5, section: "Chemical", competencyArea: "Chemical dosing and control", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-ops-301" },
  { sNo: 6, section: "Chemical", competencyArea: "Antiscalant, SMBS & chemical handling", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-ops-301" },
  { sNo: 7, section: "Biological", competencyArea: "Biological treatment & biofouling understanding", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 8, section: "Monitoring", competencyArea: "Parameter monitoring (pH, TDS, COD, flow)", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 9, section: "Troubleshooting", competencyArea: "Handling low flow / plant upset", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 10, section: "Troubleshooting", competencyArea: "Handling high TDS / COD/BOD issues", defaultLevel: "LOW", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 11, section: "Equipment", competencyArea: "Pump, blower, membrane & equipment knowledge", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-ops-301" },
  { sNo: 12, section: "Equipment", competencyArea: "Filter, evaporator & maintenance knowledge", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-zld-302" },
  { sNo: 13, section: "Safety", competencyArea: "PPE and safety compliance", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 14, section: "Practical", competencyArea: "Start/Stop procedures for all systems", defaultLevel: "HIGH", trainingRequired: "No" },
  { sNo: 15, section: "Practical", competencyArea: "Chemical preparation and dosing", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-ops-301" },
  { sNo: 16, section: "Maintenance", competencyArea: "CIP and preventive maintenance", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-ops-301" },
  { sNo: 17, section: "Maintenance", competencyArea: "Membrane & equipment handling", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-ops-301" },
  { sNo: 18, section: "Documentation", competencyArea: "Log sheet & reporting management", defaultLevel: "HIGH", trainingRequired: "No" },
  { sNo: 19, section: "Housekeeping", competencyArea: "Plant cleanliness & discipline", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 20, section: "Overall", competencyArea: "Leadership, decision making & system understanding", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
];
