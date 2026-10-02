"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Row,
  Col,
  Button,
  Tag,
  Collapse,
  Modal,
  message,
  Select,
  Input,
} from "antd";
import {
  ArrowLeftOutlined,
  StarFilled,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  BookOutlined,
  CheckCircleFilled,
  ProjectOutlined,
  TeamOutlined,
  ArrowRightOutlined,
  PlayCircleOutlined,
  CheckOutlined,
  CalendarOutlined,
  ApartmentOutlined,
  ShareAltOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import {
  getSpecializationTrackById,
  getCourseById,
  getMentorProfiles,
  registerForDropInClinic,
} from "@/lib/training/store";
import { getSession } from "@/lib/auth";
import { scopedEmployeeId, selfEmployeeId } from "@/lib/rbac";
import { getEmployeeById } from "@/lib/mock-data";
import { CourseraRecommendationsGrid } from "@/components/training/CourseraRecommendationsGrid";
import { nectarColors } from "@/lib/theme";
import type { SpecializationTrack, Course, MentorProfile } from "@/lib/training/types";
import type { CSSProperties } from "react";

const sText11BoldUpperColorBgPadR4: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#1C4463",
  background: "#EBF3FA",
  padding: "3px 8px",
  borderRadius: 4,
};

const sText24Color: CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: "#0F172A",
  margin: "8px 0 6px 0",
  letterSpacing: "-0.015em",
};

const sWhitePadR16BorderShadow: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 16,
  border: "1px solid #E2E8F0",
  padding: "32px",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
};

const sText12SemiboldColorMb6: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#475569",
  marginBottom: 6,
};

export default function SpecializationTrackPage() {
  const params = useParams();
  const router = useRouter();
  const trackId = Array.isArray(params.trackId) ? params.trackId[0] : params.trackId;

  const session = getSession();
  const employeeId = scopedEmployeeId(session) ?? selfEmployeeId(session) ?? "emp0126";
  const employee = getEmployeeById(employeeId);

  const [track, setTrack] = useState<SpecializationTrack | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [mentor, setMentor] = useState<MentorProfile | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const [clinicNotes, setClinicNotes] = useState<string>("");
  const [isEnrolled, setIsEnrolled] = useState<boolean>(false);
  const [activeSubNav, setActiveSubNav] = useState<string>("about");

  useEffect(() => {
    if (!trackId) return;
    const foundTrack = getSpecializationTrackById(trackId);
    if (foundTrack) {
      setTrack(foundTrack);

      // Resolve courses in this specialization
      const resolvedCourses = foundTrack.courseIds
        .map((cid) => getCourseById(cid))
        .filter((c): c is Course => !!c);
      setCourses(resolvedCourses);

      // Resolve lead mentor
      const mentors = getMentorProfiles();
      const leadMentor = mentors.find((m) => m.id === foundTrack.leadMentorId) || mentors[0];
      setMentor(leadMentor);
      if (leadMentor && leadMentor.publishedClinics.length > 0) {
        setSelectedClinicId(leadMentor.publishedClinics[0].id);
      }
    }
  }, [trackId]);

  if (!track) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center", minHeight: "60vh" }}>
        <h2 style={{ fontSize: 22, color: "#1F2937", marginBottom: 16 }}>Specialization Not Found</h2>
        <p style={{ color: "#64748B", marginBottom: 24 }}>The requested specialization track could not be resolved.</p>
        <Link href="/training"><Button type="primary" icon={<ArrowLeftOutlined />}>Back to Training Catalog</Button></Link>
      </div>
    );
  }

  const handleEnroll = () => {
    setIsEnrolled(true);
    message.success(`You are now enrolled in ${track.title}! You can start any course in the series.`);
  };

  const handleBookClinic = () => {
    if (!mentor || !selectedClinicId) {
      message.warning("Please select an available office hours clinic slot.");
      return;
    }
    const res = registerForDropInClinic(mentor.id, employee?.id || "EMP-001", selectedClinicId, clinicNotes);
    if (res.success) {
      message.success(res.message);
      setClinicNotes("");
    } else {
      message.error(res.message);
    }
  };

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh", paddingBottom: 80 }}>
      {/* ---------------- 1. TOP BREADCRUMB BAR (CLEAN WHITE) ---------------- */}
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", padding: "12px 24px" }}>
        <div
          style={{
            maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href="/training"
              style={{
                color: "#334155", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 13, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "#F1F5F9",
                border: "1px solid #CBD5E1", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#1C4463";
                e.currentTarget.style.borderColor = "#1C4463";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#334155";
                e.currentTarget.style.borderColor = "#CBD5E1";
              }}
            >
              <ArrowLeftOutlined style={{ fontSize: 11 }} />
              Training Portal
            </Link>
            <span style={{ color: "#CBD5E1" }}>/</span>
            <span style={{ color: "#64748B", fontSize: 13 }}>Specializations</span>
            <span style={{ color: "#CBD5E1" }}>/</span>
            <span style={{ color: "#1C4463", fontSize: 13, fontWeight: 600 }}>{track.category}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              size="small"
              icon={<ShareAltOutlined />}
              onClick={() => {
                if (typeof window !== "undefined") {
                  navigator.clipboard.writeText(window.location.href);
                  message.success("Specialization track link copied to clipboard!");
                }
              }}
              style={{ background: "#F8FAFC", borderColor: "#CBD5E1", color: "#334155", fontSize: 12, fontWeight: 500 }}
            >
              Share Track
            </Button>
          </div>
        </div>
      </div>

      {/* ---------------- 2. HERO BANNER (COURSERA SIGNATURE) ---------------- */}
      <section
        style={{
          background: "linear-gradient(135deg, #091722 0%, #102A3E 60%, #1C4463 100%)", color: "#FFFFFF",
          padding: "48px 24px 54px 24px", position: "relative", overflow: "hidden",
        }}
      >
        {/* Subtle geometric grid background pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            backgroundImage:
              "radial-gradient(#FFFFFF 1px, transparent 1px), radial-gradient(#FFFFFF 1px, #091722 1px)",
            backgroundSize: "28px 28px",
            backgroundPosition: "0 0, 14px 14px",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <Row gutter={[40, 32]} align="middle">
            <Col xs={24} lg={15}>
              {/* Partner Brand Monogram */}
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(8px)", padding: "6px 14px", borderRadius: 30,
                  border: "1px solid rgba(255, 255, 255, 0.18)", marginBottom: 18,
                }}
              >
                <div
                  style={{
                    width: 22, height: 22, borderRadius: 4, background: "#0EA5E9", display: "flex",
                    alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontSize: 10, fontWeight: 800,
                  }}
                >
                  NE
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: "#E0F2FE" }}>{track.provider}</span>
                <span style={{ color: "rgba(255, 255, 255, 0.3)" }}>•</span>
                <span style={{ fontSize: 11.5, color: "#93C5FD", fontWeight: 600 }}>SPECIALIZATION</span>
              </div>

              {/* Title */}
              <h1
                style={{
                  fontSize: 34, fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.025em", margin: "0 0 16px 0",
                  color: "#FFFFFF",
                }}
              >
                {track.title}
              </h1>

              {/* Subtitle */}
              <p style={{ fontSize: 16.5, lineHeight: 1.55, color: "#CBD5E1", margin: "0 0 24px 0", maxWidth: 680 }}>{track.subtitle}</p>

              {/* Instructor / Mentor Credit */}
              {mentor && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: "50%", overflow: "hidden", border: "2px solid #0EA5E9",
                      position: "relative", background: "#1E293B",
                    }}
                  >
                    <Image src={mentor.photoUrl} alt={mentor.name} fill sizes="44px" style={{ objectFit: "cover" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#94A3B8" }}>Taught by Lead Process Mentor</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>
                      {mentor.name}{" "}
                      <span style={{ fontWeight: 400, color: "#93C5FD", fontSize: 12.5 }}>— {mentor.role}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Ratings, Learners, and Credential strip */}
              <div
                style={{
                  display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, fontSize: 13, color: "#E2E8F0",
                  marginBottom: 32, padding: "12px 18px", background: "rgba(15, 23, 42, 0.45)", borderRadius: 12,
                  border: "1px solid rgba(255, 255, 255, 0.08)", width: "fit-content",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <StarFilled style={{ color: "#FACC15", fontSize: 14 }} />
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{track.rating.toFixed(1)}</span>
                  <span style={{ color: "#94A3B8", fontSize: 12 }}>({track.reviewCount} reviews)</span>
                </div>
                <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>|</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <UserOutlined style={{ color: "#38BDF8" }} />
                  <span style={{ fontWeight: 600 }}>{track.enrolledCount.toLocaleString()} industrial learners</span>
                </div>
                <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>|</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <SafetyCertificateOutlined style={{ color: "#38BDF8" }} />
                  <span style={{ fontWeight: 600 }}>{track.heroBadge}</span>
                </div>
              </div>

              {/* Primary Call to Action */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
                <Button
                  type="primary"
                  size="large"
                  onClick={handleEnroll}
                  style={{
                    height: 52,
                    padding: "0 36px",
                    fontSize: 16,
                    fontWeight: 700,
                    borderRadius: 10,
                    background: isEnrolled
                      ? nectarColors.leaf
                      : "linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)",
                    borderColor: "transparent",
                    boxShadow: "0 10px 24px rgba(14, 165, 233, 0.35)",
                  }}
                >
                  {isEnrolled ? "✓ Enrolled in Specialization" : "Enroll in Specialization (Free for NEIPL)"}
                </Button>

                {courses.length > 0 && (
                  <Link href={`/training/learn/${courses[0].id}`}>
                    <Button
                      size="large"
                      style={{
                        height: 52, padding: "0 28px", fontSize: 15, fontWeight: 600, borderRadius: 10,
                        background: "rgba(255, 255, 255, 0.12)", borderColor: "rgba(255, 255, 255, 0.25)",
                        color: "#FFFFFF",
                      }}
                    >
                      Start Course 1: {courses[0].code} →
                    </Button>
                  </Link>
                )}
              </div>
            </Col>

            {/* Right Hero Card: Key Information Summary */}
            <Col xs={24} lg={9}>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.07)", backdropFilter: "blur(12px)", borderRadius: 20,
                  border: "1px solid rgba(255, 255, 255, 0.16)", padding: "28px 24px",
                  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
                }}
              >
                <div
                  style={{
                    fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                    color: "#93C5FD", marginBottom: 16,
                  }}
                >
                  Specialization At A Glance
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <BookOutlined style={{ fontSize: 18, color: "#38BDF8", marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>{track.courseIds.length} Sequential Courses</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>Progressive ladder from fundamentals to plant commissioning</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <ClockCircleOutlined style={{ fontSize: 18, color: "#38BDF8", marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>Approx. {track.durationWeeks} Weeks</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>{track.hoursPerWeek} hours / week of flexible self-paced study</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <ApartmentOutlined style={{ fontSize: 18, color: "#38BDF8", marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>{track.level} Skill Level</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>Industrial shift experience or baseline chemical knowledge recommended</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <SafetyCertificateOutlined style={{ fontSize: 18, color: "#38BDF8", marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>Verifiable Plant Credential</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>Shareable on LinkedIn and registered in NEIPL HR promotion records</div>
                    </div>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </section>

      {/* ---------------- 3. STICKY IN-PAGE SUB-NAV ---------------- */}
      <div
        style={{
          background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0, zIndex: 100,
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.03)",
        }}
      >
        <div
          style={{
            maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", gap: 28, padding: "0 24px",
            overflowX: "auto",
          }}
        >
          {[
            { id: "about", label: "About" },
            { id: "outcomes", label: "What You'll Learn" },
            { id: "courses", label: `Courses (${track.courseIds.length})` },
            { id: "project", label: "Applied Project" },
            { id: "mentors", label: "Mentors & Clinics" },
            { id: "certificate", label: "Certificate" },
            { id: "recommendations-section", label: "Recommended Programs" },
          ].map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveSubNav(item.id);
                const el = document.getElementById(item.id);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              style={{
                textDecoration: "none",
                fontSize: 14,
                fontWeight: activeSubNav === item.id ? 700 : 500,
                color: activeSubNav === item.id ? "#1C4463" : "#64748B",
                padding: "16px 0",
                borderBottom:
                  activeSubNav === item.id ? "3px solid #1C4463" : "3px solid transparent",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {/* ---------------- 4. MAIN BODY CONTAINER ---------------- */}
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 24px 0 24px" }}>
        {/* SECTION: ABOUT */}
        <section id="about" style={{ marginBottom: 48, scrollMarginTop: 80 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", marginBottom: 14, letterSpacing: "-0.015em" }}>About this Specialization</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#334155", maxWidth: 880 }}>
            The <strong>{track.title}</strong> is a dedicated engineering track developed by Nectar
            Enviro to train industrial plant operators, shift engineers, and technicians in
            high-volume process water and wastewater management. Learners proceed sequentially
            through chemical stoichiometry, hydraulic retention, advanced membrane filtration,
            SCADA telemetry, and statutory environmental compliance.
          </p>
        </section>

        {/* SECTION: WHAT YOU'LL LEARN */}
        <section id="outcomes" style={{ marginBottom: 56, scrollMarginTop: 80 }}>
          <div
            style={{
              background: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", padding: "32px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
            }}
          >
            <h2
              style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 24, letterSpacing: "-0.015em" }}
            >
              What You&apos;ll Learn
            </h2>

            <Row gutter={[28, 24]}>
              {track.whatYouWillLearn.map((item, idx) => (
                <Col xs={24} md={12} key={idx}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <CheckCircleFilled style={{ color: "#16A34A", fontSize: 18, marginTop: 3 }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>{item.title}</div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "#64748B" }}>{item.description}</div>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>

            {/* Skills Gained Pill Cloud */}
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #F1F5F9" }}>
              <div
                style={{
                  fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#475569",
                  marginBottom: 12,
                }}
              >
                Skills You Will Gain
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {track.skillsGained.map((skill) => (
                  <Tag
                    key={skill}
                    style={{
                      background: "#F1F5F9", borderColor: "#CBD5E1", color: "#1E293B", fontSize: 12.5,
                      padding: "4px 12px", borderRadius: 20, fontWeight: 500,
                    }}
                  >
                    {skill}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: COURSES IN THIS SPECIALIZATION */}
        <section id="courses" style={{ marginBottom: 56, scrollMarginTop: 80 }}>
          <div style={{ marginBottom: 20 }}>
            <span style={sText11BoldUpperColorBgPadR4}>SEQUENTIAL CURRICULUM</span>
            <h2 style={sText24Color}>Courses in this Specialization ({courses.length})</h2>
            <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
              Complete all courses in sequence to master operational parameters and earn your
              Specialization Certificate.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {courses.map((course, idx) => (
              <div
                key={course.id}
                style={{
                  background: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)", transition: "border-color 0.2s, box-shadow 0.2s",
                }}
              >
                <div style={{ padding: "24px" }}>
                  <Row gutter={[24, 20]} align="middle">
                    {/* Thumbnail */}
                    <Col xs={24} sm={7} md={6}>
                      <div
                        style={{
                          height: 130, borderRadius: 10, overflow: "hidden", position: "relative",
                          background: "#0F172A",
                        }}
                      >
                        <Image
                          src={course.thumbnailUrl}
                          alt={course.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 25vw"
                          style={{ objectFit: "cover" }}
                        />
                        <div
                          style={{
                            position: "absolute", bottom: 8, left: 8, background: "rgba(0, 0, 0, 0.75)",
                            color: "#FFFFFF", fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                          }}
                        >
                          {course.code}
                        </div>
                      </div>
                    </Col>

                    {/* Course Summary */}
                    <Col xs={24} sm={17} md={13}>
                      <div
                        style={{
                          fontSize: 12, fontWeight: 700, color: "#1C4463", textTransform: "uppercase",
                          letterSpacing: "0.04em", marginBottom: 4,
                        }}
                      >
                        Course {idx + 1} of {courses.length}
                      </div>

                      <h3
                        style={{
                          fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px 0", lineHeight: 1.35,
                        }}
                      >
                        {course.title}
                      </h3>

                      <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5, margin: "0 0 12px 0" }}>{course.description}</p>

                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#64748B" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <ClockCircleOutlined />
                          {course.estimatedHours} hours
                        </span>
                        <span>•</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <BookOutlined />
                          {course.abilities.length} Core Modules
                        </span>
                        <span>•</span>
                        <span>Pass threshold: {course.passThreshold}%</span>
                      </div>
                    </Col>

                    {/* Action Button */}
                    <Col xs={24} md={5} style={{ textAlign: "right" }}>
                      <Link href={`/training/learn/${course.id}`}>
                        <Button
                          type="primary"
                          icon={<PlayCircleOutlined />}
                          style={{
                            background: "#1C4463", borderColor: "#1C4463", height: 42, padding: "0 22px",
                            fontWeight: 700, borderRadius: 8, width: "100%",
                          }}
                        >
                          Start Course →
                        </Button>
                      </Link>
                    </Col>
                  </Row>

                  {/* Modules Accordion */}
                  <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Syllabus Modules:</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {course.abilities.map((ability) => (
                        <div
                          key={ability.id}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5,
                            padding: "6px 10px", background: "#F8FAFC", borderRadius: 6,
                          }}
                        >
                          <span style={{ color: "#334155", fontWeight: 500 }}>
                            <strong style={{ color: "#1C4463", marginRight: 8 }}>{ability.code}</strong>
                            {ability.title}
                          </span>
                          <span style={{ color: "#94A3B8", fontSize: 11.5 }}>{ability.videoDurationMinutes}m video + quiz</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: APPLIED LEARNING PROJECT */}
        <section id="project" style={{ marginBottom: 56, scrollMarginTop: 80 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #0B1A24 0%, #17364D 100%)", borderRadius: 18, padding: "36px",
              color: "#FFFFFF", position: "relative", overflow: "hidden",
            }}
          >
            <div style={{ maxWidth: 840, position: "relative", zIndex: 2 }}>
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(14, 165, 233, 0.2)",
                  color: "#38BDF8", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12,
                }}
              >
                <ProjectOutlined />
                COURSERA-STYLE APPLIED LEARNING PROJECT
              </div>

              <h2
                style={{
                  fontSize: 24, fontWeight: 800, color: "#FFFFFF", margin: "0 0 10px 0", letterSpacing: "-0.015em",
                }}
              >
                {track.appliedLearningProject.title}
              </h2>

              <div style={{ fontSize: 13, color: "#93C5FD", marginBottom: 16 }}>
                Facility Case Setting:{" "}
                <strong>{track.appliedLearningProject.facilityType}</strong>
              </div>

              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#CBD5E1", margin: "0 0 24px 0" }}>{track.appliedLearningProject.description}</p>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.08)", borderRadius: 12, padding: "20px 24px",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <div
                  style={{
                    fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                    color: "#93C5FD", marginBottom: 12,
                  }}
                >
                  Key Engineering Deliverables Required:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                  {track.appliedLearningProject.keyDeliverables.map((deliv, i) => (
                    <div
                      key={i}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#E2E8F0" }}
                    >
                      <CheckOutlined style={{ color: "#38BDF8", fontSize: 12 }} />
                      <span>{deliv}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: SENIOR PROCESS MENTOR & DROP-IN CLINICS */}
        {mentor && (
          <section id="mentors" style={{ marginBottom: 56, scrollMarginTop: 80 }}>
            <div style={{ marginBottom: 20 }}>
              <span style={sText11BoldUpperColorBgPadR4}>PLANT OPERATIONS FACULTY</span>
              <h2 style={sText24Color}>Lead Mentor & Drop-In Office Hours</h2>
              <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
                Every Specialization includes direct drop-in clinic access with senior NEIPL process
                engineers for viva coaching, plant incident troubleshooting, and question resolution.
              </p>
            </div>

            <div style={sWhitePadR16BorderShadow}>
              <Row gutter={[32, 28]} align="middle">
                {/* Mentor Avatar & Bio */}
                <Col xs={24} md={10}>
                  <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                    <div
                      style={{
                        width: 90, height: 90, borderRadius: "50%", overflow: "hidden", border: "3px solid #1C4463",
                        position: "relative", flexShrink: 0,
                      }}
                    >
                      <Image src={mentor.photoUrl} alt={mentor.name} fill sizes="90px" style={{ objectFit: "cover" }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 19, fontWeight: 800, color: "#0F172A", margin: 0 }}>{mentor.name}</h3>
                      <div style={{ fontSize: 13, color: "#1C4463", fontWeight: 600, marginTop: 2 }}>{mentor.role}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{mentor.department}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, fontSize: 12 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <StarFilled style={{ color: "#EAB308" }} />
                          <strong>{mentor.rating.toFixed(1)}</strong>
                        </span>
                        <span>•</span>
                        <span>{mentor.sessionCount} clinics conducted</span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 18, fontSize: 13, lineHeight: 1.5, color: "#475569", background: "#F8FAFC",
                      padding: "12px 16px", borderRadius: 8,
                    }}
                  >
                    <strong>Specialization Focus:</strong> {mentor.specialty}
                  </div>
                </Col>

                {/* Drop-in Office Hours Booking Widget */}
                <Col xs={24} md={14}>
                  <div
                    style={{ background: "#F8FAFC", borderRadius: 12, padding: "24px", border: "1px solid #E2E8F0" }}
                  >
                    <div
                      style={{
                        fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 12, display: "flex",
                        alignItems: "center", gap: 6,
                      }}
                    >
                      <CalendarOutlined style={{ color: "#1C4463" }} />
                      Reserve an Upcoming Drop-In Clinic Slot
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={sText12SemiboldColorMb6}>Available Time Windows:</label>
                      <Select
                        value={selectedClinicId}
                        onChange={(val) => setSelectedClinicId(val)}
                        style={{ width: "100%" }}
                        options={mentor.publishedClinics.map((c) => ({
                          value: c.id,
                          label: `${c.dayTime} — ${c.location} (${c.capacity - c.registeredCount} seats left)`,
                        }))}
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={sText12SemiboldColorMb6}>Operational Question / Viva Topic (Optional):</label>
                      <Input
                        placeholder="e.g., Clarifier MLSS calculation or MBR chemical cleaning steps..."
                        value={clinicNotes}
                        onChange={(e) => setClinicNotes(e.target.value)}
                      />
                    </div>

                    <Button
                      type="primary"
                      onClick={handleBookClinic}
                      style={{
                        background: "#1C4463", borderColor: "#1C4463", fontWeight: 700, height: 40, padding: "0 20px",
                        borderRadius: 6,
                      }}
                    >
                      Confirm Drop-In Slot Reservation
                    </Button>
                  </div>
                </Col>
              </Row>
            </div>
          </section>
        )}

        {/* SECTION: CERTIFICATE PREVIEW */}
        <section id="certificate" style={{ marginBottom: 56, scrollMarginTop: 80 }}>
          <div style={sWhitePadR16BorderShadow}>
            <Row gutter={[32, 24]} align="middle">
              <Col xs={24} md={14}>
                <div
                  style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                    color: "#16A34A", marginBottom: 8,
                  }}
                >
                  ACCREDITED INDUSTRIAL CREDENTIAL
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: "0 0 12px 0" }}>Earn Your Verifiable Plant Operations Certificate</h2>
                <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 16px 0" }}>
                  Upon successful completion of all {courses.length} courses and the capstone
                  applied project, you will be awarded the official{" "}
                  <strong>{track.heroBadge}</strong> signed by Nectar Enviro plant operations
                  directors and certified for CPCB/ISO 14001 compliance records.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <Button
                    type="default"
                    icon={<FileTextOutlined />}
                    onClick={() => {
                      message.info("Certificate syllabus criteria: 100% video completion, 70% quiz pass rate, oral evaluation.");
                    }}
                  >
                    View Credential Criteria
                  </Button>
                </div>
              </Col>

              <Col xs={24} md={10} style={{ textAlign: "center" }}>
                <div
                  style={{
                    background: "linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)", border: "2px solid #CBD5E1",
                    borderRadius: 12, padding: "24px", boxShadow: "0 6px 16px rgba(0, 0, 0, 0.06)",
                    position: "relative",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1C4463", letterSpacing: "0.06em" }}>NECTA ENVIRO OPERATIONS ACADEMY</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginTop: 6, marginBottom: 8 }}>Certificate of Specialization Mastery</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginBottom: 12 }}>Awarded to: <strong>{employee?.name || "Employee"}</strong></div>
                  <div
                    style={{
                      display: "inline-block", border: "1px dashed #0284C7", padding: "4px 10px", borderRadius: 4,
                      fontSize: 10.5, fontWeight: 700, color: "#0284C7",
                    }}
                  >
                    VERIFIED CPCB / ISO 14001 COMPLIANT
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </section>

        {/* ---------------- 5. COURSERA-GRADE BOTTOM RECOMMENDATIONS ---------------- */}
        <CourseraRecommendationsGrid
          currentTrackId={track.id}
          category={track.category}
          title="Recommended Specializations & Related Programs"
          subtitle="Engineers who pursued this track also enrolled in these companion specializations to expand operational coverage."
        />
      </div>
    </div>
  );
}
