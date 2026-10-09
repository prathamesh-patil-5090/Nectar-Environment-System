"use client";

import Link from "next/link";
import { Button, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DownloadOutlined } from "@ant-design/icons";
import OtFiltersBar from "@/components/overtime/OtFiltersBar";
import { useOtFilters } from "@/components/overtime/OtFilterContext";
import {
  downloadOtReport,
  formatHours,
  formatInr,
  getSiteOtRows,
  type SiteOtRow,
} from "@/lib/overtime";
import { getSession } from "@/lib/auth";
import { canDownloadReports } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { tr, trCell, trData } from "@/lib/i18n";

export default function OtSitesPage() {
  const { filters, setFilters, lockedSiteId } = useOtFilters();
  const rows = getSiteOtRows(filters);

  const columns: ColumnsType<SiteOtRow> = [
    {
      title: tr("Site"),
      dataIndex: "siteName",
      render: (name, record) => (
        <Link href={`/overtime/sites/${record.siteId}`} style={{ color: nectarColors.leaf, fontWeight: 600 }}>{trData(name)}</Link>
      ),
    },
    {
      title: tr("OT Employees"),
      dataIndex: "otEmployees", render: trCell,
      sorter: (a, b) => a.otEmployees - b.otEmployees,
      defaultSortOrder: "descend",
    },
    { title: tr("OT Days"), dataIndex: "otDays", render: trCell, sorter: (a, b) => a.otDays - b.otDays },
    { title: tr("OT Hours"), dataIndex: "otHours", sorter: (a, b) => a.otHours - b.otHours, render: (v) => formatHours(v) },
    { title: tr("OT Cost"), dataIndex: "otCost", sorter: (a, b) => a.otCost - b.otCost, render: (v) => formatInr(v) },
    {
      title: tr("Avg OT/Employee"),
      dataIndex: "avgOtPerEmployee",
      sorter: (a, b) => a.avgOtPerEmployee - b.avgOtPerEmployee,
      render: (v) => formatHours(v),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <OtFiltersBar value={filters} onChange={setFilters} lockedSiteId={lockedSiteId} />
      {canDownloadReports(getSession()) ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}><Button icon={<DownloadOutlined />} onClick={() => downloadOtReport("site", "xlsx", filters)}>{tr("Export")}</Button></div>
      ) : null}
      <Table
        rowKey="siteId"
        columns={columns}
        dataSource={rows}
        pagination={false}
        style={{ background: nectarColors.white }}
      />
    </div>
  );
}
