"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Tag } from "antd";
import {
  ClockCircleOutlined,
  CalendarOutlined,
  SafetyCertificateOutlined,
  DollarCircleOutlined,
  TeamOutlined,
  BellOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  ArrowRightOutlined,
  RightOutlined,
  ReadOutlined,
  ThunderboltOutlined,
  BankOutlined,
} from "@ant-design/icons";
import type { Employee, Site } from "@/lib/mock-data";
import { getShiftById } from "@/lib/overtime/data";
import { formatInrAmount, getSalaryHistory, salaryMonthLabel } from "@/lib/salary";
import { getCertificatesForEmployee, getTrainingItems, useTrainingData, type ViewCertificateItem } from "@/lib/training/store";
import { getNotificationsForEmployee } from "@/lib/notifications";
import { getOtAssignments } from "@/lib/overtime";
import { getEmployeeSkills } from "@/lib/mock-data";
import { nectarColors } from "@/lib/theme";
import { rowBetween, rowCenterBetween2, sSerifText16SemiboldInkM0 } from "@/lib/styles";
import type { CSSProperties } from "react";

const colBetweenWhitePadR14BorderShadow: CSSProperties = {
  background: nectarColors.white,
  padding: 22,
  borderRadius: 14,
  border: "1px solid rgba(28, 68, 99, 0.08)",
  boxShadow: "0 2px 10px rgba(11, 26, 36, 0.03)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  minHeight: 350,
};

const rowCenterBetweenMb16: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 16,
};

const rowCenterBetweenMt18: CSSProperties = {
  marginTop: 18,
  paddingTop: 12,
  borderTop: "1px solid rgba(28, 68, 99, 0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const gridText15LeafBgR8Box32: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: "rgba(28, 68, 99, 0.08)",
  color: nectarColors.leaf,
  display: "grid",
  placeItems: "center",
  fontSize: 15,
};

const sText10SemiboldUpperMuted: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: nectarColors.muted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const rowCenterBetweenBgPadR10Border: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  background: nectarColors.sand,
  borderRadius: 10,
  border: "1px solid rgba(28, 68, 99, 0.05)",
};

const rowCenterGap4SemiboldInkMt2: CSSProperties = {
  fontWeight: 600,
  color: nectarColors.ink,
  display: "flex",
  alignItems: "center",
  gap: 4,
  marginTop: 2,
};

const sText11UpperColorMb2: CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255, 255, 255, 0.6)",
  marginBottom: 2,
};

const sText10SemiboldMuted: CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 600,
  color: nectarColors.muted,
  letterSpacing: "0.04em",
};

const rowBetweenText11SemiboldInk: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 11,
  fontWeight: 600,
  color: nectarColors.ink,
};

const sBgR2Mt5: CSSProperties = {
  height: 4,
  background: "rgba(28, 68, 99, 0.1)",
  borderRadius: 2,
  marginTop: 5,
  overflow: "hidden",
};

const sBgPadR8Border: CSSProperties = {
  background: nectarColors.sand,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(28, 68, 99, 0.05)",
};

interface EmployeeDashboardViewProps {
  employee: Employee;
  site?: Site;
  reporting: {
    manager?: Employee;
    sic?: Employee;
    supervisor?: Employee;
  } | null;
}

export default function EmployeeDashboardView({
  employee,
  site,
  reporting,
}: EmployeeDashboardViewProps) {
  // Time-aware greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const shift = useMemo(() => {
    return (
      getShiftById(employee.shiftId) ?? {
        id: "sh-morning",
        name: "A Shift (Morning)",
        startTime: "06:00",
        endTime: "14:00",
        scheduledHours: 8,
      }
    );
  }, [employee.shiftId]);

  const certs = useMemo(() => {
    return getCertificatesForEmployee(employee.id);
  }, [employee.id]);

  const salary = useMemo(() => {
    return getSalaryHistory(employee.id)[0];
  }, [employee.id]);

  const otAssignments = useMemo(() => {
    return getOtAssignments({ employeeId: employee.id }).filter(
      (a) => a.status === "assigned" || a.status === "acknowledged",
    );
  }, [employee.id]);

  const notifications = useMemo(() => {
    return getNotificationsForEmployee(employee.id);
  }, [employee.id]);

  const { version: trainingVersion } = useTrainingData();
  /** Open training from the database, most urgent first (completed items excluded). */
  const trainings = useMemo(() => {
    void trainingVersion;
    const rank = { overdue: 0, "due-soon": 1, scheduled: 2, completed: 3 } as const;
    return getTrainingItems({ employeeId: employee.id })
      .filter((t) => t.status !== "completed")
      .sort((a, b) => rank[a.status] - rank[b.status] || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  }, [employee.id, trainingVersion]);

  const skills = useMemo(() => {
    return getEmployeeSkills(employee);
  }, [employee]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 1. HERO IDENTITY & LIVE SHIFT CONSOLE */}
      <div
        style={{
          background: `linear-gradient(135deg, ${nectarColors.leaf} 0%, #0F2A3F 100%)`, borderRadius: 14,
          padding: "24px 28px", color: nectarColors.white, boxShadow: "0 10px 25px -5px rgba(28, 68, 99, 0.25)",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Subtle geometric background glow */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 20,
            position: "relative", zIndex: 1,
          }}
        >
          {/* Identity & Greeting */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 56, height: 56, borderRadius: "50%", background: "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(8px)", border: "2px solid rgba(255, 255, 255, 0.3)", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 600, color: "#FFFFFF",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontFamily: "var(--font-fraunces), Georgia, serif",
              }}
            >
              {employee.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1
                  style={{
                    margin: 0, fontSize: 24, fontWeight: 600, fontFamily: "var(--font-fraunces), Georgia, serif",
                    color: "#FFFFFF", letterSpacing: "-0.01em",
                  }}
                >
                  {greeting}, {employee.name.split(" ")[0]}!
                </h1>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px",
                    background: "rgba(22, 163, 74, 0.25)", border: "1px solid rgba(22, 163, 74, 0.5)", borderRadius: 20,
                    fontSize: 12, fontWeight: 500, color: "#86EFAC",
                  }}
                >
                  <span
                    style={{
                      width: 7, height: 7, borderRadius: "50%", background: "#4ADE80", boxShadow: "0 0 8px #4ADE80",
                    }}
                  />
                  Active on Duty
                </span>
              </div>

              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 13,
                  color: "rgba(255, 255, 255, 0.78)", flexWrap: "wrap",
                }}
              >
                <span>{employee.designation}</span>
                <span>·</span>
                <span>{site ? `${site.name} (${site.plantType})` : "Treatment Plant"}</span>
                <span>·</span>
                <span>{site?.location ?? "Maharashtra"}</span>
                <span>·</span>
                <span style={{ opacity: 0.9 }}>Emp ID: {employee.id}</span>
              </div>
            </div>
          </div>

          {/* Quick Shift Summary Capsule */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.08)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.14)", borderRadius: 12, padding: "12px 18px", display: "flex",
              alignItems: "center", gap: 20,
            }}
          >
            <div>
              <div style={sText11UpperColorMb2}>Current Shift</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF" }}>{shift.name}</div>
            </div>

            <div style={{ height: 28, width: 1, background: "rgba(255, 255, 255, 0.15)" }} />

            <div>
              <div style={sText11UpperColorMb2}>Shift Timing</div>
              <div
                style={{
                  fontSize: 14, fontWeight: 600, color: "#E2E8F0", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <ClockCircleOutlined style={{ fontSize: 13, color: "#93C5FD" }} />
                {shift.startTime} – {shift.endTime}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ACTION REQUIRED & NOTICE BAR (If any OT or urgent notice) */}
      {otAssignments.length > 0 && (
        <div
          style={{
            background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "16px 20px", display: "flex",
            alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14,
            boxShadow: "0 2px 6px rgba(217, 119, 6, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: 10, background: "#FEF3C7", color: "#D97706", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 18,
              }}
            >
              <ThunderboltOutlined />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "#92400E", fontSize: 14 }}>Overtime Shift Assigned · {otAssignments[0].hours} Hours Planned</div>
              <div style={{ fontSize: 13, color: "#B45309", marginTop: 2 }}>
                Assigned for {otAssignments[0].date} · {otAssignments[0].reason}
                {otAssignments[0].notes ? ` (${otAssignments[0].notes})` : ""}
              </div>
            </div>
          </div>

          <Link
            href="/notifications"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, background: "#D97706", color: "#FFFFFF",
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            Acknowledge & Details <ArrowRightOutlined style={{ fontSize: 11 }} />
          </Link>
        </div>
      )}

      {/* 3. LIVELY BALANCED BENTO GRID */}
      <div className="nectar-employee-grid">
        {/* CARD A: Shift Crew & Direct Support */}
        <div style={colBetweenWhitePadR14BorderShadow}>
          <div>
            <div style={rowCenterBetweenMb16}>
              <CardTitle icon={<TeamOutlined />}>On-Duty Shift Crew</CardTitle>
              <Tag color="cyan" style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>Site Supervision</Tag>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <CrewRow
                label="Supervisor"
                name={reporting?.supervisor?.name ?? "Amit Supervisor"}
                avatar={["#DCFCE7", "#166534", "#BBF7D0"]}
                badge={<DotPill colors={["#15803D", "#F0FDF4", "#DCFCE7", "#22C55E"]}>On Site</DotPill>}
              />
              <CrewRow
                label="Shift In-Charge"
                name={reporting?.sic?.name ?? "Sanjay Jadhav"}
                avatar={["#DBEAFE", "#1E40AF", "#BFDBFE"]}
                badge={<DotPill colors={["#1D4ED8", "#EFF6FF", "#DBEAFE", "#3B82F6"]}>Console Room</DotPill>}
              />
              <CrewRow
                label="Plant Manager"
                name={reporting?.manager?.name ?? "Rajesh Kulkarni"}
                avatar={["#F3E8FF", "#6B21A8", "#E9D5FF"]}
                badge={<Tag style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>O&M Head</Tag>}
              />
            </div>
          </div>
        </div>

        {/* CARD B: Leave Balances & Fast Request */}
        <div style={colBetweenWhitePadR14BorderShadow}>
          <div>
            <div style={rowCenterBetweenMb16}>
              <CardTitle icon={<CalendarOutlined />}>Leave Balances</CardTitle>
              <Link
                href="/leave/requests"
                style={{
                  fontSize: 12, color: nectarColors.leaf, fontWeight: 500, display: "flex", alignItems: "center",
                  gap: 4,
                }}
              >
                My Requests <RightOutlined style={{ fontSize: 10 }} />
              </Link>
            </div>

            {/* Leave quota boxes */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <LeaveQuotaBox days={4} label="Casual Leave" colors={["rgba(22, 163, 74, 0.06)", "rgba(22, 163, 74, 0.2)", "#166534", "#15803D", "#166534"]} />
              <LeaveQuotaBox days={5} label="Sick Leave" colors={["rgba(28, 68, 99, 0.06)", "rgba(28, 68, 99, 0.18)", "#0F2A3F", "#1C4463", "#4A6375"]} />
              <LeaveQuotaBox days={8} label="Privilege" colors={["rgba(196, 92, 38, 0.06)", "rgba(196, 92, 38, 0.2)", "#9A3412", "#C2410C", "#9A3412"]} />
            </div>

            <div
              style={{
                marginTop: 12, padding: "9px 12px", background: "rgba(22, 163, 74, 0.06)",
                border: "1px solid rgba(22, 163, 74, 0.16)", borderRadius: 8, fontSize: 12, color: "#166534",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <CheckCircleFilled style={{ color: "#16A34A", fontSize: 13 }} />
              <span>Sep 15–16 Leave approved by plant manager</span>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Link
              href="/leave/requests"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: nectarColors.leaf,
                color: "#FFFFFF", padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                textDecoration: "none", transition: "opacity 0.2s ease",
              }}
            >
              + Apply for Leave
            </Link>
          </div>
        </div>

        {/* CARD C: Latest Salary & Payslip */}
        <div style={colBetweenWhitePadR14BorderShadow}>
          <div>
            <div style={rowCenterBetweenMb16}>
              <CardTitle icon={<DollarCircleOutlined />}>Latest Salary & Payout</CardTitle>
              <Tag color="success" style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>Credited</Tag>
            </div>

            {salary ? (
              <div
                style={{
                  background: nectarColors.sand, border: "1px solid rgba(28, 68, 99, 0.08)", borderRadius: 10,
                  padding: "16px 18px",
                }}
              >
                <div style={rowBetween}>
                  <div>
                    <span style={sText10SemiboldUpperMuted}>Net Credited Amount</span>
                    <div
                      style={{
                        fontSize: 24, fontWeight: 700, color: nectarColors.ink,
                        fontFamily: "var(--font-fraunces), Georgia, serif", marginTop: 2,
                      }}
                    >
                      {formatInrAmount(salary.amount)}
                    </div>
                  </div>
                  <Tag color="blue" style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>{salaryMonthLabel(salary.salaryMonth)}</Tag>
                </div>

                <div
                  style={{
                    marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12,
                    borderTop: "1px solid rgba(28, 68, 99, 0.06)", paddingTop: 12,
                  }}
                >
                  <div>
                    <span style={sText10SemiboldMuted}>BANK ACCOUNT</span>
                    <span style={rowCenterGap4SemiboldInkMt2}><BankOutlined style={{ color: nectarColors.leaf }} /> {salary.bankName} (••••{salary.accountLast4})</span>
                  </div>
                  <div>
                    <span style={sText10SemiboldMuted}>TRANSFER MODE</span>
                    <span style={rowCenterGap4SemiboldInkMt2}><CheckCircleOutlined style={{ color: "#16A34A" }} /> {salary.paymentMode} · {salary.paymentDate}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: nectarColors.muted }}>No salary records available.</p>
            )}
          </div>

          <div style={rowCenterBetweenMt18}>
            <span style={{ fontSize: 12, color: nectarColors.muted }}>OT Rate: ₹270/hr · Eligible</span>
            <Link href="/salary" style={{ color: nectarColors.leaf, fontSize: 12, fontWeight: 500 }}>View Payslip →</Link>
          </div>
        </div>

        {/* CARD D: Safety Passport & Active Certifications */}
        <div style={colBetweenWhitePadR14BorderShadow}>
          <div>
            <div style={rowCenterBetweenMb16}>
              <CardTitle icon={<SafetyCertificateOutlined />} tile={["rgba(22, 163, 74, 0.1)", "#16A34A"]}>Safety Passport</CardTitle>
              <Tag color="green" style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>100% Compliant</Tag>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {certs.slice(0, 4).map((c: ViewCertificateItem) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px",
                    background: nectarColors.sand, borderRadius: 8, border: "1px solid rgba(28, 68, 99, 0.04)",
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircleFilled style={{ color: "#16A34A", fontSize: 13 }} />
                    <span style={{ fontWeight: 600, color: nectarColors.ink }}>{c.name}</span>
                  </div>
                  <span
                    style={{
                      background: nectarColors.white, border: "1px solid rgba(28, 68, 99, 0.1)", borderRadius: 6,
                      padding: "2px 7px", fontSize: 11, color: nectarColors.muted, fontWeight: 500,
                    }}
                  >
                    Exp: {c.expiresOn}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={rowCenterBetweenMt18}>
            <span style={{ fontSize: 12, color: nectarColors.muted }}>{certs.length} active plant safety passes</span>
            <Link href="/certifications" style={{ color: nectarColors.leaf, fontSize: 12, fontWeight: 500 }}>All Certificates →</Link>
          </div>
        </div>

        {/* CARD E: Plant Notice & Toolbox Talks */}
        <div style={colBetweenWhitePadR14BorderShadow}>
          <div>
            <div style={rowCenterBetweenMb16}>
              <CardTitle icon={<BellOutlined />} tile={["rgba(217, 119, 6, 0.1)", "#D97706"]}>Plant Announcements</CardTitle>
              <Tag color="orange" style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>Operations</Tag>
            </div>

            <div
              style={{
                background: "#FFFBEB", border: "1px solid #FDE68A", padding: "12px 14px", borderRadius: 10,
                marginBottom: 10,
              }}
            >
              <div style={rowCenterBetween2}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>Mandatory Toolbox Talk</div>
                <span
                  style={{
                    fontSize: 10, fontWeight: 600, background: "#FEF3C7", color: "#B45309", padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  Fri 07:00
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#B45309", marginTop: 4 }}>ETP Control Room · Chemical spill containment & secondary bund checks.</div>
            </div>

            <div
              style={{
                background: nectarColors.sand, border: "1px solid rgba(28, 68, 99, 0.06)", padding: "12px 14px",
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: nectarColors.ink }}>Shift A → B Handover Protocol</div>
              <div style={{ fontSize: 12, color: nectarColors.muted, marginTop: 3 }}>Log RO feed turbidity readings into the logbook 15 mins prior to shift conclusion.</div>
            </div>
          </div>

          <div style={rowCenterBetweenMt18}>
            <span style={{ fontSize: 12, color: nectarColors.muted }}>{notifications.filter((n) => !n.read).length} unread updates</span>
            <Link href="/notifications" style={{ color: nectarColors.leaf, fontSize: 12, fontWeight: 500 }}>Notification Center →</Link>
          </div>
        </div>

        {/* CARD F: Skill & Training Tracker (Elevated Design) */}
        <div style={colBetweenWhitePadR14BorderShadow}>
          <div>
            <div style={rowCenterBetweenMb16}>
              <CardTitle icon={<ReadOutlined />} tile={["rgba(124, 58, 237, 0.1)", "#7C3AED"]}>Skill & Training Tracker</CardTitle>
              <Tag color="purple" style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>Operator Tier II</Tag>
            </div>

            {/* Radial Competency Meter & Details */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: nectarColors.sand,
                borderRadius: 10, border: "1px solid rgba(28, 68, 99, 0.06)", marginBottom: 10,
              }}
            >
              {/* Radial Donut Progress Indicator */}
              <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="28" cy="28" r="22" fill="transparent" stroke="rgba(28, 68, 99, 0.1)" strokeWidth="5" />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="transparent"
                    stroke="#1C4463"
                    strokeWidth="5"
                    strokeDasharray={2 * Math.PI * 22}
                    strokeDashoffset={
                      2 * Math.PI * 22 * (1 - (employee.skillScore ?? 70) / 100)
                    }
                    strokeLinecap="round"
                  />
                </svg>
                <div
                  style={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: nectarColors.ink, lineHeight: 1 }}>{employee.skillScore ?? 70}%</span>
                  <span
                    style={{
                      fontSize: 8, fontWeight: 700, color: nectarColors.muted, letterSpacing: "0.04em", marginTop: 2,
                    }}
                  >
                    INDEX
                  </span>
                </div>
              </div>

              {/* Competency Text & Status */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: nectarColors.ink }}>Operator Competency</div>
                  <span
                    style={{
                      fontSize: 10, fontWeight: 600, color: "#166534", background: "#DCFCE7", padding: "1px 6px",
                      borderRadius: 10,
                    }}
                  >
                    Verified
                  </span>
                </div>
                <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 2, lineHeight: 1.35 }}>ETP operations, chemical dosing & sampling standards verified.</div>
              </div>
            </div>

            {/* Core Domain Competency Mini-Bars */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div style={sBgPadR8Border}>
                <div style={rowBetweenText11SemiboldInk}>
                  <span>ETP Ops</span>
                  <span style={{ color: nectarColors.leaf }}>{skills.etpOps ?? 75}%</span>
                </div>
                <div style={sBgR2Mt5}>
                  <div
                    style={{
                      width: `${skills.etpOps ?? 75}%`, height: "100%", background: nectarColors.leaf, borderRadius: 2,
                    }}
                  />
                </div>
              </div>

              <div style={sBgPadR8Border}>
                <div style={rowBetweenText11SemiboldInk}>
                  <span>Safety SOP</span>
                  <span style={{ color: "#16A34A" }}>{skills.safety ?? 88}%</span>
                </div>
                <div style={sBgR2Mt5}>
                  <div
                    style={{ width: `${skills.safety ?? 88}%`, height: "100%", background: "#16A34A", borderRadius: 2 }}
                  />
                </div>
              </div>
            </div>

            {/* Active Training Module Container */}
            {trainings.length > 0 ? (
              <div
                style={{
                  padding: "10px 12px", background: nectarColors.white, border: "1px solid rgba(28, 68, 99, 0.12)",
                  borderRadius: 8, fontSize: 12,
                }}
              >
                <div style={rowCenterBetween2}>
                  <span style={{ fontWeight: 600, color: nectarColors.ink }}>{trainings[0].course}</span>
                  <Tag
                    color={trainings[0].priority === "critical" ? "red" : "orange"}
                    style={{ borderRadius: 6, margin: 0, fontSize: 10 }}
                  >
                    {trainings[0].priority}
                  </Tag>
                </div>
                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", color: nectarColors.muted,
                    marginTop: 5, fontSize: 11,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><ClockCircleOutlined style={{ fontSize: 11 }} /> {trainings[0].dueDate ? `Due: ${trainings[0].dueDate}` : "No due date"}</span>
                  <span style={{ color: trainings[0].status === "overdue" ? "#DC2626" : "#2563EB", fontWeight: 500 }}>
                    {{ overdue: "Overdue", "due-soon": "Due soon", scheduled: "In progress", completed: "Completed" }[trainings[0].status]}
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: "10px 12px", border: "1px solid rgba(28, 68, 99, 0.08)", borderRadius: 8, fontSize: 12,
                  color: nectarColors.muted, background: nectarColors.sand,
                }}
              >
                All mandatory refresher trainings completed.
              </div>
            )}
          </div>

          <div style={rowCenterBetweenMt18}>
            <span style={{ fontSize: 12, color: nectarColors.muted }}>{trainings.length} open · {trainings.filter((t) => t.status === "overdue").length} overdue</span>
            <Link href="/training" style={{ color: nectarColors.leaf, fontSize: 12, fontWeight: 500 }}>Open Training Hub →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One row of the "On-Duty Shift Crew" card. avatar = [background, text, border]. */
function CrewRow({ label, name, avatar: [bg, color, border], badge }: {
  label: string;
  name: string;
  avatar: [string, string, string];
  badge: React.ReactNode;
}) {
  return (
    <div style={rowCenterBetweenBgPadR10Border}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{ width: 34, height: 34, borderRadius: "50%", background: bg, color, fontWeight: 700, fontSize: 12,
            display: "grid", placeItems: "center", border: `1px solid ${border}` }}
        >
          {name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div>
          <div style={sText10SemiboldUpperMuted}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: nectarColors.ink }}>{name}</div>
        </div>
      </div>
      {badge}
    </div>
  );
}

/** Small status pill with a coloured dot. colors = [text, background, border, dot]. */
function DotPill({ colors: [color, bg, border, dot], children }: {
  colors: [string, string, string, string];
  children: React.ReactNode;
}) {
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, color,
        background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "2px 8px" }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />
      {children}
    </span>
  );
}

/** Leave balance tile. colors = [background, border, number, label, "Days left"]. */
function LeaveQuotaBox({ days, label, colors: [bg, border, numColor, labelColor, subColor] }: {
  days: number;
  label: string;
  colors: [string, string, string, string, string];
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, padding: "14px 8px", borderRadius: 10, textAlign: "center" }}>
      <div
        style={{ fontSize: 22, fontWeight: 700, color: numColor, lineHeight: 1,
          fontFamily: "var(--font-fraunces), Georgia, serif" }}
      >
        {days}
      </div>
      <div style={{ fontSize: 11, color: labelColor, marginTop: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 11, color: subColor, marginTop: 2, fontWeight: 500 }}>Days left</div>
    </div>
  );
}

/** Card header: tinted 32px icon tile + serif title. tile = [background, color]; default is the leaf tint. */
function CardTitle({ icon, tile, children }: {
  icon: React.ReactNode;
  tile?: [string, string];
  children: React.ReactNode;
}) {
  const tileStyle = tile
    ? { ...gridText15LeafBgR8Box32, background: tile[0], color: tile[1] }
    : gridText15LeafBgR8Box32;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={tileStyle}>{icon}</div>
      <h3 style={sSerifText16SemiboldInkM0}>{children}</h3>
    </div>
  );
}
