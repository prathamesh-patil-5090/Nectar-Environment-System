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
  escalateLeave,
  finalizeApprove,
  getLeaveById,
  hrValidate,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  rejectLeave,
  siteApprove,
  supervisorVerify,
} from "@/lib/leave";
import {
  canConfirmLeaveReturn,
  canHrValidateLeave,
  canSiteApproveLeave,
  canSupervisorVerifyLeave,
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

  const leave = useMemo(() => getLeaveById(id), [id, tick]);
  const impact = useMemo(
    () =>
      leave
        ? computeLeaveImpact(leave.employeeId, leave.startDate, leave.endDate)
        : null,
    [leave, tick],
  );

  if (!leave || !impact) {
    return (
      <Empty description="Leave request not found">
        <Button type="primary" onClick={() => router.push("/leave/requests")}>
          Back
        </Button>
      </Empty>
    );
  }

  const actor = session?.name ?? "User";
  const canVerify = canSupervisorVerifyLeave(session);
  const canSite = canSiteApproveLeave(session);
  const canHr = canHrValidateLeave(session);
  const canReturn = canConfirmLeaveReturn(session);
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

        <Descriptions
          style={{ marginTop: 20 }}
          column={{ xs: 1, sm: 2, md: 3 }}
          size="small"
        >
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
          <Descriptions.Item label="Site In-Charge">
            {leave.siteInChargeName}
          </Descriptions.Item>
          <Descriptions.Item label="Entered by">
            {leave.enteredByName} ({leave.enteredByRole})
          </Descriptions.Item>
          <Descriptions.Item label="Reason" span={3}>
            {leave.reason}
          </Descriptions.Item>
          {leave.lastCommunication ? (
            <Descriptions.Item label="Last communication" span={3}>
              {leave.lastCommunication}
            </Descriptions.Item>
          ) : null}
          {leave.replacementPlan ? (
            <Descriptions.Item label="Replacement plan" span={3}>
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
        <Space wrap>
          {canVerify &&
          ["REQUESTED", "ABSENT"].includes(leave.status) ? (
            <Button
              onClick={() =>
                run(() => supervisorVerify(leave.id, actor), "Supervisor verified")
              }
            >
              Supervisor verify
            </Button>
          ) : null}

          {canSite &&
          ["SUPERVISOR_VERIFIED", "SUPERVISOR_RECORDED", "REQUESTED"].includes(
            leave.status,
          ) ? (
            <>
              <Button
                type="primary"
                onClick={() =>
                  run(
                    () =>
                      siteApprove(leave.id, actor, {
                        arrangeReplacement: true,
                      }),
                    "Replacement arranged & site approved",
                  )
                }
              >
                Arrange replacement & approve
              </Button>
              <Button
                danger={impact.potentialOtHours > 0}
                onClick={() =>
                  run(
                    () =>
                      siteApprove(leave.id, actor, { approveAnyway: true }),
                    "Approved with noted OT risk",
                  )
                }
              >
                Approve anyway
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
              <Button
                danger
                onClick={() =>
                  run(
                    () => rejectLeave(leave.id, actor, "Site cannot accommodate"),
                    "Rejected",
                  )
                }
              >
                Reject
              </Button>
            </>
          ) : null}

          {canHr &&
          ["SITE_APPROVED", "SITE_VERIFIED", "HR_VALIDATED"].includes(
            leave.status,
          ) ? (
            <>
              {leave.status !== "HR_VALIDATED" ? (
                <Button
                  onClick={() =>
                    run(() => hrValidate(leave.id, actor), "HR validated")
                  }
                >
                  HR validate
                </Button>
              ) : null}
              <Button
                type="primary"
                onClick={() =>
                  run(() => finalizeApprove(leave.id, actor), "Leave approved")
                }
              >
                Final approve
              </Button>
            </>
          ) : null}

          {canReturn &&
          ["APPROVED", "SITE_APPROVED", "HR_VALIDATED", "SITE_VERIFIED"].includes(
            leave.status,
          ) ? (
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
    </div>
  );
}
