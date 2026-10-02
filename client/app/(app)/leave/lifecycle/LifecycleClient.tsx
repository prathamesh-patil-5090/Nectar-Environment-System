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
import dayjs from "dayjs";
import KpiStat from "@/components/KpiStat";
import { getSession } from "@/lib/auth";
import { getSiteName, sites } from "@/lib/mock-data";
import {
  confirmReturnLifecycle,
  getLifecycleReport,
  lifecycleKindLabel,
  reportCoverDisruption,
  type LifecycleCase,
  type LifecycleKind,
} from "@/lib/leave-lifecycle";
import {
  canConfirmLeaveReturn,
  canManagerDecideLeave,
  canManageRelieverPool,
  normalizeRole,
  scopedSiteId,
} from "@/lib/rbac";
import { TODAY } from "@/lib/shift";
import { nectarColors } from "@/lib/theme";

export default function LeaveLifecycleClient() {
  const { message, modal } = App.useApp();
  const session = getSession();
  const search = useSearchParams();
  const focusLeaveId = search.get("leaveId") ?? undefined;
  const locked = scopedSiteId(session);
  const canReturn = canConfirmLeaveReturn(session);
  const canManager = canManagerDecideLeave(session);
  const canPool = canManageRelieverPool(session);
  const role = normalizeRole(session?.role);

  const [siteId, setSiteId] = useState<string | undefined>(locked);
  const [kind, setKind] = useState<LifecycleKind | "all">("all");
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const report = useMemo(() => {
    void tick;
    return getLifecycleReport({
      siteId,
      asOf: TODAY,
      leaveId: focusLeaveId,
    });
  }, [siteId, tick, focusLeaveId]);

  const rows = useMemo(() => {
    if (kind === "all") return report.cases;
    return report.cases.filter((c) => c.kind === kind);
  }, [report, kind]);

  const actorRole =
    role === "director"
      ? "director"
      : role === "manager"
        ? "manager"
        : role === "supervisor"
          ? "supervisor"
          : "shift_incharge";

  const onReturn = (row: LifecycleCase) => {
    if (!canReturn) {
      message.error("You cannot confirm return.");
      return;
    }
    const isExtension = row.kind === "extension_open";
    if (isExtension && !canManager) {
      message.error("Only Manager or Director can close an extension.");
      return;
    }
    let remark = "";
    let returnDate = dayjs(TODAY);
    modal.confirm({
      title: isExtension
        ? `Close extension — ${row.employeeName}`
        : `Confirm return — ${row.employeeName}`,
      width: 460,
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13, color: nectarColors.muted }}>
            {row.message}
          </p>
          <DatePicker
            defaultValue={returnDate}
            onChange={(d) => {
              if (d) returnDate = d;
            }}
            style={{ width: "100%" }}
          />
          {isExtension || canManager ? (
            <Input.TextArea
              rows={2}
              placeholder={
                isExtension
                  ? "Manager remark (required)"
                  : "Remark (optional)"
              }
              onChange={(e) => {
                remark = e.target.value;
              }}
            />
          ) : null}
        </div>
      ),
      okText: isExtension ? "Close extension" : "Confirm return",
      onOk: () => {
        try {
          confirmReturnLifecycle({
            leaveId: row.leaveId,
            actor: session?.name ?? "User",
            actualReturnDate: returnDate.format("YYYY-MM-DD"),
            remark: remark.trim() || undefined,
            actorRole,
          });
          message.success(
            isExtension ? "Extension closed — cover released." : "Return confirmed.",
          );
          refresh();
        } catch (e) {
          message.error(e instanceof Error ? e.message : "Failed");
          return Promise.reject();
        }
      },
    });
  };

  const onDisrupt = (row: LifecycleCase) => {
    if (!canPool && !canManager) {
      message.error("SIC / Manager can report cover disruption.");
      return;
    }
    let note = "";
    let disruptKind: "no_show" | "became_unavailable" = "no_show";
    modal.confirm({
      title: `Report cover disruption — ${row.employeeName}`,
      width: 460,
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Select
            defaultValue="no_show"
            options={[
              { value: "no_show", label: "Cover no-show" },
              { value: "became_unavailable", label: "Became unavailable" },
            ]}
            onChange={(v) => {
              disruptKind = v as typeof disruptKind;
            }}
          />
          <Input.TextArea
            rows={3}
            placeholder="What happened? (required)"
            onChange={(e) => {
              note = e.target.value;
            }}
          />
        </div>
      ),
      okText: "Report disruption",
      okButtonProps: { danger: true },
      onOk: () => {
        try {
          reportCoverDisruption({
            leaveId: row.leaveId,
            kind: disruptKind,
            note,
            actor: session?.name ?? "User",
          });
          message.warning("Cover released — re-cover via Match / OT Decisions.");
          refresh();
        } catch (e) {
          message.error(e instanceof Error ? e.message : "Failed");
          return Promise.reject();
        }
      },
    });
  };

  const columns: ColumnsType<LifecycleCase> = [
    {
      title: "Case",
      key: "case",
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.title}</div>
          <div style={{ fontSize: 12, color: nectarColors.muted }}>
            {row.message}
          </div>
          {row.softBlock ? (
            <Tag color={nectarColors.alert} style={{ marginTop: 4 }}>
              {row.softBlock}
            </Tag>
          ) : null}
        </div>
      ),
    },
    {
      title: "Kind",
      dataIndex: "kind",
      width: 130,
      render: (k: LifecycleKind) => <Tag>{lifecycleKindLabel(k)}</Tag>,
    },
    {
      title: "Site",
      dataIndex: "siteId",
      width: 110,
      render: (id) => getSiteName(id),
    },
    {
      title: "Expected return",
      dataIndex: "expectedReturnDate",
      width: 120,
    },
    {
      title: "Cover",
      key: "cover",
      width: 140,
      render: (_, row) => row.coverName ?? "—",
    },
    {
      title: "Action",
      key: "action",
      width: 200,
      render: (_, row) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Link href={row.href}>Leave</Link>
          {(row.kind === "due_return" ||
            row.kind === "late_return" ||
            row.kind === "early_return_ready" ||
            row.kind === "extension_open") &&
          canReturn ? (
            <Button type="primary" size="small" onClick={() => onReturn(row)}>
              {row.kind === "extension_open" ? "Close extension" : "Confirm return"}
            </Button>
          ) : null}
          {(row.kind === "active_cover" || row.kind === "extension_open") &&
          (canPool || canManager) ? (
            <Button size="small" danger onClick={() => onDisrupt(row)}>
              Disrupt
            </Button>
          ) : null}
          {row.kind === "cover_disrupted" ? (
            <Link href="/overtime/decisions">OT Decisions</Link>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
          }}
        >
          Leave Lifecycle / Coverage
        </div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted, maxWidth: 740 }}>
          Returns, extensions, emergency paths, and cover disruptions. Late
          return keeps cover until Manager closes the extension; cover no-show
          re-opens the vacancy.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Select
          allowClear={!locked}
          disabled={!!locked}
          placeholder="All sites"
          style={{ minWidth: 180 }}
          value={siteId}
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
          onChange={setSiteId}
        />
        <Select
          style={{ minWidth: 180 }}
          value={kind}
          options={[
            { value: "all", label: "All kinds" },
            { value: "extension_open", label: "Extensions" },
            { value: "due_return", label: "Return due" },
            { value: "late_return", label: "Late / overdue" },
            { value: "active_cover", label: "Active cover" },
            { value: "cover_disrupted", label: "Disrupted" },
            { value: "emergency_open", label: "Emergency" },
            { value: "unexplained", label: "Unexplained" },
          ]}
          onChange={setKind}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <KpiStat label="Extensions" value={report.extensionCount} tone="alert" />
        <KpiStat label="Due / late" value={report.dueReturnCount} />
        <KpiStat label="Disrupted" value={report.disruptedCount} tone="alert" />
        <KpiStat label="Emergency" value={report.emergencyCount} />
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
