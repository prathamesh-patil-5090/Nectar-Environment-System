"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Input, Select, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  getAllEnrollments,
  getCertificates,
  getCertificateStatus,
  getPeople,
  getSiteName,
  getTrainingAssignments,
  useTrainingData,
} from "@/lib/training/store";
import { useViewer } from "@/lib/training/hooks";
import FlagTrainingNeedModal, { flaggableIds } from "./FlagTrainingNeedModal";
import { translatePersonName, useT, trData, trCell } from "@/lib/i18n";

type Row = {
  id: string;
  name: string;
  designation?: string;
  siteId?: string;
  site: string;
  assigned: number;
  overdue: number;
  flags: number;
  inProgress: number;
  certified: number;
  expiring: number;
};

const OPEN = ["open", "in_progress", "assigned"];

/** Whose progress the viewer can see. */
export function teamScope(viewer: ReturnType<typeof useViewer>, siteId?: string) {
  const people = getPeople();
  switch (viewer.role) {
    case "director":
    case "hr":
      return people;
    case "manager":
      return people.filter((p) => p.managerId === viewer.personId);
    case "supervisor":
      return people.filter((p) => p.supervisorId === viewer.personId);
    case "shift_incharge":
      return people.filter((p) => p.shiftInChargeId === viewer.personId);
    case "site_incharge":
      return people.filter((p) => siteId && p.siteId === siteId && p.id !== viewer.personId);
    default:
      return [];
  }
}

/** Allotted employees × assigned / overdue / in progress / certified, with Flag / assign. */
export default function TeamProgressTable() {
  const viewer = useViewer();
  const t = useT();
  const { ready, version } = useTrainingData();
  const [search, setSearch] = useState("");
  const [site, setSite] = useState<string>();
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [flagFor, setFlagFor] = useState<string[] | null>(null);
  const canFlag = flaggableIds(viewer);

  const rows: Row[] = useMemo(() => {
    void version;
    const today = new Date().toISOString().slice(0, 10);
    const assignments = getTrainingAssignments();
    const enrollments = getAllEnrollments();
    const certs = getCertificates();
    return teamScope(viewer, viewer.session?.siteId).map((p) => {
      const mine = assignments.filter((a) => a.employeeId === p.id && OPEN.includes(a.status));
      const mandatory = mine.filter((a) => a.kind !== "suggested");
      const myCerts = certs.filter((c) => c.employeeId === p.id);
      return {
        id: p.id,
        name: p.name,
        designation: p.designation,
        siteId: p.siteId,
        site: getSiteName(p.siteId) ?? "—",
        assigned: mandatory.length,
        overdue: mandatory.filter((a) => a.dueDate && a.dueDate.slice(0, 10) < today).length,
        flags: mine.filter((a) => a.kind === "suggested").length,
        inProgress: enrollments.filter((e) => e.employeeId === p.id && e.status !== "CERTIFIED").length,
        certified: myCerts.filter((c) => getCertificateStatus(c.expiresAt) !== "expired").length,
        expiring: myCerts.filter((c) => getCertificateStatus(c.expiresAt) === "expiring_soon").length,
      };
    });
  }, [version, viewer]);

  const sites = [...new Set(rows.map((r) => r.siteId).filter(Boolean))] as string[];
  const shown = rows.filter(
    (r) =>
      (!site || r.siteId === site) &&
      (!onlyOverdue || r.overdue > 0) &&
      (!search || `${r.name} ${r.designation ?? ""}`.toLowerCase().includes(search.toLowerCase())),
  );

  const columns: ColumnsType<Row> = [
    {
      title: t("common.employee"),
      key: "name",
      fixed: "left",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (_, r) => (
        <div>
          <Link href={`/employees/${r.id}`} style={{ fontWeight: 600 }}>
            {translatePersonName(r.name)}
          </Link>
          <div style={{ fontSize: 12, color: "#4A6375" }}>{trData(r.designation)}</div>
        </div>
      ),
    },
    { title: t("common.site"), dataIndex: "site", render: trCell, sorter: (a, b) => a.site.localeCompare(b.site) },
    { title: t("training.assigned"), dataIndex: "assigned", render: trCell, align: "center", sorter: (a, b) => a.assigned - b.assigned },
    {
      title: t("training.overdue"),
      dataIndex: "overdue",
      align: "center",
      defaultSortOrder: "descend",
      sorter: (a, b) => a.overdue - b.overdue,
      render: (n: number) => (n ? <Tag color="red">{n}</Tag> : 0),
    },
    {
      title: t("training.weakFlags"),
      dataIndex: "flags",
      align: "center",
      render: (n: number) => (n ? <Tag color="purple">{n}</Tag> : 0),
    },
    { title: t("training.inProgress"), dataIndex: "inProgress", render: trCell, align: "center" },
    {
      title: t("training.certified"),
      key: "certified",
      align: "center",
      render: (_, r) => (
        <span>
          {r.certified}
          {r.expiring ? (
            <Tag color="gold" style={{ marginLeft: 6 }}>
              {r.expiring} {t("training.expiring")}
            </Tag>
          ) : null}
        </span>
      ),
    },
    {
      title: "",
      key: "act",
      align: "right",
      render: (_, r) =>
        canFlag.has(r.id) ? (
          <Button size="small" onClick={() => setFlagFor([r.id])}>
            {t("training.flagAssign")}
          </Button>
        ) : null,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Space wrap>
        <Input.Search
          allowClear
          placeholder={t("training.searchPeople")}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 240 }}
        />
        {sites.length > 1 && (
          <Select
            allowClear
            placeholder={t("training.allSites")}
            value={site}
            onChange={setSite}
            style={{ width: 160 }}
            options={sites.map((s) => ({ value: s, label: getSiteName(s) ?? s }))}
          />
        )}
        <Button type={onlyOverdue ? "primary" : "default"} onClick={() => setOnlyOverdue((v) => !v)}>
          {t("training.overdueOnly")}
        </Button>
        {canFlag.size > 0 && (
          <Button type="primary" onClick={() => setFlagFor([])}>
            {t("training.flagAssignTraining")}
          </Button>
        )}
      </Space>
      <Table<Row>
        rowKey="id"
        size="middle"
        loading={!ready}
        columns={columns}
        dataSource={shown}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 15, hideOnSinglePage: true }}
        locale={{
          emptyText:
            viewer.role === "manager" ? t("training.noAllotted") : t("training.nobodyInTeam"),
        }}
      />
      <FlagTrainingNeedModal open={flagFor !== null} initialEmployeeIds={flagFor ?? []} onClose={() => setFlagFor(null)} />
    </div>
  );
}
