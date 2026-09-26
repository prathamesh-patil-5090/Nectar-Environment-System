"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  DatePicker,
  Descriptions,
  Empty,
  Input,
  Modal,
  Space,
  Tag,
  Timeline,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import LeaveImpactPanel from "@/components/leave/LeaveImpactPanel";
import { getSession } from "@/lib/auth";
import { getSiteName } from "@/lib/mock-data";
import {
  computeLeaveImpact,
  confirmReturn,
  employeeConsentLeave,
  escalateLeave,
  getLeaveById,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  managerDecideLeave,
  siteApprove,
  supervisorVerify,
} from "@/lib/leave";
import { pushNotification } from "@/lib/notifications";
import {
  canConfirmLeaveReturn,
  canManagerDecideLeave,
  canSiteApproveLeave,
  canSupervisorVerifyLeave,
  normalizeRole,
  scopedEmployeeId,
  scopedSiteId,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

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

  if (!leave || !impact) {
    return (
      <Empty description="Leave request not found">
        <Button type="primary" onClick={() => router.push("/leave/requests")}>
          Back
        </Button>
      </Empty>
    );
  }

  const siteScope = scopedSiteId(session);
  const empScope = scopedEmployeeId(session);
  if (empScope && leave.employeeId !== empScope) {
    return (
      <Empty description="You can only view your own leave requests.">
        <Button type="primary" onClick={() => router.push("/leave/requests")}>
          My leave
        </Button>
      </Empty>
    );
  }
  if (siteScope && leave.siteId !== siteScope && !empScope) {
    return (
      <Empty description="This leave request is outside your plant scope.">
        <Button type="primary" onClick={() => router.push("/leave/requests")}>
          Back
        </Button>
      </Empty>
    );
  }

  const actor = session?.name ?? "User";
  const role = normalizeRole(session?.role);
  const canVerify = canSupervisorVerifyLeave(session);
  const canSite = canSiteApproveLeave(session);
  const canManager = canManagerDecideLeave(session);
  const canReturn = canConfirmLeaveReturn(session);
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
    } catch {
      message.error("Action failed");
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-fraunces), Georgia, serif",
                fontSize: 26,
                color: nectarColors.ink,
              }}
            >
              {leave.employeeName}
            </div>
            <div style={{ color: nectarColors.muted }}>
              <Link href={`/employees/${leave.employeeId}`}>{leave.employeeId}</Link>
              {" · "}
              {getSiteName(leave.siteId)} · {leave.department}
            </div>
          </div>
          <Space wrap>
            <Tag color={leave.mode === "emergency" ? nectarColors.alert : nectarColors.sky}>
              {leave.mode}
            </Tag>
            <Tag>{LEAVE_STATUS_LABELS[leave.status]}</Tag>
            <Tag>
              {leave.entrySource === "supervisor_on_behalf"
                ? "Entered by supervisor"
                : "Requested by employee"}
            </Tag>
          </Space>
        </div>

        <Descriptions style={{ marginTop: 20 }} column={1} size="small">
          <Descriptions.Item label="Leave type">
            {LEAVE_TYPE_LABELS[leave.leaveType]}
          </Descriptions.Item>
          <Descriptions.Item label="Dates">
            {leave.startDate} → {leave.endDate} ({leave.daysRequested}d)
          </Descriptions.Item>
          <Descriptions.Item label="Expected return">
            {leave.expectedReturnDate}
          </Descriptions.Item>
          <Descriptions.Item label="Actual return">
            {leave.actualReturnDate ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Leave balance">
            {leave.leaveBalanceDays} days
          </Descriptions.Item>
          <Descriptions.Item label="Supervisor">
            {leave.supervisorName}
          </Descriptions.Item>
          <Descriptions.Item label="Shift In-Charge">
            {leave.siteInChargeName}
          </Descriptions.Item>
          <Descriptions.Item label="Manager">
            {leave.managerName ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Entered by">
            {leave.enteredByName} ({leave.enteredByRole})
          </Descriptions.Item>
          {leave.employeeConsent ? (
            <Descriptions.Item label="Employee consent">
              {leave.employeeConsent}
              {leave.employeeConsentAt
                ? ` · ${leave.employeeConsentAt.slice(0, 16).replace("T", " ")}`
                : ""}
            </Descriptions.Item>
          ) : null}
          {leave.managerDecision ? (
            <Descriptions.Item label="Manager decision">
              {leave.managerDecision}
              {leave.managerDecisionAt
                ? ` · ${leave.managerDecisionAt.slice(0, 16).replace("T", " ")}`
                : ""}
            </Descriptions.Item>
          ) : null}
          {leave.rejectionReason ? (
            <Descriptions.Item label="Rejection reason">
              {leave.rejectionReason}
            </Descriptions.Item>
          ) : null}
          <Descriptions.Item label="Reason">{leave.reason}</Descriptions.Item>
          {leave.lastCommunication ? (
            <Descriptions.Item label="Last communication">
              {leave.lastCommunication}
            </Descriptions.Item>
          ) : null}
          {leave.replacementPlan ? (
            <Descriptions.Item label="Replacement plan">
              {leave.replacementPlan}
            </Descriptions.Item>
          ) : null}
        </Descriptions>
      </div>

      <LeaveImpactPanel impact={impact} />

      <div
        style={{
          background: nectarColors.white,
          padding: 20,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          Actions
        </div>
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
            Your supervisor submitted this leave for you. Approve to send it to
            your Manager, or reject to stop it here.
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
            !waitingOnConsent &&
            [
              "REQUESTED",
              "SUPERVISOR_VERIFIED",
              "SUPERVISOR_RECORDED",
              "SITE_APPROVED",
              "SITE_VERIFIED",
            ].includes(leave.status);
          const showReturn =
            canReturn &&
            ["APPROVED", "SITE_APPROVED", "HR_VALIDATED", "SITE_VERIFIED"].includes(
              leave.status,
            );
          const hasButtons =
            showConsent || showVerify || showSite || showManager || showReturn;

          if (!hasButtons && !waitingOnConsent) {
            let statusNote = "No actions available for your role on this leave.";
            if (canGiveConsent && leave.status === "REQUESTED") {
              statusNote =
                "You approved consent. This leave is now with your Manager for a final decision.";
            } else if (leave.status === "APPROVED") {
              statusNote = "Leave is approved. Confirm return when you are back on duty (supervisor/manager).";
            } else if (leave.status === "REJECTED") {
              statusNote = leave.rejectionReason
                ? `Leave rejected: ${leave.rejectionReason}`
                : "Leave was rejected. No further action needed.";
            } else if (leave.status === "CLOSED") {
              statusNote = "Leave closed — return confirmed.";
            } else if (
              canGiveConsent &&
              leave.status === "PENDING_EMPLOYEE_CONSENT"
            ) {
              statusNote = "";
            }
            return statusNote ? (
              <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
                {statusNote}
              </p>
            ) : null;
          }

          return (
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
                        body: `${leave.employeeName} approved the on-behalf leave — pending manager.`,
                        href: `/leave/requests/${leave.id}`,
                      });
                    }
                  }, "Consent approved — sent to manager")
                }
              >
                Approve — send to Manager
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
              onClick={() =>
                run(() => supervisorVerify(leave.id, actor), "Supervisor verified")
              }
            >
              Supervisor verify
            </Button>
          ) : null}

          {showSite ? (
            <>
              <Button
                type="primary"
                onClick={() =>
                  run(
                    () =>
                      siteApprove(leave.id, actor, {
                        arrangeReplacement: true,
                      }),
                    "Replacement arranged",
                  )
                }
              >
                Arrange replacement
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
            </>
          ) : null}

          {showManager ? (
            <>
              <Button
                type="primary"
                onClick={() =>
                  run(() => {
                    managerDecideLeave(leave.id, actor, "approved");
                    notifyDecision(true);
                  }, "Leave approved by manager")
                }
              >
                Manager approve
              </Button>
              <Button
                danger
                onClick={() => {
                  setRejectNote("");
                  setRejectOpen(true);
                }}
              >
                Manager reject
              </Button>
            </>
          ) : null}

          {showReturn ? (
            <Space>
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
            </Space>
          ) : null}
        </Space>
          );
        })()}
      </div>

      <div
        style={{
          background: nectarColors.white,
          padding: 20,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          Workflow timeline
        </div>
        <Timeline
          items={leave.timeline.map((t) => ({
            color: nectarColors.leaf,
            content: (
              <div>
                <div style={{ fontWeight: 600 }}>
                  {t.action}{" "}
                  <span style={{ color: nectarColors.muted, fontWeight: 400 }}>
                    · {t.actor} ({t.role})
                  </span>
                </div>
                {t.note ? (
                  <div style={{ fontSize: 12, color: nectarColors.muted }}>
                    {t.note}
                  </div>
                ) : null}
                <div style={{ fontSize: 11, color: nectarColors.muted }}>
                  {t.at.slice(0, 16).replace("T", " ")}
                </div>
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
          if (leave.status === "PENDING_EMPLOYEE_CONSENT" && canGiveConsent) {
            run(() => {
              employeeConsentLeave(
                leave.id,
                actor,
                "rejected",
                rejectNote || "Employee rejected consent",
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
          } else {
            run(() => {
              managerDecideLeave(
                leave.id,
                actor,
                "rejected",
                rejectNote || "Rejected by manager",
              );
              notifyDecision(false, rejectNote);
            }, "Leave rejected");
          }
          setRejectOpen(false);
        }}
        okText="Reject"
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          rows={3}
          placeholder="Reason for rejection"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}
