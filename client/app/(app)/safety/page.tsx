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
import { tr, intlLocale, trData, trCell } from "@/lib/i18n";

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
          {tr("Every incident, near-miss and breakdown, big or small, is recorded here and visible to everyone. Plant managers raise safety concerns; open cases keep reminding everyone responsible until the Director closes them.")}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link href="/safety/training"><Button>{tr("Safety training")}</Button></Link>
          <Link href="/safety/protocols"><Button icon={<BookOutlined />}>{tr("Emergency protocols")}</Button></Link>
          {canConcern ? (
            <Link href="/safety/report"><Button type="primary" icon={<PlusOutlined />}>{tr("Raise safety concern")}</Button></Link>
          ) : canBreakdown ? (
            <Link href="/safety/report?type=breakdown"><Button type="primary" icon={<PlusOutlined />}>{tr("Log breakdown")}</Button></Link>
          ) : null}
        </div>
      </div>

      {error ? <Alert type="warning" showIcon title={tr("Server unreachable — showing the last saved data ({error})", { error: trData(error) })} /> : null}

      <div data-anim="intro">
        <NumberRow
          items={[
            { label: tr("Open cases"), value: k.open, hint: tr("{openCritical} high or critical", { openCritical: k.openCritical }), alert: k.openCritical > 0 },
            { label: tr("Active emergencies"), value: k.activeEmergencies, hint: k.activeEmergencies ? tr("Acknowledge from the case") : tr("None"), alert: k.activeEmergencies > 0 },
            { label: tr("Near-misses, 30 days"), value: k.nearMiss30d, hint: tr("Reporting them prevents injuries") },
            { label: tr("Plants down now"), value: k.activeBreakdowns, hint: tr("{breakdownOtHours30d} repair OT hours, 30 days", { breakdownOtHours30d: k.breakdownOtHours30d }), alert: k.activeBreakdowns > 0 },
            { label: tr("Return to work pending"), value: k.pendingClearances, hint: tr("Leave can't close until cleared"), alert: k.pendingClearances > 0 },
            { label: tr("Days since lost-time injury"), value: k.daysSinceLti ?? "—", hint: k.daysSinceLti === null ? tr("None recorded") : tr("All plants") },
          ]}
        />
      </div>

      <div data-anim="intro" className="safety-case-grid">
        <div ref={tableRef}>
          <Section title={tr("Needs attention")} extra={<Link href="/safety/incidents">{tr("All cases")}</Link>} flush>
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
                        <Link href={href(e)} style={{ fontWeight: 500, color: token.colorText }}>{trData(e.title)}</Link>
                        {e.isEmergency ? (
                          <span style={{ marginLeft: 8, fontSize: 12, color: token.colorError, whiteSpace: "nowrap" }}>
                            <WarningOutlined />{" "}{tr("Emergency")}
                          </span>
                        ) : null}
                        <div style={{ fontSize: 13, ...muted }}>
                          <TypeTag type={e.type} /> · {trData(dir.siteName(e.siteId))} ·{" "}
                          {new Date(e.reportedAt).toLocaleString(intlLocale(), { dateStyle: "medium", timeStyle: "short" })}
                          {e.type === "breakdown" && !e.restoredAt ? tr(" · down {downtimeDays} d", { downtimeDays: downtimeDays(e.failedAt) }) : ""}
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
                <Quiet>{loading ? tr("Loading…") : tr("Nothing open right now.")}</Quiet>
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
                title: tr("Site"),
                dataIndex: "site",
                render: (name: string, r) => (
                  <div style={{ lineHeight: 1.35 }}>
                    <div style={{ fontWeight: 500 }}>{trData(name)}</div>
                    <div style={{ fontSize: 13, ...muted }}>{trData(r.location)}</div>
                  </div>
                ),
              },
              { title: tr("Open"), dataIndex: "open", render: trCell, align: "right" },
              {
                title: tr("Down"),
                dataIndex: "activeBreakdowns",
                align: "right",
                render: (v: number) => (v ? <span style={{ color: token.colorError }}>{v}</span> : 0),
              },
              {
                title: tr("Since LTI"),
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
