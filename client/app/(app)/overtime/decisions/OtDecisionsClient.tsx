"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  App,
  Button,
  DatePicker,
  Input,
  Select,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import KpiStat from "@/components/KpiStat";
import { getSession } from "@/lib/auth";
import { getSiteName, sites } from "@/lib/mock-data";
import { assignOt } from "@/lib/overtime/assignments";
import {
  approveOtDecision,
  blockOtDecision,
  getOtDecisions,
  type OtDecision,
} from "@/lib/ot-decision";
import {
  canResolveOtDecisions,
  canViewOtModule,
  scopedSiteId,
} from "@/lib/rbac";
import { TODAY } from "@/lib/shift";
import { nectarColors } from "@/lib/theme";
import { tr, trData, trEnum } from "@/lib/i18n";

export default function OtDecisionsClient() {
  const { message, modal } = App.useApp();
  const session = getSession();
  const search = useSearchParams();
  const focusLeaveId = search.get("leaveId") ?? undefined;
  const locked = scopedSiteId(session);
  const canView = canViewOtModule(session);
  const canResolve = canResolveOtDecisions(session);

  const [siteId, setSiteId] = useState<string | undefined>(locked);
  const [status, setStatus] = useState<OtDecision["status"] | "all">("pending");
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs(TODAY).subtract(3, "day"),
    dayjs(TODAY).add(10, "day"),
  ]);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  const rows = useMemo(() => {
    void tick;
    let list = getOtDecisions({
      siteId,
      status: status === "all" ? undefined : status,
      leaveId: focusLeaveId,
    });
    const from = range[0].format("YYYY-MM-DD");
    const to = range[1].format("YYYY-MM-DD");
    list = list.filter((d) => d.date >= from && d.date <= to);
    return list;
  }, [siteId, status, range, tick, focusLeaveId]);

  const pendingCount = useMemo(() => {
    void tick;
    return getOtDecisions({ siteId, status: "pending" }).length;
  }, [siteId, tick]);

  const onApprove = (row: OtDecision) => {
    if (!canResolve) {
      message.error(tr("Only Manager or Director can approve OT decisions."));
      return;
    }
    let remark = "";
    let employeeId = row.proposedAssignees[0]?.employeeId;
    modal.confirm({
      title: tr("Approve OT — {title}", { title: trData(row.title) }),
      width: 480,
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13, color: nectarColors.muted }}>
            {row.hours}h · ₹{row.cost}
            {row.flags.length
              ? tr(" · Flags: {flags}", { flags: row.flags.join(", ") })
              : ""}
          </p>
          {row.proposedAssignees.length ? (
            <Select
              placeholder={tr("Assignee (optional)")}
              defaultValue={employeeId}
              options={row.proposedAssignees.map((a) => ({
                value: a.employeeId,
                label: tr("{name} ({currentOtHoursOnDate}h today)", { name: trData(a.name), currentOtHoursOnDate: a.currentOtHoursOnDate }),
              }))}
              onChange={(v) => {
                employeeId = v;
              }}
            />
          ) : null}
          <Input.TextArea
            rows={3}
            placeholder={tr("Remark (required)")}
            onChange={(e) => {
              remark = e.target.value;
            }}
          />
        </div>
      ),
      okText: tr("Approve OT"),
      onOk: () => {
        if (!remark.trim()) {
          message.error(tr("Remark is required"));
          return Promise.reject();
        }
        try {
          const decided = approveOtDecision({
            decisionId: row.id,
            actor: session?.name ?? "Manager",
            remark,
            employeeId,
          });
          if (decided.chosenEmployeeId) {
            try {
              assignOt({
                employeeId: decided.chosenEmployeeId,
                date: row.date,
                hours: row.hours,
                reason: `OT decision ${row.id}: ${remark}`,
                assignedBy: session?.name ?? "Manager",
                assignedByEmployeeId: session?.employeeId,
                notes: row.message,
              });
            } catch {
              /* assignment optional if employee invalid */
            }
          }
          message.success(tr("OT decision approved."));
          refresh();
        } catch (e) {
          message.error(e instanceof Error ? trData(e.message) : tr("Approve failed"));
          return Promise.reject();
        }
      },
    });
  };

  const onBlock = (row: OtDecision) => {
    if (!canResolve) {
      message.error(tr("Only Manager or Director can block OT decisions."));
      return;
    }
    let remark = "";
    modal.confirm({
      title: tr("Block OT — {title}", { title: trData(row.title) }),
      content: (
        <Input.TextArea
          rows={3}
          placeholder={tr("Remark (required)")}
          onChange={(e) => {
            remark = e.target.value;
          }}
        />
      ),
      okText: tr("Block"),
      okButtonProps: { danger: true },
      onOk: () => {
        if (!remark.trim()) {
          message.error(tr("Remark is required"));
          return Promise.reject();
        }
        try {
          blockOtDecision({
            decisionId: row.id,
            actor: session?.name ?? "Manager",
            remark,
          });
          message.success(tr("OT blocked — arrange cover instead."));
          refresh();
        } catch (e) {
          message.error(e instanceof Error ? trData(e.message) : tr("Block failed"));
          return Promise.reject();
        }
      },
    });
  };

  const columns: ColumnsType<OtDecision> = [
    {
      title: tr("Case"),
      key: "title",
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{trData(row.title)}</div>
          <div style={{ fontSize: 12, color: nectarColors.muted }}>
            {trData(row.message)}
          </div>
        </div>
      ),
    },
    {
      title: tr("Site"),
      dataIndex: "siteId",
      render: (id) => trData(getSiteName(id)),
      width: 120,
    },
    { title: tr("Date"), dataIndex: "date", width: 110 },
    {
      title: tr("Hours / cost"),
      key: "hc",
      width: 120,
      render: (_, row) => `${row.hours}h · ₹${row.cost}`,
    },
    {
      title: tr("Flags"),
      dataIndex: "flags",
      render: (flags: OtDecision["flags"]) =>
        flags.length ? (
          flags.map((f) => (
            <Tag key={f} color={nectarColors.alert} style={{ marginBottom: 2 }}>
              {trEnum(f)}
            </Tag>
          ))
        ) : (
          <Tag color={nectarColors.mint}>{tr("clear")}</Tag>
        ),
    },
    {
      title: tr("Status"),
      dataIndex: "status",
      width: 110,
      render: (s: OtDecision["status"]) => (
        <Tag
          color={
            s === "approved"
              ? nectarColors.mint
              : s === "blocked"
                ? nectarColors.alert
                : s === "pending"
                  ? "#D97706"
                  : nectarColors.muted
          }
        >
          {s}
        </Tag>
      ),
    },
    {
      title: tr("Links"),
      key: "links",
      width: 140,
      render: (_, row) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {row.leaveId ? (
            <Link href={`/leave/requests/${row.leaveId}`}>{tr("Leave")}</Link>
          ) : null}
          {row.safetyEventId ? (
            <Link href={`/safety/breakdowns/${row.safetyEventId}`}>{tr("Breakdown")}</Link>
          ) : null}
          {row.ePermitId ? (
            <Link href={`/e-permits/${row.ePermitId}`}>{tr("E-Permit")}</Link>
          ) : null}
          <Link href="/overtime/assign">{tr("Assign")}</Link>
        </div>
      ),
    },
    {
      title: tr("Action"),
      key: "action",
      width: 160,
      render: (_, row) =>
        row.status !== "pending" ? (
          <span style={{ fontSize: 12, color: nectarColors.muted }}>
            {row.actor ? tr("{status} by {actor}", { status: trData(row.status), actor: trData(row.actor) }) : "—"}
          </span>
        ) : canResolve ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button type="primary" size="small" onClick={() => onApprove(row)}>
              {tr("Approve")}
            </Button>
            <Button danger size="small" onClick={() => onBlock(row)}>
              {tr("Block")}
            </Button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: nectarColors.muted }}>
            {tr("Manager decision")}
          </span>
        ),
    },
  ];

  if (!canView) {
    return (
      <div style={{ padding: 24, color: nectarColors.muted }}>
        {tr("You do not have access to OT decisions.")}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
          }}
        >
          {tr("OT Decisions")}
        </div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted, maxWidth: 720 }}>
          {tr("Last-resort overtime for uncovered shifts. Soft block when cover still exists or thresholds are hit — Manager Approves with remark (and optional assignee) or Blocks.")}
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Select
          allowClear={!locked}
          disabled={!!locked}
          placeholder={tr("All sites")}
          style={{ minWidth: 180 }}
          value={siteId}
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
          onChange={setSiteId}
        />
        <Select
          style={{ minWidth: 140 }}
          value={status}
          options={[
            { value: "pending", label: tr("Pending") },
            { value: "approved", label: tr("Approved") },
            { value: "blocked", label: tr("Blocked") },
            { value: "all", label: tr("All") },
          ]}
          onChange={setStatus}
        />
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => {
            if (v?.[0] && v[1]) setRange([v[0], v[1]]);
          }}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <KpiStat label={tr("Pending")} value={String(pendingCount)} tone="alert" />
        <KpiStat label={tr("In view")} value={String(rows.length)} />
      </div>

      <Table
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}
