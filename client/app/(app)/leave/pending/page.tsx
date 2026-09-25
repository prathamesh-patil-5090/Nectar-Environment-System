"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button, Empty, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { getSession } from "@/lib/auth";
import { getSiteName } from "@/lib/mock-data";
import {
  getPendingJustifications,
  LEAVE_STATUS_LABELS,
  type LeaveRequest,
} from "@/lib/leave";
import { canViewLeavePending } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

export default function LeavePendingPage() {
  const router = useRouter();
  const session = getSession();
  const allowed = canViewLeavePending(session);

  useEffect(() => {
    if (!allowed) router.replace("/leave");
  }, [allowed, router]);

  if (!allowed) {
    return <Empty description="Not available for your role" />;
  }

  const rows = getPendingJustifications();

  const columns: ColumnsType<LeaveRequest> = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      render: (n, r) => (
        <Link href={`/leave/requests/${r.id}`} style={{ fontWeight: 600 }}>
          {n}
        </Link>
      ),
    },
    {
      title: "Site",
      dataIndex: "siteId",
      render: (id) => getSiteName(id),
    },
    {
      title: "Absent since",
      dataIndex: "startDate",
    },
    {
      title: "Days",
      dataIndex: "daysRequested",
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s: LeaveRequest["status"]) => (
        <Tag color={nectarColors.alert}>{LEAVE_STATUS_LABELS[s]}</Tag>
      ),
    },
    {
      title: "Supervisor",
      dataIndex: "supervisorName",
    },
    {
      title: "Site In-Charge",
      dataIndex: "siteInChargeName",
    },
    {
      title: "Last communication",
      dataIndex: "lastCommunication",
      render: (v) => v ?? "—",
    },
    {
      title: "",
      key: "follow",
      render: (_, r) => (
        <Link href={`/leave/requests/${r.id}`}>
          <Button size="small" type="primary">
            Follow up
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
            color: nectarColors.ink,
          }}
        >
          Pending employee justifications
        </div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>
          HR visibility into absences that were verbal, incomplete, overdue to
          close, or unexplained — with supervisor and site contacts for follow-up.
        </p>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1100 }}
        style={{ background: nectarColors.white }}
      />
    </div>
  );
}
