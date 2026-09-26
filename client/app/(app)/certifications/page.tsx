"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { App, Button, Switch, Table, Tag, Tooltip } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { getSession } from "@/lib/auth";
import {
  CERT_STATUS_LABELS,
  getAllCertificates,
  getCertificatesForEmployee,
  type Certificate,
  type CertificateStatus,
} from "@/lib/certificates";
import { scopedEmployeeId, scopedSiteId, selfEmployeeId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

const statusColor: Record<CertificateStatus, string> = {
  valid: "success",
  expiring_soon: "warning",
  expired: "error",
};

export default function CertificationsPage() {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const mineParam = searchParams?.get("mine") === "1";
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const empOnly = scopedEmployeeId(session);
  const selfId = selfEmployeeId(session);
  const isPersonal = Boolean(empOnly) || mineParam;
  const [mineOnly, setMineOnly] = useState(isPersonal);

  const rows = useMemo(() => {
    if (empOnly) return getCertificatesForEmployee(empOnly);
    if ((mineOnly || mineParam) && selfId) return getCertificatesForEmployee(selfId);
    return getAllCertificates(siteScope);
  }, [empOnly, mineOnly, mineParam, selfId, siteScope]);

  const columns: ColumnsType<Certificate> = [
    {
      title: "Certificate",
      dataIndex: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    ...(isPersonal
      ? []
      : [
          {
            title: "Employee",
            dataIndex: "employeeName",
            render: (name: string, r: Certificate) => (
              <Link
                href={`/employees/${r.employeeId}`}
                style={{ color: nectarColors.leaf, fontWeight: 600 }}
              >
                {name}
              </Link>
            ),
          } as ColumnsType<Certificate>[number],
        ]),
    { title: "Issuer", dataIndex: "issuer" },
    { title: "Certificate no.", dataIndex: "certificateNo" },
    { title: "Issued", dataIndex: "issuedOn" },
    {
      title: "Expires",
      dataIndex: "expiresOn",
      sorter: (a, b) => a.expiresOn.localeCompare(b.expiresOn),
    },
    {
      title: "Status",
      dataIndex: "status",
      filters: (Object.keys(CERT_STATUS_LABELS) as CertificateStatus[]).map(
        (k) => ({ text: CERT_STATUS_LABELS[k], value: k }),
      ),
      onFilter: (value, record) => record.status === value,
      render: (s: CertificateStatus) => (
        <Tag color={statusColor[s]}>{CERT_STATUS_LABELS[s]}</Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      render: (_, record: Certificate) => (
        <Tooltip title="View stored certificate document — Coming soon">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() =>
              message.info(
                `Digital document for "${record.name}" (${record.certificateNo}) is securely archived. Document viewer is coming soon!`
              )
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              borderColor: "rgba(28, 68, 99, 0.2)",
              color: nectarColors.leaf,
            }}
          >
            View
            <Tag
              color="default"
              style={{
                fontSize: 10,
                padding: "0 4px",
                lineHeight: "16px",
                margin: 0,
                border: "none",
                background: "rgba(28, 68, 99, 0.08)",
                color: nectarColors.muted,
                fontWeight: 600,
              }}
            >
              Soon
            </Tag>
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
          {isPersonal
            ? "Your safety and process certificates — validity and expiry."
            : "Plant / organization certificate register for compliance tracking."}
        </p>
        {!isPersonal && selfId ? (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: nectarColors.muted,
            }}
          >
            <Switch checked={mineOnly} onChange={setMineOnly} size="small" />
            My certificates only
          </label>
        ) : null}
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 900 }}
        style={{ background: nectarColors.white }}
      />
    </div>
  );
}
