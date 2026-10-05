"use client";

import React, { useState } from "react";
import { Table, Tag, Input, Select, Button, Tooltip, Alert, Segmented, App } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  RobotOutlined,
  SearchOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  ThunderboltOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { LearningNeedRecord, Course } from "@/lib/training/types";
import { getLearningNeedRecords, getAllCourses, createTrainingAssignment, getPeople, getPerson, getSite, useTrainingData } from "@/lib/training/store";
import { getSession } from "@/lib/auth";
import { personIdOf } from "@/lib/training/identity";
import { NECTAR_LNI_COMPETENCIES, type NectarLniItem } from "@/lib/training/data";
import { nectarColors } from "@/lib/theme";
import { sText11SemiboldColorBgR6Border, sWhiteR14BorderShadow } from "@/lib/styles";

interface LniMatrixViewProps {
  siteScope?: string;
  onOpenCourse?: (course: Course) => void;
}

type ScoreKey = "skillMapScorePct" | "writtenScorePct" | "practicalScorePct" | "oralScorePct";

const PENDING_TAG = (
  <Tag color="default" style={{ borderRadius: 6, fontWeight: 500, fontSize: 11, color: "#64748B" }}>Pending</Tag>
);
const PENDING_EXAM_TAG = (
  <Tag color="orange" style={sText11SemiboldColorBgR6Border}>Pending Exam</Tag>
);

/** Assessment score column: green when >= 70%, else failColor; "pending" tag when not taken. */
function scoreColumn(
  title: string,
  key: ScoreKey,
  failColor: string,
  pending: React.ReactNode,
): ColumnsType<LearningNeedRecord>[number] {
  return {
    title,
    dataIndex: key,
    key,
    align: "center",
    render: (s: number | null) =>
      s !== null && s !== undefined ? (
        <span style={{ fontWeight: 600, color: s >= 70 ? "#166534" : failColor }}>{s}%</span>
      ) : (
        pending
      ),
  };
}

export default function LniMatrixView({ siteScope, onOpenCourse }: LniMatrixViewProps) {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState<"legacy_sheet" | "synthesis_ledger">("legacy_sheet");
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [plantFilter, setPlantFilter] = useState<string>(siteScope ?? "all");
  const [lniItems, setLniItems] = useState<NectarLniItem[]>(NECTAR_LNI_COMPETENCIES);

  useTrainingData();
  const actorId = personIdOf(getSession());
  // Employees (from the database) for the LNI sheet
  const allPeople = getPeople();
  const availableEmployees = siteScope ? allPeople.filter((e) => e.siteId === siteScope) : allPeople;
  const [pickedEmpId, setSelectedEmpId] = useState<string>("");
  const selectedEmpId = pickedEmpId || availableEmployees[0]?.id || "";
  const selectedEmp = getPerson(selectedEmpId);
  const getEmployeeById = getPerson;

  const activeSite = siteScope ?? (plantFilter === "all" ? undefined : plantFilter);

  const records = getLearningNeedRecords();
  const allCourses = getAllCourses();

  const handleLevelChange = (sNo: number, newLevel: "LOW" | "MED" | "HIGH") => {
    setLniItems((prev) =>
      prev.map((item) =>
        item.sNo === sNo
          ? { ...item, defaultLevel: newLevel, trainingRequired: newLevel === "HIGH" ? "No" : "Yes" }
          : item
      )
    );
  };

  const filtered = records.filter((r) => {
    const emp = getEmployeeById(r.employeeId);
    if (activeSite && emp?.siteId !== activeSite) {
      return false;
    }
    const empName = emp?.name.toLowerCase() || "";
    const matchesSearch =
      !search ||
      empName.includes(search.toLowerCase()) ||
      r.competencyAreaName.toLowerCase().includes(search.toLowerCase()) ||
      r.aiInsight.toLowerCase().includes(search.toLowerCase());

    const matchesLevel =
      levelFilter === "all" || r.currentLevel.toLowerCase() === levelFilter.toLowerCase();

    return matchesSearch && matchesLevel;
  });

  const columns: ColumnsType<LearningNeedRecord> = [
    {
      title: "Employee",
      key: "employee",
      render: (_, r) => {
        const emp = getEmployeeById(r.employeeId);
        return (
          <div>
            <div style={{ fontWeight: 600, color: nectarColors.ink, fontSize: 13 }}>{emp?.name ?? r.employeeId}</div>
            <div style={{ fontSize: 11, color: nectarColors.muted }}>{emp?.designation ?? "Operator"} · {emp?.siteId?.toUpperCase() ?? "Plant"}</div>
          </div>
        );
      },
    },
    {
      title: "Competency Domain",
      dataIndex: "competencyAreaName",
      key: "competencyAreaName",
      render: (t) => (
        <span style={{ fontWeight: 500, fontSize: 13, color: nectarColors.ink }}>{t}</span>
      ),
    },
    scoreColumn("1. Skill Map", "skillMapScorePct", "#D97706", PENDING_TAG),
    scoreColumn("2. Written", "writtenScorePct", "#D97706", PENDING_EXAM_TAG),
    scoreColumn("3. Practical", "practicalScorePct", "#DC2626", PENDING_TAG),
    scoreColumn("4. Oral Viva", "oralScorePct", "#D97706", PENDING_TAG),
    {
      title: "Level",
      dataIndex: "currentLevel",
      key: "currentLevel",
      align: "center",
      render: (lvl: "LOW" | "MED" | "HIGH") => {
        const color = lvl === "HIGH" ? "success" : lvl === "MED" ? "warning" : "error";
        return (
          <Tag color={color} style={{ borderRadius: 12, fontWeight: 700, fontSize: 11 }}>{lvl}</Tag>
        );
      },
    },
    {
      title: "AI Gap Analysis & Disconnect Insight",
      dataIndex: "aiInsight",
      key: "aiInsight",
      render: (insight: string, r) => (
        <div
          style={{
            background: "rgba(28, 68, 99, 0.04)", border: "1px solid rgba(28, 68, 99, 0.1)", borderRadius: 8,
            padding: "8px 12px", fontSize: 12, lineHeight: 1.45, color: nectarColors.ink, maxWidth: 420,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: nectarColors.leaf, fontWeight: 600, marginBottom: 3 }}>
            <RobotOutlined style={{ fontSize: 12 }} />
            <span>AI Reasoning Layer (Claude 3.5 Sonnet)</span>
          </div>
          <div>{insight}</div>
          {r.recommendedCourseTitle && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: nectarColors.muted }}>Target Refresher:</span>
              <Tag color="geekblue" style={{ fontSize: 10, borderRadius: 6, margin: 0 }}>{r.recommendedCourseTitle}</Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Action",
      key: "action",
      align: "center",
      render: (_, r) => {
        const course = allCourses.find((c) => c.id === r.recommendedCourseId);
        if (!course || !onOpenCourse) return null;
        if (r.writtenScorePct === null) {
          return (
            <Tag color="volcano" style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>Awaiting Written</Tag>
          );
        }
        return (
          <Button
            size="small"
            type="link"
            icon={<BookOutlined />}
            onClick={() => onOpenCourse(course)}
            style={{ color: nectarColors.leaf, fontWeight: 600 }}
          >
            Launch Refresher
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* View Switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <Segmented
          value={activeTab}
          onChange={(val) => setActiveTab(val as any)}
          options={[
            {
              label: (
                <div style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                  <FileTextOutlined />
                  <span style={{ fontWeight: 600 }}>Diagnostic Sheet (Nectar Legacy Format)</span>
                </div>
              ),
              value: "legacy_sheet",
            },
            {
              label: (
                <div style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                  <AppstoreOutlined />
                  <span style={{ fontWeight: 600 }}>Multi-Operator Competency Ledger</span>
                </div>
              ),
              value: "synthesis_ledger",
            },
          ]}
          style={{ background: "#E2E8F0", padding: 3, borderRadius: 8 }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {activeTab === "legacy_sheet" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: nectarColors.muted }}>Operator Sheet:</span>
              <Select
                value={selectedEmp?.id}
                onChange={(val) => setSelectedEmpId(val)}
                style={{ width: 220 }}
                options={availableEmployees.map((e) => ({
                  value: e.id,
                  label: `${e.name} (${e.siteId?.toUpperCase()})`,
                }))}
              />
            </div>
          )}

          {activeTab === "synthesis_ledger" && !siteScope && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: nectarColors.muted }}>Plant:</span>
              <Select
                value={plantFilter}
                onChange={(v) => setPlantFilter(v)}
                style={{ width: 140 }}
                options={[
                  { value: "all", label: "All Plants" },
                  { value: "s-etp", label: "ETP Plant" },
                  { value: "s-ro", label: "RO Plant" },
                  { value: "s-mee", label: "MEE Plant" },
                ]}
              />
            </div>
          )}

          <Tag color="cyan" style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>
            {selectedEmp?.siteId === "s-ro"
              ? "Assessor: Priya Iyer (Plant Manager)"
              : selectedEmp?.siteId === "s-mee"
              ? "Assessor: Sameer Joshi (Plant Manager)"
              : "Assessor: Rajesh Kulkarni (Plant Manager)"}
          </Tag>
        </div>
      </div>

      {activeTab === "legacy_sheet" ? (
        /* ---------------- NECTAR LEGACY LNI SHEET (IMAGE 1) ---------------- */
        <div
          style={{
            background: "#FFFFFF", borderRadius: 12, border: "1.5px solid #1C4463",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)", overflow: "hidden",
          }}
        >
          {/* Header block */}
          <div style={{ padding: "18px 24px", borderBottom: "1.5px solid #1C4463", textAlign: "center", background: "#FFFFFF" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ textAlign: "left" }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: "#1C4463", letterSpacing: 1 }}>nėctar</span>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748B" }}>ENVIRO INDIA PVT. LTD.</div>
              </div>
              <Tag color="blue" style={{ fontWeight: 700 }}>NEIPL-FORM-LNI-2026</Tag>
            </div>
            <h2 style={{ margin: "2px 0 6px", fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: 0.5 }}>LEARNING NEED IDENTIFICATION</h2>

            {/* Metadata Table */}
            <div
              style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", background: "#F8FAFC",
                border: "1px solid #CBD5E1", borderRadius: 6, padding: "10px 16px", marginTop: 10, fontSize: 12.5,
                textAlign: "left",
              }}
            >
              <div><strong>Name :</strong> {selectedEmp?.name ?? "—"}</div>
              <div><strong>Date :</strong> {new Date().toLocaleDateString("en-GB")}</div>
              <div><strong>EC No :</strong> {selectedEmp?.id?.toUpperCase() ?? "—"}</div>
              <div>
                <strong>Assessed by :</strong>{" "}
                {getSite(selectedEmp?.siteId)?.managerName ?? "—"}
              </div>
              <div><strong>Desig :</strong> {selectedEmp?.designation ?? "—"}</div>
              <div><strong>Department :</strong> Plant Operations & Environmental Services</div>
            </div>
          </div>

          {/* 20 Competency Rows Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#F1F5F9", color: "#1E293B", borderBottom: "1.5px solid #1C4463", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", borderRight: "1px solid #CBD5E1", width: 60, textAlign: "center" }}>S.No.</th>
                <th style={{ padding: "10px 14px", borderRight: "1px solid #CBD5E1", width: 140 }}>Section</th>
                <th style={{ padding: "10px 14px", borderRight: "1px solid #CBD5E1" }}>Competency Area</th>
                <th style={{ padding: "10px 14px", borderRight: "1px solid #CBD5E1", width: 220, textAlign: "center" }}>Current Level (Low/Med/High)</th>
                <th style={{ padding: "10px 14px", borderRight: "1px solid #CBD5E1", width: 140, textAlign: "center" }}>Training Required</th>
                <th style={{ padding: "10px 14px", width: 150, textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lniItems.map((item) => {
                const isTrainingReq = item.trainingRequired === "Yes";
                const isHigh = item.defaultLevel === "HIGH";
                const isMed = item.defaultLevel === "MED";
                const isLow = item.defaultLevel === "LOW";

                return (
                  <tr
                    key={item.sNo}
                    style={{
                      borderBottom: "1px solid #E2E8F0",
                      background: isLow ? "#FEF2F2" : item.sNo % 2 === 0 ? "#FAFAFA" : "#FFFFFF",
                    }}
                  >
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#64748B", borderRight: "1px solid #E2E8F0" }}>{item.sNo}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#1C4463", borderRight: "1px solid #E2E8F0" }}>{item.section}</td>
                    <td style={{ padding: "8px 12px", color: "#1E293B", borderRight: "1px solid #E2E8F0" }}>{item.competencyArea}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", borderRight: "1px solid #E2E8F0" }}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <Button
                          size="small"
                          type={isLow ? "primary" : "default"}
                          danger={isLow}
                          onClick={() => handleLevelChange(item.sNo, "LOW")}
                          style={{ fontSize: 11, fontWeight: 700, padding: "0 8px", height: 24 }}
                        >
                          LOW
                        </Button>
                        <Button
                          size="small"
                          type={isMed ? "primary" : "default"}
                          onClick={() => handleLevelChange(item.sNo, "MED")}
                          style={{
                            fontSize: 11, fontWeight: 700, padding: "0 8px", height: 24,
                            ...(isMed ? { background: "#D97706", borderColor: "#D97706" } : {}),
                          }}
                        >
                          MED
                        </Button>
                        <Button
                          size="small"
                          type={isHigh ? "primary" : "default"}
                          onClick={() => handleLevelChange(item.sNo, "HIGH")}
                          style={{
                            fontSize: 11, fontWeight: 700, padding: "0 8px", height: 24,
                            ...(isHigh ? { background: "#16A34A", borderColor: "#16A34A" } : {}),
                          }}
                        >
                          HIGH
                        </Button>
                      </div>
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center", borderRight: "1px solid #E2E8F0" }}>
                      <Tag
                        color={isTrainingReq ? "volcano" : "success"}
                        style={{ fontWeight: 800, fontSize: 12, borderRadius: 6, minWidth: 50, textAlign: "center" }}
                      >
                        {item.trainingRequired}
                      </Tag>
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      {item.recommendedCourseId ? (
                        <Button
                          size="small"
                          type="link"
                          onClick={async () => {
                            if (item.recommendedCourseId) {
                              try {
                                await createTrainingAssignment({
                                  employeeIds: [selectedEmpId],
                                  courseId: item.recommendedCourseId,
                                  assignedByEmployeeId: actorId,
                                  reason: `LNI gap: ${item.competencyArea}`,
                                  priority: "high",
                                  kind: "mandatory",
                                  source: "lni",
                                  dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
                                });
                                message.success(`Assigned to ${selectedEmp?.name ?? "the employee"}, due in 14 days.`);
                              } catch (err) {
                                message.error((err as Error).message);
                                return;
                              }
                              const c = allCourses.find((x) => x.id === item.recommendedCourseId);
                              if (c && onOpenCourse) onOpenCourse(c);
                            }
                          }}
                          style={{ fontSize: 11, fontWeight: 700, color: "#1C4463" }}
                        >
                          Assign Module
                        </Button>
                      ) : (
                        <span style={{ fontSize: 11, color: "#94A3B8" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer Bar */}
          <div
            style={{
              padding: "14px 20px", background: "#F8FAFC", borderTop: "1.5px solid #1C4463", display: "flex",
              justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
            }}
          >
            <div style={{ fontSize: 12.5, color: "#475569" }}>
              <strong>Summary:</strong> {lniItems.filter((i) => i.trainingRequired === "Yes").length} of 20 competencies require training intervention for {selectedEmp?.name}.
            </div>
            <Tag color="green" style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px" }}>Manager Assessor Sign-off: Verified</Tag>
          </div>
        </div>
      ) : (
        /* ---------------- MULTI-OPERATOR SYNTHESIS LEDGER ---------------- */
        <>
          <div
            style={{
              background: `linear-gradient(135deg, ${nectarColors.leaf} 0%, #0F2A3F 100%)`, borderRadius: 14,
              padding: "20px 24px", color: "#FFFFFF", boxShadow: "0 6px 20px rgba(28, 68, 99, 0.15)", display: "flex",
              justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RobotOutlined style={{ fontSize: 20, color: "#38BDF8" }} />
                <h2
                  style={{
                    margin: 0, fontSize: 18, fontWeight: 600, fontFamily: "var(--font-fraunces), Georgia, serif",
                    color: "#FFFFFF",
                  }}
                >
                  Learning Need Identification (LNI) & AI Gap Analysis
                </h2>
              </div>
              <p style={{ margin: "6px 0 0", color: "rgba(255, 255, 255, 0.78)", fontSize: 13, maxWidth: 680 }}>
                Continuous synthesis of 4-tier assessment scores. Automatically correlates written theory vs. practical plant maneuvering to highlight operational blind spots before safety incidents occur.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ background: "rgba(255, 255, 255, 0.1)", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#38BDF8" }}>{filtered.filter((r) => r.currentLevel === "HIGH").length}</div>
                <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.7)" }}>Autonomous</div>
              </div>
              <div style={{ background: "rgba(255, 255, 255, 0.1)", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#FDE68A" }}>{filtered.filter((r) => r.currentLevel === "MED").length}</div>
                <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.7)" }}>Supervised</div>
              </div>
              <div style={{ background: "rgba(255, 255, 255, 0.1)", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#FCA5A5" }}>{filtered.filter((r) => r.currentLevel === "LOW").length}</div>
                <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.7)" }}>Intervention</div>
              </div>
            </div>
          </div>

          <div style={sWhiteR14BorderShadow}>
            <div
              style={{
                padding: "16px 20px", borderBottom: "1px solid rgba(28, 68, 99, 0.08)", display: "flex",
                justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 15, color: nectarColors.ink }}>Plant Manpower Competency Ledger</div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Input
                  prefix={<SearchOutlined style={{ color: nectarColors.muted }} />}
                  placeholder="Search employee, domain, or AI insight..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                  style={{ width: 260, borderRadius: 8, fontSize: 13 }}
                />
                <Select
                  value={levelFilter}
                  onChange={(v) => setLevelFilter(v)}
                  style={{ width: 120 }}
                  options={[
                    { value: "all", label: "All Levels" },
                    { value: "high", label: "High Level" },
                    { value: "med", label: "Med Level" },
                    { value: "low", label: "Low Level" },
                  ]}
                />
              </div>
            </div>

            <Table
              rowKey="id"
              columns={columns}
              dataSource={filtered}
              pagination={{ pageSize: 6 }}
              scroll={{ x: 1000 }}
            />
          </div>
        </>
      )}
    </div>
  );
}
