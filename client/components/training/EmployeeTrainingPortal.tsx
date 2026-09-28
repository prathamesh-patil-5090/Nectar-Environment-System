"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Tabs,
  Tag,
  Button,
  Progress,
  Row,
  Col,
  Modal,
  message,
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
} from "@ant-design/icons";
import { getSession } from "@/lib/auth";
import { scopedEmployeeId, selfEmployeeId } from "@/lib/rbac";
import { getEmployeeById } from "@/lib/mock-data";
import { nectarColors } from "@/lib/theme";
import type {
  Course,
  Certificate,
} from "@/lib/training/types";
import {
  getAllCourses,
  getEnrollmentsForEmployee,
  getCertificates,
  getRecommendedCourses,
  getMentorProfiles,
  registerForDropInClinic,
} from "@/lib/training/store";

// Components
import CoursePlayerModal from "@/components/training/CoursePlayerModal";
import CertificateModal from "@/components/training/CertificateModal";
import TrainingScheduleView from "@/components/training/TrainingScheduleView";
import { CourseraRecommendationsGrid } from "@/components/training/CourseraRecommendationsGrid";

// Domain Metadata for Nectar's 6 Industrial Pillars
const getDomainMeta = (nameOrCategory: string) => {
  if (nameOrCategory.includes("ETP") || nameOrCategory.includes("Effluent")) {
    return {
      pillar: "ETP",
      name: "Turnkey Industrial Effluents",
      shortLabel: "ETP",
      tag: "Membranes & Heavy Effluents",
      color: "#1C4463",
      bgLight: "#F0F5F9",
      border: "rgba(28, 68, 99, 0.22)",
      accent: "#1C4463",
      spec: "CPCB Sched-VI Standard",
    };
  }
  if (nameOrCategory.includes("WTP") || nameOrCategory.includes("Water")) {
    return {
      pillar: "WTP",
      name: "High Purity & Membrane Systems",
      shortLabel: "WTP & RO",
      tag: "Desalination & EDI Ultrapure",
      color: "#0284C7",
      bgLight: "#F0F9FF",
      border: "rgba(2, 132, 199, 0.25)",
      accent: "#0284C7",
      spec: "IS 10500 / USP Water",
    };
  }
  if (nameOrCategory.includes("STP") || nameOrCategory.includes("Sewage")) {
    return {
      pillar: "STP",
      name: "Municipal & Commercial STP",
      shortLabel: "STP",
      tag: "SBR & Virgin MBBR Carriers",
      color: "#0D9488",
      bgLight: "#F0FDFA",
      border: "rgba(13, 148, 136, 0.25)",
      accent: "#0D9488",
      spec: "NGT Urban Reuse (<10 BOD)",
    };
  }
  if (nameOrCategory.includes("ZLD") || nameOrCategory.includes("Zero Liquid")) {
    return {
      pillar: "ZLD",
      name: "Thermal Evaporators & Crystallization",
      shortLabel: "ZLD",
      tag: "High-Recovery Brine & ATFD",
      color: "#D97706",
      bgLight: "#FFFBEB",
      border: "rgba(217, 119, 6, 0.25)",
      accent: "#D97706",
      spec: "Zero Discharge Mandate",
    };
  }
  if (nameOrCategory.includes("Consulting") || nameOrCategory.includes("Environmental")) {
    return {
      pillar: "ENV",
      name: "Environmental Consulting Services",
      shortLabel: "Consulting",
      tag: "Mass Balance & Statutory Consents",
      color: "#7C3AED",
      bgLight: "#F5F3FF",
      border: "rgba(124, 58, 237, 0.25)",
      accent: "#7C3AED",
      spec: "CTE / CTO Consents",
    };
  }
  return {
    pillar: "ONM",
    name: "Operation and Maintenance (O&M)",
    shortLabel: "O&M",
    tag: "Deputed Crew & WQ&Q SLA",
    color: "#059669",
    bgLight: "#ECFDF5",
    border: "rgba(5, 150, 105, 0.25)",
    accent: "#059669",
    spec: "Preventive SLA Compliance",
  };
};

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
  const session = getSession();
  const selfId = employeeId ?? scopedEmployeeId(session) ?? selfEmployeeId(session) ?? "emp0126";
  const currentUser = getEmployeeById(selfId);

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
  const allCourses = useMemo(() => getAllCourses(), []);
  const myEnrollments = useMemo(
    () => getEnrollmentsForEmployee(selfId),
    [selfId, refreshTrigger],
  );
  const myCertificates = useMemo(
    () => getCertificates(selfId),
    [selfId, refreshTrigger],
  );
  const recommendations = useMemo(() => getRecommendedCourses(), []);
  const mentors = useMemo(() => getMentorProfiles(), [refreshTrigger]);

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

  // Mentor Drop-In Registration State
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

    if (category === "All" || category === "All Services") return true;
    if (category === "Effluent Treatment (ETP)" || category === "ETP Operations")
      return course.section === "Effluent Treatment Plants (ETP)";
    if (category === "Sewage Treatment (STP)")
      return course.section === "Sewage Treatment Plants (STP)";
    if (category === "Water Treatment (WTP)" || category === "RO & Membrane")
      return course.section === "Water Treatment Plants (WTP)";
    if (category === "Zero Liquid Discharge (ZLD)")
      return course.section === "Zero Liquid Discharge (ZLD)";
    if (category === "Environmental Consulting")
      return course.section === "Environmental Consulting Services";
    if (category === "Operation & Maintenance (O&M)")
      return course.section === "Operation and Maintenance (O&M)";
    return true;
  };

  // Filtered recommendations
  const filteredRecs = useMemo(() => {
    let list = recommendations;
    if (recFilter !== "All") {
      list = list.filter((r) => r.category === recFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.provider.toLowerCase().includes(q),
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
    setExpandedSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. TOP HERO HEADER */}
      <div
        style={{
          position: "relative",
          background: "linear-gradient(135deg, #07101B 0%, #0F2033 55%, #0A1523 100%)",
          borderRadius: 18,
          padding: "26px 30px",
          color: "#FFFFFF",
          boxShadow: "0 20px 40px -12px rgba(2, 6, 23, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          overflow: "hidden",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 22,
        }}
      >
        {/* Subtle Decorative Ambient Mesh Glows */}
        <div
          style={{
            position: "absolute",
            top: "-30%",
            left: "-10%",
            width: "50%",
            height: "160%",
            background: "radial-gradient(circle, rgba(22, 163, 74, 0.16) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-40%",
            right: "5%",
            width: "45%",
            height: "160%",
            background: "radial-gradient(circle, rgba(28, 68, 99, 0.35) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        {/* Left Side: Title & Gated 4-Tier Framework */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 680 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                background: "rgba(22, 163, 74, 0.18)",
                border: "1px solid rgba(74, 222, 128, 0.35)",
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 700,
                color: "#86EFAC",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#4ADE80",
                  display: "inline-block",
                  boxShadow: "0 0 8px #4ADE80",
                }}
              />
              NEIPL Process Academy
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 10px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 500,
                color: "#E2E8F0",
              }}
            >
              <CheckCircleFilled style={{ color: "#38BDF8", fontSize: 12 }} /> 4-Tier Assessment Model
            </span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 23,
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: "-0.015em",
              lineHeight: 1.25,
            }}
          >
            Manpower Training & Competency Management
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255, 255, 255, 0.75)" }}>
            Welcome back, {currentUser?.name ?? "Operator"}. Master industrial plant modules, verify SOP competencies, and register for senior shift clinics.
          </p>
        </div>

        {/* Right Side: Active Learner Badge */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              background: "rgba(0, 0, 0, 0.38)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              borderRadius: 14,
              padding: "10px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: nectarColors.leaf,
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              <UserOutlined />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>
                {currentUser?.name ?? "Learner Portal"}
              </div>
              <div style={{ fontSize: 11, color: "#86EFAC", fontWeight: 600 }}>
                ● Active Shift Learner ({currentUser?.designation ?? "Plant Operator"})
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. UNIFIED NAVIGATION & DISCOVERY DECK */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 16,
          border: "1px solid #E2E8F0",
          boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.05)",
          overflow: "hidden",
        }}
      >
        {/* Tier 1: Segmented Pill Navigation Bar + Live Status */}
        <div
          style={{
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            borderBottom: activeTab === "catalog" ? "1px solid #F1F5F9" : "none",
            background: "#FAFAFA",
          }}
        >
          {/* Segmented Pill Tabs */}
          <div
            style={{
              display: "inline-flex",
              background: "#F1F5F9",
              padding: "4px",
              borderRadius: 10,
              gap: 4,
            }}
          >
            {[
              {
                key: "catalog",
                label: "Course Catalog",
                count: allCourses.length,
                icon: <BookOutlined />,
              },
              {
                key: "certificates",
                label: "My Certificates",
                count: myCertificates.length,
                icon: <TrophyOutlined />,
              },
              {
                key: "schedule",
                label: "Assessment Schedule",
                icon: <CalendarOutlined />,
              },
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
                  <span style={{ color: isActive ? nectarColors.leaf : "#94A3B8", fontSize: 13 }}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 10,
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 12,
              color: nectarColors.muted,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#16A34A",
                  display: "inline-block",
                }}
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ position: "relative", flex: 1 }}>
                <Input
                  size="large"
                  prefix={<SearchOutlined style={{ color: nectarColors.leaf, fontSize: 16, marginRight: 6 }} />}
                  placeholder="Search plant courses, SOP skills, equipment (e.g. RO membrane, aeration flocs, chlorine, LOTO, pumps)..."
                  allowClear
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    height: 44,
                    borderRadius: 8,
                    fontSize: 13,
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
                    height: 44,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#DC2626",
                    borderColor: "#FCA5A5",
                    background: "#FEF2F2",
                  }}
                >
                  Clear Filters
                </Button>
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: nectarColors.muted,
                    background: nectarColors.sand,
                    border: "1px solid #E2E8F0",
                    padding: "0 14px",
                    height: 44,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {allCourses.length} Modules Available
                </div>
              )}
            </div>

            {/* Topic Filter Strip (Horizontal scrolling rail without clumsy wrap) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 14,
                overflowX: "auto",
                scrollbarWidth: "none",
                paddingBottom: 2,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#94A3B8",
                  marginRight: 4,
                  whiteSpace: "nowrap",
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
                      padding: "5px 14px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      border: isActive ? `1.5px solid ${nectarColors.leaf}` : "1px solid #E2E8F0",
                      background: isActive ? nectarColors.leaf : "#FFFFFF",
                      color: isActive ? "#FFFFFF" : "#334155",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
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

          {/* B. "GROW IN YOUR ROLES" (Senior Plant Mentors & Drop-In Clinics) */}
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 20 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#1F1F1F",
                  letterSpacing: "-0.015em",
                  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                }}
              >
                Grow in your roles
              </h2>
              <div style={{ fontSize: 13.5, color: "#64748B", marginTop: 4 }}>
                Senior process leads publish scheduled clinic availability windows for shift questions, operational troubleshooting, and viva preparation.
              </div>
            </div>

            {/* 4 Mentor Drop-In Cards Grid (Coursera Radiating Aesthetic + Full Mentor Functionality) */}
            <Row gutter={[24, 24]}>
              {mentors.map((mentor) => {
                const nextClinic = mentor.publishedClinics[0];
                const availableSeats = nextClinic
                  ? Math.max(0, nextClinic.capacity - nextClinic.registeredCount)
                  : 0;

                return (
                  <Col xs={24} sm={12} md={12} lg={6} xl={6} key={mentor.id}>
                    <div
                      onClick={() => {
                        const trackId = mentorToTrackMap[mentor.id] || "track-etp-specialist";
                        router.push(`/training/track/${trackId}`);
                      }}
                      style={{
                        background: "#FFFFFF",
                        borderRadius: 16,
                        border: "1px solid #E5E7EB",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        height: "100%",
                        cursor: "pointer",
                        transition: "all 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-6px)";
                        e.currentTarget.style.boxShadow =
                          "0 20px 36px -6px rgba(28, 68, 99, 0.18), 0 6px 16px -3px rgba(0, 0, 0, 0.04)";
                        e.currentTarget.style.borderColor = nectarColors.leaf;
                        const titleEl = e.currentTarget.querySelector(".mentor-card-title") as HTMLElement;
                        if (titleEl) titleEl.style.color = nectarColors.leaf;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.04)";
                        e.currentTarget.style.borderColor = "#E5E7EB";
                        const titleEl = e.currentTarget.querySelector(".mentor-card-title") as HTMLElement;
                        if (titleEl) titleEl.style.color = nectarColors.ink;
                      }}
                    >
                      {/* Top Hero: Pure Coursera Signature Radiating Card Fan Graphic */}
                      <div
                        style={{
                          height: 195,
                          background: "#FFFFFF",
                          position: "relative",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                        }}
                      >
                        {/* Slots indicator badge in top-right */}
                        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 3 }}>
                          <span
                            style={{
                              background: availableSeats > 0 ? "rgba(22, 163, 74, 0.92)" : "rgba(220, 38, 38, 0.92)",
                              backdropFilter: "blur(4px)",
                              color: "#FFFFFF",
                              padding: "3px 8px",
                              borderRadius: 10,
                              fontSize: 10,
                              fontWeight: 600,
                              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
                            }}
                          >
                            {availableSeats > 0 ? `● ${availableSeats} Slots Available` : "● Fully Booked"}
                          </span>
                        </div>

                        {/* SVG Fan of 3 Radiating Certificate Cards */}
                        <svg
                          viewBox="0 0 280 195"
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            pointerEvents: "none",
                          }}
                        >
                          <defs>
                            <filter id={`fan-shadow-${mentor.id}`} x="-15%" y="-15%" width="130%" height="130%">
                              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.12" />
                            </filter>
                          </defs>

                          {/* Card 1: Left Card (Tilted -22deg) */}
                          <g transform="translate(140, 205) rotate(-22) translate(-140, -205)" filter={`url(#fan-shadow-${mentor.id})`}>
                            <rect
                              x="52"
                              y="42"
                              width="84"
                              height="136"
                              rx="8"
                              fill="#0B1A24"
                              stroke="#FFFFFF"
                              strokeWidth="2.5"
                            />
                            <line x1="66" y1="60" x2="118" y2="60" stroke="#7EA6C4" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
                            <line x1="66" y1="70" x2="102" y2="70" stroke="#7EA6C4" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
                          </g>

                          {/* Card 2: Center Card (Nearly vertical, -2deg) */}
                          <g transform="translate(140, 205) rotate(-2) translate(-140, -205)" filter={`url(#fan-shadow-${mentor.id})`}>
                            <rect
                              x="92"
                              y="28"
                              width="96"
                              height="150"
                              rx="8"
                              fill={nectarColors.leaf}
                              stroke="#FFFFFF"
                              strokeWidth="2.5"
                            />
                            <line x1="108" y1="48" x2="168" y2="48" stroke="#C8DBEA" strokeWidth="2.2" strokeLinecap="round" />
                            <line x1="108" y1="58" x2="148" y2="58" stroke="#C8DBEA" strokeWidth="2.2" strokeLinecap="round" />
                          </g>

                          {/* Card 3: Right Card with Icon Badge (Tilted +22deg) */}
                          <g transform="translate(140, 205) rotate(22) translate(-140, -205)" filter={`url(#fan-shadow-${mentor.id})`}>
                            <rect
                              x="144"
                              y="42"
                              width="84"
                              height="136"
                              rx="8"
                              fill="#285F8A"
                              stroke="#FFFFFF"
                              strokeWidth="2.5"
                            />
                            {/* Department / Specialty specific white outline badge in top-right */}
                            {mentor.id === "mentor-sanjay" && (
                              <g transform="translate(190, 56)">
                                <rect x="0" y="0" width="22" height="15" rx="3" fill="#FFFFFF" fillOpacity="0.22" stroke="#FFFFFF" strokeWidth="1.2" />
                                <line x1="4" y1="5" x2="18" y2="5" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
                                <line x1="4" y1="9" x2="13" y2="9" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
                                <circle cx="16" cy="10" r="1.5" fill="#FFFFFF" />
                              </g>
                            )}
                            {mentor.id === "mentor-rajesh" && (
                              <g transform="translate(192, 54)">
                                <path d="M 9 0 C 5 7 2 11 2 14 C 2 18 5.2 21 9 21 C 12.8 21 16 18 16 14 C 16 11 13 7 9 0 Z" fill="#FFFFFF" fillOpacity="0.22" stroke="#FFFFFF" strokeWidth="1.2" />
                              </g>
                            )}
                            {mentor.id === "mentor-vikram" && (
                              <g transform="translate(192, 54)">
                                <path d="M 9 0 L 1 3.5 V 10.5 C 1 15.5 4.5 19 9 20.5 C 13.5 19 17 15.5 17 10.5 V 3.5 Z" fill="#FFFFFF" fillOpacity="0.22" stroke="#FFFFFF" strokeWidth="1.2" />
                                <path d="M 9 5 V 14 M 4.5 9.5 H 13.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                              </g>
                            )}
                            {mentor.id === "mentor-meera" && (
                              <g transform="translate(192, 54)">
                                <path d="M 6 1 H 12 V 6 L 17 16 C 17.8 17.8 16.5 20 14.5 20 H 3.5 C 1.5 20 0.2 17.8 1 16 L 6 6 Z" fill="#FFFFFF" fillOpacity="0.22" stroke="#FFFFFF" strokeWidth="1.2" />
                                <line x1="4" y1="14" x2="14" y2="14" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="1.5,1.5" />
                              </g>
                            )}
                          </g>
                        </svg>

                        {/* Centered Cameo Portrait Frame */}
                        <div
                          style={{
                            position: "relative",
                            zIndex: 2,
                            width: 116,
                            height: 148,
                            borderRadius: "58px 58px 0 0",
                            backgroundImage: `url(${mentor.photoUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center 12%",
                            boxShadow: "0 -4px 18px rgba(0, 0, 0, 0.14)",
                            border: "3.5px solid #FFFFFF",
                            borderBottom: "none",
                          }}
                        />
                      </div>

                      {/* Card Content with Full Mentor Functionality */}
                      <div
                        style={{
                          padding: "16px 18px 20px",
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          {/* Mentor Name and Rating */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <h3
                              className="mentor-card-title"
                              style={{
                                margin: 0,
                                fontSize: 16.5,
                                fontWeight: 700,
                                color: nectarColors.ink,
                                lineHeight: 1.3,
                                letterSpacing: "-0.015em",
                                transition: "color 0.2s ease",
                              }}
                            >
                              {mentor.name}
                            </h3>
                            <span
                              style={{
                                fontSize: 12,
                                color: "#D97706",
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              <StarFilled style={{ fontSize: 11 }} /> {mentor.rating}
                            </span>
                          </div>

                          {/* Role & Department */}
                          <div style={{ fontSize: 11.5, color: nectarColors.leaf, fontWeight: 600, marginTop: 3 }}>
                            {mentor.role} · {mentor.department}
                          </div>

                          {/* Specialty / Description */}
                          <p
                            style={{
                              margin: "8px 0 0",
                              fontSize: 12,
                              color: "#475569",
                              lineHeight: 1.45,
                              minHeight: 34,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {mentor.specialty}
                          </p>
                        </div>

                        {/* Upcoming Published Clinic Box & Action */}
                        <div style={{ marginTop: 12 }}>
                          {nextClinic ? (
                            <div
                              style={{
                                background: "#F8FAFC",
                                border: "1px solid #E2E8F0",
                                padding: "9px 11px",
                                borderRadius: 8,
                                fontSize: 11,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: "#0F172A",
                                  marginBottom: 3,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {nextClinic.topic || mentor.specialty}
                              </div>
                              <div style={{ color: "#64748B", fontSize: 10.5, display: "flex", alignItems: "center", gap: 5 }}>
                                <ClockCircleOutlined style={{ color: nectarColors.leaf }} />
                                {nextClinic.dayTime}
                              </div>
                              <div
                                style={{
                                  color: "#64748B",
                                  fontSize: 10.5,
                                  marginTop: 2,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 5,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                <EnvironmentOutlined style={{ color: nectarColors.leaf }} />
                                {nextClinic.location}
                              </div>
                              <div
                                style={{
                                  marginTop: 6,
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  borderTop: "1px solid #EEF2F6",
                                  paddingTop: 5,
                                }}
                              >
                                <span style={{ fontSize: 10, color: availableSeats > 0 ? "#166534" : "#B91C1C", fontWeight: 600 }}>
                                  {availableSeats} of {nextClinic.capacity} seats open
                                </span>
                                <span style={{ fontSize: 10, color: "#94A3B8" }}>
                                  {mentor.sessionCount} sessions held
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                background: "#F8FAFC",
                                border: "1px solid #E2E8F0",
                                padding: "9px 11px",
                                borderRadius: 8,
                                fontSize: 11,
                                color: "#64748B",
                              }}
                            >
                              No open clinics right now. Check back next shift.
                            </div>
                          )}

                          <Button
                            type="primary"
                            block
                            icon={<ArrowRightOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              const trackId = mentorToTrackMap[mentor.id] || "track-etp-specialist";
                              router.push(`/training/track/${trackId}`);
                            }}
                            style={{
                              marginTop: 10,
                              borderRadius: 8,
                              background: nectarColors.leaf,
                              fontWeight: 600,
                              fontSize: 12,
                              height: 36,
                            }}
                          >
                            Explore Specialization & Clinics →
                          </Button>
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
              background: "#FFFFFF",
              borderRadius: 20,
              padding: "28px 30px 32px",
              border: "1px solid rgba(11, 26, 36, 0.08)",
              boxShadow: "0 10px 30px -10px rgba(11, 26, 36, 0.05), 0 1px 3px rgba(11, 26, 36, 0.03)",
            }}
          >
            {/* Architectural Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 20,
                marginBottom: 26,
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "4px 11px",
                    borderRadius: 20,
                    background: "rgba(28, 68, 99, 0.07)",
                    border: "1px solid rgba(28, 68, 99, 0.15)",
                    color: nectarColors.leaf,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#16A34A",
                      display: "inline-block",
                      boxShadow: "0 0 6px #16A34A",
                    }}
                  />
                  <span>Adaptive Station Telemetry · Shift Accelerators</span>
                </div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 23,
                    fontWeight: 700,
                    color: nectarColors.ink,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Learners like you took these next
                </h2>
                <div style={{ fontSize: 13.5, color: "#64748B", marginTop: 4, maxWidth: 640 }}>
                  Curated technical courses calibrated against station telemetry, active shift logs, and operational permit standards.
                </div>
              </div>

              {/* Segmented Filter Bar */}
              <div
                style={{
                  display: "inline-flex",
                  background: "#F1F5F9",
                  padding: "4px",
                  borderRadius: 14,
                  border: "1px solid #E2E8F0",
                  gap: 3,
                  flexWrap: "wrap",
                }}
              >
                {[
                  { key: "All", label: "Top Picks", count: recommendations.length },
                  {
                    key: "Effluent Treatment (ETP)",
                    label: "ETP",
                    count: recommendations.filter((r) => r.category === "Effluent Treatment (ETP)").length,
                  },
                  {
                    key: "Water Treatment (WTP)",
                    label: "WTP & RO",
                    count: recommendations.filter((r) => r.category === "Water Treatment (WTP)").length,
                  },
                  {
                    key: "Sewage Treatment (STP)",
                    label: "STP",
                    count: recommendations.filter((r) => r.category === "Sewage Treatment (STP)").length,
                  },
                  {
                    key: "Zero Liquid Discharge (ZLD)",
                    label: "ZLD",
                    count: recommendations.filter((r) => r.category === "Zero Liquid Discharge (ZLD)").length,
                  },
                  {
                    key: "Environmental Consulting",
                    label: "Consulting",
                    count: recommendations.filter((r) => r.category === "Environmental Consulting").length,
                  },
                  {
                    key: "Operation & Maintenance",
                    label: "O&M",
                    count: recommendations.filter((r) => r.category === "Operation & Maintenance").length,
                  },
                ].map((pill) => {
                  const isActive = recFilter === pill.key;
                  return (
                    <button
                      key={pill.key}
                      onClick={() => setRecFilter(pill.key)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: isActive ? 600 : 500,
                        border: "none",
                        background: isActive ? nectarColors.leaf : "transparent",
                        color: isActive ? "#FFFFFF" : "#475569",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: isActive ? "0 2px 8px rgba(28, 68, 99, 0.22)" : "none",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <span>{pill.label}</span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: 8,
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

            {/* Recommendation Cards Grid */}
            <Row gutter={[20, 20]}>
              {(recsExpanded ? filteredRecs : filteredRecs.slice(0, 4)).map((rec) => {
                const targetCourse =
                  allCourses.find((c) => c.id === rec.courseId) || allCourses[0];
                const meta = getDomainMeta(rec.category);

                return (
                  <Col xs={24} sm={12} md={12} lg={6} xl={6} key={rec.id}>
                    <div
                      onClick={() => router.push(`/training/learn/${targetCourse.id}`)}
                      style={{
                        background: "#FFFFFF",
                        borderRadius: 16,
                        border: "1px solid rgba(11, 26, 36, 0.08)",
                        boxShadow: "0 2px 10px rgba(11, 26, 36, 0.03)",
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
                        e.currentTarget.style.boxShadow =
                          "0 18px 36px -8px rgba(28, 68, 99, 0.12), 0 2px 6px rgba(11, 26, 36, 0.04)";
                        e.currentTarget.style.borderColor = "rgba(28, 68, 99, 0.28)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 10px rgba(11, 26, 36, 0.03)";
                        e.currentTarget.style.borderColor = "rgba(11, 26, 36, 0.08)";
                      }}
                    >
                      {/* Top Image Banner with Technical HUD */}
                      <div
                        style={{
                          height: 155,
                          backgroundImage: `url(${rec.thumbnailUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          position: "relative",
                        }}
                      >
                        {/* Film gradient for contrast */}
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background:
                              "linear-gradient(to top, rgba(11,26,36,0.90) 0%, rgba(11,26,36,0.3) 55%, rgba(11,26,36,0.6) 100%)",
                          }}
                        />

                        {/* Top HUD: Unit Code & Telemetry Fit */}
                        <div
                          style={{
                            position: "absolute",
                            top: 10,
                            left: 10,
                            right: 10,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              background: "rgba(11, 26, 36, 0.82)",
                              backdropFilter: "blur(6px)",
                              color: "#FFFFFF",
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontFamily: "monospace",
                              fontWeight: 700,
                              letterSpacing: "0.05em",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                            }}
                          >
                            {rec.code}
                          </div>

                          <div
                            style={{
                              background: "rgba(28, 68, 99, 0.88)",
                              backdropFilter: "blur(6px)",
                              color: "#FFFFFF",
                              padding: "3px 9px",
                              borderRadius: 14,
                              fontSize: 11,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              border: "1px solid rgba(255, 255, 255, 0.18)",
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "#4ADE80",
                                display: "inline-block",
                                boxShadow: "0 0 6px #4ADE80",
                              }}
                            />
                            <span>{rec.matchScorePct}% Match</span>
                          </div>
                        </div>

                        {/* Bottom HUD: Division & Duration */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: 9,
                            left: 11,
                            right: 11,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            color: "#FFFFFF",
                            fontSize: 11,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              color: "rgba(255,255,255,0.92)",
                              fontSize: 11,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "68%",
                            }}
                          >
                            {rec.provider}
                          </span>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              color: "rgba(255,255,255,0.85)",
                              fontWeight: 600,
                              fontSize: 10.5,
                              background: "rgba(0,0,0,0.3)",
                              padding: "2px 6px",
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
                          padding: "16px 16px 18px",
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          {/* Domain Pill & Level */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 6,
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: meta.color,
                                background: meta.bgLight,
                                border: `1px solid ${meta.border}`,
                                padding: "2px 8px",
                                borderRadius: 6,
                                letterSpacing: "0.02em",
                              }}
                            >
                              {meta.shortLabel}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#64748B",
                              }}
                            >
                              {rec.level}
                            </span>
                          </div>

                          {/* Course Title */}
                          <h3
                            style={{
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
                            }}
                          >
                            {rec.title}
                          </h3>

                          {/* Real Plant Engineering Rationale */}
                          <p
                            style={{
                              margin: "6px 0 0",
                              fontSize: 12,
                              color: "#64748B",
                              lineHeight: 1.45,
                              minHeight: 35,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {targetCourse.description || "Comprehensive hands-on operational protocols and standard operating procedures."}
                          </p>

                          {/* Engineering Competency Badge */}
                          <div
                            style={{
                              marginTop: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#334155",
                                background: "#F1F5F9",
                                padding: "2px 7px",
                                borderRadius: 5,
                                border: "1px solid #E2E8F0",
                              }}
                            >
                              {targetCourse.abilities.length} Core Modules
                            </span>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 500,
                                color: "#64748B",
                              }}
                            >
                              {meta.spec}
                            </span>
                          </div>
                        </div>

                        {/* Card Action Row: Button-in-Button */}
                        <div
                          style={{
                            marginTop: 16,
                            paddingTop: 12,
                            borderTop: "1px solid #F1F5F9",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              color: nectarColors.leaf,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <SafetyCertificateOutlined style={{ fontSize: 12 }} />
                            <span>Plant Certified</span>
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/training/learn/${targetCourse.id}`);
                            }}
                            style={{
                              background: nectarColors.leaf,
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: 20,
                              padding: "5px 6px 5px 12px",
                              fontSize: 11.5,
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              cursor: "pointer",
                              transition: "all 0.18s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = nectarColors.ink;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = nectarColors.leaf;
                            }}
                          >
                            <span>Start Course</span>
                            <span
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: "rgba(255, 255, 255, 0.2)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 9.5,
                              }}
                            >
                              <PlayCircleOutlined />
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>

            {/* Architectural Footer Bar for Expand / Collapse */}
            {filteredRecs.length > 4 && (
              <div
                style={{
                  marginTop: 26,
                  paddingTop: 18,
                  borderTop: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>
                  Showing{" "}
                  <strong style={{ color: "#0F172A" }}>
                    {recsExpanded ? filteredRecs.length : Math.min(4, filteredRecs.length)}
                  </strong>{" "}
                  of <strong style={{ color: "#0F172A" }}>{filteredRecs.length}</strong> telemetry-matched courses
                </div>

                <Button
                  size="middle"
                  onClick={() => setRecsExpanded((prev) => !prev)}
                  icon={recsExpanded ? <UpOutlined /> : <DownOutlined />}
                  style={{
                    borderColor: "rgba(28, 68, 99, 0.3)",
                    color: nectarColors.leaf,
                    fontWeight: 600,
                    borderRadius: 10,
                    padding: "0 20px",
                    height: 38,
                    background: "#FFFFFF",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  {recsExpanded ? "Collapse to Top 4" : `Show All ${filteredRecs.length} Courses`}
                </Button>
              </div>
            )}
          </div>

          {/* C. PLANT PILLAR COMMAND CONSOLE */}
          <div
            style={{
              marginTop: 36,
              marginBottom: 24,
              background: "#FFFFFF",
              borderRadius: 20,
              padding: "20px 24px",
              border: "1px solid rgba(11, 26, 36, 0.08)",
              boxShadow: "0 4px 20px -6px rgba(11, 26, 36, 0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: nectarColors.leaf,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: nectarColors.leaf,
                      display: "inline-block",
                    }}
                  />
                  <span>Nectar Enviro Core Engineering Curriculum</span>
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    color: nectarColors.ink,
                    letterSpacing: "-0.015em",
                  }}
                >
                  6 Plant Engineering Pillars & Turnkey Services
                </h3>
              </div>

              {/* Pillar Switcher Tabs */}
              <div
                style={{
                  display: "inline-flex",
                  background: "#F1F5F9",
                  padding: "4px",
                  borderRadius: 14,
                  border: "1px solid #E2E8F0",
                  gap: 3,
                  flexWrap: "wrap",
                }}
              >
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
                        padding: "6px 12px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: isActive ? 700 : 500,
                        border: "none",
                        background: isActive ? nectarColors.leaf : "transparent",
                        color: isActive ? "#FFFFFF" : "#475569",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: isActive ? "0 2px 8px rgba(28, 68, 99, 0.25)" : "none",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <span>{tab.label}</span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: 8,
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
                    marginBottom: 36,
                    background: "#FFFFFF",
                    borderRadius: 22,
                    border: "1px solid rgba(11, 26, 36, 0.08)",
                    boxShadow: "0 6px 24px -8px rgba(11, 26, 36, 0.04)",
                    overflow: "hidden",
                  }}
                >
                  {/* 1. Architectural Section Dossier Header */}
                  <div
                    style={{
                      background: secMeta.bgLight,
                      borderBottom: `1px solid ${secMeta.border}`,
                      padding: "24px 28px 22px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 16,
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        {/* Division Code & Standard Badges */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                            marginBottom: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              fontFamily: "monospace",
                              letterSpacing: "0.08em",
                              color: secMeta.color,
                              background: "#FFFFFF",
                              border: `1px solid ${secMeta.border}`,
                              padding: "3px 9px",
                              borderRadius: 6,
                            }}
                          >
                            {telemetryData.divisionCode}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#475569",
                              background: "rgba(255,255,255,0.75)",
                              border: "1px solid rgba(0,0,0,0.06)",
                              padding: "3px 9px",
                              borderRadius: 6,
                            }}
                          >
                            {telemetryData.standard}
                          </span>
                        </div>

                        {/* Title */}
                        <h2
                          style={{
                            margin: 0,
                            fontSize: 22,
                            fontWeight: 800,
                            color: nectarColors.ink,
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {sec.title}
                        </h2>

                        {/* Scope description */}
                        <div
                          style={{
                            fontSize: 13,
                            color: "#475569",
                            marginTop: 4,
                            maxWidth: 840,
                            lineHeight: 1.5,
                          }}
                        >
                          {sec.description}
                        </div>
                      </div>

                      {/* Right Metrics Capsule */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: secMeta.color,
                            background: "#FFFFFF",
                            padding: "5px 14px",
                            borderRadius: 20,
                            border: `1px solid ${secMeta.border}`,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                          }}
                        >
                          Showing {visibleCourses.length} of {secCourses.length} Courses
                        </div>
                        <div style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>
                          {secCourses.reduce((acc, c) => acc + c.estimatedHours, 0)} Total Training Hours
                        </div>
                      </div>
                    </div>

                    {/* 2. Plant Parameter Telemetry Strip */}
                    <div
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: "1px solid rgba(0,0,0,0.06)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: secMeta.color,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        Operational Benchmarks:
                      </span>
                      {telemetryData.metrics.map((m, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#334155",
                            background: "#FFFFFF",
                            padding: "2px 8px",
                            borderRadius: 5,
                            border: "1px solid rgba(0,0,0,0.05)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              background: secMeta.accent,
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
                                background: "#FFFFFF",
                                borderRadius: 16,
                                border: "1px solid rgba(11, 26, 36, 0.08)",
                                boxShadow: "0 2px 10px rgba(11, 26, 36, 0.03)",
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
                                  height: 150,
                                  backgroundImage: `url(${course.thumbnailUrl})`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "center",
                                  position: "relative",
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
                                <div
                                  style={{
                                    position: "absolute",
                                    top: 10,
                                    left: 10,
                                    right: 10,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <div
                                    style={{
                                      background: "rgba(11, 26, 36, 0.85)",
                                      backdropFilter: "blur(6px)",
                                      color: "#FFFFFF",
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontFamily: "monospace",
                                      fontWeight: 700,
                                      border: "1px solid rgba(255, 255, 255, 0.12)",
                                      letterSpacing: "0.04em",
                                    }}
                                  >
                                    {course.code}
                                  </div>

                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 3,
                                      color: "rgba(255,255,255,0.92)",
                                      fontWeight: 600,
                                      fontSize: 10.5,
                                      background: "rgba(0,0,0,0.38)",
                                      backdropFilter: "blur(4px)",
                                      padding: "2px 7px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    <ClockCircleOutlined style={{ fontSize: 10 }} /> {course.estimatedHours} hrs
                                  </div>
                                </div>

                                {/* Bottom HUD: Division Stamp */}
                                <div
                                  style={{
                                    position: "absolute",
                                    bottom: 8,
                                    left: 11,
                                    right: 11,
                                    color: "rgba(255,255,255,0.95)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                                  }}
                                >
                                  {secMeta.name}
                                </div>
                              </div>

                              {/* Body Content */}
                              <div
                                style={{
                                  padding: "16px 18px 20px",
                                  flex: 1,
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "space-between",
                                }}
                              >
                                <div>
                                  {/* Course Title */}
                                  <h3
                                    style={{
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
                                    }}
                                  >
                                    {course.title}
                                  </h3>

                                  {/* Actual Key Abilities (No Truncated AI Sentences!) */}
                                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                                    {course.abilities.slice(0, 2).map((ab, idx) => (
                                      <div
                                        key={ab.id || idx}
                                        style={{
                                          fontSize: 11.5,
                                          color: "#475569",
                                          lineHeight: 1.4,
                                          display: "flex",
                                          alignItems: "flex-start",
                                          gap: 6,
                                        }}
                                      >
                                        <span style={{ color: secMeta.color, fontSize: 10, marginTop: 2, flexShrink: 0 }}>
                                          ▸
                                        </span>
                                        <span
                                          style={{
                                            display: "-webkit-box",
                                            WebkitLineClamp: 1,
                                            WebkitBoxOrient: "vertical",
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
                                      display: "flex",
                                      justifyContent: "space-between",
                                      fontSize: 11,
                                      color: "#64748B",
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
                                      marginTop: 14,
                                      paddingTop: 12,
                                      borderTop: "1px solid #F1F5F9",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      gap: 6,
                                    }}
                                  >
                                    {enr?.status === "CERTIFIED" ? (
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 700,
                                          color: "#166534",
                                          background: "#DCFCE7",
                                          padding: "3px 8px",
                                          borderRadius: 6,
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                        }}
                                      >
                                        <CheckCircleFilled style={{ fontSize: 11 }} /> Certified
                                      </span>
                                    ) : enr?.status === "SKILL_MAP_DONE" ? (
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: "#6D28D9",
                                          background: "#F5F3FF",
                                          padding: "3px 8px",
                                          borderRadius: 6,
                                        }}
                                      >
                                        In Review
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: "#475569",
                                          background: "#F1F5F9",
                                          padding: "3px 8px",
                                          borderRadius: 6,
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
                                        background: nectarColors.leaf,
                                        color: "#FFFFFF",
                                        border: "none",
                                        borderRadius: 20,
                                        padding: "5px 6px 5px 12px",
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        cursor: "pointer",
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
                                          width: 20,
                                          height: 20,
                                          borderRadius: "50%",
                                          background: "rgba(255, 255, 255, 0.2)",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: 9.5,
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
                            borderColor: "rgba(28, 68, 99, 0.3)",
                            color: nectarColors.leaf,
                            fontWeight: 600,
                            borderRadius: 10,
                            padding: "0 22px",
                            height: 38,
                            background: "#FFFFFF",
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
                background: "#FFFFFF",
                borderRadius: 14,
                padding: 40,
                textAlign: "center",
                border: "1px solid rgba(28, 68, 99, 0.08)",
              }}
            >
              <TrophyOutlined style={{ fontSize: 48, color: nectarColors.muted, marginBottom: 12 }} />
              <h3 style={{ margin: 0, fontSize: 16, color: nectarColors.ink }}>
                No Certificates Issued Yet
              </h3>
              <p style={{ margin: "6px 0 16px", fontSize: 13, color: nectarColors.muted }}>
                Complete all course modules, pass the Skill Mapping test, and complete the Manager Practical and Oral evaluations to earn your certificate.
              </p>
              <Button type="primary" onClick={() => setActiveTab("catalog")} style={{ background: nectarColors.leaf }}>
                Go to Course Catalog
              </Button>
            </div>
          ) : (
            <Row gutter={[20, 20]}>
              {myCertificates.map((cert) => (
                <Col xs={24} sm={12} key={cert.id}>
                  <div
                    style={{
                      background: "#FFFFFF",
                      borderRadius: 14,
                      border: "1px solid rgba(28, 68, 99, 0.1)",
                      boxShadow: "0 2px 10px rgba(11, 26, 36, 0.03)",
                      padding: 24,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 11, color: nectarColors.leaf, fontWeight: 700, letterSpacing: "0.08em" }}>
                            VERIFIED COMPETENCY CERTIFICATE
                          </div>
                          <h3
                            style={{
                              margin: "4px 0 0",
                              fontSize: 17,
                              fontWeight: 600,
                              color: nectarColors.ink,
                            }}
                          >
                            {cert.courseTitle}
                          </h3>
                        </div>
                        <Tag color="success" style={{ margin: 0, borderRadius: 12, fontWeight: 700 }}>
                          {cert.overallPct}% Overall
                        </Tag>
                      </div>

                      <div
                        style={{
                          marginTop: 16,
                          background: nectarColors.sand,
                          padding: "10px 14px",
                          borderRadius: 10,
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: 8,
                          textAlign: "center",
                          fontSize: 11,
                        }}
                      >
                        <div>
                          <div style={{ color: nectarColors.muted }}>Skill Map</div>
                          <div style={{ fontWeight: 700, color: "#166534" }}>{cert.skillMapPct}%</div>
                        </div>
                        <div>
                          <div style={{ color: nectarColors.muted }}>Written</div>
                          <div style={{ fontWeight: 700, color: "#166534" }}>{cert.writtenPct}%</div>
                        </div>
                        <div>
                          <div style={{ color: nectarColors.muted }}>Practical</div>
                          <div style={{ fontWeight: 700, color: "#166534" }}>{cert.practicalPct}%</div>
                        </div>
                        <div>
                          <div style={{ color: nectarColors.muted }}>Oral Viva</div>
                          <div style={{ fontWeight: 700, color: "#166534" }}>{cert.oralPct}%</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 11, color: nectarColors.muted, fontFamily: "monospace" }}>
                        ID: {cert.certificateNo}
                      </div>
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

      <CertificateModal
        certificate={activeCert}
        onClose={() => setActiveCert(null)}
      />

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
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  backgroundImage: `url(${bookingMentor.photoUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center 20%",
                  border: `2px solid ${nectarColors.leaf}`,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0F172A" }}>
                    {bookingMentor.name}
                  </h3>
                  <Tag color="purple" style={{ margin: 0, borderRadius: 8 }}>
                    Mentor Clinic
                  </Tag>
                </div>
                <div style={{ fontSize: 13, color: nectarColors.leaf, fontWeight: 600 }}>
                  {bookingMentor.role} · {bookingMentor.department}
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                  Specialty: {bookingMentor.specialty}
                </div>
              </div>
            </div>

            <div
              style={{
                background: "#F8FAFC",
                borderRadius: 10,
                padding: "14px 16px",
                marginBottom: 18,
                border: "1px solid #E2E8F0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <label style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                  Mentor Drop-In Availability Windows
                </label>
                <span style={{ fontSize: 11, color: "#64748B" }}>
                  {bookingMentor.publishedClinics.length} scheduled clinic(s)
                </span>
              </div>

              {bookingMentor.publishedClinics.length === 0 ? (
                <div style={{ fontSize: 12, color: "#64748B" }}>
                  No active availability windows dropped yet.
                </div>
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
                          borderRadius: 8,
                          padding: "10px 12px",
                          width: "100%",
                          margin: 0,
                        }}
                      >
                        <div style={{ marginLeft: 6 }}>
                          <div style={{ fontWeight: 600, color: "#0F172A", fontSize: 13 }}>
                            {clinic.topic || bookingMentor.specialty}
                          </div>
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                            📅 {clinic.dayTime}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>
                            📍 {clinic.location}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            {isFull ? (
                              <Tag color="error" style={{ fontSize: 10, margin: 0 }}>
                                Clinic Full ({clinic.capacity}/{clinic.capacity})
                              </Tag>
                            ) : (
                              <Tag color="success" style={{ fontSize: 10, margin: 0 }}>
                                {seatsLeft} seat(s) remaining ({clinic.registeredCount}/{clinic.capacity} booked)
                              </Tag>
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
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0F172A",
                  marginBottom: 6,
                }}
              >
                Topics or Operational Questions for this Clinic (Optional)
              </label>
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
