"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Alert, Button, Table, theme } from "antd";
import { BookOutlined, PlusOutlined, WarningOutlined } from "@ant-design/icons";
import { SeverityTag, StatusTag, TypeTag } from "@/components/safety/SafetyTags";
import { NumberRow, Panel, Quiet, Section } from "@/components/safety/ui";
import { isOpenStatus, downtimeDays } from "@/lib/safety/rules";
import type { SafetyEvent } from "@/lib/safety/types";
import { safetyKpis } from "@/lib/safety/kpis";
import { useDirectory, useSafetyEvents, useSessionUser } from "@/lib/safety/hooks";
import { canSafety } from "@/lib/rbac";
import { useTableMotion } from "@/lib/motion/use-table-motion";

export default function SafetyOverviewPage() {
  const { token } = theme.useToken();
  const router = useRouter();
  const user = useSessionUser();
  const { events, loading, error } = useSafetyEvents();
  const dir = useDirectory();

  const k = useMemo(() => safetyKpis(events), [events]);
  const open = useMemo(() => events.filter((e) => isOpenStatus(e.status)).slice(0, 8), [events]);
  const siteRows = useMemo(
    () =>
      dir.sites.map((s) => {
        const sk = safetyKpis(events, s.id);
        return { key: s.id, site: s.name, location: s.location, ...sk };
      }),
    [dir.sites, events],
  );

  const ready = !loading || events.length > 0;
  const { pageRef, tableRef } = useTableMotion(ready ? open.map((e) => e.id).join("|") || "empty" : "");

  const muted = { color: token.colorTextSecondary };
  const href = (e: SafetyEvent) => `/safety/${e.type === "breakdown" ? "breakdowns" : "incidents"}/${e.id}`;
  const canConcern = canSafety(user ?? null, "reportIncident");
  const canBreakdown = canSafety(user ?? null, "reportBreakdown");

  return (
    <div ref={pageRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div data-anim="intro" style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: 14, maxWidth: 640, ...muted }}>
          Every incident, near-miss and breakdown, big or small, is recorded here and visible to everyone. Plant managers raise
          safety concerns; open cases keep reminding everyone responsible until the Director closes them.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link href="/safety/training"><Button>Safety training</Button></Link>
          <Link href="/safety/protocols"><Button icon={<BookOutlined />}>Emergency protocols</Button></Link>
          {canConcern ? (
            <Link href="/safety/report"><Button type="primary" icon={<PlusOutlined />}>Raise safety concern</Button></Link>
          ) : canBreakdown ? (
            <Link href="/safety/report?type=breakdown"><Button type="primary" icon={<PlusOutlined />}>Log breakdown</Button></Link>
          ) : null}
        </div>
      </div>

      {error ? <Alert type="warning" showIcon title={`Server unreachable — showing the last saved data (${error})`} /> : null}

      <div data-anim="intro">
        <NumberRow
          items={[
            { label: "Open cases", value: k.open, hint: `${k.openCritical} high or critical`, alert: k.openCritical > 0 },
            { label: "Active emergencies", value: k.activeEmergencies, hint: k.activeEmergencies ? "Acknowledge from the case" : "None", alert: k.activeEmergencies > 0 },
            { label: "Near-misses, 30 days", value: k.nearMiss30d, hint: "Reporting them prevents injuries" },
            { label: "Plants down now", value: k.activeBreakdowns, hint: `${k.breakdownOtHours30d} repair OT hours, 30 days`, alert: k.activeBreakdowns > 0 },
            { label: "Return to work pending", value: k.pendingClearances, hint: "Leave can't close until cleared", alert: k.pendingClearances > 0 },
            { label: "Days since lost-time injury", value: k.daysSinceLti ?? "—", hint: k.daysSinceLti === null ? "None recorded" : "All plants" },
          ]}
        />
      </div>

      <div data-anim="intro" className="safety-case-grid">
        <div ref={tableRef}>
          <Section title="Needs attention" extra={<Link href="/safety/incidents">All cases</Link>} flush>
            {open.length ? (
              <Table<SafetyEvent>
                rowKey="id"
                dataSource={open}
                pagination={false}
                showHeader={false}
                scroll={{ x: "max-content" }}
                onRow={(e) => ({
                  onClick: (ev) => {
                    if ((ev.target as HTMLElement).closest("a")) return;
                    router.push(href(e));
                  },
                  style: { cursor: "pointer" },
                })}
                columns={[
                  {
                    key: "case",
                    render: (_, e) => (
                      <div style={{ minWidth: 220, lineHeight: 1.35 }}>
                        <Link href={href(e)} style={{ fontWeight: 500, color: token.colorText }}>{e.title}</Link>
                        {e.isEmergency ? (
                          <span style={{ marginLeft: 8, fontSize: 12, color: token.colorError, whiteSpace: "nowrap" }}>
                            <WarningOutlined /> Emergency
                          </span>
                        ) : null}
                        <div style={{ fontSize: 13, ...muted }}>
                          <TypeTag type={e.type} /> · {dir.siteName(e.siteId)} ·{" "}
                          {new Date(e.reportedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          {e.type === "breakdown" && !e.restoredAt ? ` · down ${downtimeDays(e.failedAt)} d` : ""}
                        </div>
                      </div>
                    ),
                  },
                  { key: "sev", render: (_, e) => <SeverityTag severity={e.severity} /> },
                  { key: "status", render: (_, e) => <StatusTag status={e.status} /> },
                ]}
              />
            ) : (
              <div style={{ padding: 16 }}>
                <Quiet>{loading ? "Loading…" : "Nothing open right now."}</Quiet>
              </div>
            )}
          </Section>
        </div>

        <Panel>
          <Table
            rowKey="key"
            pagination={false}
            dataSource={siteRows}
            scroll={{ x: "max-content" }}
            columns={[
              {
                title: "Site",
                dataIndex: "site",
                render: (name: string, r) => (
                  <div style={{ lineHeight: 1.35 }}>
                    <div style={{ fontWeight: 500 }}>{name}</div>
                    <div style={{ fontSize: 13, ...muted }}>{r.location}</div>
                  </div>
                ),
              },
              { title: "Open", dataIndex: "open", align: "right" },
              {
                title: "Down",
                dataIndex: "activeBreakdowns",
                align: "right",
                render: (v: number) => (v ? <span style={{ color: token.colorError }}>{v}</span> : 0),
              },
              {
                title: "Since LTI",
                dataIndex: "daysSinceLti",
                align: "right",
                render: (v: number | null) => (v === null ? <span style={muted}>—</span> : `${v} d`),
              },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
