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
import {
  acknowledgeContest,
  awardContest,
  contestLabel,
  detectContests,
  type ContestClaim,
  type RelieverContest,
} from "@/lib/reliever-competition";
import {
  assignChosenRelieverForLeave,
  runReplacementFlow,
} from "@/lib/reliever/pool";
import { getLeaveById } from "@/lib/leave/store";
import {
  canManageRelieverPool,
  canResolveRelieverCompetition,
  scopedSiteId,
} from "@/lib/rbac";
import { TODAY } from "@/lib/shift";
import { nectarColors } from "@/lib/theme";
import { tr, trNode, trData, trEnum } from "@/lib/i18n";

export default function RelieverCompetitionPage() {
  const { message, modal } = App.useApp();
  const session = getSession();
  const search = useSearchParams();
  const focusLeaveId = search.get("leaveId") ?? undefined;
  const locked = scopedSiteId(session);
  const canManage = canManageRelieverPool(session);
  const canResolve = canResolveRelieverCompetition(session);

  const [siteId, setSiteId] = useState<string | undefined>(locked);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs(TODAY),
    dayjs(TODAY).add(7, "day"),
  ]);
  const [tick, setTick] = useState(0);
  const [ackRemark, setAckRemark] = useState("");
  const [ackTarget, setAckTarget] = useState<{
    contest: RelieverContest;
    leaveId: string;
  } | null>(null);

  const refresh = () => setTick((t) => t + 1);

  const contests = useMemo(() => {
    void tick;
    let list = detectContests({
      siteId,
      from: range[0].format("YYYY-MM-DD"),
      to: range[1].format("YYYY-MM-DD"),
    });
    if (focusLeaveId) {
      const focused = list.filter((c) =>
        c.claims.some(
          (cl) => cl.leaveId === focusLeaveId || cl.absenceId === focusLeaveId,
        ),
      );
      if (focused.length) list = focused;
    }
    return list;
  }, [siteId, range, tick, focusLeaveId]);

  const claimCount = contests.reduce((n, c) => n + c.claims.length, 0);

  const onAward = (contest: RelieverContest, winnerLeaveId: string) => {
    if (!canResolve) {
      message.error(tr("Only Manager or Director can Award a contested reliever."));
      return;
    }
    modal.confirm({
      title: tr("Award {candidateName}?", { candidateName: trData(contest.candidateName) }),
      content: tr("Assign to the selected request. Other competing requests will need an alternate or OT."),
      okText: tr("Award"),
      onOk: () => {
        try {
          const { contest: updated } = awardContest({
            contestId: contest.id,
            winnerLeaveId,
            candidateId: contest.candidateId,
            actor: session?.name ?? "Manager",
          });

          const leave = getLeaveById(winnerLeaveId);
          if (leave) {
            assignChosenRelieverForLeave(
              {
                leaveId: leave.id,
                employeeId: leave.employeeId,
                employeeName: leave.employeeName,
                siteId: leave.siteId,
                shiftId: leave.shiftId,
                date: leave.startDate,
                reason: leave.reason,
              },
              contest.candidateKind === "employee"
                ? { coverEmployeeId: contest.candidateId }
                : { relieverId: contest.candidateId },
              { competitionCleared: true },
            );
          } else {
            // Pool absence path
            try {
              runReplacementFlow(winnerLeaveId);
            } catch {
              /* absence may already be handled via ack only */
            }
          }

          void updated;
          message.success(tr("{candidateName} awarded.", { candidateName: trData(contest.candidateName) }));
          refresh();
        } catch (e) {
          message.error(e instanceof Error ? trData(e.message) : tr("Award failed"));
        }
      },
    });
  };

  const onAcknowledge = () => {
    if (!ackTarget || !canResolve) return;
    try {
      acknowledgeContest({
        contestId: ackTarget.contest.id,
        leaveId: ackTarget.leaveId,
        candidateId: ackTarget.contest.candidateId,
        actor: session?.name ?? "Manager",
        remark: ackRemark,
      });
      message.success(tr("Acknowledged — SIC can now assign this person."));
      setAckTarget(null);
      setAckRemark("");
      refresh();
    } catch (e) {
      message.error(e instanceof Error ? trData(e.message) : tr("Acknowledge failed"));
    }
  };

  const claimColumns = (
    contest: RelieverContest,
  ): ColumnsType<ContestClaim> => [
    {
      title: tr("Absent"),
      dataIndex: "absentEmployeeName",
      render: (name, row) =>
        row.leaveId ? (
          <Link href={`/leave/requests/${row.leaveId}`}>{trData(name)}</Link>
        ) : (
          name
        ),
    },
    {
      title: tr("Site"),
      dataIndex: "siteId",
      render: (id) => trData(getSiteName(id)),
    },
    {
      title: tr("Date"),
      dataIndex: "date",
      width: 110,
    },
    {
      title: tr("Mode"),
      dataIndex: "mode",
      render: (m) =>
        m ? (
          <Tag color={m === "emergency" ? nectarColors.alert : nectarColors.sky}>
            {trData(m)}
          </Tag>
        ) : (
          "—"
        ),
    },
    {
      title: tr("Shift"),
      key: "shift",
      render: (_, row) => row.shiftCode ?? row.shiftId ?? "—",
    },
    {
      title: tr("Alts"),
      dataIndex: "alternativeCount",
      width: 60,
    },
    {
      title: tr("OT if rejected"),
      key: "ot",
      render: (_, row) =>
        row.otHoursIfRejected
          ? `${row.otHoursIfRejected}h · ₹${row.otCostIfRejected}`
          : "—",
    },
    {
      title: tr("Status"),
      dataIndex: "status",
      render: (s: ContestClaim["status"]) => (
        <Tag
          color={
            s === "awarded"
              ? nectarColors.mint
              : s === "acknowledged"
                ? nectarColors.sky
                : s === "need_alt"
                  ? "#D97706"
                  : nectarColors.alert
          }
        >
          {trEnum(s)}
        </Tag>
      ),
    },
    {
      title: tr("Action"),
      key: "action",
      render: (_, row) => {
        const leaveKey = row.leaveId ?? row.absenceId;
        if (!leaveKey || row.status === "awarded" || row.status === "need_alt") {
          return <span style={{ color: nectarColors.muted }}>—</span>;
        }
        if (!canResolve) {
          return (
            <span style={{ fontSize: 12, color: nectarColors.muted }}>
              {tr("Manager decision")}
            </span>
          );
        }
        return (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              type="primary"
              size="small"
              onClick={() => onAward(contest, leaveKey)}
            >
              {tr("Award")}
            </Button>
            <Button
              size="small"
              onClick={() => {
                setAckTarget({ contest, leaveId: leaveKey });
                setAckRemark("");
              }}
            >
              {tr("Acknowledge")}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: nectarColors.white,
          borderRadius: 12,
          padding: 20,
          border: "1px solid #E2E8F0",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
          }}
        >
          {tr("Reliever Competition")}
        </div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted, maxWidth: 720 }}>
          {tr("Same person claimed by multiple open absences or leaves. Manager Awards one request or Acknowledges so SIC can assign; losers need an alternate or OT. Soft block — not silent first-come.")}
        </p>
        <div style={{ marginTop: 12 }}>
          <Link href="/reliever-pool" style={{ fontSize: 13 }}>
            {tr("← Back to Reliever Pool")}
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Select
          allowClear={!locked}
          disabled={!!locked}
          placeholder={tr("All sites")}
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <KpiStat label={tr("Contested people")} value={String(contests.length)} />
        <KpiStat label={tr("Competing claims")} value={String(claimCount)} />
        <KpiStat
          label={tr("Your role")}
          value={canResolve ? tr("Can Award / Ack") : canManage ? tr("View + assign after Ack") : tr("View")}
        />
      </div>

      {contests.length === 0 ? (
        <div
          style={{
            background: nectarColors.white,
            padding: 24,
            borderRadius: 10,
            color: nectarColors.muted,
          }}
        >
          {tr("No contested relievers in this window. Open overlapping absences that share a top cover candidate will appear here.")}
        </div>
      ) : (
        contests.map((contest) => (
          <div
            key={contest.id}
            style={{
              background: nectarColors.white,
              borderRadius: 10,
              padding: 16,
              border: "1px solid #E2E8F0",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  fontSize: 18,
                }}
              >
                {trData(contest.candidateName)}
              </span>
              <Tag>{trData(contestLabel(contest.kind))}</Tag>
              <Tag>
                {contest.candidateKind === "employee" ? tr("Employee") : tr("Pool")}
              </Tag>
              {contest.siteIds.map((id) => (
                <Tag key={id} color={nectarColors.sky}>
                  {trData(getSiteName(id))}
                </Tag>
              ))}
            </div>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              columns={claimColumns(contest)}
              dataSource={contest.claims}
            />
          </div>
        ))
      )}

      {ackTarget ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11,26,36,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: nectarColors.white,
              borderRadius: 12,
              padding: 20,
              maxWidth: 420,
              width: "100%",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {tr("Acknowledge contested assign")}
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: nectarColors.muted }}>
              {trNode("Clears soft block for {name} on this request only. Other competing leaves stay contested.", { name: <strong>{trData(ackTarget.contest.candidateName)}</strong> })}
            </p>
            <Input.TextArea
              rows={3}
              placeholder={tr("Remark (required)")}
              value={ackRemark}
              onChange={(e) => setAckRemark(e.target.value)}
            />
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <Button
                onClick={() => {
                  setAckTarget(null);
                  setAckRemark("");
                }}
              >
                {tr("Cancel")}
              </Button>
              <Button
                type="primary"
                disabled={!ackRemark.trim()}
                onClick={onAcknowledge}
              >
                {tr("Acknowledge")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
