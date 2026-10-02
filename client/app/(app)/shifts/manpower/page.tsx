"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DatePicker, Select, Table, Tag } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import KpiStat from "@/components/KpiStat";
import { getSession } from "@/lib/auth";
import { getSiteName, sites } from "@/lib/mock-data";
import {
  getManpowerConflictReport,
  type ManpowerIssue,
} from "@/lib/manpower-conflict";
import { TODAY } from "@/lib/shift";
import { scopedSiteId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

const KIND_LABEL: Record<ManpowerIssue["kind"], string> = {
  uncovered_vacancy: "Uncovered",
  open_vacancy: "Open vacancy",
  plant_overlap: "Plant overlap",
  rest: "Rest",
  weekly_off: "Weekly off",
  leave_on_roster: "Leave on roster",
  double_booking: "Double booking",
  reliever_contest: "Reliever contest",
  ot_decision_pending: "OT decision",
  lifecycle_extension: "Leave extension",
  cover_disrupted: "Cover disrupted",
};

export default function ManpowerConflictPage() {
  const session = getSession();
  const locked = scopedSiteId(session);
  const [siteId, setSiteId] = useState<string | undefined>(locked);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs(TODAY),
    dayjs(TODAY).add(10, "day"),
  ]);
  const [tick] = useState(0);

  const report = useMemo(() => {
    void tick;
    return getManpowerConflictReport({
      siteId,
      from: range[0].format("YYYY-MM-DD"),
      to: range[1].format("YYYY-MM-DD"),
    });
  }, [siteId, range, tick]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
          }}
        >
          Manpower + Conflict
        </div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>
          Plant shortages, uncovered shifts, leave overlaps, and roster
          conflicts in one place. Attention items block leave site-approve and
          rotation publish until resolved (cover / OT / schedule edit).
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Select
          allowClear={!locked}
          disabled={!!locked}
          placeholder="All sites"
          style={{ minWidth: 200 }}
          value={siteId}
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
          onChange={setSiteId}
        />
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => {
            if (v?.[0] && v[1]) setRange([v[0], v[1]]);
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          background: "rgba(28, 68, 99, 0.06)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <KpiStat
          label="Attention"
          value={report.attentionCount}
          tone="alert"
        />
        <KpiStat
          label="Uncovered"
          value={report.uncoveredCount}
          tone="alert"
        />
        <KpiStat
          label="Open vacancies"
          value={report.openVacancyCount}
          tone="info"
        />
        <KpiStat label="Plant overlaps" value={report.overlapCount} />
        <KpiStat label="All issues" value={report.issues.length} />
      </div>

      <Table
        rowKey="id"
        dataSource={report.issues}
        style={{ background: nectarColors.white }}
        locale={{ emptyText: "No manpower or conflict issues in this window" }}
        columns={[
          {
            title: "Severity",
            dataIndex: "severity",
            width: 110,
            render: (s: string) => (
              <Tag color={s === "attention" ? nectarColors.alert : "#D97706"}>
                {s}
              </Tag>
            ),
          },
          {
            title: "Kind",
            dataIndex: "kind",
            render: (k: ManpowerIssue["kind"]) => KIND_LABEL[k] ?? k,
          },
          {
            title: "Date",
            dataIndex: "date",
            width: 120,
          },
          {
            title: "Site",
            dataIndex: "siteId",
            render: (id: string) => getSiteName(id),
          },
          {
            title: "Shift",
            dataIndex: "shiftCode",
            width: 70,
            render: (c?: string) => (c ? <Tag>{c}</Tag> : "—"),
          },
          {
            title: "Issue",
            dataIndex: "message",
            render: (m: string, r) => (
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: nectarColors.muted }}>{m}</div>
              </div>
            ),
          },
          {
            title: "Resolve via",
            dataIndex: "resolvableBy",
            width: 120,
            render: (r: string) => r.replace("_", " "),
          },
          {
            title: "",
            key: "link",
            width: 90,
            render: (_, r) =>
              r.href ? <Link href={r.href}>Open</Link> : null,
          },
        ]}
      />
    </div>
  );
}
