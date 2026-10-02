import type { SpecializationTrack } from "./types";

/**
 * Client-side MOCK content, kept outside the database by client decision (plan §7 Q12):
 * specialization tracks and the LNI competency list. Everything else in Training is loaded
 * from the database.
 */

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
