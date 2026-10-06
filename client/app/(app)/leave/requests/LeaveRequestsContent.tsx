"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  App,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Table,
  Tabs,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getSession } from "@/lib/auth";
import { employees, getEmployeeById, getSiteName } from "@/lib/mock-data";
import {
  createLeaveRequestViaApi,
  getLeaveRequests,
  getPendingJustifications,
  getPlantOverlappingLeaves,
  managerDecideLeave,
  rejectLeave,
  siteApprove,
  supervisorVerify,
  adminFinalizeLeave,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  type LeaveMode,
  type LeaveRequest,
  type LeaveType,
} from "@/lib/leave";
import { validateLeave, type LeavePolicyResult } from "@/lib/api/leaves";
import { assertCanSiteApproveLeave } from "@/lib/manpower-conflict";
import { pushNotification } from "@/lib/notifications";
import {
  canConfirmLeaveReturn,
  canEnterLeaveForOthers,
  canManagerDecideLeave,
  canAdminFinalizeLeave,
  canSiteApproveLeave,
  canSupervisorVerifyLeave,
  canViewLeavePending,
  leaveActorRole,
  scopedEmployeeId,
  scopedSiteId,
  selfEmployeeId,
  isInChargeOf,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { listReplacementOptions } from "@/lib/reliever/pool";
import { rowBetweenWrapGap12 } from "@/lib/styles";
import { tr, trData, trCell, trEnum } from "@/lib/i18n";

/** Statuses where the next step is someone's approval (verify, approve, finalize, confirm return). */
const DECISION_STATUSES = new Set<LeaveRequest["status"]>([
  "REQUESTED",
  "ABSENT",
  "SUPERVISOR_VERIFIED",
  "SUPERVISOR_RECORDED",
  "SITE_APPROVED",
  "SITE_VERIFIED",
  "MANAGER_APPROVED",
  "APPROVED",
  "EXTENSION_REQUIRED",
]);

export default function LeaveRequestsContent() {
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mineOnly = searchParams.get("mine") === "1";
  const viewParam = searchParams.get("view");
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const empScope = scopedEmployeeId(session);
  const selfId = selfEmployeeId(session);
  const personalOnly = Boolean(empScope) || mineOnly;
  const filterEmployeeId = empScope ?? (mineOnly ? selfId : undefined);
  const canEnterOthers = canEnterLeaveForOthers(session) && !personalOnly;
  /** Pending justifications tab: all ops roles; never for pure employee / My leave */
  const showPendingTab = !personalOnly && canViewLeavePending(session);
  const actorRole = leaveActorRole(session);

  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [policyPreview, setPolicyPreview] = useState<LeavePolicyResult | null>(
    null,
  );
  const [policyChecking, setPolicyChecking] = useState(false);
  const policyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [coverLeave, setCoverLeave] = useState<LeaveRequest | null>(null);
  const [coverChoice, setCoverChoice] = useState<string>();
  const [rejectRow, setRejectRow] = useState<LeaveRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const activeTab =
    showPendingTab && viewParam === "pending" ? "pending" : "requests";

  const rows = useMemo(() => {
    void tick;
    let list = getLeaveRequests(personalOnly ? undefined : siteScope);
    if (filterEmployeeId) {
      list = list.filter((l) => l.employeeId === filterEmployeeId);
    }
    return list;
  }, [siteScope, filterEmployeeId, personalOnly, tick]);

  const pendingRows = useMemo(() => {
    void tick;
    return getPendingJustifications().filter((l) =>
      siteScope ? l.siteId === siteScope : true,
    );
  }, [siteScope, tick]);

  const coverOptions = useMemo(() => {
    void tick;
    if (!coverLeave) return { local: [] as ReturnType<typeof listReplacementOptions>["local"], cluster: [] as ReturnType<typeof listReplacementOptions>["cluster"] };
    return listReplacementOptions(coverLeave.siteId, {
      date: coverLeave.startDate,
      excludeEmployeeId: coverLeave.employeeId,
    });
  }, [coverLeave, tick]);

  const setView = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "pending") params.set("view", "pending");
    else params.delete("view");
    const q = params.toString();
    router.replace(q ? `/leave/requests?${q}` : "/leave/requests");
  };

  const columns: ColumnsType<LeaveRequest> = [
    {
      title: tr("Employee"),
      dataIndex: "employeeName",
      render: (name, r) => (
        <Link href={`/leave/requests/${r.id}`} style={{ color: nectarColors.leaf, fontWeight: 600 }}>{trData(name)}</Link>
      ),
    },
    { title: tr("Site"), dataIndex: "siteId", render: (id) => trData(getSiteName(id)) },
    {
      title: tr("Mode"),
      dataIndex: "mode",
      render: (m: LeaveMode) => (
        <Tag color={m === "emergency" ? nectarColors.alert : nectarColors.sky}>{trEnum(m)}</Tag>
      ),
    },
    {
      title: tr("Dates"),
      key: "dates",
      render: (_, r) => {
        const overlaps =
          !personalOnly && getPlantOverlappingLeaves(r.id).length > 0;
        const gate =
          !personalOnly &&
          ["SUPERVISOR_VERIFIED", "SUPERVISOR_RECORDED"].includes(r.status)
            ? assertCanSiteApproveLeave(r.id, {})
            : null;
        const hasConflict = Boolean(gate && !gate.ok);
        return (
          <span>
            {r.startDate} → {r.endDate}
            {overlaps ? (
              <Tag color={nectarColors.alert} style={{ marginLeft: 8, marginInlineEnd: 0 }}>{tr("plant overlap")}</Tag>
            ) : null}
            {hasConflict ? (
              <Tag
                color="#D97706"
                style={{ marginLeft: 8, marginInlineEnd: 0 }}
              >
                {tr("conflict")}
              </Tag>
            ) : null}
          </span>
        );
      },
    },
    {
      title: tr("Entry"),
      dataIndex: "entrySource",
      render: (s, r) =>
        s === "supervisor_on_behalf" ? (
          <span style={{ fontSize: 12 }}>
            {tr("Supervisor on behalf")}
            <br />
            <span style={{ color: nectarColors.muted }}>{trData(r.enteredByName)}</span>
          </span>
        ) : (
          tr("By employee")
        ),
    },
    {
      title: tr("OT risk"),
      dataIndex: "potentialOtHours",
      sorter: (a, b) => a.potentialOtHours - b.potentialOtHours,
      render: (h: number) =>
        h > 0 ? (
          <span style={{ color: nectarColors.alert, fontWeight: 600 }}>{tr("+{h} hrs", { h })}</span>
        ) : (
          tr("None")
        ),
    },
    {
      title: tr("Status"),
      dataIndex: "status",
      render: (s: LeaveRequest["status"], r) => (
        <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
          <Tag color={s === "CANCELLED" ? "default" : undefined}>{LEAVE_STATUS_LABELS[s]}</Tag>
          {s === "CANCELLED" && r.cancellationReason ? (
            <span style={{ fontSize: 11, color: nectarColors.muted, maxWidth: 160 }}>
              {r.cancelledByName ? `${r.cancelledByName}: ` : ""}
              {trData(r.cancellationReason)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      title: tr("Action"),
      key: "action",
      render: (_, r) => {
        const actor = session?.name ?? "User";
        const act = (fn: () => void, ok: string) => {
          try {
            fn();
            message.success(ok);
            setTick((t) => t + 1);
          } catch (err) {
            message.error(err instanceof Error ? trData(err.message) : tr("Action failed"));
          }
        };
        const waiting = (text: string) => (
          <span style={{ color: nectarColors.muted, fontSize: 12 }}>{trData(text)}</span>
        );

        // Nobody approves their own leave or a senior's — only leave of people in their charge.
        if (DECISION_STATUSES.has(r.status) && !isInChargeOf(session, getEmployeeById(r.employeeId))) {
          return waiting(session?.employeeId === r.employeeId ? tr("With your approver") : tr("With their approver"));
        }

        if (r.status === "REQUESTED" || r.status === "ABSENT") {
          if (canSupervisorVerifyLeave(session)) {
            return (
              <span style={{ display: "inline-flex", gap: 6 }}>
                <Button
                  size="small"
                  type="primary"
                  onClick={() =>
                    act(() => supervisorVerify(r.id, actor), tr("Supervisor verified"))
                  }
                >
                  {tr("Verify")}
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    setRejectNote("");
                    setRejectRow(r);
                  }}
                >
                  {tr("Reject")}
                </Button>
              </span>
            );
          }
          return waiting(tr("Waiting for supervisor"));
        }

        if (
          r.status === "SUPERVISOR_VERIFIED" ||
          r.status === "SUPERVISOR_RECORDED"
        ) {
          if (canSiteApproveLeave(session)) {
            return (
              <span style={{ display: "inline-flex", gap: 6 }}>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    setCoverChoice(undefined);
                    setCoverLeave(r);
                  }}
                >
                  {tr("Choose replacement")}
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    setRejectNote("");
                    setRejectRow(r);
                  }}
                >
                  {tr("Reject")}
                </Button>
              </span>
            );
          }
          return waiting(tr("Waiting for shift in-charge"));
        }

        if (r.status === "SITE_APPROVED" || r.status === "SITE_VERIFIED") {
          if (canManagerDecideLeave(session)) {
            return (
              <span style={{ display: "inline-flex", gap: 6 }}>
                <Button
                  size="small"
                  type="primary"
                  onClick={() =>
                    act(
                      () => managerDecideLeave(r.id, actor, "approved"),
                      tr("Manager approved — sent to Director"),
                    )
                  }
                >
                  {tr("Approve")}
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    setRejectNote("");
                    setRejectRow(r);
                  }}
                >
                  {tr("Reject")}
                </Button>
              </span>
            );
          }
          return waiting(tr("Waiting for manager"));
        }

        if (r.status === "MANAGER_APPROVED") {
          if (canAdminFinalizeLeave(session)) {
            return (
              <span style={{ display: "inline-flex", gap: 6 }}>
                <Button
                  size="small"
                  type="primary"
                  onClick={() =>
                    act(
                      () => adminFinalizeLeave(r.id, actor, "approved"),
                      tr("Leave approved by Director"),
                    )
                  }
                >
                  {tr("Director approve")}
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    setRejectNote("");
                    setRejectRow(r);
                  }}
                >
                  {tr("Reject")}
                </Button>
              </span>
            );
          }
          return waiting(tr("Waiting for Director"));
        }

        if (r.status === "PENDING_EMPLOYEE_CONSENT") {
          return waiting(tr("Waiting for {employeeName}", { employeeName: trData(r.employeeName) }));
        }

        if (r.status === "APPROVED" || r.status === "EXTENSION_REQUIRED") {
          if (canConfirmLeaveReturn(session)) {
            return (
              <Link href={`/leave/requests/${r.id}`}><Button size="small">{tr("Confirm return")}</Button></Link>
            );
          }
          return waiting(tr("Approved"));
        }

        return (
          <Link href={`/leave/requests/${r.id}`} style={{ fontSize: 12 }}>{tr("Open")}</Link>
        );
      },
    },
  ];

  const pendingColumns: ColumnsType<LeaveRequest> = [
    {
      title: tr("Employee"),
      dataIndex: "employeeName",
      render: (n, r) => (
        <Link href={`/leave/requests/${r.id}`} style={{ fontWeight: 600 }}>{trData(n)}</Link>
      ),
    },
    { title: tr("Site"), dataIndex: "siteId", render: (id) => trData(getSiteName(id)) },
    { title: tr("Absent since"), dataIndex: "startDate" },
    { title: tr("Days"), dataIndex: "daysRequested", render: trCell },
    {
      title: tr("Status"),
      dataIndex: "status",
      render: (s: LeaveRequest["status"]) => (
        <Tag color={nectarColors.alert}>{LEAVE_STATUS_LABELS[s]}</Tag>
      ),
    },
    { title: tr("Supervisor"), dataIndex: "supervisorName", render: trCell },
    { title: tr("Site In-Charge"), dataIndex: "siteInChargeName", render: trCell },
    { title: tr("Last communication"), dataIndex: "lastCommunication", render: (v) => trData(v) ?? "—" },
    {
      title: "",
      key: "follow",
      render: (_, r) => (
        <Link href={`/leave/requests/${r.id}`}><Button size="small" type="primary">{tr("Follow up")}</Button></Link>
      ),
    },
  ];

  const runPolicyPreview = async () => {
    try {
      const values = await form.validateFields([
        "employeeId",
        "mode",
        "leaveType",
        "range",
        "expectedReturn",
        "entrySource",
        "isHalfDay",
        "halfDaySlot",
      ]);
      const employeeId = filterEmployeeId ?? values.employeeId;
      if (!employeeId || !values.range?.[0] || !values.range?.[1]) {
        setPolicyPreview(null);
        return;
      }
      setPolicyChecking(true);
      const isOnBehalf =
        canEnterOthers &&
        (values.entrySource === "supervisor_on_behalf" ||
          actorRole === "supervisor" ||
          actorRole === "site_incharge");
      const result = await validateLeave({
        employeeId,
        mode: values.mode,
        leaveType: values.leaveType,
        startDate: values.range[0].format("YYYY-MM-DD"),
        endDate: values.isHalfDay
          ? values.range[0].format("YYYY-MM-DD")
          : values.range[1].format("YYYY-MM-DD"),
        expectedReturnDate: values.expectedReturn?.format("YYYY-MM-DD"),
        entrySource: isOnBehalf ? "supervisor_on_behalf" : "employee",
        isHalfDay: Boolean(values.isHalfDay),
        halfDaySlot: values.halfDaySlot,
      });
      setPolicyPreview(result);
    } catch {
      setPolicyPreview(null);
    } finally {
      setPolicyChecking(false);
    }
  };

  const onCreate = async () => {
    const values = await form.validateFields();
    const employeeId = filterEmployeeId ?? values.employeeId;
    const isOnBehalf =
      canEnterOthers &&
      (values.entrySource === "supervisor_on_behalf" ||
        actorRole === "supervisor" ||
        actorRole === "site_incharge");

    const emp = getEmployeeById(employeeId);
    const managerName = emp?.managerId
      ? getEmployeeById(emp.managerId)?.name
      : undefined;
    const supervisorName =
      actorRole === "supervisor"
        ? (session?.name ?? "Supervisor")
        : emp?.supervisorId
          ? (getEmployeeById(emp.supervisorId)?.name ?? "Supervisor")
          : "Supervisor";
    const sicName = emp?.shiftInChargeId
      ? (getEmployeeById(emp.shiftInChargeId)?.name ?? "Shift In-Charge")
      : "Shift In-Charge";

    const start = values.range[0].format("YYYY-MM-DD");
    const end = values.isHalfDay
      ? start
      : values.range[1].format("YYYY-MM-DD");

    try {
      const created = await createLeaveRequestViaApi({
        employeeId,
        mode: values.mode,
        leaveType: values.leaveType,
        startDate: start,
        endDate: end,
        expectedReturnDate: values.expectedReturn.format("YYYY-MM-DD"),
        reason: values.reason,
        entrySource: isOnBehalf ? "supervisor_on_behalf" : "employee",
        enteredByName: session?.name ?? "System",
        enteredByRole: actorRole,
        submittedByEmployeeId: isOnBehalf ? session?.employeeId : undefined,
        supervisorName,
        siteInChargeName: sicName,
        managerName,
        lastCommunication: values.lastCommunication,
        isHalfDay: Boolean(values.isHalfDay),
        halfDaySlot: values.halfDaySlot,
      });

      if (created.status === "PENDING_EMPLOYEE_CONSENT") {
        pushNotification({
          employeeId: created.employeeId,
          kind: "leave_consent",
          title: "Leave request needs your consent",
          body: "{enteredByName} submitted leave on your behalf for {startDate}–{endDate}. Approve or reject to continue.",
          params: { enteredByName: created.enteredByName, startDate: created.startDate, endDate: created.endDate },
          href: `/leave/requests/${created.id}`,
          meta: { leaveId: created.id },
        });
      }

      const warnCount = created.policyFlags?.filter((f) => f.severity === "warn")
        .length;
      message.success(
        created.status === "PENDING_EMPLOYEE_CONSENT"
          ? tr("Leave submitted — awaiting employee consent.")
          : warnCount
            ? tr("Leave recorded with {warnCount} policy warning(s).", { warnCount })
            : tr("Leave / absence recorded."),
      );
      setOpen(false);
      setPolicyPreview(null);
      form.resetFields();
      setTick((t) => t + 1);
    } catch (err) {
      message.error(err instanceof Error ? trData(err.message) : tr("Could not create leave"));
    }
  };

  const requestsTable = (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={rows}
      pagination={{ pageSize: 10 }}
      scroll={{ x: 1000 }}
      style={{ background: nectarColors.white }}
    />
  );

  const pendingTable = (
    <>
      <p style={{ margin: "0 0 12px", color: nectarColors.muted, fontSize: 13 }}>
        {tr("Absences that need employee follow-up — verbal, incomplete, unexplained, or overdue to close.")}
      </p>
      <Table
        rowKey="id"
        columns={pendingColumns}
        dataSource={pendingRows}
        pagination={false}
        scroll={{ x: 1100 }}
        style={{ background: nectarColors.white }}
      />
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={rowBetweenWrapGap12}>
        <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
          {personalOnly
            ? tr("Your leave and absence requests.")
            : tr("Open a name for the full record. Action column: supervisor verifies → shift in-charge covers → manager approves → Director finalizes.")}
        </p>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>{personalOnly ? tr("Request leave") : tr("Record leave / absence")}</Button>
      </div>

      {showPendingTab ? (
        <Tabs
          activeKey={activeTab}
          onChange={setView}
          items={[
            { key: "requests", label: tr("Requests ({rowCount})", { rowCount: rows.length }), children: requestsTable },
            { key: "pending", label: tr("Pending justifications ({pendingRowCount})", { pendingRowCount: pendingRows.length }), children: pendingTable },
          ]}
        />
      ) : (
        requestsTable
      )}

      <Drawer
        title={tr("Record leave or emergency absence")}
        size={480}
        open={open}
        onClose={() => {
          setOpen(false);
          setPolicyPreview(null);
        }}
        destroyOnHidden
        extra={
          <Button type="primary" onClick={onCreate} disabled={policyPreview?.verdict === "BLOCK"}>{tr("Save")}</Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            mode: "planned",
            leaveType: "casual",
            entrySource: canEnterOthers ? "supervisor_on_behalf" : "employee",
            employeeId: filterEmployeeId,
            isHalfDay: false,
          }}
          onValuesChange={() => {
            if (policyTimer.current) clearTimeout(policyTimer.current);
            policyTimer.current = setTimeout(() => {
              void runPolicyPreview();
            }, 400);
          }}
        >
          <Form.Item name="employeeId" label={tr("Employee")} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              disabled={Boolean(filterEmployeeId)}
              options={employees
                .filter((e) => {
                  if (filterEmployeeId) return e.id === filterEmployeeId;
                  // Yourself, or someone in your charge — never leave on behalf of a senior
                  return e.id === session?.employeeId || isInChargeOf(session, e);
                })
                .map((e) => ({ value: e.id, label: `${trData(e.name)} · ${trData(e.role)}` }))}
            />
          </Form.Item>
          {canEnterOthers ? (
            <Form.Item name="entrySource" label={tr("Entry source")}>
              <Radio.Group>
                <Radio value="employee">{tr("Employee self-request")}</Radio>
                <Radio value="supervisor_on_behalf">{tr("Supervisor on behalf (needs employee consent)")}</Radio>
              </Radio.Group>
            </Form.Item>
          ) : null}
          <Form.Item name="mode" label={tr("Mode")} rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="planned">{tr("Planned")}</Radio>
              <Radio value="emergency">{tr("Emergency")}</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="leaveType" label={tr("Leave type")} rules={[{ required: true }]}>
            <Select
              options={(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map(
                (value) => ({ value, label: LEAVE_TYPE_LABELS[value] }),
              )}
            />
          </Form.Item>
          <Form.Item name="isHalfDay" label={tr("Duration")}>
            <Radio.Group>
              <Radio value={false}>{tr("Full day(s)")}</Radio>
              <Radio value={true}>{tr("Half day")}</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, next) =>
              prev.isHalfDay !== next.isHalfDay || prev.mode !== next.mode
            }
          >
            {({ getFieldValue }) =>
              getFieldValue("isHalfDay") ? (
                <Form.Item
                  name="halfDaySlot"
                  label={tr("Half-day slot")}
                  rules={[{ required: true, message: tr("Pick morning or afternoon") }]}
                >
                  <Radio.Group>
                    <Radio value="morning">{tr("Morning")}</Radio>
                    <Radio value="afternoon">{tr("Afternoon")}</Radio>
                  </Radio.Group>
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.mode !== next.mode}>
            {({ getFieldValue }) => {
              const mode = getFieldValue("mode") as LeaveMode;
              const minDate =
                mode === "emergency"
                  ? dayjs().startOf("day").subtract(7, "day")
                  : dayjs().startOf("day");
              return (
                <Form.Item name="range" label={tr("Dates")} rules={[{ required: true }]}>
                  <DatePicker.RangePicker
                    style={{ width: "100%" }}
                    disabledDate={(current) =>
                      !!current && current.isBefore(minDate, "day")
                    }
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, next) =>
              prev.range !== next.range || prev.mode !== next.mode
            }
          >
            {({ getFieldValue }) => {
              const range = getFieldValue("range") as
                | [dayjs.Dayjs, dayjs.Dayjs]
                | undefined;
              const mode = getFieldValue("mode") as LeaveMode;
              const endOrStart = range?.[1] ?? range?.[0];
              const minReturn = endOrStart
                ? endOrStart.startOf("day")
                : mode === "emergency"
                  ? dayjs().startOf("day").subtract(7, "day")
                  : dayjs().startOf("day");
              return (
                <Form.Item name="expectedReturn" label={tr("Expected return")} rules={[{ required: true }]}>
                  <DatePicker
                    style={{ width: "100%" }}
                    disabledDate={(current) =>
                      !!current && current.isBefore(minReturn, "day")
                    }
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="reason" label={tr("Reason")} rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="lastCommunication" label={tr("Last communication")}><Input placeholder={tr("Optional note")} /></Form.Item>

          {policyChecking ? (
            <p style={{ fontSize: 12, color: nectarColors.muted }}>{tr("Checking leave policy…")}</p>
          ) : null}
          {policyPreview ? (
            <div
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 8,
                background:
                  policyPreview.verdict === "BLOCK"
                    ? "rgba(185, 28, 28, 0.08)"
                    : policyPreview.verdict === "WARN"
                      ? "rgba(217, 119, 6, 0.1)"
                      : "rgba(63, 174, 124, 0.1)",
                border: `1px solid ${
                  policyPreview.verdict === "BLOCK"
                    ? nectarColors.alert
                    : policyPreview.verdict === "WARN"
                      ? "#D97706"
                      : nectarColors.leaf
                }`,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {tr("Policy:")}{" "}{trData(policyPreview.verdict)}
                {policyPreview.daysRequested
                  ? tr(" · {daysRequested} day(s)", { daysRequested: policyPreview.daysRequested })
                  : ""}
              </div>
              {policyPreview.flags.length === 0 ? (
                <div style={{ fontSize: 12, color: nectarColors.muted }}>{tr("No policy issues.")}</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                  {policyPreview.flags.map((f) => (
                    <li key={f.code + f.message}>{trData(f.message)}</li>
                  ))}
                </ul>
              )}
              {policyPreview.suggestions?.length ? (
                <div style={{ marginTop: 6, fontSize: 12 }}>{policyPreview.suggestions.join(" · ")}</div>
              ) : null}
            </div>
          ) : null}
        </Form>
      </Drawer>

      <Modal
        title={
          coverLeave
            ? tr("Who covers {employeeName}?", { employeeName: trData(coverLeave.employeeName) })
            : tr("Choose replacement")
        }
        open={Boolean(coverLeave)}
        okText={tr("Cover this shift")}
        okButtonProps={{ disabled: !coverChoice }}
        onCancel={() => {
          setCoverLeave(null);
          setCoverChoice(undefined);
        }}
        onOk={() => {
          if (!coverLeave || !coverChoice) return;
          try {
            siteApprove(
              coverLeave.id,
              session?.name ?? "Shift In-Charge",
              coverChoice === "ot"
                ? { otFallback: true }
                : { relieverId: coverChoice },
            );
            message.success(
              coverChoice === "ot"
                ? tr("Covered with overtime")
                : tr("Replacement arranged"),
            );
            setCoverLeave(null);
            setCoverChoice(undefined);
            setTick((t) => t + 1);
          } catch (err) {
            message.error(err instanceof Error ? trData(err.message) : tr("Action failed"));
          }
        }}
      >
        <p style={{ marginTop: 0, color: nectarColors.muted, fontSize: 13 }}>{tr("Same-plant employees, cluster employees, then pool — pick cover or OT.")}</p>
        <Radio.Group
          value={coverChoice}
          onChange={(e) => setCoverChoice(e.target.value)}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {coverOptions.local.map((person) => (
            <Radio key={person.relieverId} value={person.relieverId}>
              {trData(person.name)} ·{" "}
              {person.kind === "employee" ? tr("employee · this site") : tr("pool · this site")}
              {person.phone ? ` · ${person.phone}` : ""}
            </Radio>
          ))}
          {coverOptions.cluster.map((person) => (
            <Radio key={person.relieverId} value={person.relieverId}>
              {trData(person.name)} ·{" "}
              {person.kind === "employee" ? tr("employee · cluster") : tr("pool · cluster")}
              {person.homeSiteId ? ` · ${getSiteName(person.homeSiteId)}` : ""}
              {person.phone ? ` · ${person.phone}` : ""}
            </Radio>
          ))}
          <Radio value="ot">{tr("No one — accept overtime")}</Radio>
        </Radio.Group>
      </Modal>

      <Modal
        title={tr("Reject leave")}
        open={Boolean(rejectRow)}
        okText={tr("Reject")}
        okButtonProps={{ danger: true }}
        onCancel={() => setRejectRow(null)}
        onOk={() => {
          if (!rejectRow) return;
          const note = rejectNote.trim();
          if (!note) {
            message.error(tr("Add a remark before rejecting"));
            return;
          }
          const role =
            rejectRow.status === "MANAGER_APPROVED"
              ? "director"
              : rejectRow.status === "SITE_APPROVED" ||
                  rejectRow.status === "SITE_VERIFIED"
                ? "management"
                : rejectRow.status === "SUPERVISOR_VERIFIED" ||
                    rejectRow.status === "SUPERVISOR_RECORDED"
                  ? "site_incharge"
                  : "supervisor";
          try {
            rejectLeave(rejectRow.id, session?.name ?? "User", note, role);
            message.success(tr("Leave rejected"));
            setRejectRow(null);
            setRejectNote("");
            setTick((t) => t + 1);
          } catch (err) {
            message.error(err instanceof Error ? trData(err.message) : tr("Action failed"));
          }
        }}
      >
        <Input.TextArea
          rows={3}
          placeholder={tr("Remark — why this leave is rejected")}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}
