"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Input, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DownloadOutlined } from "@ant-design/icons";
import OtFiltersBar from "@/components/overtime/OtFiltersBar";
import { useOtFilters } from "@/components/overtime/OtFilterContext";
import {
  downloadOtReport,
  formatHours,
  formatInr,
  getEmployeeOtRows,
  OT_STATUS_LABELS,
  type EmployeeOtRow,
} from "@/lib/overtime";
import { getSession } from "@/lib/auth";
import { canDownloadReports } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { rowBetweenWrapGap12 } from "@/lib/styles";

export default function OtEmployeesPage() {
  const { filters, setFilters, lockedSiteId } = useOtFilters();
  const [search, setSearch] = useState("");
  const rows = useMemo(() => getEmployeeOtRows(filters), [filters]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.employeeName.toLowerCase().includes(q) ||
        r.employeeId.toLowerCase().includes(q) ||
        r.siteName.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const columns: ColumnsType<EmployeeOtRow> = [
    { title: "Employee ID", dataIndex: "employeeId", sorter: (a, b) => a.employeeId.localeCompare(b.employeeId) },
    {
      title: "Employee Name",
      dataIndex: "employeeName",
      sorter: (a, b) => a.employeeName.localeCompare(b.employeeName),
      render: (name, record) => (
        <Link href={`/overtime/employees/${record.employeeId}`} style={{ color: nectarColors.leaf, fontWeight: 600 }}>{name}</Link>
      ),
    },
    { title: "Site", dataIndex: "siteName" },
    {
      title: "Department",
      dataIndex: "department",
      filters: [...new Set(rows.map((r) => r.department))].map((d) => ({ text: d, value: d })),
      onFilter: (value, record) => record.department === value,
    },
    { title: "OT Days", dataIndex: "otDays", sorter: (a, b) => a.otDays - b.otDays },
    { title: "OT Hours", dataIndex: "otHours", sorter: (a, b) => a.otHours - b.otHours, render: (v) => formatHours(v) },
    { title: "OT Cost", dataIndex: "otCost", sorter: (a, b) => a.otCost - b.otCost, render: (v) => formatInr(v) },
    { title: "Avg OT/Day", dataIndex: "avgOtPerDay", sorter: (a, b) => a.avgOtPerDay - b.avgOtPerDay },
    { title: "Last OT Date", dataIndex: "lastOtDate", sorter: (a, b) => a.lastOtDate.localeCompare(b.lastOtDate) },
    {
      title: "OT Status",
      dataIndex: "otStatus",
      render: (status: EmployeeOtRow["otStatus"]) =>
        status === "MIXED" ? (
          <Tag>Mixed</Tag>
        ) : (
          <Tag>{OT_STATUS_LABELS[status]}</Tag>
        ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <OtFiltersBar value={filters} onChange={setFilters} lockedSiteId={lockedSiteId} />
      <div style={rowBetweenWrapGap12}>
        <Input.Search
          allowClear
          placeholder="Search employee, site, department"
          style={{ maxWidth: 320 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canDownloadReports(getSession()) ? (
          <Button icon={<DownloadOutlined />} onClick={() => downloadOtReport("employee", "xlsx", filters)}>Export</Button>
        ) : null}
      </div>
      <Table
        rowKey="employeeId"
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1100 }}
        style={{ background: nectarColors.white }}
      />
    </div>
  );
}
