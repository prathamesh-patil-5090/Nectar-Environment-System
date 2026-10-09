"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert, Button, DatePicker, Input, Segmented, Select, Table, theme } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, ReloadOutlined, SearchOutlined, WarningOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import {
  safetyCategoryLabel,
  SAFETY_SEVERITY_LABELS,
  SAFETY_STATUSES,
  SAFETY_STATUS_LABELS,
  SAFETY_TYPE_LABELS,
  downtimeDays,
  otTotals,
  type SafetyEventType,
  type SafetySeverity,
} from "@/lib/safety/rules";
import type { SafetyEvent } from "@/lib/safety/types";
import { useDirectory, useSafetyEvents, useSessionUser } from "@/lib/safety/hooks";
import { canSafety } from "@/lib/rbac";
import { useTableMotion } from "@/lib/motion/use-table-motion";
import { SeverityTag, StatusTag, TypeTag } from "./SafetyTags";
import { Panel } from "./ui";
import { tr, intlLocale, trData } from "@/lib/i18n";

type Scope = "open" | "closed" | "all";

const isClosed = (e: SafetyEvent) => e.status === "RESOLVED" || e.status === "CLOSED";

/** History of incidents & near-misses, or the breakdown log. Visible to every role. */
export default function EventsTable({ types, title }: { types: SafetyEventType[]; title: string }) {
  const { token } = theme.useToken();
  const router = useRouter();
  const user = useSessionUser();
  const { events, loading, error, reload } = useSafetyEvents();
  const dir = useDirectory();
  const [site, setSite] = useState<string>();
  const [type, setType] = useState<SafetyEventType>();
  const [severity, setSeverity] = useState<SafetySeverity>();
  const [scope, setScope] = useState<Scope>("open");
  const [status, setStatus] = useState<string>();
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [text, setText] = useState("");
  const isBreakdown = types.length === 1 && types[0] === "breakdown";
  const base = isBreakdown ? "breakdowns" : "incidents";

  const ofType = useMemo(() => events.filter((e) => types.includes(e.type)), [events, types]);
  const counts = useMemo(
    () => ({
      open: ofType.filter((e) => !isClosed(e)).length,
      closed: ofType.filter(isClosed).length,
      all: ofType.length,
    }),
    [ofType],
  );

  const rows = useMemo(() => {
    const q = text.trim().toLowerCase();
    return ofType
      .filter((e) => (scope === "all" ? true : scope === "open" ? !isClosed(e) : isClosed(e)))
      .filter((e) => !status || e.status === status)
      .filter((e) => !site || e.siteId === site)
      .filter((e) => !type || e.type === type)
      .filter((e) => !severity || e.severity === severity)
      .filter((e) => {
        if (!range) return true;
        const t = new Date(e.occurredAt).getTime();
        if (range[0] && t < range[0].startOf("day").valueOf()) return false;
        if (range[1] && t > range[1].endOf("day").valueOf()) return false;
        return true;
      })
      .filter(
        (e) =>
          !q ||
          e.title.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.involved.some((p) => dir.empName(p).toLowerCase().includes(q)),
      );
  }, [ofType, scope, status, site, type, severity, range, text, dir]);

  const { pageRef, tableRef } = useTableMotion(loading && !events.length ? "" : rows.map((e) => e.id).join("|") || "empty");

  const muted = { color: token.colorTextSecondary };
  const when = (iso: string) => new Date(iso).toLocaleString(intlLocale(), { dateStyle: "medium", timeStyle: "short" });

  const columns: ColumnsType<SafetyEvent> = [
    {
      title: tr("Case"),
      key: "title",
      render: (_, e) => (
        <div style={{ minWidth: 220, lineHeight: 1.35 }}>
          <Link href={`/safety/${base}/${e.id}`} style={{ fontWeight: 500, color: token.colorText }}>
            {trData(e.title)}
          </Link>
          {e.isEmergency ? (
            <span style={{ marginLeft: 8, fontSize: 12, color: token.colorError, whiteSpace: "nowrap" }}>
              <WarningOutlined />{" "}{tr("Emergency")}
            </span>
          ) : null}
          <div style={{ fontSize: 13, ...muted }}>{e.location || e.id}</div>
        </div>
      ),
    },
    ...(types.length > 1 ? [{ title: tr("Type"), key: "type", render: (_: unknown, e: SafetyEvent) => <TypeTag type={e.type} /> }] : []),
    {
      title: tr("Site"),
      key: "site",
      render: (_, e) => (
        <div style={{ lineHeight: 1.35 }}>
          <div>{trData(dir.siteName(e.siteId))}</div>
          <div style={{ fontSize: 13, ...muted }}>{trData(safetyCategoryLabel(e))}</div>
        </div>
      ),
    },
    { title: tr("Severity"), key: "sev", render: (_, e) => <SeverityTag severity={e.severity} /> },
    { title: tr("Status"), key: "status", render: (_, e) => <StatusTag status={e.status} /> },
    ...(isBreakdown
      ? [
          {
            title: tr("Downtime"),
            key: "down",
            render: (_: unknown, e: SafetyEvent) =>
              e.restoredAt ? (
                `${downtimeDays(e.failedAt, e.restoredAt)} d`
              ) : (
                <span style={{ color: token.colorError, whiteSpace: "nowrap" }}>{tr("Down {downtimeDays} d", { downtimeDays: downtimeDays(e.failedAt) })}</span>
              ),
          },
          {
            title: tr("OT to fix"),
            key: "ot",
            render: (_: unknown, e: SafetyEvent) => {
              const t = otTotals(e.otEntries);
              return <span style={{ whiteSpace: "nowrap" }}>{tr("{people} people · {hours} h", { people: t.people, hours: t.hours })}</span>;
            },
          },
        ]
      : [
          {
            title: tr("People"),
            key: "inv",
            render: (_: unknown, e: SafetyEvent) => (
              <div style={{ lineHeight: 1.35, maxWidth: 220 }}>
                <div>{e.involved.map((p) => trData(dir.empName(p))).join(", ") || "—"}</div>
                {e.informedBy.length ? <div style={{ fontSize: 13, ...muted }}>{tr("{informedByCount} saw it", { informedByCount: e.informedBy.length })}</div> : null}
              </div>
            ),
          },
        ]),
    {
      title: tr("Occurred"),
      key: "when",
      sorter: (a, b) => a.occurredAt.localeCompare(b.occurredAt),
      defaultSortOrder: "descend",
      render: (_, e) => <span style={{ whiteSpace: "nowrap" }}>{trData(when(e.occurredAt))}</span>,
    },
  ];

  const scopeLabel: Record<Scope, string> = { open: "Open", closed: "Resolved & closed", all: "All" };

  return (
    <div ref={pageRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        data-anim="intro"
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <p style={{ margin: 0, fontSize: 14, maxWidth: 640, ...muted }}>
          {trData(title)}.{" "}
          {isBreakdown
            ? tr("Every time a plant stops working — what broke, how long it was down and the overtime it took to fix.")
            : tr("Every incident and near-miss at every plant, visible to everyone. Open a case to follow it.")}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={() => void reload()} loading={loading} aria-label={tr("Refresh")} />
          {isBreakdown && canSafety(user ?? null, "reportBreakdown") ? (
            <Link href="/safety/report?type=breakdown"><Button type="primary" icon={<PlusOutlined />}>{tr("Log breakdown")}</Button></Link>
          ) : !isBreakdown && canSafety(user ?? null, "reportIncident") ? (
            <Link href="/safety/report"><Button type="primary" icon={<PlusOutlined />}>{tr("Raise safety concern")}</Button></Link>
          ) : null}
        </div>
      </div>

      {error ? <Alert type="warning" showIcon title={tr("Server unreachable — showing the last saved list ({error})", { error: trData(error) })} /> : null}

      <div data-anim="intro" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Segmented<Scope>
          value={scope}
          onChange={(v) => {
            setScope(v);
            setStatus(undefined);
          }}
          options={(["open", "closed", "all"] as Scope[]).map((s) => ({ value: s, label: `${tr(scopeLabel[s])} ${counts[s]}` }))}
        />
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
          placeholder={tr("Search title, ID, place or person")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ width: 260, maxWidth: "100%" }}
        />
        <Select allowClear placeholder={tr("All sites")} style={{ width: 200 }} value={site} onChange={setSite}
          options={dir.sites.map((s) => ({ value: s.id, label: s.name }))} />
        {types.length > 1 ? (
          <Select allowClear placeholder={tr("Any type")} style={{ width: 130 }} value={type} onChange={setType}
            options={types.map((t) => ({ value: t, label: SAFETY_TYPE_LABELS[t] }))} />
        ) : null}
        <Select allowClear placeholder={tr("Any severity")} style={{ width: 140 }} value={severity} onChange={setSeverity}
          options={(Object.keys(SAFETY_SEVERITY_LABELS) as SafetySeverity[]).map((s) => ({ value: s, label: SAFETY_SEVERITY_LABELS[s] }))} />
        <Select allowClear placeholder={tr("Any status")} style={{ width: 150 }} value={status} onChange={setStatus}
          options={SAFETY_STATUSES.filter((s) => (scope === "all" ? true : scope === "open" ? s !== "RESOLVED" && s !== "CLOSED" : s === "RESOLVED" || s === "CLOSED"))
            .map((s) => ({ value: s, label: SAFETY_STATUS_LABELS[s] }))} />
        <DatePicker.RangePicker value={range} onChange={(v) => setRange(v)} allowEmpty={[true, true]} />
      </div>

      <div ref={tableRef} data-anim="intro">
        <Panel>
          <Table<SafetyEvent>
            rowKey="id"
            loading={loading && !events.length}
            columns={columns}
            dataSource={rows}
            pagination={{
              pageSize: 20,
              hideOnSinglePage: true,
              showSizeChanger: false,
              showTotal: (total, [from, to]) => tr("{from}–{to} of {total} cases", { from, to, total }),
              style: { padding: "0 16px" },
            }}
            scroll={{ x: "max-content" }}
            onRow={(e) => ({
              onClick: (ev) => {
                if ((ev.target as HTMLElement).closest("a")) return;
                router.push(`/safety/${base}/${e.id}`);
              },
              style: { cursor: "pointer" },
            })}
            locale={{
              emptyText:
                scope === "open" && counts.all
                  ? tr("Nothing open. Switch to “All” to see the history.")
                  : isBreakdown
                    ? tr("No breakdowns recorded.")
                    : tr("No cases recorded."),
            }}
          />
        </Panel>
      </div>
    </div>
  );
}
