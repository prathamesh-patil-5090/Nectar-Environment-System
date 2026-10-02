"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Tabs,
  Tag,
  Button,
  Progress,
  Row,
  Col,
  Modal,
  App,
  Input,
  Radio,
} from "antd";
import {
  PlayCircleOutlined,
  CheckCircleFilled,
  SafetyCertificateOutlined,
  CalendarOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  BookOutlined,
  TeamOutlined,
  UserOutlined,
  ArrowRightOutlined,
  StarFilled,
  FireFilled,
  SolutionOutlined,
  SearchOutlined,
  DownOutlined,
  UpOutlined,
  RiseOutlined,
  EnvironmentOutlined,
  VideoCameraOutlined,
  MessageOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { getSession } from "@/lib/auth";
import { scopedEmployeeId, selfEmployeeId } from "@/lib/rbac";
import { getEmployeeById } from "@/lib/mock-data";
import { nectarColors } from "@/lib/theme";
import type {
  Course,
  Certificate,
  MentorLiveSession,
} from "@/lib/training/types";
import {
  getAllCourses,
  getEnrollmentsForEmployee,
  getCertificates,
  getRecommendedCourses,
  getMentorProfiles,
  registerForDropInClinic,
  getLiveMasterclasses,
  enrollInLiveMasterclass,
  cancelLiveMasterclassEnrollment,
  submitLiveMasterclassQuestion,
  syncTrainingWithApi,
} from "@/lib/training/store";

// Components
import CoursePlayerModal from "@/components/training/CoursePlayerModal";
import CertificateModal from "@/components/training/CertificateModal";
import TrainingScheduleView from "@/components/training/TrainingScheduleView";
import { CourseraRecommendationsGrid } from "@/components/training/CourseraRecommendationsGrid";
import { rowBetween, rowCenterBetween2 } from "@/lib/styles";
import type { CSSProperties } from "react";

const sText14p5BoldColorM0: CSSProperties = {
  margin: 0,
  fontSize: 14.5,
  fontWeight: 700,
  color: "#0F172A",
  lineHeight: 1.35,
  minHeight: 40,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const inlineRowWrapGap3BgPadR14Border: CSSProperties = {
  display: "inline-flex",
  background: "#F1F5F9",
  padding: "4px",
  borderRadius: 14,
  border: "1px solid #E2E8F0",
  gap: 3,
  flexWrap: "wrap",
};

const rowCenterBetween: CSSProperties = {
  position: "absolute",
  top: 10,
  left: 10,
  right: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

// Domain Metadata for Nectar's 6 Industrial Pillars (first keyword match wins, else O&M)
const domain = (
  pillar: string, name: string, shortLabel: string, tag: string,
  color: string, bgLight: string, border: string, spec: string,
) => ({ pillar, name, shortLabel, tag, color, bgLight, border, accent: color, spec });

const DOMAIN_META: [string[], ReturnType<typeof domain>][] = [
  [["ETP", "Effluent"], domain("ETP", "Turnkey Industrial Effluents", "ETP", "Membranes & Heavy Effluents", "#1C4463", "#F0F5F9", "rgba(28, 68, 99, 0.22)", "CPCB Sched-VI Standard")],
  [["WTP", "Water"], domain("WTP", "High Purity & Membrane Systems", "WTP & RO", "Desalination & EDI Ultrapure", "#0284C7", "#F0F9FF", "rgba(2, 132, 199, 0.25)", "IS 10500 / USP Water")],
  [["STP", "Sewage"], domain("STP", "Municipal & Commercial STP", "STP", "SBR & Virgin MBBR Carriers", "#0D9488", "#F0FDFA", "rgba(13, 148, 136, 0.25)", "NGT Urban Reuse (<10 BOD)")],
  [["ZLD", "Zero Liquid"], domain("ZLD", "Thermal Evaporators & Crystallization", "ZLD", "High-Recovery Brine & ATFD", "#D97706", "#FFFBEB", "rgba(217, 119, 6, 0.25)", "Zero Discharge Mandate")],
  [["Consulting", "Environmental"], domain("ENV", "Environmental Consulting Services", "Consulting", "Mass Balance & Statutory Consents", "#7C3AED", "#F5F3FF", "rgba(124, 58, 237, 0.25)", "CTE / CTO Consents")],
];
const DEFAULT_DOMAIN_META = domain("ONM", "Operation and Maintenance (O&M)", "O&M", "Deputed Crew & WQ&Q SLA", "#059669", "#ECFDF5", "rgba(5, 150, 105, 0.25)", "Preventive SLA Compliance");

/** Catalog filter label → course section */
const CATEGORY_SECTION = new Map<string, Course["section"]>([
  ["Effluent Treatment (ETP)", "Effluent Treatment Plants (ETP)"],
  ["ETP Operations", "Effluent Treatment Plants (ETP)"],
  ["Sewage Treatment (STP)", "Sewage Treatment Plants (STP)"],
  ["Water Treatment (WTP)", "Water Treatment Plants (WTP)"],
  ["RO & Membrane", "Water Treatment Plants (WTP)"],
  ["Zero Liquid Discharge (ZLD)", "Zero Liquid Discharge (ZLD)"],
  ["Environmental Consulting", "Environmental Consulting Services"],
  ["Operation & Maintenance (O&M)", "Operation and Maintenance (O&M)"],
]);

/** Recommendation filter: first group whose keyword appears in the filter decides the match */
const REC_KEYWORD_GROUPS = [
  ["etp", "effluent"],
  ["wtp", "ro", "water"],
  ["stp", "sewage"],
  ["zld", "zero", "mee"],
  ["consult", "env"],
  ["o&m", "maint"],
];

const getDomainMeta = (nameOrCategory: string) =>
  DOMAIN_META.find(([keys]) => keys.some((k) => nameOrCategory.includes(k)))?.[1] ?? DEFAULT_DOMAIN_META;

// Engineering Telemetry & Operational Standards for Nectar's 6 Pillars
const sectionTelemetryMetrics: Record<
  string,
  {
    divisionCode: string;
    standard: string;
    metrics: string[];
    leadSpecialty: string;
  }
> = {
  "Effluent Treatment Plants (ETP)": {
    divisionCode: "DIV 01 · HEAVY EFFLUENTS",
    standard: "CPCB Schedule-VI Industrial Standard",
    leadSpecialty: "Physico-Chemical Coagulation, ASP/MBBR Aeration & MBR Filtration",
    metrics: [
      "Flux: 18–22 LMH",
      "Equalization: 8.5h HRT",
      "MLSS: 8,000–12,000 mg/L",
      "Filter Press: <25% Cake Moisture",
    ],
  },
  "Sewage Treatment Plants (STP)": {
    divisionCode: "DIV 02 · BIOLOGICAL STP",
    standard: "NGT Urban Reuse (<10 mg/L BOD)",
    leadSpecialty: "SBR Cyclic Batch Kinetics, Virgin Bio-Media & Packaged Skids",
    metrics: [
      "BOD Reduction: >96%",
      "SBR Aeration/Settle: 4h Cycle",
      "Bio-Media: 650 m²/m³",
      "Treated BOD: <10 mg/L",
    ],
  },
  "Water Treatment Plants (WTP)": {
    divisionCode: "DIV 03 · HIGH PURITY WTP",
    standard: "IS 10500 / USP Ultrapure Standard",
    leadSpecialty: "Industrial RO Membranes, Hollow-Fiber UF & EDI Polishing",
    metrics: [
      "Conductivity: <5 µS/cm",
      "Silica Rejection: >99%",
      "UF TMP: <0.6 bar",
      "EDI Demin: >15 MΩ·cm",
    ],
  },
  "Zero Liquid Discharge (ZLD)": {
    divisionCode: "DIV 04 · THERMAL SYSTEMS",
    standard: "Zero Liquid Discharge Mandate",
    leadSpecialty: "High-Recovery Brine RO, Vacuum MEE Evaporators & ATFD Salts",
    metrics: [
      "Steam Economy: 3.2 kg/kg",
      "Brine TDS: >220,000 ppm",
      "ATFD Dry Salt: >96%",
      "Recycled Water: 100%",
    ],
  },
  "Environmental Consulting Services": {
    divisionCode: "DIV 05 · AUDITING & LAB",
    standard: "State Pollution Control Board Statutory Consents",
    leadSpecialty: "Comprehensive Water Balance Audits, Treatability Studies & CTE/CTO",
    metrics: [
      "Mass Flow Balance",
      "Jar Test Coagulation",
      "CTE / CTO Statutory Filings",
      "OCEMS Telemetry Server",
    ],
  },
  "Operation and Maintenance (O&M)": {
    divisionCode: "DIV 06 · DEPUTED OPS & SLA",
    standard: "ISO 14001 SOP & Site Safety Standard",
    leadSpecialty: "Deputed Technical Manpower, Monthly WQ&Q Reporting & PM Schedules",
    metrics: [
      "Availability SLA: 99.4%",
      "Monthly WQ&Q Logbooks",
      "Preventive PM Matrix",
      "Zero-Harm LOTO Drills",
    ],
  },
};

interface EmployeeTrainingPortalProps {
  employeeId?: string;
}

export default function EmployeeTrainingPortal({ employeeId }: EmployeeTrainingPortalProps) {
  const { message } = App.useApp();
  const session = getSession();
  const selfId = employeeId ?? scopedEmployeeId(session) ?? selfEmployeeId(session) ?? "emp0126";
  const currentUser = getEmployeeById(selfId);

  const learnerInitials = useMemo(() => {
    const name = currentUser?.name ?? "Shilpa Hotkar";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || "SH";
  }, [currentUser?.name]);

  const router = useRouter();
  const mentorToTrackMap: Record<string, string> = {
    "mentor-sanjay": "track-etp-specialist",
    "mentor-rajesh": "track-wtp-ro",
    "mentor-vikram": "track-zld-lead",
    "mentor-meera": "track-om-manager",
  };

  const [activeTab, setActiveTab] = useState<string>("catalog");

  // Modals state
  const [playerCourse, setPlayerCourse] = useState<Course | null>(null);
  const [activeCert, setActiveCert] = useState<Certificate | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Data queries
  const allCourses = useMemo(() => getAllCourses(), [refreshTrigger]);
  const myEnrollments = useMemo(
    () => getEnrollmentsForEmployee(selfId),
    [selfId, refreshTrigger],
  );
  const myCertificates = useMemo(
    () => getCertificates(selfId),
    [selfId, refreshTrigger],
  );
  const recommendations = useMemo(
    () => getRecommendedCourses(selfId),
    [selfId, refreshTrigger],
  );
  const mentors = useMemo(() => getMentorProfiles(), [refreshTrigger]);
  const masterclasses = useMemo(() => getLiveMasterclasses(), [refreshTrigger]);
  const myEnrolledMasterclasses = useMemo(
    () => masterclasses.filter((s) => s.enrolledEmployeeIds?.includes(selfId)),
    [masterclasses, selfId],
  );

  useEffect(() => {
    syncTrainingWithApi(selfId).then(() => setRefreshTrigger((t) => t + 1));
  }, [selfId]);

  // Coursera Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Pillar Quick Focus Navigator
  const [pillarFilter, setPillarFilter] = useState<string>("All");

  // Show More / Show Less expansion states
  const [recsExpanded, setRecsExpanded] = useState<boolean>(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Recommendation category filter
  const [recFilter, setRecFilter] = useState<string>("All");

  // 1:1 Live Online Session Enrollment State
  const [selectedMasterclass, setSelectedMasterclass] = useState<MentorLiveSession | null>(null);
  const [doubtQuestion, setDoubtQuestion] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [selectedAgenda, setSelectedAgenda] = useState<string>("Plant Troubleshooting & Shock Load");
  const [isEnrollingSession, setIsEnrollingSession] = useState<boolean>(false);

  // Mentor Drop-In Registration State (Legacy Fallback)
  const [bookingMentor, setBookingMentor] = useState<any | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const [clinicNotes, setClinicNotes] = useState<string>("");
  const [isRegisteringClinic, setIsRegisteringClinic] = useState<boolean>(false);

  const sections: {
    title: Course["section"];
    badge: string;
    description: string;
  }[] = [
    {
      title: "Effluent Treatment Plants (ETP)",
      badge: "Turnkey Industrial Effluents",
      description: "Heavy wastewater treatment: equalization, physico-chemical coagulation, ASP, MBBR, MBR cassettes, and filter press dewatering.",
    },
    {
      title: "Sewage Treatment Plants (STP)",
      badge: "Municipal & Commercial STP",
      description: "Cyclic batch SBR operations, MBBR virgin bio-carrier hydrodynamics, and compact containerized skid-mounted treatment plants.",
    },
    {
      title: "Water Treatment Plants (WTP)",
      badge: "High Purity & Membrane Systems",
      description: "Industrial RO membrane desalination, hollow-fiber UF integrity testing, and EDI polishing for boiler feed and pharma ultrapure water.",
    },
    {
      title: "Zero Liquid Discharge (ZLD)",
      badge: "Thermal Evaporators & Crystallization",
      description: "High-recovery brine concentration RO, Multiple Effect Evaporators (MEE) with vacuum steam economy, and ATFD salt crystallization.",
    },
    {
      title: "Environmental Consulting Services",
      badge: "Audits, Consents & Treatability",
      description: "Comprehensive industrial water balance audits, on-site bench treatability studies, statutory CTE/CTO consents, and online OCEMS telemetry.",
    },
    {
      title: "Operation and Maintenance (O&M)",
      badge: "Deputed Manpower & Site Excellence",
      description: "Deputed site technical services, monthly Water Quality & Quantity (WQ&Q) analytical reporting, preventive maintenance schedules, and workplace safety.",
    },
  ];

  // Helper filter for courses across Nectar's 6 core services
  const matchesCourseFilter = (course: Course, query: string, category: string): boolean => {
    const q = query.toLowerCase().trim();
    const matchesQuery =
      !q ||
      course.title.toLowerCase().includes(q) ||
      course.description.toLowerCase().includes(q) ||
      course.code.toLowerCase().includes(q) ||
      course.section.toLowerCase().includes(q) ||
      course.abilities.some(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.code.toLowerCase().includes(q),
      );

    if (!matchesQuery) return false;
    // "All", "All Services" and unknown categories match everything
    const section = CATEGORY_SECTION.get(category);
    return !section || course.section === section;
  };

  // Filtered recommendations with robust category matcher
  const filteredRecs = useMemo(() => {
    let list = recommendations;
    if (recFilter !== "All") {
      const f = recFilter.toLowerCase();
      const group = REC_KEYWORD_GROUPS.find((words) => words.some((w) => f.includes(w)));
      list = list.filter((r) => {
        const cat = (r.category || "").toLowerCase();
        return group ? group.some((w) => cat.includes(w)) : cat.includes(f) || f.includes(cat);
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.provider.toLowerCase().includes(q) ||
          (r.category && r.category.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [recommendations, recFilter, searchQuery]);

  // Handle clinic registration submission
  const handleRegisterClinic = () => {
    if (!bookingMentor || !selectedClinicId) {
      message.error("Please select an available drop-in clinic time slot.");
      return;
    }
    setIsRegisteringClinic(true);
    setTimeout(() => {
      const res = registerForDropInClinic(
        bookingMentor.id,
        selfId,
        selectedClinicId,
        clinicNotes,
      );
      setIsRegisteringClinic(false);
      if (res.success) {
        message.success(res.message);
        setBookingMentor(null);
        setSelectedClinicId("");
        setClinicNotes("");
        setRefreshTrigger((prev) => prev + 1);
      } else {
        message.error(res.message);
      }
    }, 350);
  };

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionTitle]: !prev[sectionTitle] }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. TOP HERO HEADER */}
      <div
        style={{
          position: "relative", background: "linear-gradient(135deg, #07101B 0%, #0F2033 55%, #0A1523 100%)",
          borderRadius: 18, padding: "26px 30px", color: "#FFFFFF",
          boxShadow: "0 20px 40px -12px rgba(2, 6, 23, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
          border: "1px solid rgba(255, 255, 255, 0.12)", overflow: "hidden", display: "flex",
          justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 22,
        }}
      >
        {/* Subtle Decorative Ambient Mesh Glows */}
        <div
          style={{
            position: "absolute", top: "-30%", left: "-10%", width: "50%", height: "160%",
            background: "radial-gradient(circle, rgba(28, 68, 99, 0.45) 0%, transparent 65%)", pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute", bottom: "-40%", right: "5%", width: "45%", height: "160%",
            background: "radial-gradient(circle, rgba(28, 68, 99, 0.35) 0%, transparent 65%)", pointerEvents: "none",
          }}
        />

        {/* Left Side: Title & Gated 4-Tier Framework */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 680 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px",
                background: "rgba(28, 68, 99, 0.4)", border: "1px solid rgba(56, 189, 248, 0.35)", borderRadius: 20,
                fontSize: 10, fontWeight: 700, color: "#38BDF8", letterSpacing: "0.08em", textTransform: "uppercase",
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#38BDF8", display: "inline-block",
                  boxShadow: "0 0 8px #38BDF8",
                }}
              />
              NEIPL Process Academy
            </span>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px",
                background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.14)",
                borderRadius: 20, fontSize: 11, fontWeight: 500, color: "#E2E8F0",
              }}
            >
              <CheckCircleFilled style={{ color: "#38BDF8", fontSize: 12 }} /> 4-Tier Assessment Model
            </span>
          </div>

          <h1
            style={{
              margin: 0, fontSize: 23, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.015em", lineHeight: 1.25,
            }}
          >
            Manpower Training & Competency Management
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255, 255, 255, 0.75)" }}>
            Welcome back, {currentUser?.name ?? "Operator"}. Master industrial plant modules, verify SOP competencies, and register for senior shift clinics.
          </p>
        </div>

        {/* Right Side: High-End Active Learner Identity Card */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.09) 0%, rgba(255, 255, 255, 0.03) 100%)",
              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.14)", borderRadius: 14, padding: "10px 16px", display: "flex",
              alignItems: "center", gap: 12,
              boxShadow: "0 10px 28px -6px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
            }}
          >
            {/* Operator Monogram Avatar with Live Status Indicator */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div
                style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: "linear-gradient(135deg, #1C4463 0%, #0F2033 100%)",
                  border: "1.5px solid rgba(56, 189, 248, 0.45)", color: "#FFFFFF", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, letterSpacing: "0.5px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
                }}
              >
                {learnerInitials}
              </div>
              <span
                style={{
                  position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: "50%",
                  background: "#10B981", border: "2px solid #0B1A24", boxShadow: "0 0 8px #10B981",
                }}
              />
            </div>

            {/* Operator Details & Visual Hierarchy */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 13.5, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em", lineHeight: 1.2,
                  }}
                >
                  {currentUser?.name ?? "Shilpa Hotkar"}
                </span>
                <span
                  style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                    padding: "1.5px 6px", borderRadius: 4, background: "rgba(56, 189, 248, 0.14)",
                    border: "1px solid rgba(56, 189, 248, 0.3)", color: "#7DD3FC", lineHeight: 1.2,
                  }}
                >
                  {currentUser?.designation ?? "Plant Operator"}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span
                  style={{
                    fontSize: 11, color: "rgba(255, 255, 255, 0.75)", fontWeight: 500, display: "inline-flex",
                    alignItems: "center", gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: 5, height: 5, borderRadius: "50%", background: "#38BDF8", display: "inline-block",
                      boxShadow: "0 0 6px #38BDF8",
                    }}
                  />
                  Active Shift Learner
                </span>
                <span style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.3)" }}>•</span>
                <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.6)", fontWeight: 500 }}>{myCertificates.length > 0 ? `${myCertificates.length} Certified SOPs` : "ETP Plant Ops"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* UPCOMING ENROLLED SESSIONS */}
      {myEnrolledMasterclasses.length > 0 && (
        <div
          style={{
            background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 14, padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
        >
          {/* Header Bar */}
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12,
              marginBottom: 12, borderBottom: "1px solid #F1F5F9", flexWrap: "wrap", gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 8, height: 8, borderRadius: "50%", background: nectarColors.leaf, display: "inline-block",
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.01em" }}>My Enrolled Sessions</span>
              <span
                style={{
                  fontSize: 11, fontWeight: 600, color: nectarColors.leaf, background: "#EAF1F6",
                  border: "1px solid rgba(28, 68, 99, 0.2)", padding: "1px 8px", borderRadius: 10,
                }}
              >
                {myEnrolledMasterclasses.length} Upcoming
              </span>
            </div>

            <span style={{ fontSize: 11.5, color: "#94A3B8" }}>Live streams open 10 minutes prior to session</span>
          </div>

          {/* Session Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
            {myEnrolledMasterclasses.map((session) => {
              const myDoubt = session.questions?.filter((q) => q.employeeId === selfId).slice(-1)[0];

              const dateMatch = session.scheduledAt.match(/([A-Za-z]+),\s*([A-Za-z]+)\s*(\d+)\s*·\s*([\d:]+)/);
              const dayName = dateMatch ? dateMatch[1].slice(0, 3).toUpperCase() : "LIVE";
              const dateText = dateMatch ? `${dateMatch[3]} ${dateMatch[2].slice(0, 3).toUpperCase()}` : "UPCOMING";
              const timeText = dateMatch ? dateMatch[4] : "15:00";

              return (
                <div
                  key={`enrolled-${session.id}`}
                  style={{
                    background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 18px",
                    display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12,
                    transition: "box-shadow 0.15s ease, border-color 0.15s ease",
                  }}
                >
                  {/* Card Top: Mentor & Schedule */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 38, height: 38, borderRadius: "50%", backgroundImage: `url(${session.photoDataUrl})`,
                            backgroundSize: "cover", backgroundPosition: "center 20%", border: "1.5px solid #CBD5E1",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.mentorName}</div>
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.mentorRole}</div>
                        </div>
                      </div>

                      {/* Schedule Badge */}
                      <div
                        style={{
                          background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "4px 8px",
                          textAlign: "right", flexShrink: 0,
                        }}
                      >
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1 }}>{dayName} · {dateText}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: nectarColors.leaf, lineHeight: 1, marginTop: 3 }}>{timeText} IST</div>
                      </div>
                    </div>

                    {/* Topic */}
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginTop: 12, lineHeight: 1.35 }}>{session.topic}</div>

                    <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>Live Interactive Cohort · {session.durationMinutes} mins</div>

                    {/* Question / Note if present */}
                    {myDoubt ? (
                      <div
                        style={{
                          background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 10px",
                          marginTop: 10,
                        }}
                      >
                        <div style={rowCenterBetween2}>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: "#64748B" }}>Your Question:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMasterclass(session);
                              setDoubtQuestion(myDoubt.question);
                            }}
                            style={{
                              background: "none", border: "none", padding: 0, fontSize: 10.5, fontWeight: 600,
                              color: nectarColors.leaf, cursor: "pointer", textDecoration: "underline",
                            }}
                          >
                            Edit
                          </button>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#334155", fontStyle: "italic", marginTop: 2, lineHeight: 1.3 }}>"{myDoubt.question}"</div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMasterclass(session);
                          setDoubtQuestion("");
                        }}
                        style={{
                          background: "none", border: "none", padding: 0, marginTop: 8, fontSize: 11.5, fontWeight: 600,
                          color: nectarColors.leaf, cursor: "pointer", display: "inline-block",
                        }}
                      >
                        + Add a question for mentor
                      </button>
                    )}
                  </div>

                  {/* Card Footer: Actions */}
                  <div
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      borderTop: "1px solid #E2E8F0", paddingTop: 12, marginTop: 4,
                    }}
                  >
                    <Button
                      type="primary"
                      onClick={() => {
                        message.info(`Session opens at ${timeText} on ${dateText}. Link will activate 10 minutes prior.`);
                      }}
                      style={{
                        background: nectarColors.leaf, borderColor: nectarColors.leaf, fontSize: 12, fontWeight: 600,
                        borderRadius: 6, height: 32, padding: "0 14px",
                      }}
                    >
                      Join Session
                    </Button>

                    <button
                      type="button"
                      onClick={async () => {
                        const res = await cancelLiveMasterclassEnrollment(session.id, selfId);
                        message.info(res.message);
                        setRefreshTrigger((t) => t + 1);
                      }}
                      style={{
                        background: "none", border: "none", padding: "4px 8px", fontSize: 11.5, color: "#94A3B8",
                        cursor: "pointer", borderRadius: 4, transition: "color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
                    >
                      Unenroll
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. UNIFIED NAVIGATION & DISCOVERY DECK */}
      <div
        style={{
          background: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0",
          boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.05)", overflow: "hidden",
        }}
      >
        {/* Tier 1: Segmented Pill Navigation Bar + Live Status */}
        <div
          style={{
            padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 16, borderBottom: activeTab === "catalog" ? "1px solid #F1F5F9" : "none",
            background: "#FAFAFA",
          }}
        >
          {/* Segmented Pill Tabs */}
          <div style={{ display: "inline-flex", background: "#F1F5F9", padding: "4px", borderRadius: 10, gap: 4 }}>
            {[
              { key: "catalog", label: "Course Catalog", count: allCourses.length, icon: <BookOutlined /> },
              { key: "certificates", label: "My Certificates", count: myCertificates.length, icon: <TrophyOutlined /> },
              { key: "schedule", label: "Assessment Schedule", icon: <CalendarOutlined /> },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 16px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? nectarColors.ink : nectarColors.muted,
                    background: isActive ? "#FFFFFF" : "transparent",
                    boxShadow: isActive
                      ? "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)"
                      : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ color: isActive ? nectarColors.leaf : "#94A3B8", fontSize: 13 }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      style={{
                        fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
                        background: isActive ? "#EAF1F6" : "#E2E8F0",
                        color: isActive ? nectarColors.leaf : nectarColors.muted,
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Live Operator Context */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: nectarColors.muted }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{ width: 7, height: 7, borderRadius: "50%", background: "#16A34A", display: "inline-block" }}
              />
              <span style={{ fontWeight: 500 }}>Self-Paced Competency LMS</span>
            </span>
            <span style={{ color: "#CBD5E1" }}>|</span>
            <span style={{ fontWeight: 500 }}>
              {myEnrollments.filter((e) => e.status === "CERTIFIED").length} Certified ·{" "}
              {myEnrollments.filter((e) => e.status === "IN_PROGRESS").length} In Progress
            </span>
          </div>
        </div>

        {/* Tier 2: Omni Search & Horizontal Topic Rail (Only in catalog view) */}
        {activeTab === "catalog" && (
          <div style={{ padding: "18px 20px 20px" }}>
            {/* Search Input Row with integrated action */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Input
                  size="large"
                  prefix={<SearchOutlined style={{ color: nectarColors.leaf, fontSize: 16, marginRight: 6 }} />}
                  placeholder="Search plant courses, SOP skills, equipment (e.g. RO membrane, aeration flocs, chlorine, LOTO, pumps)..."
                  allowClear
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    height: 44, borderRadius: 8, fontSize: 13,
                    border: searchQuery ? `1.5px solid ${nectarColors.leaf}` : "1px solid #CBD5E1",
                    boxShadow: searchQuery ? "0 0 0 3px rgba(28, 68, 99, 0.15)" : "none",
                  }}
                />
              </div>

              {/* Status counter or Clear button */}
              {searchQuery || selectedCategory !== "All" ? (
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                  }}
                  style={{
                    height: 44, borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#DC2626",
                    borderColor: "#FCA5A5", background: "#FEF2F2",
                  }}
                >
                  Clear Filters
                </Button>
              ) : (
                <div
                  style={{
                    fontSize: 12, fontWeight: 600, color: nectarColors.muted, background: nectarColors.sand,
                    border: "1px solid #E2E8F0", padding: "0 14px", height: 44, borderRadius: 8, display: "flex",
                    alignItems: "center", whiteSpace: "nowrap",
                  }}
                >
                  {allCourses.length} Modules Available
                </div>
              )}
            </div>

            {/* Topic Filter Strip (Horizontal scrolling rail without clumsy wrap) */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8, marginTop: 14, overflowX: "auto", scrollbarWidth: "none",
                paddingBottom: 2,
              }}
            >
              <span
                style={{
                  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94A3B8",
                  marginRight: 4, whiteSpace: "nowrap",
                }}
              >
                Quick Filter:
              </span>
              {[
                { key: "All", label: "All Services" },
                { key: "Effluent Treatment (ETP)", label: "Effluent Treatment (ETP)" },
                { key: "Sewage Treatment (STP)", label: "Sewage Treatment (STP)" },
                { key: "Water Treatment (WTP)", label: "Water Treatment (WTP)" },
                { key: "Zero Liquid Discharge (ZLD)", label: "Zero Liquid Discharge (ZLD)" },
                { key: "Environmental Consulting", label: "Environmental Consulting" },
                { key: "Operation & Maintenance (O&M)", label: "Operation & Maintenance (O&M)" },
              ].map((cat) => {
                const isActive = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    style={{
                      padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: isActive ? 600 : 500,
                      cursor: "pointer", border: isActive ? `1.5px solid ${nectarColors.leaf}` : "1px solid #E2E8F0",
                      background: isActive ? nectarColors.leaf : "#FFFFFF", color: isActive ? "#FFFFFF" : "#334155",
                      whiteSpace: "nowrap", transition: "all 0.15s ease",
                      boxShadow: isActive ? "0 2px 6px rgba(28, 68, 99, 0.25)" : "none",
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. TAB CONTENTS */}
      {/* ----------------- CATALOG TAB ----------------- */}
      {activeTab === "catalog" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>

          {/* B. EXECUTIVE & PLANT LEAD MASTERCLASSES */}
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 24,
                      fontWeight: 700,
                      color: "#0F172A",
                      letterSpacing: "-0.015em",
                      fontFamily:
                        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    }}
                  >
                    Live Online Mentorship & Group Masterclasses
                  </h2>
                </div>
                <div style={{ fontSize: 13.5, color: nectarColors.muted, marginTop: 5, maxWidth: 880, lineHeight: 1.5 }}>
                  Interactive live group masterclasses conducted online by our Managing Director and Senior Plant Managers.
                  Mentors schedule and lead cohort sessions on operational challenges, plant troubleshooting, and SOP best practices via Google Meet.
                </div>
              </div>
            </div>

            {/* 4 Executive & Plant Lead Masterclass Cards Grid */}
            <Row gutter={[20, 20]}>
              {masterclasses.map((session) => {
                const isEnrolled = session.enrolledEmployeeIds?.includes(selfId);
                const availableSeats = Math.max(0, session.maxCapacity - session.registeredCount);
                const isFull = availableSeats <= 0;
                const percentFull = Math.min(
                  100,
                  Math.round((session.registeredCount / session.maxCapacity) * 100),
                );

                return (
                  <Col xs={24} sm={12} md={12} lg={6} xl={6} key={session.id}>
                    <div
                      onClick={() => {
                        setSelectedMasterclass(session);
                        setDoubtQuestion("");
                        setSelectedSlotId(session.selectedSlotMap?.[selfId] || session.slots?.[0]?.id || "");
                        setSelectedAgenda(session.selectedAgendaMap?.[selfId] || "Plant Troubleshooting & Shock Load");
                      }}
                      style={{
                        background: "#FFFFFF",
                        borderRadius: 16,
                        border: session.isFounder
                          ? "1.5px solid rgba(217, 119, 6, 0.4)"
                          : "1px solid #E2E8F0",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        height: "100%",
                        cursor: "pointer",
                        transition: "all 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
                        boxShadow: session.isFounder
                          ? "0 4px 20px -2px rgba(217, 119, 6, 0.14), 0 2px 6px rgba(0, 0, 0, 0.04)"
                          : "0 1px 3px rgba(0, 0, 0, 0.04)",
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-6px)";
                        e.currentTarget.style.boxShadow = session.isFounder
                          ? "0 20px 36px -6px rgba(217, 119, 6, 0.28), 0 6px 16px -3px rgba(0, 0, 0, 0.08)"
                          : "0 20px 36px -6px rgba(28, 68, 99, 0.18), 0 6px 16px -3px rgba(0, 0, 0, 0.04)";
                        e.currentTarget.style.borderColor = session.isFounder
                          ? "#D97706"
                          : nectarColors.leaf;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = session.isFounder
                          ? "0 4px 20px -2px rgba(217, 119, 6, 0.14), 0 2px 6px rgba(0, 0, 0, 0.04)"
                          : "0 1px 3px rgba(0, 0, 0, 0.04)";
                        e.currentTarget.style.borderColor = session.isFounder
                          ? "rgba(217, 119, 6, 0.4)"
                          : "#E2E8F0";
                      }}
                    >
                      {/* Top Hero Frame */}
                      <div
                        style={{
                          height: 195,
                          background: session.isFounder
                            ? "linear-gradient(180deg, #FEF3C7 0%, #FFFFFF 100%)"
                            : "linear-gradient(180deg, #EAF1F6 0%, #FFFFFF 100%)",
                          position: "relative",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                          borderBottom: "1px solid #F1F5F9",
                        }}
                      >
                        {/* Domain / Executive Badge (Top-Left) */}
                        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 3 }}>
                          {session.isFounder ? (
                            <Tag
                              color="gold"
                              style={{
                                margin: 0, fontWeight: 700, borderRadius: 10, fontSize: 10.5, padding: "3px 8px",
                                border: "1px solid rgba(217, 119, 6, 0.35)",
                                boxShadow: "0 2px 6px rgba(217, 119, 6, 0.15)",
                              }}
                            >
                              👑 {session.badgeText}
                            </Tag>
                          ) : (
                            <Tag
                              color={
                                session.id.includes("etp")
                                  ? "cyan"
                                  : session.id.includes("ro")
                                    ? "blue"
                                    : "volcano"
                              }
                              style={{ margin: 0, fontWeight: 600, borderRadius: 10, fontSize: 10, padding: "2px 8px" }}
                            >
                              {session.badgeText}
                            </Tag>
                          )}
                        </div>

                        {/* Slots indicator badge (Top-Right) */}
                        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 3 }}>
                          <span
                            style={{
                              background:
                                availableSeats > 0
                                  ? "rgba(22, 163, 74, 0.95)"
                                  : "rgba(220, 38, 38, 0.95)",
                              backdropFilter: "blur(4px)",
                              color: "#FFFFFF",
                              padding: "3px 8px",
                              borderRadius: 10,
                              fontSize: 10,
                              fontWeight: 600,
                              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
                            }}
                          >
                            {availableSeats > 0
                              ? `● ${availableSeats} Seats Left`
                              : "● Fully Booked"}
                          </span>
                        </div>

                        {/* Center Cameo Portrait with Arch Frame */}
                        <div
                          style={{
                            position: "relative",
                            zIndex: 2,
                            width: 124,
                            height: 154,
                            borderRadius: "62px 62px 0 0",
                            backgroundImage: `url(${session.photoDataUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center 12%",
                            boxShadow: "0 -4px 18px rgba(0, 0, 0, 0.14)",
                            border: session.isFounder
                              ? "3.5px solid #F59E0B"
                              : "3.5px solid #FFFFFF",
                            borderBottom: "none",
                          }}
                        />
                      </div>

                      {/* Card Content */}
                      <div
                        style={{
                          padding: "16px 18px 18px", flex: 1, display: "flex", flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          {/* Mentor Name & Rating */}
                          <div style={rowBetween}>
                            <h3
                              style={{
                                margin: 0, fontSize: 16.5, fontWeight: 700, color: "#0F172A", lineHeight: 1.3,
                                letterSpacing: "-0.015em",
                              }}
                            >
                              {session.mentorName}
                            </h3>
                            <span
                              style={{
                                fontSize: 12, color: "#D97706", fontWeight: 700, display: "flex", alignItems: "center",
                                gap: 3,
                              }}
                            >
                              <StarFilled style={{ fontSize: 11 }} /> {session.mentorRating}
                            </span>
                          </div>

                          {/* Role & Department */}
                          <div
                            style={{
                              fontSize: 11.5, color: session.isFounder ? "#B45309" : nectarColors.leaf, fontWeight: 600,
                              marginTop: 2,
                            }}
                          >
                            {session.mentorRole} · {session.mentorDepartment}
                          </div>

                          {/* Specific Session Topic */}
                          <div
                            style={{
                              marginTop: 10, fontWeight: 700, fontSize: 13.5, color: "#0F172A", lineHeight: 1.35,
                              minHeight: 36, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {session.topic}
                          </div>

                          {/* Description */}
                          <p
                            style={{
                              margin: "6px 0 0", fontSize: 11.5, color: "#64748B", lineHeight: 1.45, minHeight: 34,
                              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {session.description}
                          </p>
                        </div>

                        {/* Session Metadata & Action Box */}
                        <div style={{ marginTop: 14 }}>
                          <div
                            style={{
                              background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "10px 12px",
                              borderRadius: 10, fontSize: 11,
                            }}
                          >
                            {/* Scheduled Live Group Session Time */}
                            <div
                              style={{
                                color: "#334155", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <ClockCircleOutlined style={{ color: nectarColors.leaf }} />
                              <span>{session.scheduledAt}</span>
                            </div>

                            {/* Live Group Session Format Badge */}
                            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <Tag
                                style={{
                                  fontSize: 10, borderRadius: 6, fontWeight: 700, padding: "2px 7px", margin: 0,
                                  background: "#EAF1F6", border: "1px solid rgba(28, 68, 99, 0.25)",
                                  color: nectarColors.leaf,
                                }}
                              >
                                <VideoCameraOutlined style={{ marginRight: 4 }} />
                                Google Meet Live Stream · {session.durationMinutes} mins
                              </Tag>
                              <Tag
                                style={{
                                  fontSize: 10, borderRadius: 6, fontWeight: 600, padding: "2px 7px", margin: 0,
                                  background: "#F1F5F9", border: "1px solid #CBD5E1", color: "#334155",
                                }}
                              >
                                Group Masterclass
                              </Tag>
                            </div>

                            {/* Q&A / Enrolled Count */}
                            <div
                              style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8,
                                color: "#64748B", fontSize: 10.5,
                              }}
                            >
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <MessageOutlined style={{ color: nectarColors.leaf }} />
                                {session.questions.length} question(s) submitted
                              </span>
                              <span style={{ fontWeight: 600, color: "#475569" }}>{session.registeredCount}/{session.maxCapacity} Enrolled</span>
                            </div>

                            {/* Capacity Progress Bar */}
                            <Progress
                              percent={percentFull}
                              size="small"
                              showInfo={false}
                              strokeColor={
                                percentFull >= 90
                                  ? "#EF4444"
                                  : session.isFounder
                                    ? "#F59E0B"
                                    : nectarColors.leaf
                              }
                              style={{ margin: "4px 0 0" }}
                            />
                          </div>

                          {/* Action Button */}
                          {isEnrolled ? (
                            <Button
                              type="primary"
                              block
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMasterclass(session);
                                setDoubtQuestion("");
                                setSelectedSlotId(session.selectedSlotMap?.[selfId] || session.slots?.[0]?.id || "");
                                setSelectedAgenda(session.selectedAgendaMap?.[selfId] || "Plant Troubleshooting & Shock Load");
                              }}
                              style={{
                                marginTop: 10, borderRadius: 8, background: "#64748B", borderColor: "#64748B",
                                color: "#FFFFFF", fontWeight: 600, fontSize: 13, height: 38,
                              }}
                            >
                              Enrolled
                            </Button>
                          ) : (
                            <Button
                              type="primary"
                              block
                              disabled={isFull}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMasterclass(session);
                                setDoubtQuestion("");
                                setSelectedSlotId(session.slots?.[0]?.id || "");
                                setSelectedAgenda("Plant Troubleshooting & Shock Load");
                              }}
                              style={{
                                marginTop: 10, borderRadius: 8, background: nectarColors.leaf,
                                borderColor: nectarColors.leaf, color: "#FFFFFF", fontWeight: 600, fontSize: 13,
                                height: 38,
                              }}
                            >
                              {isFull ? "Full" : "Enroll"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </div>

          {/* C. RECOMMENDATION SECTION - ADAPTIVE SHIFT CURRICULA */}
          <div
            style={{
              background: "#FFFFFF", borderRadius: 20, padding: "28px 30px 32px",
              border: "1px solid rgba(11, 26, 36, 0.08)",
              boxShadow: "0 10px 30px -10px rgba(11, 26, 36, 0.05), 0 1px 3px rgba(11, 26, 36, 0.03)",
            }}
          >
            {/* Architectural Header */}
            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20,
                marginBottom: 26,
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 11px", borderRadius: 20,
                    background: "#EAF1F6", border: "1px solid rgba(28, 68, 99, 0.2)", color: nectarColors.leaf,
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 7, height: 7, borderRadius: "50%", background: nectarColors.leaf, display: "inline-block",
                      boxShadow: "0 0 6px rgba(28, 68, 99, 0.4)",
                    }}
                  />
                  <span>Adaptive Station Telemetry · Shift Accelerators</span>
                </div>
                <h2
                  style={{
                    margin: 0, fontSize: 23, fontWeight: 700, color: nectarColors.ink, letterSpacing: "-0.02em",
                  }}
                >
                  Learners like you took these next
                </h2>
                <div style={{ fontSize: 13.5, color: "#64748B", marginTop: 4, maxWidth: 640 }}>
                  Curated technical courses calibrated against station telemetry, active shift logs, and operational permit standards.
                </div>
              </div>

              {/* Segmented Filter Bar */}
              <div style={inlineRowWrapGap3BgPadR14Border}>
                {[
                  { key: "All", label: "Top Recommended", count: recommendations.length },
                  {
                    key: "ETP",
                    label: "ETP Operations",
                    count: recommendations.filter((r) => (r.category || "").includes("ETP") || (r.category || "").includes("Effluent")).length,
                  },
                  {
                    key: "WTP",
                    label: "WTP & RO",
                    count: recommendations.filter((r) => (r.category || "").includes("WTP") || (r.category || "").includes("Water") || (r.category || "").includes("RO")).length,
                  },
                  {
                    key: "STP",
                    label: "STP Facilities",
                    count: recommendations.filter((r) => (r.category || "").includes("STP") || (r.category || "").includes("Sewage")).length,
                  },
                  {
                    key: "ZLD",
                    label: "ZLD & Thermal",
                    count: recommendations.filter((r) => (r.category || "").includes("ZLD") || (r.category || "").includes("Zero") || (r.category || "").includes("MEE")).length,
                  },
                  {
                    key: "Consulting",
                    label: "Environmental Consulting",
                    count: recommendations.filter((r) => (r.category || "").includes("Consulting") || (r.category || "").includes("Environmental")).length,
                  },
                  {
                    key: "O&M",
                    label: "O&M Reliability",
                    count: recommendations.filter((r) => (r.category || "").includes("O&M") || (r.category || "").includes("Maintenance")).length,
                  },
                ].map((pill) => {
                  const isActive = recFilter === pill.key;
                  return (
                    <button
                      key={pill.key}
                      onClick={() => setRecFilter(pill.key)}
                      style={{
                        padding: "6px 13px", borderRadius: 10, fontSize: 12, fontWeight: isActive ? 600 : 500,
                        border: "none", background: isActive ? nectarColors.leaf : "transparent",
                        color: isActive ? "#FFFFFF" : "#475569", cursor: "pointer", display: "inline-flex",
                        alignItems: "center", gap: 6, boxShadow: isActive ? "0 2px 8px rgba(28, 68, 99, 0.22)" : "none",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <span>{pill.label}</span>
                      <span
                        style={{
                          fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                          background: isActive ? "rgba(255, 255, 255, 0.22)" : "#E2E8F0",
                          color: isActive ? "#FFFFFF" : "#64748B",
                        }}
                      >
                        {pill.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recommendation Cards Grid — Guaranteed 4 to 6 items per category view */}
            <Row gutter={[20, 20]}>
              {(recsExpanded ? filteredRecs : (filteredRecs.length <= 6 ? filteredRecs : filteredRecs.slice(0, 6))).map((rec) => {
                const targetCourse =
                  allCourses.find((c) => c.id === rec.courseId || c.courseId === rec.courseId) ||
                  allCourses.find((c) => c.code === rec.code) ||
                  allCourses[0];
                const meta = getDomainMeta(rec.category);

                return (
                  <Col xs={24} sm={12} md={12} lg={8} xl={6} key={rec.id}>
                    <div
                      onClick={() => router.push(`/training/learn/${targetCourse?.id || rec.courseId}`)}
                      style={{
                        background: "#FFFFFF",
                        borderRadius: 16,
                        border: rec.isAssignedByManager
                          ? "1.5px solid #F59E0B"
                          : "1px solid rgba(11, 26, 36, 0.08)",
                        boxShadow: rec.isAssignedByManager
                          ? "0 4px 18px rgba(245, 158, 11, 0.12)"
                          : "0 2px 10px rgba(11, 26, 36, 0.03)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        height: "100%",
                        transition: "all 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
                        cursor: "pointer",
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow = rec.isAssignedByManager
                          ? "0 18px 36px -8px rgba(245, 158, 11, 0.25)"
                          : "0 18px 36px -8px rgba(28, 68, 99, 0.12), 0 2px 6px rgba(11, 26, 36, 0.04)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = rec.isAssignedByManager
                          ? "0 4px 18px rgba(245, 158, 11, 0.12)"
                          : "0 2px 10px rgba(11, 26, 36, 0.03)";
                      }}
                    >
                      {/* Top Image Banner with Technical HUD */}
                      <div
                        style={{
                          height: 155, backgroundImage: `url(${rec.thumbnailUrl || "/courses/etp_plant.jpg"})`,
                          backgroundSize: "cover", backgroundPosition: "center", position: "relative",
                        }}
                      >
                        {/* Film gradient for contrast */}
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background:
                              "linear-gradient(to top, rgba(11,26,36,0.92) 0%, rgba(11,26,36,0.3) 55%, rgba(11,26,36,0.6) 100%)",
                          }}
                        />

                        {/* Top HUD: Unit Code & Telemetry Fit */}
                        <div style={rowCenterBetween}>
                          <div
                            style={{
                              background: "rgba(11, 26, 36, 0.85)", backdropFilter: "blur(6px)", color: "#FFFFFF",
                              padding: "3px 8px", borderRadius: 6, fontSize: 11, fontFamily: "monospace",
                              fontWeight: 700, letterSpacing: "0.05em", border: "1px solid rgba(255, 255, 255, 0.15)",
                            }}
                          >
                            {rec.code}
                          </div>

                          {rec.isAssignedByManager ? (
                            <div
                              style={{
                                background: "linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)", color: "#FFFFFF",
                                padding: "3px 9px", borderRadius: 14, fontSize: 10.5, fontWeight: 800,
                                display: "inline-flex", alignItems: "center", gap: 4,
                                border: "1px solid rgba(255, 255, 255, 0.4)",
                                boxShadow: "0 2px 8px rgba(202, 138, 4, 0.45)",
                              }}
                            >
                              <span>★ Assigned by Plant Manager</span>
                            </div>
                          ) : (
                            <div
                              style={{
                                background: "rgba(28, 68, 99, 0.88)", backdropFilter: "blur(6px)", color: "#FFFFFF",
                                padding: "3px 9px", borderRadius: 14, fontSize: 11, fontWeight: 700,
                                display: "inline-flex", alignItems: "center", gap: 5,
                                border: "1px solid rgba(255, 255, 255, 0.18)",
                              }}
                            >
                              <span
                                style={{
                                  width: 6, height: 6, borderRadius: "50%", background: "#38BDF8",
                                  display: "inline-block", boxShadow: "0 0 6px #38BDF8",
                                }}
                              />
                              <span>{rec.matchScorePct}% Match</span>
                            </div>
                          )}
                        </div>

                        {/* Bottom HUD: Division & Duration */}
                        <div
                          style={{
                            position: "absolute", bottom: 9, left: 11, right: 11, display: "flex",
                            justifyContent: "space-between", alignItems: "center", color: "#FFFFFF", fontSize: 11,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600, color: "rgba(255,255,255,0.92)", fontSize: 11, whiteSpace: "nowrap",
                              overflow: "hidden", textOverflow: "ellipsis", maxWidth: "68%",
                            }}
                          >
                            {rec.provider}
                          </span>
                          <span
                            style={{
                              display: "flex", alignItems: "center", gap: 3, color: "rgba(255,255,255,0.85)",
                              fontWeight: 600, fontSize: 10.5, background: "rgba(0,0,0,0.35)", padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            <ClockCircleOutlined style={{ fontSize: 10 }} /> {rec.durationHours} hrs
                          </span>
                        </div>
                      </div>

                      {/* Body Content */}
                      <div
                        style={{
                          padding: "16px 16px 18px", flex: 1, display: "flex", flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          {/* Domain Pill & Level */}
                          <div
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bgLight,
                                border: `1px solid ${meta.border}`, padding: "2px 8px", borderRadius: 6,
                                letterSpacing: "0.02em",
                              }}
                            >
                              {meta.shortLabel}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{rec.level}</span>
                          </div>

                          {/* Course Title */}
                          <h3 style={sText14p5BoldColorM0}>{rec.title}</h3>

                          {/* Manager Directive Callout (If Assigned) */}
                          {rec.isAssignedByManager && (
                            <div
                              style={{
                                marginTop: 8, marginBottom: 6, padding: "8px 10px", borderRadius: 8,
                                background: "#FEFCE8", border: "1px solid #FEF08A", fontSize: 11.5, lineHeight: 1.4,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 700, color: "#854D0E", display: "flex", justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span>Directive: {rec.assignedByName || "Plant Manager"}</span>
                                {rec.priority && (
                                  <span
                                    style={{
                                      textTransform: "uppercase", fontSize: 9.5, fontWeight: 800, padding: "1px 5px",
                                      borderRadius: 4, background: rec.priority === "critical" ? "#FEE2E2" : "#FEF3C7",
                                      color: rec.priority === "critical" ? "#DC2626" : "#D97706",
                                    }}
                                  >
                                    {rec.priority}
                                  </span>
                                )}
                              </div>
                              <div style={{ color: "#713F12", marginTop: 3, fontStyle: "italic", fontSize: 11 }}>"{rec.directiveReason}"</div>
                              {rec.dueDate && (
                                <div style={{ color: "#A16207", fontSize: 10, marginTop: 4, fontWeight: 600 }}>Due by: {new Date(rec.dueDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</div>
                              )}
                            </div>
                          )}

                          {/* Real Plant Engineering Rationale */}
                          <p
                            style={{
                              margin: "6px 0 0", fontSize: 12, color: "#64748B", lineHeight: 1.45, minHeight: 35,
                              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {targetCourse?.description ||
                              "Comprehensive hands-on operational protocols and standard operating procedures."}
                          </p>

                          {/* Engineering Competency Hierarchy Badge (Modules + Video Count) */}
                          <div
                            style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
                          >
                            <span
                              style={{
                                fontSize: 10.5, fontWeight: 700, color: "#1E293B", background: "#F1F5F9",
                                padding: "2px 7px", borderRadius: 5, border: "1px solid #E2E8F0",
                              }}
                            >
                              {rec.moduleCount || targetCourse?.modules?.length || 3} Modules
                            </span>
                            <span
                              style={{
                                fontSize: 10.5, fontWeight: 600, color: "#475569", background: "#F8FAFC",
                                padding: "2px 7px", borderRadius: 5, border: "1px solid #E2E8F0",
                              }}
                            >
                              {rec.videoCount || targetCourse?.abilities?.length || 4} Video Lessons
                            </span>
                            <span style={{ fontSize: 10.5, fontWeight: 500, color: "#64748B" }}>★ {rec.rating} ({rec.reviewCount} ops reviews)</span>
                          </div>
                        </div>

                        {/* Card Action Row */}
                        <div
                          style={{
                            marginTop: 16, paddingTop: 12, borderTop: "1px solid #F1F5F9", display: "flex",
                            justifyContent: "space-between", alignItems: "center", gap: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11, color: rec.isAssignedByManager ? "#CA8A04" : nectarColors.leaf,
                              fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            <SafetyCertificateOutlined style={{ fontSize: 12 }} />
                            <span>{rec.isAssignedByManager ? "Direct Mandate" : "Plant Certified"}</span>
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/training/learn/${targetCourse?.id || rec.courseId}`);
                            }}
                            style={{
                              background: rec.isAssignedByManager
                                ? "linear-gradient(135deg, #1C4463 0%, #0F2536 100%)"
                                : nectarColors.leaf,
                              color: "#FFFFFF",
                              border: rec.isAssignedByManager ? "1.5px solid #F59E0B" : "none",
                              borderRadius: 20,
                              padding: "6px 14px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              cursor: "pointer",
                              transition: "all 0.18s ease",
                              boxShadow: rec.isAssignedByManager
                                ? "0 2px 10px rgba(245, 158, 11, 0.3)"
                                : "none",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.02)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            <span>{rec.isAssignedByManager ? "Execute Directive" : "Start Course"}</span>
                            <PlayCircleOutlined />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>

            {/* Architectural Footer Bar for Expand / Collapse */}
            {filteredRecs.length > 6 && (
              <div
                style={{
                  marginTop: 26, paddingTop: 18, borderTop: "1px solid #E2E8F0", display: "flex",
                  justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
                }}
              >
                <div style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>
                  Showing{" "}
                  <strong style={{ color: "#0F172A" }}>{recsExpanded ? filteredRecs.length : Math.min(6, filteredRecs.length)}</strong>{" "}
                  of <strong style={{ color: "#0F172A" }}>{filteredRecs.length}</strong> telemetry-matched courses
                </div>

                <Button
                  size="middle"
                  onClick={() => setRecsExpanded((prev) => !prev)}
                  icon={recsExpanded ? <UpOutlined /> : <DownOutlined />}
                  style={{
                    borderColor: "rgba(28, 68, 99, 0.3)", color: nectarColors.leaf, fontWeight: 600, borderRadius: 10,
                    padding: "0 20px", height: 38, background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  {recsExpanded ? "Collapse to Top 6" : `Show All ${filteredRecs.length} Courses`}
                </Button>
              </div>
            )}
          </div>

          {/* C. PLANT PILLAR COMMAND CONSOLE */}
          <div
            style={{
              marginTop: 36, marginBottom: 24, background: "#FFFFFF", borderRadius: 20, padding: "20px 24px",
              border: "1px solid rgba(11, 26, 36, 0.08)", boxShadow: "0 4px 20px -6px rgba(11, 26, 36, 0.04)",
            }}
          >
            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11, fontWeight: 700, color: nectarColors.leaf, letterSpacing: "0.1em",
                    textTransform: "uppercase", marginBottom: 4, display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 6, height: 6, borderRadius: "50%", background: nectarColors.leaf, display: "inline-block",
                    }}
                  />
                  <span>Nectar Enviro Core Engineering Curriculum</span>
                </div>
                <h3
                  style={{
                    margin: 0, fontSize: 18, fontWeight: 800, color: nectarColors.ink, letterSpacing: "-0.015em",
                  }}
                >
                  6 Plant Engineering Pillars & Turnkey Services
                </h3>
              </div>

              {/* Pillar Switcher Tabs */}
              <div style={inlineRowWrapGap3BgPadR14Border}>
                {[
                  { key: "All", label: "All Pillars", count: allCourses.length },
                  {
                    key: "ETP",
                    label: "ETP Effluents",
                    count: allCourses.filter((c) => c.section.includes("ETP")).length,
                  },
                  {
                    key: "STP",
                    label: "STP Sewage",
                    count: allCourses.filter((c) => c.section.includes("STP")).length,
                  },
                  {
                    key: "WTP",
                    label: "WTP High Purity",
                    count: allCourses.filter((c) => c.section.includes("WTP")).length,
                  },
                  {
                    key: "ZLD",
                    label: "ZLD Thermal",
                    count: allCourses.filter((c) => c.section.includes("ZLD")).length,
                  },
                  {
                    key: "Consulting",
                    label: "Consulting",
                    count: allCourses.filter((c) => c.section.includes("Consulting")).length,
                  },
                  {
                    key: "O&M",
                    label: "O&M Services",
                    count: allCourses.filter((c) => c.section.includes("Maintenance")).length,
                  },
                ].map((tab) => {
                  const isActive = pillarFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setPillarFilter(tab.key)}
                      style={{
                        padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: isActive ? 700 : 500,
                        border: "none", background: isActive ? nectarColors.leaf : "transparent",
                        color: isActive ? "#FFFFFF" : "#475569", cursor: "pointer", display: "inline-flex",
                        alignItems: "center", gap: 6, boxShadow: isActive ? "0 2px 8px rgba(28, 68, 99, 0.25)" : "none",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <span>{tab.label}</span>
                      <span
                        style={{
                          fontSize: 10.5, fontWeight: 700, padding: "1px 5px", borderRadius: 8,
                          background: isActive ? "rgba(255, 255, 255, 0.22)" : "#E2E8F0",
                          color: isActive ? "#FFFFFF" : "#64748B",
                        }}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* D. CORE PLANT CURRICULUM SECTIONS */}
          {sections
            .filter((sec) => {
              if (pillarFilter === "All") return true;
              if (pillarFilter === "O&M") return sec.title.includes("Maintenance");
              return sec.title.includes(pillarFilter);
            })
            .map((sec) => {
              const secCourses = allCourses.filter(
                (c) =>
                  c.section === sec.title &&
                  matchesCourseFilter(c, searchQuery, selectedCategory),
              );

              if (secCourses.length === 0 && (searchQuery || selectedCategory !== "All")) {
                return null;
              }

              const isExpanded = Boolean(expandedSections[sec.title]);
              const visibleCourses = isExpanded ? secCourses : secCourses.slice(0, 4);
              const secMeta = getDomainMeta(sec.title);
              const telemetryData = sectionTelemetryMetrics[sec.title] || {
                divisionCode: "ENGINEERING DIVISION",
                standard: "Statutory Environmental Standard",
                leadSpecialty: sec.badge,
                metrics: ["Continuous OCEMS Telemetry", "SOP Reliability SLA"],
              };

              return (
                <div
                  key={sec.title}
                  style={{
                    marginBottom: 36, background: "#FFFFFF", borderRadius: 22,
                    border: "1px solid rgba(11, 26, 36, 0.08)", boxShadow: "0 6px 24px -8px rgba(11, 26, 36, 0.04)",
                    overflow: "hidden",
                  }}
                >
                  {/* 1. Architectural Section Dossier Header */}
                  <div
                    style={{
                      background: secMeta.bgLight, borderBottom: `1px solid ${secMeta.border}`,
                      padding: "24px 28px 22px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap",
                        gap: 16, marginBottom: 12,
                      }}
                    >
                      <div>
                        {/* Division Code & Standard Badges */}
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}
                        >
                          <span
                            style={{
                              fontSize: 11, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.08em",
                              color: secMeta.color, background: "#FFFFFF", border: `1px solid ${secMeta.border}`,
                              padding: "3px 9px", borderRadius: 6,
                            }}
                          >
                            {telemetryData.divisionCode}
                          </span>
                          <span
                            style={{
                              fontSize: 11, fontWeight: 600, color: "#475569", background: "rgba(255,255,255,0.75)",
                              border: "1px solid rgba(0,0,0,0.06)", padding: "3px 9px", borderRadius: 6,
                            }}
                          >
                            {telemetryData.standard}
                          </span>
                        </div>

                        {/* Title */}
                        <h2
                          style={{
                            margin: 0, fontSize: 22, fontWeight: 800, color: nectarColors.ink, letterSpacing: "-0.02em",
                          }}
                        >
                          {sec.title}
                        </h2>

                        {/* Scope description */}
                        <div style={{ fontSize: 13, color: "#475569", marginTop: 4, maxWidth: 840, lineHeight: 1.5 }}>{sec.description}</div>
                      </div>

                      {/* Right Metrics Capsule */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <div
                          style={{
                            fontSize: 12, fontWeight: 700, color: secMeta.color, background: "#FFFFFF",
                            padding: "5px 14px", borderRadius: 20, border: `1px solid ${secMeta.border}`,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                          }}
                        >
                          Showing {visibleCourses.length} of {secCourses.length} Courses
                        </div>
                        <div style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>{secCourses.reduce((acc, c) => acc + c.estimatedHours, 0)} Total Training Hours</div>
                      </div>
                    </div>

                    {/* 2. Plant Parameter Telemetry Strip */}
                    <div
                      style={{
                        marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex",
                        alignItems: "center", gap: 10, flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11, fontWeight: 700, color: secMeta.color, letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        Operational Benchmarks:
                      </span>
                      {telemetryData.metrics.map((m, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 11, fontWeight: 600, color: "#334155", background: "#FFFFFF", padding: "2px 8px",
                            borderRadius: 5, border: "1px solid rgba(0,0,0,0.05)", display: "inline-flex",
                            alignItems: "center", gap: 5,
                          }}
                        >
                          <span
                            style={{
                              width: 5, height: 5, borderRadius: "50%", background: secMeta.accent,
                              display: "inline-block",
                            }}
                          />
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 3. Cards Grid */}
                  <div style={{ padding: "26px 28px 28px" }}>
                    <Row gutter={[20, 20]}>
                      {visibleCourses.map((course) => {
                        const enr = myEnrollments.find((e) => e.courseId === course.id);
                        const completedCount = enr
                          ? course.abilities.filter((a) => enr.abilityProgress[a.id]?.completedAt).length
                          : 0;
                        const pct = Math.round((completedCount / course.abilities.length) * 100);

                        return (
                          <Col xs={24} sm={12} md={12} lg={6} xl={6} key={course.id}>
                            <div
                              onClick={() => router.push(`/training/learn/${course.id}`)}
                              style={{
                                background: "#FFFFFF", borderRadius: 16, border: "1px solid rgba(11, 26, 36, 0.08)",
                                boxShadow: "0 2px 10px rgba(11, 26, 36, 0.03)", overflow: "hidden", display: "flex",
                                flexDirection: "column", justifyContent: "space-between", height: "100%",
                                transition: "all 0.28s cubic-bezier(0.16, 1, 0.3, 1)", cursor: "pointer",
                                position: "relative",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-4px)";
                                e.currentTarget.style.boxShadow =
                                  "0 20px 40px -10px rgba(28, 68, 99, 0.14), 0 2px 6px rgba(11, 26, 36, 0.04)";
                                e.currentTarget.style.borderColor = secMeta.accent;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 2px 10px rgba(11, 26, 36, 0.03)";
                                e.currentTarget.style.borderColor = "rgba(11, 26, 36, 0.08)";
                              }}
                            >
                              {/* Top Color Accent Line */}
                              <div style={{ height: 3, background: secMeta.accent, width: "100%" }} />

                              {/* Top Image Banner */}
                              <div
                                style={{
                                  height: 150, backgroundImage: `url(${course.thumbnailUrl})`, backgroundSize: "cover",
                                  backgroundPosition: "center", position: "relative",
                                }}
                              >
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    background:
                                      "linear-gradient(to top, rgba(11,26,36,0.90) 0%, rgba(11,26,36,0.2) 50%, rgba(11,26,36,0.6) 100%)",
                                  }}
                                />

                                {/* Top HUD: Code & Duration */}
                                <div style={rowCenterBetween}>
                                  <div
                                    style={{
                                      background: "rgba(11, 26, 36, 0.85)", backdropFilter: "blur(6px)",
                                      color: "#FFFFFF", padding: "3px 8px", borderRadius: 6, fontSize: 11,
                                      fontFamily: "monospace", fontWeight: 700,
                                      border: "1px solid rgba(255, 255, 255, 0.12)", letterSpacing: "0.04em",
                                    }}
                                  >
                                    {course.code}
                                  </div>

                                  <div
                                    style={{
                                      display: "flex", alignItems: "center", gap: 3, color: "rgba(255,255,255,0.92)",
                                      fontWeight: 600, fontSize: 10.5, background: "rgba(0,0,0,0.38)",
                                      backdropFilter: "blur(4px)", padding: "2px 7px", borderRadius: 4,
                                    }}
                                  >
                                    <ClockCircleOutlined style={{ fontSize: 10 }} /> {course.estimatedHours} hrs
                                  </div>
                                </div>

                                {/* Bottom HUD: Division Stamp */}
                                <div
                                  style={{
                                    position: "absolute", bottom: 8, left: 11, right: 11,
                                    color: "rgba(255,255,255,0.95)", fontSize: 11, fontWeight: 600,
                                    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                                  }}
                                >
                                  {secMeta.name}
                                </div>
                              </div>

                              {/* Body Content */}
                              <div
                                style={{
                                  padding: "16px 18px 20px", flex: 1, display: "flex", flexDirection: "column",
                                  justifyContent: "space-between",
                                }}
                              >
                                <div>
                                  {/* Course Title */}
                                  <h3 style={sText14p5BoldColorM0}>{course.title}</h3>

                                  {/* Actual Key Abilities (No Truncated AI Sentences!) */}
                                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                                    {course.abilities.slice(0, 2).map((ab, idx) => (
                                      <div
                                        key={ab.id || idx}
                                        style={{
                                          fontSize: 11.5, color: "#475569", lineHeight: 1.4, display: "flex",
                                          alignItems: "flex-start", gap: 6,
                                        }}
                                      >
                                        <span style={{ color: secMeta.color, fontSize: 10, marginTop: 2, flexShrink: 0 }}>▸</span>
                                        <span
                                          style={{
                                            display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                          }}
                                        >
                                          {ab.title}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Segmented Milestone Progress Meter */}
                                <div style={{ marginTop: 16 }}>
                                  <div
                                    style={{
                                      display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748B",
                                      marginBottom: 6,
                                    }}
                                  >
                                    <span>{completedCount} of {course.abilities.length} Abilities Passed</span>
                                    <span style={{ fontWeight: 700, color: secMeta.color }}>{pct}%</span>
                                  </div>

                                  {/* Multi-Segment Pip Bar */}
                                  <div style={{ display: "flex", gap: 3, width: "100%" }}>
                                    {course.abilities.map((a, i) => {
                                      const isDone = Boolean(enr?.abilityProgress[a.id]?.completedAt);
                                      return (
                                        <div
                                          key={a.id || i}
                                          style={{
                                            height: 4,
                                            flex: 1,
                                            borderRadius: 2,
                                            background: isDone
                                              ? "#16A34A"
                                              : pct > 0 && i === 0
                                              ? secMeta.color
                                              : "rgba(11, 26, 36, 0.08)",
                                            transition: "background 0.3s ease",
                                          }}
                                        />
                                      );
                                    })}
                                  </div>

                                  {/* Action Station Footer: Button-in-Button */}
                                  <div
                                    style={{
                                      marginTop: 14, paddingTop: 12, borderTop: "1px solid #F1F5F9", display: "flex",
                                      justifyContent: "space-between", alignItems: "center", gap: 6,
                                    }}
                                  >
                                    {enr?.status === "CERTIFIED" ? (
                                      <span
                                        style={{
                                          fontSize: 11, fontWeight: 700, color: nectarColors.leaf,
                                          background: "#EAF1F6", border: "1px solid rgba(28, 68, 99, 0.15)",
                                          padding: "3px 8px", borderRadius: 6, display: "inline-flex",
                                          alignItems: "center", gap: 4,
                                        }}
                                      >
                                        <CheckCircleFilled style={{ fontSize: 11, color: nectarColors.leaf }} /> Certified
                                      </span>
                                    ) : enr?.status === "SKILL_MAP_DONE" ? (
                                      <span
                                        style={{
                                          fontSize: 11, fontWeight: 600, color: "#6D28D9", background: "#F5F3FF",
                                          padding: "3px 8px", borderRadius: 6,
                                        }}
                                      >
                                        In Review
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          fontSize: 11, fontWeight: 600, color: "#475569", background: "#F1F5F9",
                                          padding: "3px 8px", borderRadius: 6,
                                        }}
                                      >
                                        {course.abilities.length} Modules
                                      </span>
                                    )}

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/training/learn/${course.id}`);
                                      }}
                                      style={{
                                        background: nectarColors.leaf, color: "#FFFFFF", border: "none",
                                        borderRadius: 20, padding: "5px 6px 5px 12px", fontSize: 11.5, fontWeight: 600,
                                        display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                                        transition: "all 0.18s ease",
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = nectarColors.ink;
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = nectarColors.leaf;
                                      }}
                                    >
                                      <span>{pct > 0 ? "Resume" : "Start"}</span>
                                      <span
                                        style={{
                                          width: 20, height: 20, borderRadius: "50%",
                                          background: "rgba(255, 255, 255, 0.2)", display: "flex", alignItems: "center",
                                          justifyContent: "center", fontSize: 9.5,
                                        }}
                                      >
                                        <PlayCircleOutlined />
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Col>
                        );
                      })}
                    </Row>

                    {/* Section Expand / Collapse */}
                    {secCourses.length > 4 && (
                      <div style={{ textAlign: "center", marginTop: 22 }}>
                        <Button
                          size="middle"
                          onClick={() => toggleSection(sec.title)}
                          icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                          style={{
                            borderColor: "rgba(28, 68, 99, 0.3)", color: nectarColors.leaf, fontWeight: 600,
                            borderRadius: 10, padding: "0 22px", height: 38, background: "#FFFFFF",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                          }}
                        >
                          {isExpanded
                            ? "Collapse Courses"
                            : `Show All ${secCourses.length} Courses in ${secMeta.shortLabel}`}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          {/* Universal Bottom Recommendations */}
          <CourseraRecommendationsGrid
            title="Recommended Specializations & Multi-Course Programs"
            subtitle="Based on Nectar Enviro operations, advance your career through our industry-accredited technical specializations."
          />
        </div>
      )}

      {/* ----------------- MY CERTIFICATES TAB ----------------- */}
      {activeTab === "certificates" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {myCertificates.length === 0 ? (
            <div
              style={{
                background: "#FFFFFF", borderRadius: 14, padding: 40, textAlign: "center",
                border: "1px solid rgba(28, 68, 99, 0.08)",
              }}
            >
              <TrophyOutlined style={{ fontSize: 48, color: nectarColors.muted, marginBottom: 12 }} />
              <h3 style={{ margin: 0, fontSize: 16, color: nectarColors.ink }}>No Certificates Issued Yet</h3>
              <p style={{ margin: "6px 0 16px", fontSize: 13, color: nectarColors.muted }}>
                Complete all course modules, pass the Skill Mapping test, and complete the Manager Practical and Oral evaluations to earn your certificate.
              </p>
              <Button type="primary" onClick={() => setActiveTab("catalog")} style={{ background: nectarColors.leaf }}>Go to Course Catalog</Button>
            </div>
          ) : (
            <Row gutter={[20, 20]}>
              {myCertificates.map((cert) => (
                <Col xs={24} sm={12} key={cert.id}>
                  <div
                    style={{
                      background: "#FFFFFF", borderRadius: 14, border: "1px solid rgba(28, 68, 99, 0.1)",
                      boxShadow: "0 2px 10px rgba(11, 26, 36, 0.03)", padding: 24, display: "flex",
                      flexDirection: "column", justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 11, color: nectarColors.leaf, fontWeight: 700, letterSpacing: "0.08em" }}>VERIFIED COMPETENCY CERTIFICATE</div>
                          <h3 style={{ margin: "4px 0 0", fontSize: 17, fontWeight: 600, color: nectarColors.ink }}>{cert.courseTitle}</h3>
                        </div>
                        <Tag color="success" style={{ margin: 0, borderRadius: 12, fontWeight: 700 }}>{cert.overallPct}% Overall</Tag>
                      </div>

                      <div
                        style={{
                          marginTop: 16, background: nectarColors.sand, padding: "10px 14px", borderRadius: 10,
                          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, textAlign: "center",
                          fontSize: 11,
                        }}
                      >
                        <div>
                          <div style={{ color: nectarColors.muted }}>Skill Map</div>
                          <div style={{ fontWeight: 700, color: nectarColors.leaf }}>{cert.skillMapPct}%</div>
                        </div>
                        <div>
                          <div style={{ color: nectarColors.muted }}>Written</div>
                          <div style={{ fontWeight: 700, color: nectarColors.leaf }}>{cert.writtenPct}%</div>
                        </div>
                        <div>
                          <div style={{ color: nectarColors.muted }}>Practical</div>
                          <div style={{ fontWeight: 700, color: nectarColors.leaf }}>{cert.practicalPct}%</div>
                        </div>
                        <div>
                          <div style={{ color: nectarColors.muted }}>Oral Viva</div>
                          <div style={{ fontWeight: 700, color: nectarColors.leaf }}>{cert.oralPct}%</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 11, color: nectarColors.muted, fontFamily: "monospace" }}>ID: {cert.certificateNo}</div>
                      <Button
                        type="primary"
                        icon={<SafetyCertificateOutlined />}
                        onClick={() => setActiveCert(cert)}
                        style={{ background: nectarColors.leaf, borderRadius: 8 }}
                      >
                        View Official Certificate
                      </Button>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          )}
        </div>
      )}

      {/* ----------------- SCHEDULE TAB ----------------- */}
      {activeTab === "schedule" && (
        <TrainingScheduleView employeeId={selfId} />
      )}

      {/* MODALS */}
      <CoursePlayerModal
        course={playerCourse}
        employeeId={selfId}
        onClose={() => setPlayerCourse(null)}
        onEnrollmentUpdated={() => setRefreshTrigger((t) => t + 1)}
      />

      <CertificateModal certificate={activeCert} onClose={() => setActiveCert(null)} />

      {/* Executive & Plant Lead Masterclasses Enrollment & Doubt Submission Modal */}
      <Modal
        open={Boolean(selectedMasterclass)}
        onCancel={() => setSelectedMasterclass(null)}
        footer={null}
        width={640}
        destroyOnHidden
        centered
      >
        {selectedMasterclass && (() => {
          const isEnrolled = selectedMasterclass.enrolledEmployeeIds?.includes(selfId);
          const availableSeats = Math.max(0, selectedMasterclass.maxCapacity - selectedMasterclass.registeredCount);
          const isFull = availableSeats <= 0;
          const slots = selectedMasterclass.slots || [];
          const activeSlotId = selectedSlotId || selectedMasterclass.selectedSlotMap?.[selfId] || slots[0]?.id || "";
          const activeAgenda = selectedAgenda || selectedMasterclass.selectedAgendaMap?.[selfId] || "Plant Troubleshooting & Shock Load";
          const meetingLink = selectedMasterclass.meetingLink || "https://meet.google.com/nec-lead-ops";

          return (
            <div style={{ padding: "6px 2px" }}>
              {/* Speaker / Mentor Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div
                  style={{
                    width: 64, height: 64, borderRadius: "50%",
                    backgroundImage: `url(${selectedMasterclass.photoDataUrl})`, backgroundSize: "cover",
                    backgroundPosition: "center 20%",
                    border: selectedMasterclass.isFounder ? "2.5px solid #F59E0B" : `2.5px solid ${nectarColors.leaf}`,
                    flexShrink: 0, boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)", position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute", bottom: 0, right: 0, width: 16, height: 16, borderRadius: "50%",
                      background: "#16A34A", border: "2px solid #FFFFFF",
                    }}
                  />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontSize: 17.5, fontWeight: 700, color: "#0F172A" }}>{selectedMasterclass.mentorName}</h3>
                    {selectedMasterclass.isFounder ? (
                      <Tag color="gold" style={{ margin: 0, borderRadius: 10, fontWeight: 700 }}>👑 {selectedMasterclass.badgeText}</Tag>
                    ) : (
                      <Tag style={{ margin: 0, borderRadius: 10, fontWeight: 600, background: "#EAF1F6", border: "1px solid rgba(28, 68, 99, 0.2)", color: nectarColors.leaf }}>{selectedMasterclass.badgeText}</Tag>
                    )}
                    <span style={{ fontSize: 12, color: "#D97706", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><StarFilled style={{ fontSize: 11 }} /> {selectedMasterclass.mentorRating}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: selectedMasterclass.isFounder ? "#B45309" : nectarColors.leaf, fontWeight: 600, marginTop: 2 }}>{selectedMasterclass.mentorRole} · {selectedMasterclass.mentorDepartment}</div>
                </div>
              </div>

              {/* Live Group Session Schedule & Telemetry Banner */}
              <div
                style={{
                  background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px",
                  marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: nectarColors.muted, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}><CalendarOutlined style={{ color: nectarColors.leaf }} /> Scheduled Live Session</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: nectarColors.ink, marginTop: 3 }}>{selectedMasterclass.scheduledAt}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: nectarColors.muted, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}><TeamOutlined style={{ color: nectarColors.leaf }} /> Format & Duration</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: nectarColors.ink, marginTop: 3 }}>Live Group Masterclass · {selectedMasterclass.durationMinutes} mins</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: nectarColors.muted, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}><UserOutlined style={{ color: nectarColors.leaf }} /> Batch Cohort</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: nectarColors.leaf, marginTop: 3 }}>{selectedMasterclass.registeredCount} / {selectedMasterclass.maxCapacity} Operators Enrolled</div>
                </div>
              </div>

              {/* Topic & Description Card */}
              <div
                style={{
                  background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px",
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: nectarColors.leaf, textTransform: "uppercase", letterSpacing: "0.06em" }}>Masterclass Focus Topic</div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: nectarColors.ink, marginTop: 4, lineHeight: 1.35 }}>{selectedMasterclass.topic}</div>
                <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#64748B", lineHeight: 1.5 }}>{selectedMasterclass.description}</p>
              </div>

              {/* Pre-Session Question for Mentor */}
              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5,
                    fontWeight: 700, color: nectarColors.ink, marginBottom: 6,
                  }}
                >
                  <span>
                    <MessageOutlined style={{ color: nectarColors.leaf, marginRight: 6 }} />
                    Ask a Question or Plant Challenge for {selectedMasterclass.mentorName.split(" ")[0]} (Optional)
                  </span>
                  <span style={{ fontSize: 11, color: nectarColors.muted, fontWeight: 400 }}>Discussed live with the group</span>
                </label>
                <Input.TextArea
                  rows={3}
                  placeholder="e.g. During shock organic loads, what specific polymer dosing ratio and RAS cycle adjustments do you recommend?"
                  value={doubtQuestion}
                  onChange={(e) => setDoubtQuestion(e.target.value)}
                  style={{ borderRadius: 8 }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid #E2E8F0" }}>
                {isEnrolled ? (
                  <Button
                    danger
                    onClick={async () => {
                      const res = await cancelLiveMasterclassEnrollment(selectedMasterclass.id, selfId);
                      message.info(res.message);
                      setRefreshTrigger((t) => t + 1);
                      setSelectedMasterclass(null);
                    }}
                  >
                    Unenroll from Session
                  </Button>
                ) : <div />}

                <div style={{ display: "flex", gap: 10 }}>
                  <Button onClick={() => setSelectedMasterclass(null)}>Close</Button>
                  
                  {isEnrolled && (
                    <Button
                      type="default"
                      icon={<VideoCameraOutlined />}
                      onClick={() => message.info("Join Session feature coming soon! Live stream room will activate at the scheduled time.")}
                      style={{
                        borderColor: "rgba(28, 68, 99, 0.3)", color: nectarColors.leaf, fontWeight: 700,
                        borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <span>Join Session</span>
                      <span
                        style={{
                          fontSize: 9.5, fontWeight: 700, background: "#FEF3C7", color: "#B45309", padding: "1.5px 5px",
                          borderRadius: 4, lineHeight: 1.2,
                        }}
                      >
                        Coming Soon
                      </span>
                    </Button>
                  )}

                  <Button
                    type="primary"
                    loading={isEnrollingSession}
                    disabled={!isEnrolled && isFull}
                    onClick={async () => {
                      setIsEnrollingSession(true);
                      const res = await enrollInLiveMasterclass(
                        selectedMasterclass.id,
                        selfId,
                        currentUser?.name || "Employee",
                        doubtQuestion,
                        activeSlotId,
                        activeAgenda,
                      );
                      setIsEnrollingSession(false);
                      if (res.success) {
                        message.success(res.message);
                        setDoubtQuestion("");
                        setRefreshTrigger((t) => t + 1);
                        setSelectedMasterclass(null);
                      } else {
                        message.error(res.message);
                      }
                    }}
                    style={{
                      background: selectedMasterclass.isFounder ? "#D97706" : nectarColors.leaf,
                      borderColor: selectedMasterclass.isFounder ? "#D97706" : nectarColors.leaf, fontWeight: 700,
                      borderRadius: 8,
                    }}
                  >
                    {isEnrolled
                      ? "Save Question Changes"
                      : isFull
                        ? "Batch Full"
                        : "Enroll in Live Session"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Mentor Drop-In Registration Modal */}
      <Modal
        open={Boolean(bookingMentor)}
        onCancel={() => setBookingMentor(null)}
        footer={null}
        width={600}
        destroyOnHidden
        centered
      >
        {bookingMentor && (
          <div style={{ padding: "8px 4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div
                style={{
                  width: 64, height: 64, borderRadius: "50%", backgroundImage: `url(${bookingMentor.photoUrl})`,
                  backgroundSize: "cover", backgroundPosition: "center 20%", border: `2px solid ${nectarColors.leaf}`,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0F172A" }}>{bookingMentor.name}</h3>
                  <Tag color="purple" style={{ margin: 0, borderRadius: 8 }}>Mentor Clinic</Tag>
                </div>
                <div style={{ fontSize: 13, color: nectarColors.leaf, fontWeight: 600 }}>{bookingMentor.role} · {bookingMentor.department}</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Specialty: {bookingMentor.specialty}</div>
              </div>
            </div>

            <div
              style={{
                background: "#F8FAFC", borderRadius: 10, padding: "14px 16px", marginBottom: 18,
                border: "1px solid #E2E8F0",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Mentor Drop-In Availability Windows</label>
                <span style={{ fontSize: 11, color: "#64748B" }}>{bookingMentor.publishedClinics.length} scheduled clinic(s)</span>
              </div>

              {bookingMentor.publishedClinics.length === 0 ? (
                <div style={{ fontSize: 12, color: "#64748B" }}>No active availability windows dropped yet.</div>
              ) : (
                <Radio.Group
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                  style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}
                >
                  {bookingMentor.publishedClinics.map((clinic: any) => {
                    const isFull = clinic.registeredCount >= clinic.capacity;
                    const seatsLeft = Math.max(0, clinic.capacity - clinic.registeredCount);
                    return (
                      <Radio
                        key={clinic.id}
                        value={clinic.id}
                        disabled={isFull}
                        style={{
                          background: selectedClinicId === clinic.id ? "#EAF1F6" : "#FFFFFF",
                          border: selectedClinicId === clinic.id ? `1.5px solid ${nectarColors.leaf}` : "1px solid #E2E8F0",
                          borderRadius: 8, padding: "10px 12px", width: "100%", margin: 0,
                        }}
                      >
                        <div style={{ marginLeft: 6 }}>
                          <div style={{ fontWeight: 600, color: "#0F172A", fontSize: 13 }}>{clinic.topic || bookingMentor.specialty}</div>
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>📅 {clinic.dayTime}</div>
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>📍 {clinic.location}</div>
                          <div style={{ marginTop: 4 }}>
                            {isFull ? (
                              <Tag color="error" style={{ fontSize: 10, margin: 0 }}>Clinic Full ({clinic.capacity}/{clinic.capacity})</Tag>
                            ) : (
                              <Tag color="success" style={{ fontSize: 10, margin: 0 }}>{seatsLeft} seat(s) remaining ({clinic.registeredCount}/{clinic.capacity} booked)</Tag>
                            )}
                          </div>
                        </div>
                      </Radio>
                    );
                  })}
                </Radio.Group>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>Topics or Operational Questions for this Clinic (Optional)</label>
              <Input.TextArea
                rows={3}
                placeholder="e.g. Need clarification on MLSS control during shock COD load, or help preparing for Secondary Clarifier practical viva..."
                value={clinicNotes}
                onChange={(e) => setClinicNotes(e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button onClick={() => setBookingMentor(null)}>Cancel</Button>
              <Button
                type="primary"
                loading={isRegisteringClinic}
                disabled={!selectedClinicId}
                onClick={handleRegisterClinic}
                style={{ background: nectarColors.leaf, fontWeight: 600, borderRadius: 8 }}
              >
                Confirm Drop-In Seat
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
