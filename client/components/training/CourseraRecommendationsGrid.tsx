"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Row, Col } from "antd";
import { StarFilled, ClockCircleOutlined, ArrowRightOutlined, SafetyCertificateOutlined, UserOutlined } from "@ant-design/icons";
import { mockSpecializationTracks } from "@/lib/training/data";
import type { PlantSection } from "@/lib/training/types";
import { tr, trData } from "@/lib/i18n";

interface CourseraRecommendationsGridProps {
  currentTrackId?: string;
  currentCourseId?: string;
  category?: PlantSection;
  title?: string;
  subtitle?: string;
  maxItems?: number;
}

export const CourseraRecommendationsGrid: React.FC<CourseraRecommendationsGridProps> = ({
  currentTrackId,
  currentCourseId,
  category,
  title = "Recommended Specializations & Related Programs",
  subtitle = "Based on this curriculum, shift engineers and process specialists also pursued these advanced industrial qualifications.",
  maxItems = 3,
}) => {
  // Filter out current track if provided
  let tracks = mockSpecializationTracks.filter((t) => t.id !== currentTrackId);

  // If category is provided, sort matches higher
  if (category) {
    tracks = [...tracks].sort((a, b) => {
      const aMatch = a.category === category ? 1 : 0;
      const bMatch = b.category === category ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  const displayTracks = tracks.slice(0, maxItems);

  return (
    <section id="recommendations-section" style={{ marginTop: 64, paddingTop: 48, borderTop: "1px solid #E2E8F0" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span
            style={{
              fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1C4463",
              background: "#EBF3FA", padding: "4px 10px", borderRadius: 6,
            }}
          >
            {tr("CONTINUE YOUR CAREER PROGRESSION")}
          </span>
          <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>{tr("• Coursera-Aligned Learning Path")}</span>
        </div>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 26, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>{trData(title)}</h2>
        <p style={{ margin: 0, fontSize: 14.5, color: "#64748B", maxWidth: 720, lineHeight: 1.55 }}>{trData(subtitle)}</p>
      </div>

      <Row gutter={[24, 24]}>
        {displayTracks.map((track) => (
          <Col xs={24} sm={12} lg={8} key={track.id}>
            <Link
              href={`/training/track/${track.id}`}
              style={{ textDecoration: "none", display: "block", height: "100%" }}
            >
              <div
                style={{
                  background: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden",
                  height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
                  transition: "all 0.28s cubic-bezier(0.32, 0.72, 0, 1)", boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-6px)";
                  e.currentTarget.style.boxShadow =
                    "0 20px 32px -8px rgba(28, 68, 99, 0.16), 0 4px 12px rgba(0, 0, 0, 0.04)";
                  e.currentTarget.style.borderColor = "#1C4463";
                  const titleEl = e.currentTarget.querySelector(".track-card-title") as HTMLElement;
                  if (titleEl) titleEl.style.color = "#1C4463";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(15, 23, 42, 0.04)";
                  e.currentTarget.style.borderColor = "#E2E8F0";
                  const titleEl = e.currentTarget.querySelector(".track-card-title") as HTMLElement;
                  if (titleEl) titleEl.style.color = "#0F172A";
                }}
              >
                <div>
                  {/* Top Image Banner */}
                  <div style={{ height: 168, position: "relative", overflow: "hidden", background: "#0B1A24" }}>
                    <Image
                      src={track.bannerImage}
                      alt={trData(track.title)}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      style={{ objectFit: "cover", transition: "transform 0.4s ease" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(180deg, rgba(11,26,36,0.3) 0%, rgba(11,26,36,0.85) 100%)",
                      }}
                    />

                    {/* Ribbon: Specialization */}
                    <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
                      <span
                        style={{
                          background: "rgba(11, 26, 36, 0.88)", backdropFilter: "blur(6px)", color: "#FFFFFF",
                          fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                          padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.2)",
                        }}
                      >
                        {tr("SPECIALIZATION")}
                      </span>
                    </div>

                    {/* Right Pill: Series count */}
                    <div style={{ position: "absolute", top: 12, right: 12 }}>
                      <span
                        style={{
                          background: "rgba(28, 68, 99, 0.92)", backdropFilter: "blur(6px)", color: "#E2F1FF",
                          fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                        }}
                      >
                        {tr("{count} Courses", { count: track.courseIds.length })}
                      </span>
                    </div>

                    {/* Category overlay */}
                    <div
                      style={{
                        position: "absolute", bottom: 10, left: 14, right: 14, display: "flex", alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11, fontWeight: 600, color: "#93C5FD", textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {trData(track.category)}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ padding: "18px 18px 12px 18px" }}>
                    {/* Partner Monogram */}
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                      <div
                        style={{
                          width: 20, height: 20, borderRadius: 4, background: track.partnerLogoBg, display: "flex",
                          alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontSize: 9,
                          fontWeight: 800,
                        }}
                      >
                        NE
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "#475569" }}>{trData(track.provider)}</span>
                    </div>

                    {/* Title */}
                    <h3
                      className="track-card-title"
                      style={{
                        fontSize: 16.5, fontWeight: 700, color: "#0F172A", lineHeight: 1.35, margin: "0 0 8px 0",
                        transition: "color 0.2s ease", minHeight: 44,
                      }}
                    >
                      {trData(track.title)}
                    </h3>

                    {/* Subtitle / summary */}
                    <p
                      style={{
                        fontSize: 12.5, color: "#64748B", lineHeight: 1.45, margin: "0 0 14px 0",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}
                    >
                      {trData(track.subtitle)}
                    </p>

                    {/* Rating & Learners */}
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: 12, fontSize: 12, marginBottom: 14,
                        color: "#334155",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <StarFilled style={{ color: "#EAB308", fontSize: 12 }} />
                        <span style={{ fontWeight: 700 }}>{track.rating.toFixed(1)}</span>
                        <span style={{ color: "#94A3B8", fontSize: 11 }}>({track.reviewCount})</span>
                      </div>
                      <span style={{ color: "#CBD5E1" }}>•</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <UserOutlined style={{ fontSize: 11, color: "#64748B" }} />
                        <span style={{ fontWeight: 600, color: "#475569" }}>{tr("{enrolledCount} enrolled", { enrolledCount: track.enrolledCount.toLocaleString() })}</span>
                      </div>
                    </div>

                    {/* Skills pills */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
                      {track.skillsGained.slice(0, 3).map((skill) => (
                        <span
                          key={skill}
                          style={{
                            fontSize: 11, color: "#1E293B", background: "#F1F5F9", padding: "3px 8px", borderRadius: 6,
                            fontWeight: 500,
                          }}
                        >
                          {trData(skill)}
                        </span>
                      ))}
                      {track.skillsGained.length > 3 && (
                        <span style={{ fontSize: 11, color: "#64748B", padding: "3px 4px" }}>{tr("+{count} more", { count: track.skillsGained.length - 3 })}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Strip */}
                <div style={{ padding: "12px 18px 16px 18px", borderTop: "1px solid #F1F5F9", background: "#FAFCFF" }}>
                  <div
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10,
                      fontSize: 11.5, color: "#64748B",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <ClockCircleOutlined style={{ fontSize: 11 }} />
                      {tr("{weeks} weeks ({hours}h/wk)", { weeks: track.durationWeeks, hours: track.hoursPerWeek })}
                    </span>
                    <span
                      style={{
                        color:
                          track.level === "Advanced"
                            ? "#7C3AED"
                            : track.level === "Intermediate"
                            ? "#0284C7"
                            : "#16A34A",
                        fontWeight: 600,
                      }}
                    >
                      {trData(track.level)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", color: "#1C4463",
                      fontWeight: 700, fontSize: 13,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <SafetyCertificateOutlined style={{ color: "#16A34A" }} />
                      {tr("Career Certificate")}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5 }}>
                      {tr("Explore Track")}
                      <ArrowRightOutlined style={{ fontSize: 11 }} />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </Col>
        ))}
      </Row>
    </section>
  );
};
