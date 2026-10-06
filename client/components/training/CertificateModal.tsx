"use client";

// i18n-ignore-file: the certificate is an official document and always stays in English.
import React from "react";
import { Modal, Button, Tag, Divider } from "antd";
import {
  PrinterOutlined,
  CheckCircleFilled,
  SafetyCertificateOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type { Certificate } from "@/lib/training/types";
import { nectarColors } from "@/lib/theme";

interface CertificateModalProps {
  certificate: Certificate | null;
  onClose: () => void;
}

export default function CertificateModal({
  certificate,
  onClose,
}: CertificateModalProps) {
  if (!certificate) return null;

  const formattedDate = new Date(certificate.issuedAt).toLocaleDateString(
    "en-IN",
    { day: "2-digit", month: "long", year: "numeric" },
  );

  return (
    <Modal open={Boolean(certificate)} onCancel={onClose} footer={null} width={760} centered styles={{ body: { padding: 0 } }}>
      <div
        id="printable-certificate"
        style={{
          background: "#FFFFFF", padding: "40px 44px", borderRadius: 8, position: "relative",
          border: `8px double ${nectarColors.leaf}`, boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          fontFamily: "var(--font-dm-sans), sans-serif",
        }}
      >
        {/* Subtle Watermark Background */}
        <div
          style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", opacity: 0.03,
            fontSize: 320, color: nectarColors.leaf, pointerEvents: "none", userSelect: "none",
          }}
        >
          <SafetyCertificateOutlined />
        </div>

        {/* Certificate Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700,
              color: nectarColors.leaf,
            }}
          >
            NECTAR ENVIRONMENT-SYSTEMS · TECHNICAL CERTIFICATION BOARD
          </div>
          <h1
            style={{
              margin: "12px 0 4px", fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 28,
              color: nectarColors.ink, fontWeight: 600,
            }}
          >
            Certificate of Competency
          </h1>
          <div style={{ fontSize: 13, color: nectarColors.muted }}>Four-Tier Competency Evaluation Framework · ISO 9001 / OHSAS Compliant</div>
        </div>

        {/* Recipient Details */}
        <div style={{ textAlign: "center", margin: "28px 0" }}>
          <div style={{ fontSize: 13, color: nectarColors.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>THIS IS TO CERTIFY THAT</div>
          <div
            style={{
              fontSize: 26, fontWeight: 700, fontFamily: "var(--font-fraunces), Georgia, serif",
              color: nectarColors.leaf, marginTop: 6, borderBottom: "1px solid rgba(28, 68, 99, 0.2)",
              display: "inline-block", paddingBottom: 4, minWidth: 320,
            }}
          >
            {certificate.employeeName}
          </div>
          <div style={{ fontSize: 13, color: nectarColors.muted, marginTop: 8 }}>Employee ID: <strong style={{ color: nectarColors.ink }}>{certificate.employeeId}</strong></div>
        </div>

        {/* Course Description */}
        <div style={{ textAlign: "center", maxWidth: 580, margin: "0 auto 28px", fontSize: 14, color: nectarColors.ink, lineHeight: 1.6 }}>
          Has satisfactorily undergone the formal syllabus, demonstrated operational mastery in plant units, and passed all four tiers of rigorous objective and field evaluation for:
          <div
            style={{
              fontSize: 18, fontWeight: 700, color: nectarColors.ink, marginTop: 8,
              fontFamily: "var(--font-fraunces), Georgia, serif",
            }}
          >
            {certificate.courseTitle}
          </div>
        </div>

        {/* 4-Tier Evaluation Score Matrix */}
        <div
          style={{
            background: nectarColors.sand, border: "1px solid rgba(28, 68, 99, 0.1)", borderRadius: 10,
            padding: "16px 20px", margin: "24px 0",
          }}
        >
          <div
            style={{
              fontSize: 11, fontWeight: 700, color: nectarColors.muted, textTransform: "uppercase",
              letterSpacing: "0.08em", marginBottom: 10, textAlign: "center",
            }}
          >
            Verified 4-Tier Assessment Breakdown
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, textAlign: "center" }}>
            <div style={{ background: "#FFFFFF", padding: "10px 6px", borderRadius: 8, border: "1px solid rgba(28, 68, 99, 0.08)" }}>
              <div style={{ fontSize: 11, color: nectarColors.muted, fontWeight: 600 }}>1. Skill Map (25%)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: nectarColors.leaf, marginTop: 2 }}>{certificate.skillMapPct}%</div>
            </div>
            <div style={{ background: "#FFFFFF", padding: "10px 6px", borderRadius: 8, border: "1px solid rgba(28, 68, 99, 0.08)" }}>
              <div style={{ fontSize: 11, color: nectarColors.muted, fontWeight: 600 }}>2. Written (25%)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: nectarColors.leaf, marginTop: 2 }}>{certificate.writtenPct}%</div>
            </div>
            <div style={{ background: "#FFFFFF", padding: "10px 6px", borderRadius: 8, border: "1px solid rgba(28, 68, 99, 0.08)" }}>
              <div style={{ fontSize: 11, color: nectarColors.muted, fontWeight: 600 }}>3. Practical (30%)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: nectarColors.leaf, marginTop: 2 }}>{certificate.practicalPct}%</div>
            </div>
            <div style={{ background: "#FFFFFF", padding: "10px 6px", borderRadius: 8, border: "1px solid rgba(28, 68, 99, 0.08)" }}>
              <div style={{ fontSize: 11, color: nectarColors.muted, fontWeight: 600 }}>4. Oral Viva (20%)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: nectarColors.leaf, marginTop: 2 }}>{certificate.oralPct}%</div>
            </div>
          </div>
          <div
            style={{
              marginTop: 12, paddingTop: 10, borderTop: "1px dashed rgba(28, 68, 99, 0.15)", display: "flex",
              justifyContent: "space-between", alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12, color: nectarColors.muted }}>Weighted Overall Evaluation Score:</span>
            <span
              style={{
                fontSize: 16, fontWeight: 700, color: nectarColors.leaf,
                fontFamily: "var(--font-fraunces), Georgia, serif",
              }}
            >
              {certificate.overallPct}% · DISTINCTION PASSED
            </span>
          </div>
        </div>

        {/* Footer & Signatures */}
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 36, paddingTop: 16,
            borderTop: "1px solid rgba(28, 68, 99, 0.12)",
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: nectarColors.muted }}>CERTIFICATE NUMBER</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: nectarColors.ink, fontFamily: "monospace" }}>{certificate.certificateNo}</div>
            <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 4 }}>Issued On: {formattedDate}</div>
            <div
              style={{
                fontSize: 11,
                color: (() => {
                  const expTime = certificate.expiresAt
                    ? new Date(certificate.expiresAt).getTime()
                    : new Date(certificate.issuedAt).getTime() + 365 * 86400000;
                  return new Date().getTime() > expTime ? "#DC2626" : nectarColors.leaf;
                })(),
                marginTop: 2,
                fontWeight: 600,
              }}
            >
              Validity: 1 Year (Expires: {(() => {
                const exp = certificate.expiresAt
                  ? new Date(certificate.expiresAt)
                  : new Date(new Date(certificate.issuedAt).setFullYear(new Date(certificate.issuedAt).getFullYear() + 1));
                return exp.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
              })()})
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 52, height: 52, borderRadius: "50%", background: "rgba(22, 163, 74, 0.1)", color: "#166534",
                display: "grid", placeItems: "center", margin: "0 auto 6px", border: "2px solid #86EFAC", fontSize: 22,
              }}
            >
              <CheckCircleFilled />
            </div>
            <span style={{ fontSize: 10, color: "#166534", fontWeight: 700, letterSpacing: "0.08em" }}>SEAL VERIFIED</span>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "cursive", fontSize: 18, color: nectarColors.leaf, marginBottom: 2 }}>
              {certificate.managerSignatory
                ? certificate.managerSignatory.split(" (")[0]
                : "Authorized Manager"}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: nectarColors.ink }}>{certificate.managerSignatory}</div>
            <div style={{ fontSize: 11, color: nectarColors.muted }}>Operations & Technical Assessment Division</div>
          </div>
        </div>

        {/* Hash pill */}
        <div
          style={{
            marginTop: 20, textAlign: "center", fontSize: 10, fontFamily: "monospace", color: nectarColors.muted,
          }}
        >
          Cryptographic Hash: {certificate.verificationHash} · Verified by NEIPL LMS
        </div>
      </div>

      {/* Action Bar */}
      <div
        style={{
          padding: "16px 24px", background: nectarColors.sand, display: "flex", justifyContent: "flex-end", gap: 12,
          borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
        }}
      >
        <Button icon={<PrinterOutlined />} onClick={() => window.print()} style={{ borderRadius: 8, fontWeight: 500 }}>Print Certificate</Button>
        <Button
          type="primary"
          onClick={onClose}
          style={{ borderRadius: 8, fontWeight: 500, background: nectarColors.leaf }}
        >
          Close
        </Button>
      </div>
    </Modal>
  );
}
