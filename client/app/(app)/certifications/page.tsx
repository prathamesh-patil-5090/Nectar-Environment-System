"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Switch, Table, Tag, Tooltip } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { getSession } from "@/lib/auth";
import {
  CERT_STATUS_LABELS,
  getAllCertificates,
  getCertificatesForEmployee,
  syncTrainingWithApi,
  type CertificateStatus,
  type ViewCertificateItem,
} from "@/lib/training/store";
import type { Certificate } from "@/lib/training/types";
import CertificateModal from "@/components/training/CertificateModal";
import { scopedEmployeeId, scopedSiteId, selfEmployeeId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { rowCenterBetweenWrapGap12 } from "@/lib/styles";
import { tr, trCell, trData } from "@/lib/i18n";

const statusColor: Record<CertificateStatus, string> = { valid: "success", expiring_soon: "warning", expired: "error" };

export default function CertificationsPage() {
  const searchParams = useSearchParams();
  const mineParam = searchParams?.get("mine") === "1";
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const empOnly = scopedEmployeeId(session);
  const selfId = selfEmployeeId(session);
  const isPersonal = Boolean(empOnly) || mineParam;
  const [mineOnly, setMineOnly] = useState(isPersonal);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [tick, setTick] = useState(0);

  // Live refresh from MongoDB Atlas on page load
  useEffect(() => {
    syncTrainingWithApi()
      .then(() => setTick((t) => t + 1))
      .catch(() => {});
  }, []);

  const rows = useMemo(() => {
    if (empOnly) return getCertificatesForEmployee(empOnly);
    if ((mineOnly || mineParam) && selfId) return getCertificatesForEmployee(selfId);
    return getAllCertificates(siteScope);
  }, [empOnly, mineOnly, mineParam, selfId, siteScope, tick]);

  const columns: ColumnsType<ViewCertificateItem> = [
    { title: tr("Certificate"), dataIndex: "name", render: trCell, sorter: (a, b) => a.name.localeCompare(b.name) },
    ...(isPersonal
      ? []
      : [
          {
            title: tr("Employee"),
            dataIndex: "employeeName",
            render: (name: string, r: ViewCertificateItem) => (
              <Link href={`/employees/${r.employeeId}`} style={{ color: nectarColors.leaf, fontWeight: 600 }}>{trData(name)}</Link>
            ),
          } as ColumnsType<ViewCertificateItem>[number],
        ]),
    { title: tr("Issuer"), dataIndex: "issuer", render: trCell },
    { title: tr("Certificate no."), dataIndex: "certificateNo" },
    { title: tr("Issued"), dataIndex: "issuedOn", render: trCell },
    { title: tr("Expires"), dataIndex: "expiresOn", render: trCell, sorter: (a, b) => a.expiresOn.localeCompare(b.expiresOn) },
    {
      title: tr("Rule"),
      key: "validityRule",
      render: () => (
        <Tag color="cyan" style={{ fontWeight: 600, fontSize: 11, borderRadius: 4 }}>{tr("1-Year Validity")}</Tag>
      ),
    },
    {
      title: tr("Status"),
      dataIndex: "status",
      filters: (Object.keys(CERT_STATUS_LABELS) as CertificateStatus[]).map(
        (k) => ({ text: tr(CERT_STATUS_LABELS[k]), value: k }),
      ),
      onFilter: (value, record) => record.status === value,
      render: (s: CertificateStatus) => (
        <Tag color={statusColor[s]}>{tr(CERT_STATUS_LABELS[s])}</Tag>
      ),
    },
    {
      title: tr("Action"),
      key: "action",
      width: 110,
      render: (_, record: ViewCertificateItem) => (
        <Tooltip title={tr("View authentic digital certificate with 1-year validity verification")}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedCert(record.raw)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, borderColor: "rgba(28, 68, 99, 0.2)",
              color: nectarColors.leaf, fontWeight: 600,
            }}
          >
            {tr("View")}
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={rowCenterBetweenWrapGap12}>
        <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
          {isPersonal
            ? tr("Your safety and process certificates — 1-year validity tracking and authorized manager signatories.")
            : tr("Plant / organization certificate register for compliance tracking.")}
        </p>
        {!isPersonal && selfId ? (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: nectarColors.muted }}>
            <Switch checked={mineOnly} onChange={setMineOnly} size="small" />
            {tr("My certificates only")}
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

      <CertificateModal certificate={selectedCert} onClose={() => setSelectedCert(null)} />
    </div>
  );
}
