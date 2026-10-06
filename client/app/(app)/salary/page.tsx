"use client";

import React, { useMemo, useState } from "react";
import {
  Empty,
  Table,
  Tag,
  Button,
  Modal,
  Input,
  Select,
  Tooltip,
  Divider,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BankOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DollarCircleOutlined,
  DownloadOutlined,
  PrinterOutlined,
  FileTextOutlined,
  CheckCircleFilled,
  ThunderboltOutlined,
  SearchOutlined,
  CreditCardOutlined,
  SafetyCertificateOutlined,
  WalletOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { getSession } from "@/lib/auth";
import {
  formatInrAmount,
  getSalaryHistory,
  salaryMonthLabel,
  type SalaryPayment,
} from "@/lib/salary";
import { scopedEmployeeId, selfEmployeeId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { getEmployeeById, getSiteById } from "@/lib/mock-data";
import { rowCenterBetween2, sSerifText16SemiboldInkM0 } from "@/lib/styles";
import type { CSSProperties } from "react";
import { tr, intlLocale, translateDesignation, translateDepartment, trData, trEnum } from "@/lib/i18n";

const colBetweenWhitePadR14BorderShadow2: CSSProperties = {
  background: nectarColors.white,
  padding: "18px 20px",
  borderRadius: 14,
  border: "1px solid rgba(28, 68, 99, 0.08)",
  boxShadow: "0 2px 8px rgba(11, 26, 36, 0.02)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const sText11SemiboldUpperMuted: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: nectarColors.muted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const sText12SemiboldInkBgPad: CSSProperties = {
  background: "rgba(28, 68, 99, 0.05)",
  padding: "8px 12px",
  fontWeight: 600,
  fontSize: 12,
  color: nectarColors.ink,
  borderBottom: "1px solid rgba(28, 68, 99, 0.08)",
};

const sSerifText26BoldInk: CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  color: nectarColors.ink,
  fontFamily: "var(--font-fraunces), Georgia, serif",
  lineHeight: 1.1,
};

const sR10Border: CSSProperties = { border: "1px solid rgba(28, 68, 99, 0.1)", borderRadius: 10, overflow: "hidden" };

export default function SalaryPage() {
  const session = getSession();
  const empId = scopedEmployeeId(session) ?? selfEmployeeId(session);
  const employee = empId ? getEmployeeById(empId) : undefined;
  const site = employee?.siteId ? getSiteById(employee.siteId) : undefined;

  const rawRows = useMemo(
    () => (empId ? getSalaryHistory(empId) : []),
    [empId],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMode, setSelectedMode] = useState<string>("all");
  const [activeSlip, setActiveSlip] = useState<SalaryPayment | null>(null);

  const filteredRows = useMemo(() => {
    return rawRows.filter((r) => {
      const monthLabel = salaryMonthLabel(r.salaryMonth).toLowerCase();
      const matchesSearch =
        !searchQuery ||
        monthLabel.includes(searchQuery.toLowerCase()) ||
        r.salaryMonth.includes(searchQuery) ||
        r.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.remarks && r.remarks.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesMode =
        selectedMode === "all" || r.paymentMode.toLowerCase() === selectedMode.toLowerCase();

      return matchesSearch && matchesMode;
    });
  }, [rawRows, searchQuery, selectedMode]);

  const latest = rawRows[0];

  // Calculated statistics
  const totalYtd = useMemo(() => {
    return rawRows.reduce((acc, curr) => acc + curr.amount, 0);
  }, [rawRows]);

  const totalOtPayout = useMemo(() => {
    return rawRows.reduce((acc, curr) => {
      if (curr.remarks?.includes("OT payout")) {
        const match = curr.remarks.match(/₹(\d+)/);
        if (match) return acc + parseInt(match[1], 10);
      }
      return acc;
    }, 0);
  }, [rawRows]);

  if (!empId || !employee) {
    return (
      <Empty description={tr("Salary history is available on accounts linked to an employee profile. Open My Employee → Salary, or sign in as an employee.")} />
    );
  }

  const handleExportCsv = () => {
    const headers = [
      "Month",
      "Net Amount (INR)",
      "Payment Date",
      "Payment Time",
      "Bank",
      "Account (Last 4)",
      "Payment Mode",
      "Status",
      "Remarks",
    ];
    const csvRows = [
      headers.join(","),
      ...rawRows.map((r) =>
        [
          `"${salaryMonthLabel(r.salaryMonth)}"`,
          r.amount,
          `"${r.paymentDate}"`,
          `"${r.paymentTime}"`,
          `"${r.bankName}"`,
          `"${r.accountLast4}"`,
          `"${r.paymentMode}"`,
          `"${r.status}"`,
          `"${r.remarks ?? ""}"`,
        ].join(","),
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Salary_Statement_${employee.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: ColumnsType<SalaryPayment> = [
    {
      title: tr("Salary Cycle"),
      dataIndex: "salaryMonth",
      key: "salaryMonth",
      render: (m: string) => {
        const [year, month] = m.split("-");
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        return (
          <div>
            <div style={{ fontWeight: 600, color: nectarColors.ink, fontSize: 14 }}>{salaryMonthLabel(m)}</div>
            <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 2 }}>
              01 {salaryMonthLabel(m).split(" ")[0].slice(0, 3)} – {lastDay}{" "}
              {salaryMonthLabel(m).split(" ")[0].slice(0, 3)} {trData(year)}
            </div>
          </div>
        );
      },
    },
    {
      title: tr("Net Disbursed"),
      dataIndex: "amount",
      key: "amount",
      render: (a: number) => (
        <span
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 700, fontSize: 15, color: nectarColors.ink,
          }}
        >
          {formatInrAmount(a)}
        </span>
      ),
    },
    {
      title: tr("Disbursement Date"),
      dataIndex: "paymentDate",
      key: "paymentDate",
      render: (d: string, r: SalaryPayment) => {
        const dateObj = new Date(d);
        const formattedDate = dateObj.toLocaleDateString(intlLocale(), { day: "2-digit", month: "short", year: "numeric" });
        return (
          <div>
            <div
              style={{
                fontWeight: 500, color: nectarColors.ink, fontSize: 13, display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <CalendarOutlined style={{ color: nectarColors.leaf, fontSize: 12 }} />
              {trData(formattedDate)}
            </div>
            <div
              style={{
                fontSize: 11, color: nectarColors.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <ClockCircleOutlined style={{ fontSize: 10 }} />
              {r.paymentTime} IST
            </div>
          </div>
        );
      },
    },
    {
      title: tr("Bank & Account"),
      key: "bank",
      render: (_, r: SalaryPayment) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: 6, background: "rgba(28, 68, 99, 0.08)", display: "grid",
              placeItems: "center", color: nectarColors.leaf, fontSize: 13,
            }}
          >
            <BankOutlined />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: nectarColors.ink }}>{trData(r.bankName)}</div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: nectarColors.muted, letterSpacing: "0.05em" }}>•••• {trData(r.accountLast4)}</div>
          </div>
        </div>
      ),
    },
    {
      title: tr("Mode"),
      dataIndex: "paymentMode",
      key: "paymentMode",
      render: (m: SalaryPayment["paymentMode"]) => (
        <span
          style={{
            display: "inline-block", padding: "3px 8px", background: nectarColors.sand,
            border: "1px solid rgba(28, 68, 99, 0.1)", borderRadius: 6, fontSize: 11, fontWeight: 600,
            color: nectarColors.ink, letterSpacing: "0.04em",
          }}
        >
          {m}
        </span>
      ),
    },
    {
      title: tr("Status"),
      dataIndex: "status",
      key: "status",
      render: (s: SalaryPayment["status"]) => {
        const isPaid = s === "paid";
        return (
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
              background: isPaid ? "#F0FDF4" : "#FEF3C7", border: `1px solid ${isPaid ? "#DCFCE7" : "#FDE68A"}`,
              borderRadius: 20, fontSize: 12, fontWeight: 600, color: isPaid ? "#166534" : "#92400E",
              textTransform: "capitalize",
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: "50%", background: isPaid ? "#22C55E" : "#F59E0B",
                boxShadow: isPaid ? "0 0 6px #22C55E" : "none",
              }}
            />
            {trEnum(s)}
          </span>
        );
      },
    },
    {
      title: tr("Remarks"),
      dataIndex: "remarks",
      key: "remarks",
      render: (r?: string) => {
        if (!r) {
          return <span style={{ color: "rgba(74, 99, 117, 0.4)", fontSize: 13 }}>—</span>;
        }
        const isOt = r.includes("OT payout");
        return (
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500,
              color: isOt ? "#9A3412" : nectarColors.ink,
              background: isOt ? "rgba(196, 92, 38, 0.08)" : nectarColors.sand,
              border: `1px solid ${isOt ? "rgba(196, 92, 38, 0.2)" : "rgba(28, 68, 99, 0.08)"}`, padding: "3px 8px",
              borderRadius: 6,
            }}
          >
            {isOt && <ThunderboltOutlined style={{ fontSize: 11 }} />}
            {trData(r)}
          </span>
        );
      },
    },
    {
      title: tr("Slip"),
      key: "action",
      align: "center",
      render: (_, r: SalaryPayment) => (
        <Tooltip title={tr("View Payslip")}>
          <Button
            type="text"
            size="small"
            icon={<FileTextOutlined style={{ color: nectarColors.leaf }} />}
            onClick={() => setActiveSlip(r)}
            style={{
              borderRadius: 6, fontWeight: 500, fontSize: 12, color: nectarColors.leaf, display: "inline-flex",
              alignItems: "center", gap: 4,
            }}
          >
            {tr("Slip")}
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 1. COMPACT PAGE HEADER & VERIFICATION STATUS */}
      <div
        style={{
          background: nectarColors.white, borderRadius: 14, padding: "20px 24px",
          border: "1px solid rgba(28, 68, 99, 0.08)", boxShadow: "0 2px 8px rgba(11, 26, 36, 0.02)", display: "flex",
          justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1
              style={{
                margin: 0, fontSize: 22, fontWeight: 600, fontFamily: "var(--font-fraunces), Georgia, serif",
                color: nectarColors.ink, letterSpacing: "-0.01em",
              }}
            >
              {tr("Salary & Disbursement History")}
            </h1>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", background: "#F0FDF4",
                border: "1px solid #DCFCE7", borderRadius: 20, fontSize: 12, fontWeight: 500, color: "#166534",
              }}
            >
              <CheckCircleFilled style={{ color: "#16A34A", fontSize: 12 }} />
              {tr("Direct Deposit Verified")}
            </span>
          </div>

          <div
            style={{
              display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 13, color: nectarColors.muted,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 600, color: nectarColors.ink }}>{trData(employee.name)}</span>
            <span>·</span>
            <span>{trData(employee.designation)}</span>
            <span>·</span>
            <span>{site?.name ? trData(site.name) : tr("Treatment Plant")}</span>
            <span>·</span>
            <span style={{ fontFamily: "monospace" }}>{tr("Emp ID: {id}", { id: employee.id })}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportCsv}
            style={{
              borderRadius: 8, fontWeight: 500, fontSize: 13, borderColor: "rgba(28, 68, 99, 0.2)",
              color: nectarColors.ink,
            }}
          >
            {tr("Export Statement (CSV)")}
          </Button>
        </div>
      </div>

      {/* 2. EXECUTIVE METRIC CARDS (Bento Row) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <MetricCard
          label={tr("Latest Net Payout")}
          badge={<Tag color="success" style={{ margin: 0, borderRadius: 12, fontSize: 11 }}>{tr("Credited")}</Tag>}
          value={latest ? formatInrAmount(latest.amount) : "—"}
          sub={<>{latest ? salaryMonthLabel(latest.salaryMonth) : "—"}{" "}{tr("· Disbursed")}</>}
        />
        <MetricCard
          label={tr("Cumulative Recorded")}
          badge={
            <span style={{ fontSize: 12, fontWeight: 600, color: nectarColors.leaf, background: "rgba(28, 68, 99, 0.08)", padding: "2px 8px", borderRadius: 12 }}>{tr("{rawRowCount} Cycles", { rawRowCount: rawRows.length })}</span>
          }
          value={formatInrAmount(totalYtd)}
          sub={tr("Total disbursements on record")}
        />
        <MetricCard
          label={tr("Salary Deposit Account")}
          badge={<BankOutlined style={{ color: nectarColors.leaf, fontSize: 14 }} />}
          value={trData(latest?.bankName ?? "HDFC Bank")}
          valueStyle={{ fontSize: 18, fontWeight: 700, color: nectarColors.ink, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 6 }}
          sub={<>A/C: ••••{latest?.accountLast4 ?? "5444"} · {latest?.paymentMode ?? "NEFT"}</>}
          subStyle={{ fontSize: 12, color: nectarColors.muted, marginTop: 4, fontFamily: "monospace" }}
        />
        <MetricCard
          label={tr("Overtime Compensation")}
          badge={
            <span style={{ fontSize: 11, fontWeight: 600, color: "#B45309", background: "#FEF3C7", padding: "2px 7px", borderRadius: 12 }}>{tr("OT Active")}</span>
          }
          value={formatInrAmount(totalOtPayout)}
          valueStyle={{ fontSize: 26, fontWeight: 700, color: "#9A3412", fontFamily: "var(--font-fraunces), Georgia, serif", lineHeight: 1.1 }}
          sub={tr("OT Rate: ₹270/hr · Automatically credited")}
        />
      </div>

      {/* 3. TABLE CONTAINER WITH SEARCH & FILTERS */}
      <div
        style={{
          background: nectarColors.white, borderRadius: 14, border: "1px solid rgba(28, 68, 99, 0.08)",
          boxShadow: "0 2px 10px rgba(11, 26, 36, 0.03)", overflow: "hidden",
        }}
      >
        {/* Table Top Bar */}
        <div
          style={{
            padding: "16px 20px", borderBottom: "1px solid rgba(28, 68, 99, 0.08)", display: "flex",
            alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={sSerifText16SemiboldInkM0}>{tr("Disbursement Register")}</h2>
            <span
              style={{
                fontSize: 11, fontWeight: 600, color: nectarColors.leaf, background: "rgba(28, 68, 99, 0.06)",
                border: "1px solid rgba(28, 68, 99, 0.12)", padding: "2px 8px", borderRadius: 12,
              }}
            >
              {filteredRows.length} {filteredRows.length === 1 ? tr("Record") : tr("Records")}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Input
              prefix={<SearchOutlined style={{ color: nectarColors.muted }} />}
              placeholder={tr("Search month, bank, or remarks...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              style={{ width: 240, borderRadius: 8, fontSize: 13 }}
            />

            <Select
              value={selectedMode}
              onChange={(val) => setSelectedMode(val)}
              style={{ width: 130 }}
              options={[
                { value: "all", label: tr("All Modes") },
                { value: "NEFT", label: "NEFT" },
                { value: "RTGS", label: "RTGS" },
                { value: "UPI", label: "UPI" },
              ]}
            />
          </div>
        </div>

        {/* Ant Design Table */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRows}
          pagination={{ pageSize: 8, showSizeChanger: false, style: { paddingRight: 20 } }}
          scroll={{ x: 920 }}
          style={{ background: nectarColors.white }}
        />
      </div>

      {/* 4. MODAL: DETAILED CORPORATE PAYSLIP */}
      <Modal open={Boolean(activeSlip)} onCancel={() => setActiveSlip(null)} footer={null} width={680} centered>
        {activeSlip && (
          <div style={{ padding: "10px 4px" }}>
            {/* Payslip Header */}
            <div
              style={{
                borderBottom: "2px solid rgba(28, 68, 99, 0.15)", paddingBottom: 16, marginBottom: 18, display: "flex",
                justifyContent: "space-between", alignItems: "flex-start",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 18, fontWeight: 700, fontFamily: "var(--font-fraunces), Georgia, serif",
                    color: nectarColors.leaf,
                  }}
                >
                  {tr("NECTAR ENVIRONMENT-SYSTEMS")}
                </div>
                <div style={{ fontSize: 12, color: nectarColors.muted, marginTop: 2 }}>{tr("Water & Environmental Technologies Pvt. Ltd. · Treatment Plants Division")}</div>
                <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 2 }}>{tr("Site: {site} ({plant}) · Maharashtra", { site: site?.name ? trData(site.name) : tr("Pune ETP Facility"), plant: site?.plantType ?? "ETP" })}</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block", padding: "4px 10px", background: "#F0FDF4", border: "1px solid #DCFCE7",
                    borderRadius: 6, fontSize: 12, fontWeight: 700, color: "#166534",
                  }}
                >
                  {tr("PAID SALARY SLIP")}
                </span>
                <div style={{ fontSize: 12, fontWeight: 600, color: nectarColors.ink, marginTop: 6 }}>{salaryMonthLabel(activeSlip.salaryMonth)}</div>
                <div style={{ fontSize: 11, color: nectarColors.muted }}>{tr("Ref: PAY-{id}", { id: activeSlip.id.toUpperCase() })}</div>
              </div>
            </div>

            {/* Employee & Bank Info Matrix */}
            <div
              style={{
                background: nectarColors.sand, border: "1px solid rgba(28, 68, 99, 0.08)", borderRadius: 10,
                padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", fontSize: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <span style={{ color: nectarColors.muted, display: "block", fontSize: 11 }}>{tr("EMPLOYEE NAME")}</span>
                <span style={{ fontWeight: 600, color: nectarColors.ink }}>{trData(employee.name)}</span>
              </div>
              <div>
                <span style={{ color: nectarColors.muted, display: "block", fontSize: 11 }}>{tr("EMPLOYEE ID")}</span>
                <span style={{ fontWeight: 600, color: nectarColors.ink, fontFamily: "monospace" }}>{employee.id}</span>
              </div>
              <div>
                <span style={{ color: nectarColors.muted, display: "block", fontSize: 11 }}>{tr("DESIGNATION")}</span>
                <span style={{ fontWeight: 600, color: nectarColors.ink }}>{translateDesignation(employee.designation)}</span>
              </div>
              <div>
                <span style={{ color: nectarColors.muted, display: "block", fontSize: 11 }}>{tr("DEPARTMENT")}</span>
                <span style={{ fontWeight: 600, color: nectarColors.ink }}>{translateDepartment(employee.department)}</span>
              </div>
              <div>
                <span style={{ color: nectarColors.muted, display: "block", fontSize: 11 }}>{tr("DISBURSEMENT BANK")}</span>
                <span style={{ fontWeight: 600, color: nectarColors.ink }}>{trData(activeSlip.bankName)} (•••• {trData(activeSlip.accountLast4)})</span>
              </div>
              <div>
                <span style={{ color: nectarColors.muted, display: "block", fontSize: 11 }}>{tr("PAYMENT DATE & MODE")}</span>
                <span style={{ fontWeight: 600, color: nectarColors.ink }}>{activeSlip.paymentDate} · {trData(activeSlip.paymentMode)}</span>
              </div>
            </div>

            {/* Earnings & Deductions Breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              {/* Earnings Column */}
              <div style={sR10Border}>
                <div style={sText12SemiboldInkBgPad}>{tr("EARNINGS")}</div>
                <div style={{ padding: 12, fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: nectarColors.muted }}>{tr("Basic Pay")}</span>
                    <span style={{ fontWeight: 600 }}>{formatInrAmount(Math.round(activeSlip.amount * 0.62))}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: nectarColors.muted }}>{tr("House Rent Allowance (HRA)")}</span>
                    <span style={{ fontWeight: 600 }}>{formatInrAmount(Math.round(activeSlip.amount * 0.23))}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: nectarColors.muted }}>{tr("Special & Site Allowance")}</span>
                    <span style={{ fontWeight: 600 }}>
                      {formatInrAmount(
                        Math.round(
                          activeSlip.amount -
                            Math.round(activeSlip.amount * 0.62) -
                            Math.round(activeSlip.amount * 0.23) -
                            (activeSlip.remarks?.includes("OT") ? 2400 : 0),
                        ),
                      )}
                    </span>
                  </div>
                  {activeSlip.remarks?.includes("OT") && (
                    <div
                      style={{ display: "flex", justifyContent: "space-between", color: "#9A3412", fontWeight: 600 }}
                    >
                      <span>{tr("Overtime Incentive (OT)")}</span>
                      <span>
                        {formatInrAmount(
                          activeSlip.remarks.includes("2400")
                            ? 2400
                            : activeSlip.remarks.includes("1200")
                              ? 1200
                              : 1800,
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Deductions Column */}
              <div style={sR10Border}>
                <div style={sText12SemiboldInkBgPad}>{tr("STATUTORY DEDUCTIONS")}</div>
                <div style={{ padding: 12, fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: nectarColors.muted }}>{tr("Provident Fund (EPF)")}</span>
                    <span style={{ fontWeight: 600 }}>₹1,800</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: nectarColors.muted }}>{tr("Professional Tax (PT)")}</span>
                    <span style={{ fontWeight: 600 }}>₹200</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: nectarColors.muted }}>{tr("Income Tax / TDS")}</span>
                    <span style={{ fontWeight: 600 }}>₹0</span>
                  </div>
                  <div
                    style={{
                      borderTop: "1px dashed rgba(28, 68, 99, 0.12)", paddingTop: 6, display: "flex",
                      justifyContent: "space-between", color: nectarColors.muted,
                    }}
                  >
                    <span>{tr("Total Statutory Deductions")}</span>
                    <span style={{ fontWeight: 600, color: nectarColors.ink }}>₹2,000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Payout Banner */}
            <div
              style={{
                background: `linear-gradient(135deg, ${nectarColors.leaf} 0%, #0F2A3F 100%)`, borderRadius: 10,
                padding: "16px 20px", color: "#FFFFFF", display: "flex", justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: "rgba(255, 255, 255, 0.7)",
                  }}
                >
                  {tr("NET AMOUNT TRANSFERRED")}
                </span>
                <div
                  style={{
                    fontSize: 26, fontWeight: 700, fontFamily: "var(--font-fraunces), Georgia, serif", marginTop: 2,
                  }}
                >
                  {formatInrAmount(activeSlip.amount)}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
                    color: "#86EFAC",
                  }}
                >
                  <CheckCircleFilled />{" "}{tr("Direct Settlement Completed")}
                </span>
                <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.7)", marginTop: 2 }}>{tr("UTR Ref: {ref}", { ref: `UTR${activeSlip.paymentDate.replace(/-/g, "")}94821` })}</div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button
                icon={<PrinterOutlined />}
                onClick={() => window.print()}
                style={{ borderRadius: 8, fontWeight: 500 }}
              >
                {tr("Print Slip")}
              </Button>
              <Button
                type="primary"
                onClick={() => setActiveSlip(null)}
                style={{ borderRadius: 8, fontWeight: 500, background: nectarColors.leaf }}
              >
                {tr("Done")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Executive metric tile: eyebrow label + badge, large value, muted sub-line. */
function MetricCard({ label, badge, value, sub, valueStyle = sSerifText26BoldInk, subStyle }: {
  label: string;
  badge: React.ReactNode;
  value: React.ReactNode;
  sub: React.ReactNode;
  valueStyle?: React.CSSProperties;
  subStyle?: React.CSSProperties;
}) {
  return (
    <div style={colBetweenWhitePadR14BorderShadow2}>
      <div style={rowCenterBetween2}>
        <span style={sText11SemiboldUpperMuted}>{trData(label)}</span>
        {badge}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={valueStyle}>{value}</div>
        <div style={subStyle ?? { fontSize: 12, color: nectarColors.muted, marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
}
