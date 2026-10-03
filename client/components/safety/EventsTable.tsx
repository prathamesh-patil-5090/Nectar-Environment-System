"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Button, Card, DatePicker, Input, Select, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, ReloadOutlined, WarningOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import {
  SAFETY_CATEGORY_LABELS,
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
import { SeverityTag, StatusTag, TypeTag } from "./SafetyTags";

/** History of incidents & near-misses, or the breakdown log. Visible to every role. */
export default function EventsTable({ types, title }: { types: SafetyEventType[]; title: string }) {
  const user = useSessionUser();
  const { events, loading, error, reload } = useSafetyEvents();
  const dir = useDirectory();
  const [site, setSite] = useState<string>();
  const [type, setType] = useState<SafetyEventType>();
  const [severity, setSeverity] = useState<SafetySeverity>();
  const [status, setStatus] = useState<string>("open");
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [text, setText] = useState("");
  const isBreakdown = types.length === 1 && types[0] === "breakdown";

  const rows = useMemo(() => {
    const q = text.trim().toLowerCase();
    return events
      .filter((e) => types.includes(e.type))
      .filter((e) => !site || e.siteId === site)
      .filter((e) => !type || e.type === type)
      .filter((e) => !severity || e.severity === severity)
      .filter((e) =>
        status === "all" ? true : status === "open" ? !["RESOLVED", "CLOSED"].includes(e.status) : e.status === status,
      )
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
  }, [events, types, site, type, severity, status, range, text, dir]);

  const columns: ColumnsType<SafetyEvent> = [
    {
      title: "Case",
      key: "title",
      render: (_, e) => (
        <div style={{ minWidth: 200 }}>
          <Link href={`/safety/${isBreakdown ? "breakdowns" : "incidents"}/${e.id}`} style={{ fontWeight: 600 }}>
            {e.title}
          </Link>
          {e.isEmergency ? <Tag color="red" icon={<WarningOutlined />} style={{ marginLeft: 6 }}>Emergency</Tag> : null}
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.5)" }}>{e.id}{e.location ? ` · ${e.location}` : ""}</div>
        </div>
      ),
    },
    ...(types.length > 1 ? [{ title: "Type", key: "type", render: (_: unknown, e: SafetyEvent) => <TypeTag type={e.type} /> }] : []),
    { title: "Site", key: "site", render: (_, e) => dir.siteName(e.siteId) },
    { title: "Category", key: "cat", render: (_, e) => SAFETY_CATEGORY_LABELS[e.category] },
    { title: "Severity", key: "sev", render: (_, e) => <SeverityTag severity={e.severity} /> },
    { title: "Status", key: "status", render: (_, e) => <StatusTag status={e.status} /> },
    ...(isBreakdown
      ? [
          { title: "Downtime", key: "down", render: (_: unknown, e: SafetyEvent) => (e.restoredAt ? `${downtimeDays(e.failedAt, e.restoredAt)} d` : <Tag color="red">Down {downtimeDays(e.failedAt)} d</Tag>) },
          { title: "OT to fix", key: "ot", render: (_: unknown, e: SafetyEvent) => { const t = otTotals(e.otEntries); return `${t.people} ppl · ${t.hours} h`; } },
        ]
      : [{ title: "Involved", key: "inv", render: (_: unknown, e: SafetyEvent) => e.involved.map(dir.empName).join(", ") || "—" }]),
    {
      title: "Occurred",
      key: "when",
      sorter: (a, b) => a.occurredAt.localeCompare(b.occurredAt),
      defaultSortOrder: "descend",
      render: (_, e) => new Date(e.occurredAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    },
  ];

  return (
    <Card
      title={title}
      extra={
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={() => void reload()} loading={loading} />
          {isBreakdown && canSafety(user ?? null, "reportBreakdown") ? (
            <Link href="/safety/report?type=breakdown"><Button type="primary" icon={<PlusOutlined />}>Log breakdown</Button></Link>
          ) : !isBreakdown && canSafety(user ?? null, "reportIncident") ? (
            <Link href="/safety/report"><Button type="primary" icon={<PlusOutlined />}>Raise safety concern</Button></Link>
          ) : null}
        </div>
      }
    >
      {error ? <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={`Server unreachable — showing last saved list (${error})`} /> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <Input.Search placeholder="Search title, id, place, person" allowClear style={{ width: 240 }} onChange={(e) => setText(e.target.value)} />
        <Select allowClear placeholder="Site" style={{ width: 160 }} value={site} onChange={setSite}
          options={dir.sites.map((s) => ({ value: s.id, label: s.name }))} />
        {types.length > 1 ? (
          <Select allowClear placeholder="Type" style={{ width: 140 }} value={type} onChange={setType}
            options={types.map((t) => ({ value: t, label: SAFETY_TYPE_LABELS[t] }))} />
        ) : null}
        <Select allowClear placeholder="Severity" style={{ width: 130 }} value={severity} onChange={setSeverity}
          options={(Object.keys(SAFETY_SEVERITY_LABELS) as SafetySeverity[]).map((s) => ({ value: s, label: SAFETY_SEVERITY_LABELS[s] }))} />
        <Select style={{ width: 160 }} value={status} onChange={setStatus}
          options={[
            { value: "open", label: "Open (not resolved)" },
            { value: "all", label: "All statuses" },
            ...SAFETY_STATUSES.map((s) => ({ value: s, label: SAFETY_STATUS_LABELS[s] })),
          ]} />
        <DatePicker.RangePicker value={range} onChange={(v) => setRange(v)} allowEmpty={[true, true]} />
      </div>
      <Table<SafetyEvent>
        rowKey="id"
        size="middle"
        loading={loading && !events.length}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: status === "open" ? "Nothing open — switch to “All statuses” to see history." : "No records" }}
      />
    </Card>
  );
}
