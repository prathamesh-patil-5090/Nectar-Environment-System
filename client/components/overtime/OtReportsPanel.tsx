"use client";

import { useState } from "react";
import { App, Button, Card, Radio, Space, Typography } from "antd";
import {
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { getSession } from "@/lib/auth";
import { canDownloadReports } from "@/lib/rbac";
import {
  downloadOtReport,
  type OtFilters,
  type ReportFormat,
  type ReportKind,
} from "@/lib/overtime";
import { nectarColors } from "@/lib/theme";

const REPORTS: { kind: ReportKind; title: string; description: string }[] = [
  {
    kind: "employee",
    title: "Employee OT Report",
    description:
      "Employee-level OT rows with date, shift, hours, rate, cost, status, and reason.",
  },
  {
    kind: "site",
    title: "Site OT Report",
    description:
      "Site roll-up: OT employees, days, hours, cost, and average OT.",
  },
  {
    kind: "monthly",
    title: "Monthly OT Report",
    description:
      "Month-by-month OT volume, cost, and approval status counts.",
  },
  {
    kind: "yearly",
    title: "Yearly OT Report",
    description: "Month-by-month yearly OT hours and cost analysis.",
  },
  {
    kind: "management",
    title: "Management OT Analysis",
    description:
      "Executive summary with sites, top employees, reasons, and key observations.",
  },
];

export default function OtReportsPanel({ filters }: { filters: OtFilters }) {
  const { message } = App.useApp();
  const [format, setFormat] = useState<ReportFormat>("xlsx");
  const allowed = canDownloadReports(getSession());

  const onDownload = (kind: ReportKind) => {
    if (!allowed) {
      message.warning("Your role cannot download OT reports.");
      return;
    }
    downloadOtReport(kind, format, filters);
    message.success("Report download started.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
        Downloads use the same filters as Analysis above. Filenames include
        period and site when set.
      </p>

      <div
        style={{
          background: nectarColors.white,
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          borderRadius: 12,
          border: "1px solid rgba(28, 68, 99, 0.08)",
        }}
      >
        <Typography.Text strong>Format</Typography.Text>
        <Radio.Group
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          optionType="button"
          options={[
            {
              label: (
                <span>
                  <FileExcelOutlined /> Excel
                </span>
              ),
              value: "xlsx",
            },
            {
              label: (
                <span>
                  <FileTextOutlined /> CSV
                </span>
              ),
              value: "csv",
            },
            {
              label: (
                <span>
                  <FilePdfOutlined /> PDF
                </span>
              ),
              value: "pdf",
            },
          ]}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {REPORTS.map((r) => (
          <Card key={r.kind} size="small" title={r.title}>
            <p style={{ color: nectarColors.muted, minHeight: 48 }}>
              {r.description}
            </p>
            <Space>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                disabled={!allowed}
                onClick={() => onDownload(r.kind)}
              >
                Download report
              </Button>
            </Space>
          </Card>
        ))}
      </div>

      {!allowed ? (
        <p style={{ color: nectarColors.alert, margin: 0 }}>
          Site in-charge users can view OT for their site but cannot download
          management reports. Sign in as Manager or Admin to export.
        </p>
      ) : null}
    </div>
  );
}
