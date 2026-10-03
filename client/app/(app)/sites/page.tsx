"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Progress, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { getSession } from "@/lib/auth";
import { type Site } from "@/lib/mock-data";
import { scopedSiteId } from "@/lib/rbac";
import {
  getSitesWithComputedReadiness,
  type SiteReadinessBreakdown,
} from "@/lib/workforce-metrics";
import { nectarColors } from "@/lib/theme";
import { safetyKpis } from "@/lib/safety/kpis";
import { useSafetyEvents } from "@/lib/safety/hooks";

const plantColor: Record<Site["plantType"], string> = {
  ETP: nectarColors.leaf,
  STP: nectarColors.sky,
  WTP: nectarColors.mint,
  RO: "#0E7490",
  MEE: "#7C3AED",
};

type Row = Site & {
  readiness: number;
  readinessBreakdown: SiteReadinessBreakdown;
};

export default function SitesPage() {
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const data = useMemo(
    () => getSitesWithComputedReadiness(siteScope),
    [siteScope],
  );
  const { events: safetyEvents } = useSafetyEvents();

  const columns: ColumnsType<Row> = [
    { title: "Site", dataIndex: "name", key: "name", sorter: (a, b) => a.name.localeCompare(b.name) },
    {
      title: "Plant type",
      dataIndex: "plantType",
      key: "plantType",
      filters: ["ETP", "RO", "MEE", "STP", "WTP"].map((t) => ({ text: t, value: t })),
      onFilter: (value, record) => record.plantType === value,
      render: (type: Site["plantType"]) => (
        <Tag color={plantColor[type]} style={{ border: "none" }}>{type}</Tag>
      ),
    },
    { title: "Location", dataIndex: "location", key: "location" },
    { title: "Headcount", dataIndex: "headcount", key: "headcount", sorter: (a, b) => a.headcount - b.headcount },
    {
      title: "Readiness",
      dataIndex: "readiness",
      key: "readiness",
      sorter: (a, b) => a.readiness - b.readiness,
      render: (readiness: number, row) => {
        const b = row.readinessBreakdown;
        return (
          <Tooltip
            title={
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <div>Staffing {b.staffingPct}% ({b.activeStaff}/{b.requiredStaff})</div>
                <div>Training {b.trainingPct}%</div>
                <div>Skills {b.skillPct}%</div>
                <div>Cover {b.coveragePct}% · {b.openAbsences} open absences</div>
              </div>
            }
          >
            <div style={{ minWidth: 140 }}>
              <Progress
                percent={readiness}
                size="small"
                strokeColor={
                  readiness < 70
                    ? nectarColors.alert
                    : readiness < 85
                      ? nectarColors.sky
                      : nectarColors.mint
                }
              />
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: "Safety",
      key: "safety",
      render: (_, row) => {
        const k = safetyKpis(safetyEvents, row.id);
        return (
          <Link href="/safety/incidents" style={{ whiteSpace: "nowrap" }}>
            {k.open ? <Tag color={k.openCritical ? "red" : "orange"}>{k.open} open</Tag> : <Tag color="green">No open cases</Tag>}
            {k.activeBreakdowns ? <Tag color="red">Down</Tag> : null}
            <span style={{ fontSize: 12, color: nectarColors.muted }}>
              {k.daysSinceLti === null ? "No LTI" : `${k.daysSinceLti} d since LTI`}
            </span>
          </Link>
        );
      },
    },
  ];

  return (
    <div>
      <p style={{ margin: "0 0 16px", color: nectarColors.muted, fontSize: 14 }}>
        Treatment plants under O&amp;M (Operations &amp; Maintenance). Readiness
        is computed from staffing, training, skills, and open absences — not a
        fixed label.
      </p>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        pagination={false}
        style={{ background: nectarColors.white }}
      />
    </div>
  );
}
