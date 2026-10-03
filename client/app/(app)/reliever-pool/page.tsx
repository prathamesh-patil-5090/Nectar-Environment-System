"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  App,
  Button,
  Select,
  Table,
  Tag,
  Timeline,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleOutlined,
  ClusterOutlined,
  TeamOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import KpiStat from "@/components/KpiStat";
import { getSession } from "@/lib/auth";
import { sites } from "@/lib/mock-data";
import { shifts } from "@/lib/overtime/data";
import {
  getAbsences,
  getClusterById,
  getEvents,
  getPoolKpis,
  getRelievers,
  getSiteManpowerRequirement,
  runReplacementFlow,
  setRelieverAvailability,
  siteClusters,
  type AbsenceRecord,
  type Reliever,
  type RelieverAvailability,
} from "@/lib/reliever/pool";
import {
  candidateDisplaySource,
  computeShiftImpact,
} from "@/lib/shift-impact";
import { canManageRelieverPool, scopedSiteId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { gridGap162, rowCenterBetweenWrapGap12, rowWrapGap1BgR8, sWhitePadR12BorderShadow } from "@/lib/styles";

const IMPACT_TODAY = "2026-09-23";

const availabilityColor: Record<RelieverAvailability, string> = {
  available: nectarColors.mint,
  assigned: nectarColors.sky,
  unavailable: nectarColors.muted,
};

export default function RelieverPoolPage() {
  const { message } = App.useApp();
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const canManage = canManageRelieverPool(session);
  const [clusterId, setClusterId] = useState<string | undefined>();
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  const kpis = useMemo(() => {
    void tick;
    return getPoolKpis();
  }, [tick]);
  const absences = useMemo(() => {
    void tick;
    return getAbsences().filter((a) =>
      siteScope ? a.siteId === siteScope : true,
    );
  }, [tick, siteScope]);
  const relieverRows = useMemo(() => {
    void tick;
    return getRelievers(clusterId);
  }, [clusterId, tick]);
  const events = useMemo(() => {
    void tick;
    return getEvents().slice(0, 8);
  }, [tick]);
  const siteReqs = useMemo(() => {
    void tick;
    return sites
      .filter((s) => {
        if (siteScope && s.id !== siteScope) return false;
        return (
          !clusterId || getClusterById(clusterId)?.siteIds.includes(s.id)
        );
      })
      .map((s) => getSiteManpowerRequirement(s.id));
  }, [clusterId, tick, siteScope]);

  const impactVacancies = useMemo(() => {
    void tick;
    const report = computeShiftImpact({ siteId: siteScope, from: IMPACT_TODAY, to: IMPACT_TODAY });
    return report.vacancies.filter((v) => {
      if (v.status !== "open") return false;
      if (siteScope && v.siteId !== siteScope) return false;
      if (clusterId) {
        const cluster = getClusterById(clusterId);
        if (cluster && !cluster.siteIds.includes(v.siteId)) return false;
      }
      return true;
    });
  }, [tick, siteScope, clusterId]);

  const assign = (absenceId: string) => {
    if (!canManage) {
      message.error("You do not have permission to assign relievers.");
      return;
    }
    try {
      const result = runReplacementFlow(absenceId);
      refresh();
      if (result.outcome === "ot_fallback") {
        message.warning("No pool match — OT marked as last resort.");
      } else {
        message.success(
          result.outcome === "local_assigned"
            ? "Local reliever assigned."
            : "Cluster pool reliever assigned. Notification queued.",
        );
      }
    } catch {
      message.error("Could not run replacement flow.");
    }
  };

  const toggleAvailability = (reliever: Reliever) => {
    if (!canManage) {
      message.error("You do not have permission to change availability.");
      return;
    }
    const next: RelieverAvailability =
      reliever.availability === "available" ? "unavailable" : "available";
    if (reliever.availability === "assigned") {
      message.info("Release this assignment from the open absence first.");
      return;
    }
    setRelieverAvailability(reliever.id, next);
    refresh();
  };

  const absenceColumns: ColumnsType<AbsenceRecord> = [
    { title: "Date", dataIndex: "date", width: 110 },
    {
      title: "Absent employee",
      dataIndex: "employeeName",
      render: (name, row) => (
        <Link href={`/employees/${row.employeeId}`}>{name}</Link>
      ),
    },
    { title: "Site", dataIndex: "siteId", render: (id) => sites.find((s) => s.id === id)?.name ?? id },
    { title: "Shift", dataIndex: "shiftId", render: (id) => shifts.find((s) => s.id === id)?.name ?? id },
    {
      title: "Skills needed",
      dataIndex: "requiredSkills",
      render: (skills: string[]) =>
        skills.map((s) => (
          <Tag key={s} style={{ marginBottom: 2 }}>{s}</Tag>
        )),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: AbsenceRecord["status"]) => {
        const map: Record<AbsenceRecord["status"], { color: string; label: string }> = {
          open: { color: nectarColors.alert, label: "Open" },
          local_assigned: { color: nectarColors.mint, label: "Local filled" },
          pool_assigned: { color: nectarColors.leaf, label: "Pool filled" },
          ot_fallback: { color: nectarColors.alert, label: "OT last resort" },
          resolved: { color: nectarColors.muted, label: "Resolved" },
        };
        const m = map[status];
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: "Action",
      key: "action",
      render: (_, row) =>
        row.status === "open" ? (
          canManage ? (
            <Button type="primary" size="small" onClick={() => assign(row.id)}>Find replacement</Button>
          ) : (
            <span style={{ fontSize: 12, color: nectarColors.muted }}>View only</span>
          )
        ) : (
          <span style={{ fontSize: 12, color: nectarColors.muted }}>{row.resolutionNote ?? "—"}</span>
        ),
    },
  ];

  const relieverColumns: ColumnsType<Reliever> = [
    { title: "Reliever", dataIndex: "name" },
    { title: "Cluster", dataIndex: "clusterId", render: (id) => getClusterById(id)?.name ?? id },
    {
      title: "Home site",
      dataIndex: "homeSiteId",
      render: (id) =>
        id ? sites.find((s) => s.id === id)?.name ?? id : "Shared pool",
    },
    {
      title: "Skills",
      dataIndex: "skills",
      render: (skills: string[]) =>
        skills.map((s) => (
          <Tag key={s} style={{ marginBottom: 2 }}>{s}</Tag>
        )),
    },
    {
      title: "Availability",
      dataIndex: "availability",
      render: (a: RelieverAvailability, row) => (
        <Tag color={availabilityColor[a]} style={{ border: "none" }}>
          {a === "available"
            ? "Available"
            : a === "assigned"
              ? `Assigned${
                  row.assignedSiteId
                    ? ` · ${sites.find((s) => s.id === row.assignedSiteId)?.name ?? row.assignedSiteId}`
                    : ""
                }`
              : "Not available"}
        </Tag>
      ),
    },
    {
      title: "Toggle",
      key: "toggle",
      render: (_, row) =>
        !canManage ? (
          <span style={{ fontSize: 12, color: nectarColors.muted }}>View only</span>
        ) : row.availability === "assigned" ? (
          <span style={{ fontSize: 12, color: nectarColors.muted }}>On assignment</span>
        ) : (
          <Button size="small" onClick={() => toggleAvailability(row)}>
            {row.availability === "available"
              ? "Mark unavailable"
              : "Mark available"}
          </Button>
        ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={sWhitePadR12BorderShadow}>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 22, color: nectarColors.ink, marginBottom: 6,
          }}
        >
          Dynamic Reliever Pool
        </div>
        <p style={{ margin: 0, color: nectarColors.muted, maxWidth: 720 }}>
          Shared backup manpower by site cluster. When someone is absent:
          check local reliever → check cluster pool → assign replacement → use
          OT only as last resort. Supervisors manage availability; workers do
          not need the app.
        </p>
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link href="/reliever-pool/competition">
            <Button type="default">Reliever Competition</Button>
          </Link>
          <Link href="/leave/lifecycle">
            <Button type="default">Lifecycle / Coverage</Button>
          </Link>
        </div>
        <div
          style={{ marginTop: 14, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: nectarColors.ink }}
        >
          <FlowStep n="1" label="Absence detected" />
          <FlowStep n="2" label="Local reliever" />
          <FlowStep n="3" label="Cluster pool" />
          <FlowStep n="4" label="Assign / notify" />
          <FlowStep n="5" label="OT last resort" muted />
        </div>
      </div>

      <div style={rowWrapGap1BgR8}>
        <KpiStat label="Clusters" value={kpis.clusters} hint={`${kpis.sitesCovered} sites`} />
        <KpiStat label="Pool size" value={kpis.poolSize} tone="info" />
        <KpiStat label="Available now" value={kpis.available} tone="positive" />
        <KpiStat label="On assignment" value={kpis.assigned} tone="info" />
        <KpiStat label="Open absences" value={kpis.openAbsences} tone="alert" />
        <KpiStat
          label="OT avoided"
          value={`${kpis.otAvoidanceRate}%`}
          hint={`${kpis.coveredByPool} filled · ${kpis.otLastResort} OT fallback`}
          tone="positive"
        />
      </div>

      <div style={rowCenterBetweenWrapGap12}>
        <Select
          allowClear
          placeholder="All clusters"
          style={{ minWidth: 240 }}
          value={clusterId}
          options={siteClusters.map((c) => ({ value: c.id, label: `${c.name} (${c.siteIds.length} sites)` }))}
          onChange={setClusterId}
        />
        <div style={{ fontSize: 13, color: nectarColors.muted }}>
          Model: {siteClusters[0].regularShifts} regular +{" "}
          {siteClusters[0].generalShifts} general + shared relievers per cluster
        </div>
      </div>

      <Panel title="Shift Impact vacancies" icon={<ClusterOutlined style={{ color: nectarColors.leaf }} />}>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: nectarColors.muted }}>
          Leave days and roster gaps needing cover from employees or the pool.{" "}
          <Link href="/shifts/reliever-allocation">Full allocation view</Link>
        </p>
        <Table
          rowKey="id"
          size="small"
          pagination={{ pageSize: 5 }}
          dataSource={impactVacancies}
          locale={{ emptyText: "No open shift vacancies today" }}
          columns={[
            { title: "When", key: "when", render: (_, r) => `${r.date} · ${r.shiftCode}` },
            {
              title: "Site",
              dataIndex: "siteId",
              render: (id: string) =>
                sites.find((s) => s.id === id)?.name ?? id,
            },
            { title: "Source", dataIndex: "source", render: (s: string) => (s === "leave" ? "Leave" : "Roster gap") },
            { title: "Absent", dataIndex: "absentEmployeeName", render: (n?: string) => n ?? "—" },
            {
              title: "Top candidates",
              key: "cand",
              render: (_, r) =>
                r.candidates.length ? (
                  r.candidates.slice(0, 2).map((c) => (
                    <Tag key={c.id} color={nectarColors.leaf}>{c.name} · {candidateDisplaySource(c.source)}</Tag>
                  ))
                ) : (
                  <Tag color={nectarColors.alert}>OT risk</Tag>
                ),
            },
            {
              title: "",
              key: "link",
              render: (_, r) =>
                r.leaveId ? (
                  <Link href={`/leave/requests/${r.leaveId}`}>Leave</Link>
                ) : null,
            },
          ]}
        />
      </Panel>

      <Panel title="Open absences & replacement" icon={<WarningOutlined style={{ color: nectarColors.alert }} />}>
        <Table
          rowKey="id"
          size="middle"
          columns={absenceColumns}
          dataSource={absences}
          pagination={false}
          scroll={{ x: 960 }}
        />
      </Panel>

      <div style={gridGap162} className="nectar-ot-two">
        <Panel title="Reliever availability" icon={<TeamOutlined style={{ color: nectarColors.leaf }} />}>
          <Table
            rowKey="id"
            size="small"
            columns={relieverColumns}
            dataSource={relieverRows}
            pagination={{ pageSize: 6 }}
            scroll={{ x: 800 }}
          />
        </Panel>

        <Panel title="Supervisor activity" icon={<CheckCircleOutlined style={{ color: nectarColors.sky }} />}>
          <Timeline
            items={events.map((e) => ({
              color:
                e.step === "ot_last_resort"
                  ? nectarColors.alert
                  : e.step === "assigned" || e.step === "notify"
                    ? nectarColors.mint
                    : nectarColors.leaf,
              content: (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {e.step.replace(/_/g, " ")}
                    {e.channel ? ` · ${e.channel}` : ""}
                  </div>
                  <div style={{ fontSize: 12, color: nectarColors.muted }}>{e.message}</div>
                </div>
              ),
            }))}
          />
        </Panel>
      </div>

      <Panel title="Site manpower requirement" icon={<ClusterOutlined style={{ color: nectarColors.leaf }} />}>
        <Table
          rowKey="siteId"
          size="small"
          pagination={false}
          dataSource={siteReqs}
          columns={[
            { title: "Site", dataIndex: "siteName" },
            { title: "Cluster", dataIndex: "clusterName" },
            { title: "Regular shifts", dataIndex: "regularShifts" },
            { title: "General shifts", dataIndex: "generalShifts" },
            { title: "Headcount", dataIndex: "headcount" },
            { title: "Local relievers", dataIndex: "localRelievers" },
            {
              title: "Open gaps",
              dataIndex: "openAbsences",
              render: (n: number) =>
                n > 0 ? (
                  <Tag color={nectarColors.alert}>{n}</Tag>
                ) : (
                  <Tag color={nectarColors.mint}>0</Tag>
                ),
            },
          ]}
        />
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {siteClusters.map((c) => (
          <div
            key={c.id}
            style={{
              background: nectarColors.white, borderRadius: 10, padding: 16, border: "1px solid rgba(28, 68, 99, 0.08)",
            }}
          >
            <div style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 16, marginBottom: 4 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: nectarColors.muted, marginBottom: 10 }}>{c.region}</div>
            <div style={{ fontSize: 12, color: nectarColors.ink }}>
              {c.siteIds
                .map((id) => sites.find((s) => s.id === id)?.name ?? id)
                .join(" · ")}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: nectarColors.muted }}>Shared reliever slots: {c.sharedRelieverSlots}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowStep({
  n,
  label,
  muted,
}: {
  n: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 22, height: 22, borderRadius: "50%", background: muted ? "rgba(196,92,38,0.15)" : "#1C4463",
          color: muted ? nectarColors.alert : "#FFFFFF", display: "grid", placeItems: "center", fontSize: 11,
          fontWeight: 700,
        }}
      >
        {n}
      </span>
      {label}
    </span>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: nectarColors.white, padding: 20, borderRadius: 10, border: "1px solid rgba(28, 68, 99, 0.06)",
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
          fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 18, color: nectarColors.ink,
        }}
      >
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
