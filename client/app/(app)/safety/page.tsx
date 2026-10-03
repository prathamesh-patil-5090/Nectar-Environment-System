"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Alert, Button, Card, Empty, Listy, Table, Tag } from "antd";
import {
  AlertOutlined,
  BookOutlined,
  PlusOutlined,
  ToolOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import KpiStat from "@/components/KpiStat";
import { SeverityTag, StatusTag, TypeTag } from "@/components/safety/SafetyTags";
import { isOpenStatus, downtimeDays } from "@/lib/safety/rules";
import { safetyKpis } from "@/lib/safety/kpis";
import { useDirectory, useSafetyEvents, useSessionUser } from "@/lib/safety/hooks";
import { canSafety } from "@/lib/rbac";

export default function SafetyOverviewPage() {
  const user = useSessionUser();
  const { events, loading, error } = useSafetyEvents();
  const dir = useDirectory();

  const k = useMemo(() => safetyKpis(events), [events]);
  const open = useMemo(() => events.filter((e) => isOpenStatus(e.status)).slice(0, 8), [events]);
  const siteRows = useMemo(
    () =>
      dir.sites.map((s) => {
        const sk = safetyKpis(events, s.id);
        return { key: s.id, site: s.name, ...sk };
      }),
    [dir.sites, events],
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "rgba(0,0,0,0.6)", maxWidth: 640, flex: "1 1 260px", minWidth: 0 }}>
          Every incident, near-miss and breakdown — big or small — is recorded here and visible to everyone.
          Safety concerns are raised by the plant manager; open cases keep notifying everyone responsible until the Director closes them.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {canSafety(user ?? null, "reportIncident") ? (
            <Link href="/safety/report"><Button type="primary" icon={<PlusOutlined />}>Raise safety concern</Button></Link>
          ) : canSafety(user ?? null, "reportBreakdown") ? (
            <Link href="/safety/report?type=breakdown"><Button type="primary" icon={<PlusOutlined />}>Log breakdown</Button></Link>
          ) : null}
          <Link href="/safety/protocols"><Button icon={<BookOutlined />}>Emergency protocols</Button></Link>
        </div>
      </div>
      {error ? <Alert type="warning" showIcon title={`Server unreachable — showing last saved data (${error})`} /> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, background: "#f0f0f0", borderRadius: 10, overflow: "hidden" }}>
        <KpiStat label="Open cases" value={k.open} hint={`${k.openCritical} critical / high`} tone={k.openCritical ? "alert" : "default"} />
        <KpiStat label="Active emergencies" value={k.activeEmergencies} tone={k.activeEmergencies ? "alert" : "default"} hint={k.activeEmergencies ? "Acknowledge from the case" : "None"} />
        <KpiStat label="Near-misses (30 days)" value={k.nearMiss30d} hint="Reporting them prevents injuries" />
        <KpiStat label="Plants down now" value={k.activeBreakdowns} tone={k.activeBreakdowns ? "alert" : "default"} hint={`${k.breakdownOtHours30d} OT h on repairs (30 d)`} />
        <KpiStat label="Return-to-work pending" value={k.pendingClearances} tone={k.pendingClearances ? "alert" : "default"} hint="Leave can't close until cleared" />
        <KpiStat label="Days since lost-time injury" value={k.daysSinceLti ?? "—"} hint={k.daysSinceLti === null ? "None recorded" : "All sites"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 16 }}>
        <Card title="Needs attention" extra={<Link href="/safety/incidents">All history</Link>}>
          {open.length ? (
            <Listy
              items={open}
              rowKey="id"
              itemRender={(e) => (
                <div style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ minWidth: 0, width: "100%" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
                      <TypeTag type={e.type} />
                      <StatusTag status={e.status} />
                      <SeverityTag severity={e.severity} />
                      {e.isEmergency ? <Tag color="red" icon={<WarningOutlined />}>Emergency</Tag> : null}
                    </div>
                    <Link href={`/safety/${e.type === "breakdown" ? "breakdowns" : "incidents"}/${e.id}`} style={{ fontWeight: 600 }}>{e.title}</Link>
                    <div style={{ fontSize: 12, color: "rgba(0,0,0,0.5)" }}>
                      {dir.siteName(e.siteId)} · {new Date(e.reportedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      {e.type === "breakdown" && !e.restoredAt ? ` · down ${downtimeDays(e.failedAt)} d` : ""}
                    </div>
                  </div>
                </div>
              )}
            />
          ) : (
            <Empty description={loading ? "Loading…" : "No open cases"} />
          )}
        </Card>

        <Card title="By site">
          <Table
            size="small"
            pagination={false}
            dataSource={siteRows}
            scroll={{ x: "max-content" }}
            columns={[
              { title: "Site", dataIndex: "site" },
              { title: "Open", dataIndex: "open" },
              { title: "Near-miss 30d", dataIndex: "nearMiss30d" },
              { title: "Down now", dataIndex: "activeBreakdowns", render: (v: number) => (v ? <Tag color="red">{v}</Tag> : 0) },
              { title: "Days since LTI", dataIndex: "daysSinceLti", render: (v: number | null) => (v === null ? "—" : v) },
            ]}
          />
        </Card>

        <Card title="Quick links">
          <div style={{ display: "grid", gap: 8 }}>
            {canSafety(user ?? null, "reportIncident") ? (
              <Link href="/safety/report"><Button block icon={<AlertOutlined />}>Raise a safety concern</Button></Link>
            ) : null}
            <Link href="/safety/breakdowns"><Button block icon={<ToolOutlined />}>Breakdown log</Button></Link>
            <Link href="/safety/protocols"><Button block icon={<BookOutlined />}>Emergency protocols</Button></Link>
            <Link href="/safety/training"><Button block>Safety training</Button></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
