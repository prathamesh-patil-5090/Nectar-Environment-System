"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert, Segmented, Table, Tooltip, theme } from "antd";
import type { ColumnsType } from "antd/es/table";
import { getSession } from "@/lib/auth";
import { canViewPlantPipeline, scopedSiteId } from "@/lib/rbac";
import { getAllSites, getSites } from "@/lib/api/sites";
import type { PlantType, Site, SiteStatus } from "@/lib/types/site.types";
import {
  getSitesWithComputedReadiness,
  READINESS_READY_THRESHOLD,
  type SiteReadinessBreakdown,
} from "@/lib/workforce-metrics";
import { safetyKpis } from "@/lib/safety/kpis";
import { useSafetyEvents } from "@/lib/safety/hooks";
import { useTableMotion } from "@/lib/motion/use-table-motion";

const PLANT_TYPES: PlantType[] = ["ETP", "STP", "WTP", "RO", "MEE"];
const STATUS_ORDER: SiteStatus[] = ["operational", "new", "upcoming", "closed"];
const STATUS_LABEL: Record<SiteStatus, string> = {
  operational: "Operational",
  new: "New",
  upcoming: "Upcoming",
  closed: "Closed",
};

type Row = {
  id: string;
  name: string;
  location: string;
  /** A plant can run several treatment processes (e.g. ETP + RO + MEE). */
  plantTypes: PlantType[];
  status: SiteStatus;
  headcount: number;
  readiness: number;
  /** Absent for new / upcoming / closed plants — they are not running, so nothing to score. */
  readinessBreakdown?: SiteReadinessBreakdown;
};

const isOperational = (row: Row) => row.status === "operational";

export default function SitesPage() {
  const { token } = theme.useToken();
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const showPipeline = canViewPlantPipeline(session);
  const computed = useMemo(
    () => new Map(getSitesWithComputedReadiness(siteScope).map((s) => [s.id, s])),
    [siteScope],
  );
  const { events: safetyEvents } = useSafetyEvents();

  // Plant names, locations and types come from the DB. New, upcoming and closed plants are Director only.
  const [sites, setSites] = useState<Site[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SiteStatus | "all">("all");
  useEffect(() => {
    (showPipeline ? getAllSites() : getSites())
      .then(setSites)
      .catch((err: Error) => setError(err.message));
  }, [showPipeline]);

  const rows = useMemo<Row[]>(
    () =>
      (sites ?? [])
        .filter((s) => !siteScope || s.id === siteScope)
        .map((s) => {
          const status = s.status ?? "operational";
          const metrics = status === "operational" ? computed.get(s.id) : undefined;
          return {
            id: s.id,
            name: s.name,
            location: s.location,
            plantTypes: s.plantTypes?.length ? s.plantTypes : s.plantType ? [s.plantType] : [],
            status,
            headcount: metrics?.headcount ?? s.headcount ?? 0,
            readiness: metrics?.readiness ?? 0,
            readinessBreakdown: metrics?.readinessBreakdown,
          };
        })
        .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)),
    [sites, siteScope, computed],
  );

  const counts = useMemo(() => {
    const c = { all: rows.length } as Record<SiteStatus | "all", number>;
    for (const s of STATUS_ORDER) c[s] = rows.filter((r) => r.status === s).length;
    return c;
  }, [rows]);

  const data = statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);

  // Header + table settle in once; rows stagger and readiness bars fill whenever the rows change.
  const { pageRef, tableRef } = useTableMotion(sites ? data.map((r) => r.id).join("|") : "");

  const statusColor: Record<SiteStatus, string> = {
    operational: token.colorSuccess,
    new: token.colorPrimary,
    upcoming: token.colorWarning,
    closed: token.colorTextQuaternary,
  };

  const muted = { color: token.colorTextSecondary };
  const empty = <span style={{ color: token.colorTextQuaternary }}>—</span>;

  const columns: ColumnsType<Row> = [
    {
      title: "Site",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, row) => (
        <div style={{ lineHeight: 1.35 }}>
          <div style={{ fontWeight: 500, color: token.colorText }}>{name}</div>
          <div style={{ fontSize: 13, ...muted }}>{row.location}</div>
        </div>
      ),
    },
    {
      title: "Plant types",
      dataIndex: "plantTypes",
      key: "plantTypes",
      filters: PLANT_TYPES.map((t) => ({ text: t, value: t })),
      onFilter: (value, record) => record.plantTypes.includes(value as PlantType),
      render: (types: PlantType[]) =>
        types.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {types.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 12,
                  lineHeight: "20px",
                  padding: "0 7px",
                  borderRadius: 4,
                  border: `1px solid ${token.colorBorder}`,
                  color: token.colorText,
                  background: token.colorBgContainer,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        ) : (
          empty
        ),
    },
    ...(showPipeline
      ? [
          {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (status: SiteStatus) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                <span
                  aria-hidden
                  style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor[status] }}
                />
                {STATUS_LABEL[status]}
              </span>
            ),
          } satisfies ColumnsType<Row>[number],
        ]
      : []),
    {
      title: "Headcount",
      dataIndex: "headcount",
      key: "headcount",
      align: "right",
      width: 120,
      sorter: (a, b) => a.headcount - b.headcount,
      // Closed plants keep the headcount they had; new / upcoming plants have no staff yet.
      render: (headcount: number, row) =>
        isOperational(row) || headcount > 0 ? (
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{headcount}</span>
        ) : (
          empty
        ),
    },
    {
      title: "Readiness",
      dataIndex: "readiness",
      key: "readiness",
      width: 220,
      sorter: (a, b) => a.readiness - b.readiness,
      render: (readiness: number, row) => {
        const b = row.readinessBreakdown;
        if (!b) return empty;
        const color =
          readiness < 70 ? token.colorError : readiness < READINESS_READY_THRESHOLD ? token.colorWarning : token.colorPrimary;
        return (
          <Tooltip
            title={
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                <div>Staffing {b.staffingPct}% ({b.activeStaff}/{b.requiredStaff})</div>
                <div>Training {b.trainingPct}%</div>
                <div>Skills {b.skillPct}%</div>
                <div>Cover {b.coveragePct}% · {b.openAbsences} open absences</div>
              </div>
            }
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: token.colorFillSecondary }}>
                <div
                  data-anim="bar"
                  style={{ width: `${readiness}%`, height: "100%", borderRadius: 2, background: color }}
                />
              </div>
              <span style={{ width: 36, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{readiness}%</span>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: "Safety",
      key: "safety",
      render: (_, row) => {
        if (!isOperational(row)) return empty;
        const k = safetyKpis(safetyEvents, row.id);
        const lti = k.daysSinceLti === null ? "No LTI" : `${k.daysSinceLti} d since LTI`;
        return (
          <Link href="/safety/incidents" style={{ display: "block", lineHeight: 1.35, color: token.colorText }}>
            <div
              style={{
                color: k.openCritical || k.activeBreakdowns ? token.colorError : k.open ? token.colorWarning : token.colorText,
              }}
            >
              {k.open ? `${k.open} open ${k.open === 1 ? "case" : "cases"}` : "No open cases"}
              {k.activeBreakdowns ? " · Breakdown" : ""}
            </div>
            <div style={{ fontSize: 13, ...muted }}>{lti}</div>
          </Link>
        );
      },
    },
  ];

  return (
    <div ref={pageRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        data-anim="intro"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <p style={{ margin: 0, fontSize: 14, maxWidth: 720, ...muted }}>
          Treatment plants under O&amp;M (Operations &amp; Maintenance). Readiness is computed from staffing,
          training, skills and open absences.
        </p>
        {showPipeline ? (
          <Segmented<SiteStatus | "all">
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: `All ${counts.all}` },
              ...STATUS_ORDER.filter((s) => counts[s]).map((s) => ({
                value: s,
                label: `${STATUS_LABEL[s]} ${counts[s]}`,
              })),
            ]}
          />
        ) : null}
      </div>

      {error ? <Alert type="error" showIcon message="Could not load sites" description={error} /> : null}

      <div
        ref={tableRef}
        data-anim="intro"
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          overflow: "hidden",
          background: token.colorBgContainer,
        }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={!sites && !error}
          pagination={false}
          scroll={{ x: 900 }}
          onRow={(row) => ({ style: row.status === "closed" ? { opacity: 0.6 } : undefined })}
        />
      </div>
    </div>
  );
}
