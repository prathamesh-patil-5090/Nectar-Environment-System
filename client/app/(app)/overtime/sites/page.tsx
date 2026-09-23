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
import { nectarColors } from "@/lib/theme";

export default function OtSitesPage() {
  const { filters, setFilters, lockedSiteId } = useOtFilters();
  const rows = getSiteOtRows(filters);

  const columns: ColumnsType<SiteOtRow> = [
    {
      title: "Site",
      dataIndex: "siteName",
      render: (name, record) => (
        <Link
          href={`/overtime/sites/${record.siteId}`}
          style={{ color: nectarColors.leaf, fontWeight: 600 }}
        >
          {name}
        </Link>
      ),
    },
    {
      title: "OT Employees",
      dataIndex: "otEmployees",
      sorter: (a, b) => a.otEmployees - b.otEmployees,
      defaultSortOrder: "descend",
    },
    {
      title: "OT Days",
      dataIndex: "otDays",
      sorter: (a, b) => a.otDays - b.otDays,
    },
    {
      title: "OT Hours",
      dataIndex: "otHours",
      sorter: (a, b) => a.otHours - b.otHours,
      render: (v) => formatHours(v),
    },
    {
      title: "OT Cost",
      dataIndex: "otCost",
      sorter: (a, b) => a.otCost - b.otCost,
      render: (v) => formatInr(v),
    },
    {
      title: "Avg OT/Employee",
      dataIndex: "avgOtPerEmployee",
      sorter: (a, b) => a.avgOtPerEmployee - b.avgOtPerEmployee,
      render: (v) => formatHours(v),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <OtFiltersBar
        value={filters}
        onChange={setFilters}
        lockedSiteId={lockedSiteId}
      />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => downloadOtReport("site", "xlsx", filters)}
        >
          Export
        </Button>
      </div>
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
