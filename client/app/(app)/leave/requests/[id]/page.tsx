"use client";

import { use, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  DatePicker,
  Empty,
  Input,
  Modal,
  Radio,
  Space,
  Tag,
  Timeline,
} from "antd";
import { ArrowLeftOutlined, WarningOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import ShiftImpactPanel from "@/components/leave/ShiftImpactPanel";
import SafetyClearanceBanner from "@/components/safety/SafetyClearanceBanner";
import { getSession } from "@/lib/auth";
import { getEmployeeById, getSiteName } from "@/lib/mock-data";
import {
  cancelLeave,
  computeLeaveImpact,
  employeeConsentLeave,
  escalateLeave,
  getLeaveById,
  getPlantOverlappingLeaves,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  managerDecideLeave,
  adminFinalizeLeave,
  rejectLeave,
  siteApprove,
  supervisorVerify,
} from "@/lib/leave";
import {
  confirmReturnLifecycle,
  getLifecycleReport,
  reportCoverDisruption,
} from "@/lib/leave-lifecycle";
import {
  candidateDisplaySource,
  computeShiftImpact,
} from "@/lib/shift-impact";
import {
  assertCanSiteApproveLeave,
  getManpowerConflictReport,
  leaveRequiresCoverChoice,
} from "@/lib/manpower-conflict";
import { pushNotification } from "@/lib/notifications";
import {
  canConfirmLeaveReturn,
  canManagerDecideLeave,
  canAdminFinalizeLeave,
  canManageRelieverPool,
  canSiteApproveLeave,
  canSupervisorVerifyLeave,
  canWithdrawLeaveRequest,
  leaveActorRole,
  normalizeRole,
  scopedEmployeeId,
  scopedSiteId,
  isInChargeOf,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { listReplacementOptions } from "@/lib/reliever/pool";
import {
  detectContests,
  hasCompetitionAck,
} from "@/lib/reliever-competition";
import {
  evaluateOtDecision,
  findClearingOtDecision,
} from "@/lib/ot-decision";
import { rowBetweenWrapGap12, sSerifText18Ink, sSerifText18InkMb122, sSerifText18Mb12, sSerifText26Ink, sWhitePadR10 } from "@/lib/styles";
import type { CSSProperties } from "react";
import { tr, trNode, trData, trEnum } from "@/lib/i18n";

const sText12MutedMt2: CSSProperties = {
  display: "block",
  fontSize: 12,
  color: nectarColors.muted,
  fontWeight: 400,
  marginTop: 2,
};

function InfoTile({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        gridColumn: wide ? "1 / -1" : undefined, padding: "12px 14px", borderRadius: 8, background: nectarColors.sand,
        border: "1px solid rgba(11, 26, 36, 0.06)", minHeight: 64,
      }}
    >
      <div
        style={{ fontSize: 11, letterSpacing: "0.04em", color: nectarColors.muted, marginBottom: 4, fontWeight: 600 }}
      >
        {trData(label)}
      </div>
      <div
        style={{ fontSize: 14, color: nectarColors.ink, fontWeight: 500, lineHeight: 1.45, wordBreak: "break-word" }}
      >
        {children}
      </div>
    </div>
  );
}

export default function LeaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { message } = App.useApp();
  const session = getSession();
  const [tick, setTick] = useState(0);
  const [returnDate, setReturnDate] = useState(dayjs());
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawNote, setWithdrawNote] = useState("");
  const [coverChoice, setCoverChoice] = useState<string>();
  const [otRemark, setOtRemark] = useState("");
  const [extensionRemark, setExtensionRemark] = useState("");

  const leave = useMemo(() => {
    void tick;
    return getLeaveById(id);
  }, [id, tick]);
  const impact = useMemo(() => {
    void tick;
    return leave
      ? computeLeaveImpact(leave.employeeId, leave.startDate, leave.endDate)
      : null;
  }, [leave, tick]);

  const shiftReport = useMemo(() => {
    void tick;
    if (!leave) return null;
    return computeShiftImpact({
      siteId: leave.siteId,
      from: leave.startDate,
      to: leave.endDate,
      focusLeaveId: leave.id,
    });
  }, [leave, tick]);

  const manpowerReport = useMemo(() => {
    void tick;
    if (!leave) return null;
    return getManpowerConflictReport({
      siteId: leave.siteId,
      from: leave.startDate,
      to: leave.endDate,
      focusLeaveId: leave.id,
    });
  }, [leave, tick]);

  const leaveGate = useMemo(() => {
    void tick;
    if (!leave) return null;
    return assertCanSiteApproveLeave(leave.id, {
      relieverId: coverChoice && coverChoice !== "ot" ? coverChoice : undefined,
      otFallback: coverChoice === "ot",
    });
  }, [leave, tick, coverChoice]);

  const needsCoverChoice = useMemo(() => {
    void tick;
    if (!leave) return false;
    return leaveRequiresCoverChoice(leave.id);
  }, [leave, tick]);

  const replacementOptions = useMemo(() => {
    void tick;
    if (!leave) return { local: [], cluster: [] };
    return listReplacementOptions(leave.siteId, { date: leave.startDate, excludeEmployeeId: leave.employeeId });
  }, [leave, tick]);

  const leaveContests = useMemo(() => {
    void tick;
    if (!leave) return [];
    return detectContests({
      siteId: leave.siteId,
      from: leave.startDate,
      to: leave.endDate,
    }).filter((c) =>
      c.claims.some(
        (cl) => cl.leaveId === leave.id || cl.absenceId === leave.id,
      ),
    );
  }, [leave, tick]);

  const otEval = useMemo(() => {
    void tick;
    if (!leave) return null;
    return evaluateOtDecision({
      siteId: leave.siteId,
      date: leave.startDate,
      shiftId: leave.shiftId,
      leaveId: leave.id,
      trigger: "leave_cover",
    });
  }, [leave, tick]);

  const otCleared = useMemo(() => {
    void tick;
    if (!leave) return false;
    return Boolean(
      findClearingOtDecision({
        siteId: leave.siteId,
        date: leave.startDate,
        leaveId: leave.id,
      }),
    );
  }, [leave, tick]);

  const lifecycleCases = useMemo(() => {
    void tick;
    if (!leave) return [];
    return getLifecycleReport({ leaveId: leave.id }).cases;
  }, [leave, tick]);

  const plantOverlaps = useMemo(() => {
    void tick;
    if (!leave) return [];
    return getPlantOverlappingLeaves(leave.id);
  }, [leave, tick]);

  if (!leave || !impact) {
    return (
      <Empty description={tr("Leave request not found")}><Button type="primary" onClick={() => router.push("/leave/requests")}>{tr("Back")}</Button></Empty>
    );
  }

  const siteScope = scopedSiteId(session);
  const empScope = scopedEmployeeId(session);
  if (empScope && leave.employeeId !== empScope) {
    return (
      <Empty description={tr("You can only view your own leave requests.")}><Button type="primary" onClick={() => router.push("/leave/requests")}>{tr("My leave")}</Button></Empty>
    );
  }
  if (siteScope && leave.siteId !== siteScope && !empScope) {
    return (
      <Empty description={tr("This leave request is outside your plant scope.")}><Button type="primary" onClick={() => router.push("/leave/requests")}>{tr("Back")}</Button></Empty>
    );
  }

  const actor = session?.name ?? "User";
  const role = normalizeRole(session?.role);
  // Approvals only on leave of people in your charge — never your own, never a senior's.
  const inCharge = isInChargeOf(session, getEmployeeById(leave.employeeId));
  const canVerify = inCharge && canSupervisorVerifyLeave(session);
  const canSite = inCharge && canSiteApproveLeave(session);
  const canManager = inCharge && canManagerDecideLeave(session);
  const canAdmin = inCharge && canAdminFinalizeLeave(session);
  const canReturn = inCharge && canConfirmLeaveReturn(session);
  const canWithdraw = canWithdrawLeaveRequest(session, leave);
  const actorLeaveRole = leaveActorRole(session);
  /** Only the employee role who owns the leave may consent */
  const canGiveConsent =
    role === "employee" &&
    Boolean(session?.employeeId) &&
    session?.employeeId === leave.employeeId;
  const waitingOnConsent =
    leave.status === "PENDING_EMPLOYEE_CONSENT" && !canGiveConsent;
  const refresh = () => setTick((t) => t + 1);

  const run = (fn: () => void, ok: string) => {
    try {
      fn();
      message.success(ok);
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? trData(err.message) : tr("Action failed"));
    }
  };

  const notifyDecision = (approved: boolean, reason?: string) => {
    pushNotification({
      employeeId: leave.employeeId,
      kind: "leave_decision",
      title: approved ? "Leave approved" : "Leave rejected",
      body: approved
        ? "Your leave {startDate}–{endDate} was approved by {actor}."
        : reason
          ? "Your leave was rejected by {actor}: {reason}"
          : "Your leave was rejected by {actor}.",
      params: { startDate: leave.startDate, endDate: leave.endDate, actor, reason: reason ?? "" },
      href: `/leave/requests/${leave.id}`,
      meta: { leaveId: leave.id },
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push("/leave/requests")}
        style={{ width: "fit-content", paddingInline: 0 }}
      >
        {tr("Leave requests")}
      </Button>

      {!["CLOSED", "REJECTED", "CANCELLED"].includes(leave.status) ? (
        <SafetyClearanceBanner employeeId={leave.employeeId} />
      ) : null}

      <div style={{ background: nectarColors.white, padding: 24, borderRadius: 10 }}>
        <div style={rowBetweenWrapGap12}>
          <div>
            <div style={sSerifText26Ink}>{trData(leave.employeeName)}</div>
            <div style={{ color: nectarColors.muted }}>
              <Link href={`/employees/${leave.employeeId}`}>{leave.employeeId}</Link>
              {" · "}
              {trData(getSiteName(leave.siteId))} · {trData(leave.department)}
            </div>
          </div>
          <Space wrap>
            <Tag color={leave.mode === "emergency" ? nectarColors.alert : nectarColors.sky}>{trData(leave.mode)}</Tag>
            <Tag color={leave.status === "CANCELLED" ? "default" : undefined}>{LEAVE_STATUS_LABELS[leave.status]}</Tag>
            <Tag>
              {leave.entrySource === "supervisor_on_behalf"
                ? tr("Entered by supervisor")
                : tr("Requested by employee")}
            </Tag>
          </Space>
        </div>

        {leave.status === "CANCELLED" ? (
          <div
            style={{
              marginTop: 16, padding: "14px 16px", borderRadius: 8, background: "rgba(74, 99, 117, 0.08)",
              border: "1px solid rgba(74, 99, 117, 0.25)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {tr("Withdrawn")}
              {leave.cancelledByName ? tr(" by {cancelledByName}", { cancelledByName: trData(leave.cancelledByName) }) : ""}
              {leave.cancelledByRole ? ` (${leave.cancelledByRole})` : ""}
            </div>
            <div style={{ fontSize: 13, color: nectarColors.ink }}>{leave.cancellationReason ?? tr("No reason recorded")}</div>
            {leave.cancelledAt ? (
              <div style={{ marginTop: 6, fontSize: 12, color: nectarColors.muted }}>{trData(leave.cancelledAt.slice(0, 16).replace("T", " "))}</div>
            ) : null}
          </div>
        ) : null}

        {leave.policyVerdict === "WARN" && leave.policyFlags?.length ? (
          <div
            style={{
              marginTop: 16, padding: 12, borderRadius: 8, background: "rgba(217, 119, 6, 0.1)",
              border: "1px solid #D97706",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{tr("Policy warnings")}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {leave.policyFlags
                .filter((f) => f.severity === "warn")
                .map((f) => (
                  <li key={f.code + f.message}>{trData(f.message)}</li>
                ))}
            </ul>
            {leave.policySuggestions?.length ? (
              <div style={{ marginTop: 8, fontSize: 12, color: nectarColors.muted }}>{leave.policySuggestions.join(" · ")}</div>
            ) : null}
          </div>
        ) : null}

        <div style={{ marginTop: 22 }}>
          <div style={sSerifText18InkMb122}>{tr("Leave details")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            <InfoTile label={tr("Leave type")}>
              {LEAVE_TYPE_LABELS[leave.leaveType]}
              {leave.isHalfDay
                ? tr(" · Half-day ({halfDaySlot})", { halfDaySlot: leave.halfDaySlot ?? "—" })
                : ""}
            </InfoTile>
            <InfoTile label={tr("Dates")}>
              {leave.startDate} → {leave.endDate}
              <span style={sText12MutedMt2}>{leave.daysRequested === 1 ? tr("{count} day", { count: leave.daysRequested }) : tr("{count} days", { count: leave.daysRequested })}</span>
            </InfoTile>
            <InfoTile label={tr("Expected return")}>{leave.expectedReturnDate}</InfoTile>
            <InfoTile label={tr("Actual return")}>{leave.actualReturnDate ?? "—"}</InfoTile>
            <InfoTile label={tr("Lifecycle")} wide>
              {lifecycleCases.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {lifecycleCases.slice(0, 3).map((c) => (
                    <div key={c.id} style={{ fontSize: 13 }}>
                      <Tag>{trEnum(c.kind)}</Tag> {trData(c.message)}
                    </div>
                  ))}
                  <Link href={`/leave/lifecycle?leaveId=${leave.id}`}>
                    {tr("Open Lifecycle queue")}
                  </Link>
                </div>
              ) : (
                tr("No active lifecycle flags")
              )}
            </InfoTile>
            <InfoTile label={tr("Leave balance")}>{tr("{leaveBalanceDays} days", { leaveBalanceDays: leave.leaveBalanceDays })}</InfoTile>
            <InfoTile label={tr("Supervisor")}>{trData(leave.supervisorName)}</InfoTile>
            <InfoTile label={tr("Shift In-Charge")}>{trData(leave.siteInChargeName)}</InfoTile>
            <InfoTile label={tr("Manager")}>{leave.managerName ?? "—"}</InfoTile>
            <InfoTile label={tr("Entered by")}>
              {trData(leave.enteredByName)}
              <span style={sText12MutedMt2}>{trData(leave.enteredByRole)}</span>
            </InfoTile>
            {leave.employeeConsent ? (
              <InfoTile label={tr("Employee consent")}>
                {trData(leave.employeeConsent)}
                {leave.employeeConsentAt
                  ? ` · ${leave.employeeConsentAt.slice(0, 16).replace("T", " ")}`
                  : ""}
              </InfoTile>
            ) : null}
            {leave.managerDecision ? (
              <InfoTile label={tr("Manager decision")}>
                {trData(leave.managerDecision)}
                {leave.managerDecisionAt
                  ? ` · ${leave.managerDecisionAt.slice(0, 16).replace("T", " ")}`
                  : ""}
              </InfoTile>
            ) : null}
            {leave.rejectionReason ? (
              <InfoTile label={tr("Rejection reason")} wide>{trData(leave.rejectionReason)}</InfoTile>
            ) : null}
            <InfoTile label={tr("Reason")} wide>{trData(leave.reason)}</InfoTile>
            {leave.lastCommunication ? (
              <InfoTile label={tr("Last communication")} wide>{trData(leave.lastCommunication)}</InfoTile>
            ) : null}
            {leave.replacementPlan ? (
              <InfoTile label={tr("Replacement plan")} wide>{trData(leave.replacementPlan)}</InfoTile>
            ) : null}
          </div>
        </div>
      </div>

      {plantOverlaps.length > 0 ? (
        <div
          style={{
            background: nectarColors.white, padding: 20, borderRadius: 10, border: "1px solid rgba(196, 92, 38, 0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
            <WarningOutlined style={{ color: nectarColors.alert, fontSize: 18, marginTop: 2 }} />
            <div>
              <div style={sSerifText18Ink}>{tr("Same-plant date overlap")}</div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: nectarColors.muted, lineHeight: 1.45 }}>
                {tr("{count} other active leave(s) at {site} cover overlapping dates. Review coverage before approving.", { count: plantOverlaps.length, site: trData(getSiteName(leave.siteId)) })}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {plantOverlaps.map((o) => (
              <Link
                key={o.id}
                href={`/leave/requests/${o.id}`}
                style={{
                  display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px", padding: "12px 14px",
                  borderRadius: 8, background: "rgba(196, 92, 38, 0.06)", color: nectarColors.ink,
                  textDecoration: "none",
                }}
              >
                <span style={{ fontWeight: 600, color: nectarColors.leaf }}>{trData(o.employeeName)}</span>
                <span style={{ fontSize: 13 }}>{o.startDate} → {o.endDate}</span>
                <Tag color={o.mode === "emergency" ? nectarColors.alert : nectarColors.sky} style={{ margin: 0 }}>{trData(o.mode)}</Tag>
                <Tag style={{ margin: 0 }}>{LEAVE_STATUS_LABELS[o.status]}</Tag>
                {o.potentialOtHours > 0 ? (
                  <span style={{ fontSize: 12, color: nectarColors.alert, fontWeight: 600 }}>{tr("+{potentialOtHours} hrs OT risk", { potentialOtHours: o.potentialOtHours })}</span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <ShiftImpactPanel impact={impact} report={shiftReport ?? undefined} />

      {manpowerReport && manpowerReport.issues.length > 0 ? (
        <div
          style={{
            background: nectarColors.white,
            padding: 16,
            borderRadius: 10,
            border:
              (leaveGate && !leaveGate.ok) || manpowerReport.attentionCount > 0
                ? "1px solid rgba(196, 92, 38, 0.4)"
                : "1px solid rgba(28, 68, 99, 0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-fraunces), Georgia, serif",
                fontSize: 18,
              }}
            >
              {tr("Manpower conflicts")}
            </div>
            <Space size={4} wrap>
              <Tag color={manpowerReport.attentionCount ? nectarColors.alert : undefined}>
                {tr("{attentionCount} attention", { attentionCount: manpowerReport.attentionCount })}
              </Tag>
              {canSite ? (
                <Tag color={leaveGate?.ok ? nectarColors.mint : nectarColors.alert}>
                  {leaveGate?.ok
                    ? tr("Site-approve clear")
                    : tr("Site-approve blocked")}
                </Tag>
              ) : null}
            </Space>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              color: nectarColors.ink,
              lineHeight: 1.55,
            }}
          >
            {manpowerReport.issues
              .filter((i) => i.severity === "attention" || i.kind === "plant_overlap")
              .slice(0, 8)
              .map((i) => (
                <li key={i.id}>
                  <Tag
                    color={
                      i.severity === "attention" ? nectarColors.alert : "#D97706"
                    }
                    style={{ marginRight: 6 }}
                  >
                    {trEnum(i.kind)}
                  </Tag>
                  {trData(i.message)}
                </li>
              ))}
          </ul>
          {needsCoverChoice && canSite ? (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 12,
                color: nectarColors.muted,
              }}
            >
              {tr("Assign cover or accept OT below before site approval. Leave-on-roster is expected until the leave is approved; rest / double-booking still block and need a schedule edit.")}
            </p>
          ) : null}
        </div>
      ) : null}

      {(() => {
        const awaitingCover = [
          "REQUESTED",
          "ABSENT",
          "SUPERVISOR_VERIFIED",
          "SUPERVISOR_RECORDED",
        ].includes(leave.status);
        const canPick =
          canSite &&
          ["SUPERVISOR_VERIFIED", "SUPERVISOR_RECORDED"].includes(leave.status);
        const assignedName =
          leave.replacementPlan ??
          (leave.assignedCoverEmployeeId
            ? getEmployeeById(leave.assignedCoverEmployeeId)?.name
            : undefined);
        const people = [
          ...replacementOptions.local.map((p) => ({
            ...p,
            label: p.coverSource
              ? candidateDisplaySource(p.coverSource)
              : tr("This site"),
          })),
          ...replacementOptions.cluster.map((p) => ({
            ...p,
            label: p.coverSource
              ? candidateDisplaySource(p.coverSource)
              : p.homeSiteId
                ? tr("Cluster · {siteName}", { siteName: trData(getSiteName(p.homeSiteId)) })
                : tr("Cluster"),
          })),
        ];
        const showPanel =
          awaitingCover ||
          Boolean(leave.replacementPlan) ||
          Boolean(leave.assignedRelieverId) ||
          Boolean(leave.assignedCoverEmployeeId) ||
          canPick;

        if (!showPanel) return null;

        return (
          <div style={sWhitePadR10}>
            <div style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 18, marginBottom: 8 }}>{tr("Replacement")}</div>
            {leave.assignedRelieverId ||
            leave.assignedCoverEmployeeId ||
            leave.replacementPlan ? (
              <p style={{ margin: "0 0 12px", color: nectarColors.ink, fontSize: 14 }}>
                {leave.replacementPlan ??
                  (assignedName
                    ? tr("{assignedName} assigned", { assignedName: trData(assignedName) })
                    : tr("Replacement arranged"))}
              </p>
            ) : (
              <p style={{ margin: "0 0 12px", color: nectarColors.muted, fontSize: 14 }}>
                {canPick
                  ? tr("Choose cover from same-plant employees, cluster employees, or the reliever pool.")
                  : tr("Cover candidates appear once the Shift In-Charge arranges replacement.")}
              </p>
            )}

            {canPick ? (
              <>
                <Radio.Group
                  value={coverChoice}
                  onChange={(e) => setCoverChoice(e.target.value)}
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {people.map((person) => {
                    const contest = leaveContests.find(
                      (c) =>
                        c.candidateId === person.relieverId ||
                        c.employeeId === person.relieverId,
                    );
                    const cleared =
                      contest &&
                      hasCompetitionAck(leave.id, person.relieverId);
                    return (
                      <Radio key={person.relieverId} value={person.relieverId}>
                        {trData(person.name)} · {trData(person.label)}
                        {person.kind === "employee" ? tr(" · employee") : tr(" · pool")}
                        {person.phone ? ` · ${person.phone}` : ""}
                        {contest ? (
                          <Tag
                            color={cleared ? nectarColors.sky : nectarColors.alert}
                            style={{ marginLeft: 8 }}
                          >
                            {cleared
                              ? tr("Contested · acknowledged")
                              : tr("Contested — needs Manager")}
                          </Tag>
                        ) : null}
                      </Radio>
                    );
                  })}
                  <Radio value="ot">
                    {tr("No one — accept overtime")}
                    {otEval?.needsManagerRemark && !otCleared ? (
                      <Tag color={nectarColors.alert} style={{ marginLeft: 8 }}>
                        {tr("Needs Manager OT decision")}
                      </Tag>
                    ) : null}
                    {otCleared ? (
                      <Tag color={nectarColors.mint} style={{ marginLeft: 8 }}>
                        {tr("OT approved")}
                      </Tag>
                    ) : null}
                  </Radio>
                </Radio.Group>
                {coverChoice === "ot" && otEval ? (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 12,
                      borderRadius: 8,
                      background: nectarColors.sand,
                      fontSize: 13,
                    }}
                  >
                    <div>
                      {otEval.hours}h · ₹{otEval.cost}
                      {otEval.flags.length
                        ? ` · ${otEval.flags.map((f) => trEnum(f)).join(", ")}`
                        : ""}
                    </div>
                    <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>
                      {trData(otEval.message)}{" "}
                      <Link href={`/overtime/decisions?leaveId=${leave.id}`}>
                        {tr("OT Decisions")}
                      </Link>
                    </p>
                    {canManager && otEval.needsManagerRemark && !otCleared ? (
                      <Input.TextArea
                        style={{ marginTop: 8 }}
                        rows={2}
                        placeholder={tr("Manager remark to clear OT soft block")}
                        value={otRemark}
                        onChange={(e) => setOtRemark(e.target.value)}
                      />
                    ) : null}
                  </div>
                ) : null}
                {leaveContests.length > 0 ? (
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: 12,
                      color: nectarColors.muted,
                    }}
                  >
                    {trNode("Contested cover must be Awarded or Acknowledged on {link} before Cover this shift succeeds.", {
                      link: (
                        <Link href={`/reliever-pool/competition?leaveId=${leave.id}`}>
                          {tr("Reliever Competition")}
                        </Link>
                      ),
                    })}
                  </p>
                ) : null}
                <Space wrap style={{ marginTop: 12 }}>
                  <Button
                    type="primary"
                    disabled={!coverChoice}
                    onClick={() => {
                      if (!coverChoice) return;
                      const otActorRole =
                        role === "director"
                          ? "director"
                          : role === "manager"
                            ? "manager"
                            : "sic";
                      run(
                        () =>
                          siteApprove(
                            leave.id,
                            actor,
                            coverChoice === "ot"
                              ? {
                                  otFallback: true,
                                  otRemark:
                                    canManager && otRemark.trim()
                                      ? otRemark.trim()
                                      : undefined,
                                  otActorRole,
                                }
                              : { relieverId: coverChoice },
                          ),
                        coverChoice === "ot"
                          ? tr("Covered with overtime")
                          : tr("Cover arranged"),
                      );
                    }}
                  >
                    {tr("Cover this shift")}
                  </Button>
                  <Button
                    danger
                    onClick={() => {
                      setRejectNote("");
                      setRejectOpen(true);
                    }}
                  >
                    {tr("Reject")}
                  </Button>
                  <Button
                    onClick={() =>
                      run(
                        () =>
                          escalateLeave(
                            leave.id,
                            actor,
                            "Escalated for manpower / OT review",
                          ),
                        tr("Escalated"),
                      )
                    }
                  >
                    {tr("Escalate")}
                  </Button>
                </Space>
              </>
            ) : people.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: nectarColors.ink, fontSize: 14, lineHeight: 1.7 }}>
                {people.slice(0, 8).map((person) => (
                  <li key={person.relieverId}>
                    {trData(person.name)} · {trData(person.label)}
                    {person.kind === "employee" ? tr(" · employee") : tr(" · pool")}
                    {person.phone ? ` · ${person.phone}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>{tr("No available cover candidates — overtime may be needed.")}</p>
            )}
          </div>
        );
      })()}

      <div style={sWhitePadR10}>
        <div style={sSerifText18Mb12}>{tr("Actions")}</div>
        {waitingOnConsent ? (
          <p style={{ margin: "0 0 12px", color: nectarColors.muted, fontSize: 14 }}>
            {trNode("Waiting for {name} to approve or reject this on-behalf request. Manager approval unlocks only after they consent. Ask them to sign in as the employee and open this leave (or their Notifications inbox).", { name: <strong>{trData(leave.employeeName)}</strong> })}
          </p>
        ) : null}
        {canGiveConsent && leave.status === "PENDING_EMPLOYEE_CONSENT" ? (
          <p style={{ margin: "0 0 12px", color: nectarColors.muted, fontSize: 14 }}>
            {tr("Your supervisor submitted this leave for you. Approve to send it to your supervisor for verification, or reject to stop it here.")}
          </p>
        ) : null}
        {(() => {
          const showConsent =
            canGiveConsent && leave.status === "PENDING_EMPLOYEE_CONSENT";
          const showVerify =
            canVerify && ["REQUESTED", "ABSENT"].includes(leave.status);
          const showSite =
            canSite &&
            ["SUPERVISOR_VERIFIED", "SUPERVISOR_RECORDED"].includes(
              leave.status,
            );
          const showManager =
            canManager &&
            ["SITE_APPROVED", "SITE_VERIFIED"].includes(leave.status);
          const showAdmin =
            canAdmin && leave.status === "MANAGER_APPROVED";
          const showReturn =
            canReturn &&
            leave.status === "APPROVED";
          const showCloseExtension =
            canManager && leave.status === "EXTENSION_REQUIRED";
          const showDisrupt =
            (canManager || canManageRelieverPool(session)) &&
            ["APPROVED", "EXTENSION_REQUIRED"].includes(leave.status) &&
            Boolean(
              leave.assignedRelieverId ||
                leave.assignedCoverEmployeeId ||
                leave.coverSource === "ot_fallback",
            );
          const showReject =
            (canVerify && ["REQUESTED", "ABSENT"].includes(leave.status)) ||
            (canSite &&
              ["SUPERVISOR_VERIFIED", "SUPERVISOR_RECORDED"].includes(
                leave.status,
              )) ||
            (canManager &&
              ["SITE_APPROVED", "SITE_VERIFIED"].includes(leave.status)) ||
            (canAdmin && leave.status === "MANAGER_APPROVED");
          const showWithdraw = canWithdraw;
          const hasButtons =
            showConsent ||
            showVerify ||
            showSite ||
            showManager ||
            showAdmin ||
            showReturn ||
            showCloseExtension ||
            showDisrupt ||
            showReject ||
            showWithdraw;

          if (!hasButtons && !waitingOnConsent) {
            let statusNote = tr("No actions available for your role on this leave.");
            if (canGiveConsent && leave.status === "REQUESTED") {
              statusNote =
                tr("You approved consent. This leave is now with your supervisor to verify.");
            } else if (leave.status === "APPROVED") {
              statusNote = tr("Leave is approved. Confirm return when you are back on duty (supervisor/manager).");
            } else if (leave.status === "REJECTED") {
              statusNote = leave.rejectionReason
                ? tr("Leave rejected: {rejectionReason}", { rejectionReason: trData(leave.rejectionReason) })
                : tr("Leave was rejected. No further action needed.");
            } else if (leave.status === "CANCELLED") {
              statusNote = leave.cancellationReason
                ? tr("Leave withdrawn: {cancellationReason}", { cancellationReason: trData(leave.cancellationReason) })
                : tr("Leave was withdrawn. Kept on record for ops visibility.");
            } else if (leave.status === "CLOSED") {
              statusNote = tr("Leave closed — return confirmed.");
            } else if (
              canGiveConsent &&
              leave.status === "PENDING_EMPLOYEE_CONSENT"
            ) {
              statusNote = "";
            }
            return statusNote ? (
              <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>{trData(statusNote)}</p>
            ) : null;
          }

          const rejectBtn = showReject ? (
            <Button
              danger
              onClick={() => {
                setRejectNote("");
                setRejectOpen(true);
              }}
            >
              {tr("Reject")}
            </Button>
          ) : null;

          const withdrawBtn = showWithdraw ? (
            <Button
              danger
              ghost
              onClick={() => {
                setWithdrawNote("");
                setWithdrawOpen(true);
              }}
            >
              {tr("Withdraw leave")}
            </Button>
          ) : null;

          return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Space wrap>
          {showConsent ? (
            <>
              <Button
                type="primary"
                onClick={() =>
                  run(() => {
                    employeeConsentLeave(leave.id, actor, "approved");
                    if (leave.submittedByEmployeeId) {
                      pushNotification({
                        employeeId: leave.submittedByEmployeeId,
                        kind: "leave_decision",
                        title: "Employee approved leave consent",
                        body: "{employeeName} approved the on-behalf leave — pending supervisor verification.",
                        params: { employeeName: leave.employeeName },
                        href: `/leave/requests/${leave.id}`,
                      });
                    }
                  }, tr("Consent approved — sent to supervisor"))
                }
              >
                {tr("Approve — send to supervisor")}
              </Button>
              <Button
                danger
                onClick={() => {
                  setRejectNote("");
                  setRejectOpen(true);
                }}
              >
                {tr("Reject — do not proceed")}
              </Button>
            </>
          ) : null}

          {showVerify ? (
            <Button
              type="primary"
              onClick={() =>
                run(() => supervisorVerify(leave.id, actor), tr("Supervisor verified"))
              }
            >
              {tr("Supervisor verify")}
            </Button>
          ) : null}

          {showManager ? (
            <Button
              type="primary"
              onClick={() =>
                run(() => {
                  managerDecideLeave(leave.id, actor, "approved");
                }, tr("Manager approved — sent to Director"))
              }
            >
              {tr("Manager approve")}
            </Button>
          ) : null}

          {showAdmin ? (
            <Button
              type="primary"
              onClick={() =>
                run(() => {
                  adminFinalizeLeave(leave.id, actor, "approved");
                  notifyDecision(true);
                }, tr("Leave approved by Director"))
              }
            >
              {tr("Director approve")}
            </Button>
          ) : null}

          {rejectBtn}
          {withdrawBtn}

          {showReturn ? (
            <>
              <DatePicker value={returnDate} onChange={(d) => d && setReturnDate(d)} />
              <Button
                onClick={() =>
                  run(
                    () =>
                      confirmReturnLifecycle({
                        leaveId: leave.id,
                        actor,
                        actualReturnDate: returnDate.format("YYYY-MM-DD"),
                        actorRole:
                          role === "director"
                            ? "director"
                            : role === "manager"
                              ? "manager"
                              : role === "supervisor"
                                ? "supervisor"
                                : "shift_incharge",
                      }),
                    tr("Return recorded"),
                  )
                }
              >
                {tr("Confirm return to duty")}
              </Button>
            </>
          ) : null}
          {showCloseExtension ? (
            <>
              <DatePicker value={returnDate} onChange={(d) => d && setReturnDate(d)} />
              <Input.TextArea
                rows={2}
                placeholder={tr("Manager remark to close extension (required)")}
                value={extensionRemark}
                onChange={(e) => setExtensionRemark(e.target.value)}
                style={{ minWidth: 220 }}
              />
              <Button
                type="primary"
                onClick={() =>
                  run(
                    () =>
                      confirmReturnLifecycle({
                        leaveId: leave.id,
                        actor,
                        actualReturnDate: returnDate.format("YYYY-MM-DD"),
                        remark: extensionRemark,
                        actorRole: role === "director" ? "director" : "manager",
                      }),
                    tr("Extension closed"),
                  )
                }
              >
                {tr("Close extension")}
              </Button>
            </>
          ) : null}
          {showDisrupt ? (
            <Button
              danger
              onClick={() => {
                const note = window.prompt(tr("Cover disruption note (required)"));
                if (!note?.trim()) return;
                run(
                  () =>
                    reportCoverDisruption({
                      leaveId: leave.id,
                      kind: "no_show",
                      note: note.trim(),
                      actor,
                    }),
                  tr("Cover disruption recorded"),
                );
              }}
            >
              {tr("Report cover no-show")}
            </Button>
          ) : null}
          </Space>

          {showSite ? (
            <p style={{ margin: 0, color: nectarColors.muted, fontSize: 13 }}>
              {trNode("Use the {section} section above to choose who covers this shift.", { section: <strong>{tr("Replacement")}</strong> })}
            </p>
          ) : null}
        </div>
          );
        })()}
      </div>

      <div style={sWhitePadR10}>
        <div style={sSerifText18Mb12}>{tr("Workflow timeline")}</div>
        <Timeline
          items={leave.timeline.map((t) => ({
            color: nectarColors.leaf,
            content: (
              <div>
                <div style={{ fontWeight: 600 }}>
                  {trData(t.action)}{" "}
                  <span style={{ color: nectarColors.muted, fontWeight: 400 }}>· {trData(t.actor)} ({trData(t.role)})</span>
                </div>
                {t.note ? (
                  <div style={{ fontSize: 12, color: nectarColors.muted }}>{trData(t.note)}</div>
                ) : null}
                <div style={{ fontSize: 11, color: nectarColors.muted }}>{trData(t.at.slice(0, 16).replace("T", " "))}</div>
              </div>
            ),
          }))}
        />
      </div>

      <Modal
        title={
          leave.status === "PENDING_EMPLOYEE_CONSENT"
            ? tr("Reject leave consent")
            : tr("Reject leave")
        }
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => {
          const note = rejectNote.trim();
          if (leave.status === "PENDING_EMPLOYEE_CONSENT" && canGiveConsent) {
            run(() => {
              employeeConsentLeave(
                leave.id,
                actor,
                "rejected",
                note || "Employee rejected consent",
              );
              if (leave.submittedByEmployeeId) {
                pushNotification({
                  employeeId: leave.submittedByEmployeeId,
                  kind: "leave_decision",
                  title: "Employee rejected leave consent",
                  body: "{employeeName} rejected the on-behalf request. It will not go to the manager.",
                  params: { employeeName: leave.employeeName },
                  href: `/leave/requests/${leave.id}`,
                });
              }
            }, tr("Consent rejected — request stopped"));
            setRejectOpen(false);
            return;
          }
          if (!note) {
            message.error(tr("Add a remark before rejecting"));
            return;
          }
          const role =
            leave.status === "MANAGER_APPROVED"
              ? "director"
              : leave.status === "SITE_APPROVED" || leave.status === "SITE_VERIFIED"
                ? "management"
                : leave.status === "SUPERVISOR_VERIFIED" ||
                    leave.status === "SUPERVISOR_RECORDED"
                  ? "site_incharge"
                  : "supervisor";
          run(() => {
            rejectLeave(leave.id, actor, note, role);
            notifyDecision(false, note);
          }, tr("Leave rejected"));
          setRejectOpen(false);
        }}
        okText={tr("Reject")}
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          rows={3}
          placeholder={tr("Remark — why this leave is rejected")}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
        />
      </Modal>

      <Modal
        title={tr("Withdraw leave request")}
        open={withdrawOpen}
        onCancel={() => setWithdrawOpen(false)}
        onOk={() => {
          const note = withdrawNote.trim();
          if (!note) {
            message.error(tr("Add a reason before withdrawing"));
            return;
          }
          run(() => {
            cancelLeave(leave.id, actor, note, actorLeaveRole);
            const emp = getEmployeeById(leave.employeeId);
            const notifyIds = new Set<string>();
            if (emp?.supervisorId) notifyIds.add(emp.supervisorId);
            if (emp?.managerId) notifyIds.add(emp.managerId);
            if (emp?.shiftInChargeId) notifyIds.add(emp.shiftInChargeId);
            if (leave.submittedByEmployeeId) {
              notifyIds.add(leave.submittedByEmployeeId);
            }
            notifyIds.delete(leave.employeeId);
            for (const employeeId of notifyIds) {
              pushNotification({
                employeeId,
                kind: "leave_decision",
                title: "Leave withdrawn",
                body: "{employeeName} withdrew leave {startDate}–{endDate}: {note}",
                params: { employeeName: leave.employeeName, startDate: leave.startDate, endDate: leave.endDate, note },
                href: `/leave/requests/${leave.id}`,
                meta: { leaveId: leave.id },
              });
            }
          }, tr("Leave withdrawn — still visible to ops"));
          setWithdrawOpen(false);
        }}
        okText={tr("Withdraw")}
        okButtonProps={{ danger: true }}
      >
        <p style={{ margin: "0 0 10px", fontSize: 13, color: nectarColors.muted }}>
          {tr("This does not permanently delete the request. Supervisors and managers will still see it as withdrawn, with your reason. Withdrawal is not allowed after site approval or escalation.")}
        </p>
        <Input.TextArea
          rows={3}
          placeholder={tr("Reason for withdrawing this leave")}
          value={withdrawNote}
          onChange={(e) => setWithdrawNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}
