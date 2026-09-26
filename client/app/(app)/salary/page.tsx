"use client";

import { useMemo } from "react";
import { Empty, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { getSession } from "@/lib/auth";
import {
  formatInrAmount,
  getSalaryHistory,
  salaryMonthLabel,
  type SalaryPayment,
} from "@/lib/salary";
import { scopedEmployeeId, selfEmployeeId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { getEmployeeById } from "@/lib/mock-data";

export default function SalaryPage() {
  const session = getSession();
  const empId = scopedEmployeeId(session) ?? selfEmployeeId(session);
  const employee = empId ? getEmployeeById(empId) : undefined;

  const rows = useMemo(
    () => (empId ? getSalaryHistory(empId) : []),
    [empId],
  );

  if (!empId || !employee) {
    return (
      <Empty description="Salary history is available on accounts linked to an employee profile. Open My Employee → Salary, or sign in as an employee." />
    );
  }

  const latest = rows[0];

  const columns: ColumnsType<SalaryPayment> = [
    {
      title: "Salary month",
      dataIndex: "salaryMonth",
      render: (m) => salaryMonthLabel(m),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      render: (a) => (
        <span style={{ fontWeight: 600 }}>{formatInrAmount(a)}</span>
      ),
    },
    {
      title: "Payment date",
      dataIndex: "paymentDate",
    },
    {
      title: "Payment time",
      dataIndex: "paymentTime",
    },
    {
      title: "Bank / account",
      key: "bank",
      render: (_, r) => `${r.bankName} · ****${r.accountLast4}`,
    },
    {
      title: "Mode",
      dataIndex: "paymentMode",
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s: SalaryPayment["status"]) => (
        <Tag
          color={
            s === "paid" ? "success" : s === "pending" ? "warning" : "error"
          }
        >
          {s}
        </Tag>
      ),
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      render: (r) => r ?? "—",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
        Salary and payment records for <strong>{employee.name}</strong>
        {latest ? (
          <>
            {" "}
            · Latest: {salaryMonthLabel(latest.salaryMonth)}{" "}
            {formatInrAmount(latest.amount)}
          </>
        ) : null}
      </p>

      <div
        style={{
          background: nectarColors.white,
          padding: 20,
          borderRadius: 10,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: nectarColors.muted }}>
            Latest month
          </div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {latest ? salaryMonthLabel(latest.salaryMonth) : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: nectarColors.muted }}>Amount</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {latest ? formatInrAmount(latest.amount) : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: nectarColors.muted }}>
            Paid on
          </div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {latest
              ? `${latest.paymentDate} · ${latest.paymentTime}`
              : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: nectarColors.muted }}>
            Bank / mode
          </div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {latest
              ? `${latest.bankName} · ${latest.paymentMode}`
              : "—"}
          </div>
        </div>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 1000 }}
        style={{ background: nectarColors.white }}
      />
    </div>
  );
}
