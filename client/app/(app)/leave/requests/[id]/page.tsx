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
import { getSession } from "@/lib/auth";
import { getEmployeeById, getSiteName } from "@/lib/mock-data";
import {
  cancelLeave,
  computeLeaveImpact,
  confirmReturn,
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
  candidateDisplaySource,
  computeShiftImpact,
} from "@/lib/shift-impact";
import { pushNotification } from "@/lib/notifications";
import {
  canConfirmLeaveReturn,
  canManagerDecideLeave,
  canAdminFinalizeLeave,
  canSiteApproveLeave,
  canSupervisorVerifyLeave,
  canWithdrawLeaveRequest,
  leaveActorRole,
  normalizeRole,
  scopedEmployeeId,
  scopedSiteId,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { listReplacementOptions } from "@/lib/reliever/pool";
import { rowBetweenWrapGap12, sSerifText18Ink, sSerifText18InkMb122, sSerifText18Mb12, sSerifText26Ink, sWhitePadR10 } from "@/lib/styles";
import type { CSSProperties } from "react";

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
        {label}
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

  const replacementOptions = useMemo(() => {
    void tick;
    if (!leave) return { local: [], cluster: [] };
    return listReplacementOptions(leave.siteId, { date: leave.startDate, excludeEmployeeId: leave.employeeId });
  }, [leave, tick]);

  const plantOverlaps = useMemo(() => {
    void tick;
    if (!leave) return [];
    return getPlantOverlappingLeaves(leave.id);
  }, [leave, tick]);

  if (!leave || !impact) {
    return (
      <Empty description="Leave request not found"><Button type="primary" onClick={() => router.push("/leave/requests")}>Back</Button></Empty>
    );
  }

  const siteScope = scopedSiteId(session);
  const empScope = scopedEmployeeId(session);
  if (empScope && leave.employeeId !== empScope) {
    return (
      <Empty description="You can only view your own leave requests."><Button type="primary" onClick={() => router.push("/leave/requests")}>My leave</Button></Empty>
    );
  }
  if (siteScope && leave.siteId !== siteScope && !empScope) {
    return (
      <Empty description="This leave request is outside your plant scope."><Button type="primary" onClick={() => router.push("/leave/requests")}>Back</Button></Empty>
    );
  }

  const actor = session?.name ?? "User";
  const role = normalizeRole(session?.role);
  const canVerify = canSupervisorVerifyLeave(session);
  const canSite = canSiteApproveLeave(session);
  const canManager = canManagerDecideLeave(session);
  const canAdmin = canAdminFinalizeLeave(session);
  const canReturn = canConfirmLeaveReturn(session);
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
      message.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const notifyDecision = (approved: boolean, reason?: string) => {
    pushNotification({
      employeeId: leave.employeeId,
      kind: "leave_decision",
      title: approved ? "Leave approved" : "Leave rejected",
      body: approved
        ? `Your leave ${leave.startDate}–${leave.endDate} was approved by ${actor}.`
        : `Your leave was rejected by ${actor}${reason ? `: ${reason}` : "."}`,
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
        Leave requests
      </Button>

      <div style={{ background: nectarColors.white, padding: 24, borderRadius: 10 }}>
        <div style={rowBetweenWrapGap12}>
          <div>
            <div style={sSerifText26Ink}>{leave.employeeName}</div>
            <div style={{ color: nectarColors.muted }}>
              <Link href={`/employees/${leave.employeeId}`}>{leave.employeeId}</Link>
              {" · "}
              {getSiteName(leave.siteId)} · {leave.department}
            </div>
          </div>
          <Space wrap>
            <Tag color={leave.mode === "emergency" ? nectarColors.alert : nectarColors.sky}>{leave.mode}</Tag>
            <Tag color={leave.status === "CANCELLED" ? "default" : undefined}>{LEAVE_STATUS_LABELS[leave.status]}</Tag>
            <Tag>
              {leave.entrySource === "supervisor_on_behalf"
                ? "Entered by supervisor"
                : "Requested by employee"}
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
              Withdrawn
              {leave.cancelledByName ? ` by ${leave.cancelledByName}` : ""}
              {leave.cancelledByRole ? ` (${leave.cancelledByRole})` : ""}
            </div>
            <div style={{ fontSize: 13, color: nectarColors.ink }}>{leave.cancellationReason ?? "No reason recorded"}</div>
            {leave.cancelledAt ? (
              <div style={{ marginTop: 6, fontSize: 12, color: nectarColors.muted }}>{leave.cancelledAt.slice(0, 16).replace("T", " ")}</div>
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
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Policy warnings</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {leave.policyFlags
                .filter((f) => f.severity === "warn")
                .map((f) => (
                  <li key={f.code + f.message}>{f.message}</li>
                ))}
            </ul>
            {leave.policySuggestions?.length ? (
              <div style={{ marginTop: 8, fontSize: 12, color: nectarColors.muted }}>{leave.policySuggestions.join(" · ")}</div>
            ) : null}
          </div>
        ) : null}

        <div style={{ marginTop: 22 }}>
          <div style={sSerifText18InkMb122}>Leave details</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            <InfoTile label="Leave type">
              {LEAVE_TYPE_LABELS[leave.leaveType]}
              {leave.isHalfDay
                ? ` · Half-day (${leave.halfDaySlot ?? "—"})`
                : ""}
            </InfoTile>
            <InfoTile label="Dates">
              {leave.startDate} → {leave.endDate}
              <span style={sText12MutedMt2}>{leave.daysRequested} day{leave.daysRequested === 1 ? "" : "s"}</span>
            </InfoTile>
            <InfoTile label="Expected return">{leave.expectedReturnDate}</InfoTile>
            <InfoTile label="Actual return">{leave.actualReturnDate ?? "—"}</InfoTile>
            <InfoTile label="Leave balance">{leave.leaveBalanceDays} days</InfoTile>
            <InfoTile label="Supervisor">{leave.supervisorName}</InfoTile>
            <InfoTile label="Shift In-Charge">{leave.siteInChargeName}</InfoTile>
            <InfoTile label="Manager">{leave.managerName ?? "—"}</InfoTile>
            <InfoTile label="Entered by">
              {leave.enteredByName}
              <span style={sText12MutedMt2}>{leave.enteredByRole}</span>
            </InfoTile>
            {leave.employeeConsent ? (
              <InfoTile label="Employee consent">
                {leave.employeeConsent}
                {leave.employeeConsentAt
                  ? ` · ${leave.employeeConsentAt.slice(0, 16).replace("T", " ")}`
                  : ""}
              </InfoTile>
            ) : null}
            {leave.managerDecision ? (
              <InfoTile label="Manager decision">
                {leave.managerDecision}
                {leave.managerDecisionAt
                  ? ` · ${leave.managerDecisionAt.slice(0, 16).replace("T", " ")}`
                  : ""}
              </InfoTile>
            ) : null}
            {leave.rejectionReason ? (
              <InfoTile label="Rejection reason" wide>{leave.rejectionReason}</InfoTile>
            ) : null}
            <InfoTile label="Reason" wide>{leave.reason}</InfoTile>
            {leave.lastCommunication ? (
              <InfoTile label="Last communication" wide>{leave.lastCommunication}</InfoTile>
            ) : null}
            {leave.replacementPlan ? (
              <InfoTile label="Replacement plan" wide>{leave.replacementPlan}</InfoTile>
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
              <div style={sSerifText18Ink}>Same-plant date overlap</div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: nectarColors.muted, lineHeight: 1.45 }}>
                {plantOverlaps.length} other active leave
                {plantOverlaps.length === 1 ? "" : "s"} at{" "}
                {getSiteName(leave.siteId)} cover overlapping dates. Review
                coverage before approving.
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
                <span style={{ fontWeight: 600, color: nectarColors.leaf }}>{o.employeeName}</span>
                <span style={{ fontSize: 13 }}>{o.startDate} → {o.endDate}</span>
                <Tag color={o.mode === "emergency" ? nectarColors.alert : nectarColors.sky} style={{ margin: 0 }}>{o.mode}</Tag>
                <Tag style={{ margin: 0 }}>{LEAVE_STATUS_LABELS[o.status]}</Tag>
                {o.potentialOtHours > 0 ? (
                  <span style={{ fontSize: 12, color: nectarColors.alert, fontWeight: 600 }}>+{o.potentialOtHours} hrs OT risk</span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <ShiftImpactPanel impact={impact} report={shiftReport ?? undefined} />

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
              : "This site",
          })),
          ...replacementOptions.cluster.map((p) => ({
            ...p,
            label: p.coverSource
              ? candidateDisplaySource(p.coverSource)
              : p.homeSiteId
                ? `Cluster · ${getSiteName(p.homeSiteId)}`
                : "Cluster",
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
            <div style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 18, marginBottom: 8 }}>Replacement</div>
            {leave.assignedRelieverId ||
            leave.assignedCoverEmployeeId ||
            leave.replacementPlan ? (
              <p style={{ margin: "0 0 12px", color: nectarColors.ink, fontSize: 14 }}>
                {leave.replacementPlan ??
                  (assignedName
                    ? `${assignedName} assigned`
                    : "Replacement arranged")}
              </p>
            ) : (
              <p style={{ margin: "0 0 12px", color: nectarColors.muted, fontSize: 14 }}>
                {canPick
                  ? "Choose cover from same-plant employees, cluster employees, or the reliever pool."
                  : "Cover candidates appear once the Shift In-Charge arranges replacement."}
              </p>
            )}

            {canPick ? (
              <>
                <Radio.Group
                  value={coverChoice}
                  onChange={(e) => setCoverChoice(e.target.value)}
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {people.map((person) => (
                    <Radio key={person.relieverId} value={person.relieverId}>
                      {person.name} · {person.label}
                      {person.kind === "employee" ? " · employee" : " · pool"}
                      {person.phone ? ` · ${person.phone}` : ""}
                    </Radio>
                  ))}
                  <Radio value="ot">No one — accept overtime</Radio>
                </Radio.Group>
                <Space wrap style={{ marginTop: 12 }}>
                  <Button
                    type="primary"
                    disabled={!coverChoice}
                    onClick={() => {
                      if (!coverChoice) return;
                      run(
                        () =>
                          siteApprove(
                            leave.id,
                            actor,
                            coverChoice === "ot"
                              ? { otFallback: true }
                              : { relieverId: coverChoice },
                          ),
                        coverChoice === "ot"
                          ? "Covered with overtime"
                          : "Cover arranged",
                      );
                    }}
                  >
                    Cover this shift
                  </Button>
                  <Button
                    danger
                    onClick={() => {
                      setRejectNote("");
                      setRejectOpen(true);
                    }}
                  >
                    Reject
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
                        "Escalated",
                      )
                    }
                  >
                    Escalate
                  </Button>
                </Space>
              </>
            ) : people.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: nectarColors.ink, fontSize: 14, lineHeight: 1.7 }}>
                {people.slice(0, 8).map((person) => (
                  <li key={person.relieverId}>
                    {person.name} · {person.label}
                    {person.kind === "employee" ? " · employee" : " · pool"}
                    {person.phone ? ` · ${person.phone}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>No available cover candidates — overtime may be needed.</p>
            )}
          </div>
        );
      })()}

      <div style={sWhitePadR10}>
        <div style={sSerifText18Mb12}>Actions</div>
        {waitingOnConsent ? (
          <p style={{ margin: "0 0 12px", color: nectarColors.muted, fontSize: 14 }}>
            Waiting for <strong>{leave.employeeName}</strong> to approve or reject
            this on-behalf request. Manager approval unlocks only after they
            consent. Ask them to sign in as the employee and open this leave
            (or their Notifications inbox).
          </p>
        ) : null}
        {canGiveConsent && leave.status === "PENDING_EMPLOYEE_CONSENT" ? (
          <p style={{ margin: "0 0 12px", color: nectarColors.muted, fontSize: 14 }}>
            Your supervisor submitted this leave for you. Approve to send it
            to your supervisor for verification, or reject to stop it here.
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
            ["APPROVED", "EXTENSION_REQUIRED"].includes(leave.status);
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
            showReject ||
            showWithdraw;

          if (!hasButtons && !waitingOnConsent) {
            let statusNote = "No actions available for your role on this leave.";
            if (canGiveConsent && leave.status === "REQUESTED") {
              statusNote =
                "You approved consent. This leave is now with your supervisor to verify.";
            } else if (leave.status === "APPROVED") {
              statusNote = "Leave is approved. Confirm return when you are back on duty (supervisor/manager).";
            } else if (leave.status === "REJECTED") {
              statusNote = leave.rejectionReason
                ? `Leave rejected: ${leave.rejectionReason}`
                : "Leave was rejected. No further action needed.";
            } else if (leave.status === "CANCELLED") {
              statusNote = leave.cancellationReason
                ? `Leave withdrawn: ${leave.cancellationReason}`
                : "Leave was withdrawn. Kept on record for ops visibility.";
            } else if (leave.status === "CLOSED") {
              statusNote = "Leave closed — return confirmed.";
            } else if (
              canGiveConsent &&
              leave.status === "PENDING_EMPLOYEE_CONSENT"
            ) {
              statusNote = "";
            }
            return statusNote ? (
              <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>{statusNote}</p>
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
              Reject
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
              Withdraw leave
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
                        body: `${leave.employeeName} approved the on-behalf leave — pending supervisor verification.`,
                        href: `/leave/requests/${leave.id}`,
                      });
                    }
                  }, "Consent approved — sent to supervisor")
                }
              >
                Approve — send to supervisor
              </Button>
              <Button
                danger
                onClick={() => {
                  setRejectNote("");
                  setRejectOpen(true);
                }}
              >
                Reject — do not proceed
              </Button>
            </>
          ) : null}

          {showVerify ? (
            <Button
              type="primary"
              onClick={() =>
                run(() => supervisorVerify(leave.id, actor), "Supervisor verified")
              }
            >
              Supervisor verify
            </Button>
          ) : null}

          {showManager ? (
            <Button
              type="primary"
              onClick={() =>
                run(() => {
                  managerDecideLeave(leave.id, actor, "approved");
                }, "Manager approved — sent to Director")
              }
            >
              Manager approve
            </Button>
          ) : null}

          {showAdmin ? (
            <Button
              type="primary"
              onClick={() =>
                run(() => {
                  adminFinalizeLeave(leave.id, actor, "approved");
                  notifyDecision(true);
                }, "Leave approved by Director")
              }
            >
              Director approve
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
                      confirmReturn(
                        leave.id,
                        actor,
                        returnDate.format("YYYY-MM-DD"),
                      ),
                    "Return recorded",
                  )
                }
              >
                Confirm return to duty
              </Button>
            </>
          ) : null}
          </Space>

          {showSite ? (
            <p style={{ margin: 0, color: nectarColors.muted, fontSize: 13 }}>
              Use the <strong>Replacement</strong> section above to choose who
              covers this shift.
            </p>
          ) : null}
        </div>
          );
        })()}
      </div>

      <div style={sWhitePadR10}>
        <div style={sSerifText18Mb12}>Workflow timeline</div>
        <Timeline
          items={leave.timeline.map((t) => ({
            color: nectarColors.leaf,
            content: (
              <div>
                <div style={{ fontWeight: 600 }}>
                  {t.action}{" "}
                  <span style={{ color: nectarColors.muted, fontWeight: 400 }}>· {t.actor} ({t.role})</span>
                </div>
                {t.note ? (
                  <div style={{ fontSize: 12, color: nectarColors.muted }}>{t.note}</div>
                ) : null}
                <div style={{ fontSize: 11, color: nectarColors.muted }}>{t.at.slice(0, 16).replace("T", " ")}</div>
              </div>
            ),
          }))}
        />
      </div>

      <Modal
        title={
          leave.status === "PENDING_EMPLOYEE_CONSENT"
            ? "Reject leave consent"
            : "Reject leave"
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
                  body: `${leave.employeeName} rejected the on-behalf request. It will not go to the manager.`,
                  href: `/leave/requests/${leave.id}`,
                });
              }
            }, "Consent rejected — request stopped");
            setRejectOpen(false);
            return;
          }
          if (!note) {
            message.error("Add a remark before rejecting");
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
          }, "Leave rejected");
          setRejectOpen(false);
        }}
        okText="Reject"
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          rows={3}
          placeholder="Remark — why this leave is rejected"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
        />
      </Modal>

      <Modal
        title="Withdraw leave request"
        open={withdrawOpen}
        onCancel={() => setWithdrawOpen(false)}
        onOk={() => {
          const note = withdrawNote.trim();
          if (!note) {
            message.error("Add a reason before withdrawing");
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
                body: `${leave.employeeName} withdrew leave ${leave.startDate}–${leave.endDate}: ${note}`,
                href: `/leave/requests/${leave.id}`,
                meta: { leaveId: leave.id },
              });
            }
          }, "Leave withdrawn — still visible to ops");
          setWithdrawOpen(false);
        }}
        okText="Withdraw"
        okButtonProps={{ danger: true }}
      >
        <p style={{ margin: "0 0 10px", fontSize: 13, color: nectarColors.muted }}>
          This does not permanently delete the request. Supervisors and managers
          will still see it as withdrawn, with your reason. Withdrawal is not
          allowed after site approval or escalation.
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Reason for withdrawing this leave"
          value={withdrawNote}
          onChange={(e) => setWithdrawNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}
