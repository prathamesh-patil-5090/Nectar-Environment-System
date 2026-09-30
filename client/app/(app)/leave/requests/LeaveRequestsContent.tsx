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
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { listReplacementOptions } from "@/lib/reliever/pool";

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
    return listReplacementOptions(coverLeave.siteId);
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
      title: "Employee",
      dataIndex: "employeeName",
      render: (name, r) => (
        <Link
          href={`/leave/requests/${r.id}`}
          style={{ color: nectarColors.leaf, fontWeight: 600 }}
        >
          {name}
        </Link>
      ),
    },
    {
      title: "Site",
      dataIndex: "siteId",
      render: (id) => getSiteName(id),
    },
    {
      title: "Mode",
      dataIndex: "mode",
      render: (m: LeaveMode) => (
        <Tag color={m === "emergency" ? nectarColors.alert : nectarColors.sky}>
          {m}
        </Tag>
      ),
    },
    {
      title: "Dates",
      key: "dates",
      render: (_, r) => {
        const overlaps =
          !personalOnly && getPlantOverlappingLeaves(r.id).length > 0;
        return (
          <span>
            {r.startDate} → {r.endDate}
            {overlaps ? (
              <Tag
                color={nectarColors.alert}
                style={{ marginLeft: 8, marginInlineEnd: 0 }}
              >
                plant overlap
              </Tag>
            ) : null}
          </span>
        );
      },
    },
    {
      title: "Entry",
      dataIndex: "entrySource",
      render: (s, r) =>
        s === "supervisor_on_behalf" ? (
          <span style={{ fontSize: 12 }}>
            Supervisor on behalf
            <br />
            <span style={{ color: nectarColors.muted }}>{r.enteredByName}</span>
          </span>
        ) : (
          "By employee"
        ),
    },
    {
      title: "OT risk",
      dataIndex: "potentialOtHours",
      sorter: (a, b) => a.potentialOtHours - b.potentialOtHours,
      render: (h: number) =>
        h > 0 ? (
          <span style={{ color: nectarColors.alert, fontWeight: 600 }}>
            +{h} hrs
          </span>
        ) : (
          "None"
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s: LeaveRequest["status"], r) => (
        <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
          <Tag color={s === "CANCELLED" ? "default" : undefined}>
            {LEAVE_STATUS_LABELS[s]}
          </Tag>
          {s === "CANCELLED" && r.cancellationReason ? (
            <span style={{ fontSize: 11, color: nectarColors.muted, maxWidth: 160 }}>
              {r.cancelledByName ? `${r.cancelledByName}: ` : ""}
              {r.cancellationReason}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_, r) => {
        const actor = session?.name ?? "User";
        const act = (fn: () => void, ok: string) => {
          try {
            fn();
            message.success(ok);
            setTick((t) => t + 1);
          } catch (err) {
            message.error(err instanceof Error ? err.message : "Action failed");
          }
        };
        const waiting = (text: string) => (
          <span style={{ color: nectarColors.muted, fontSize: 12 }}>{text}</span>
        );

        if (r.status === "REQUESTED" || r.status === "ABSENT") {
          if (canSupervisorVerifyLeave(session)) {
            return (
              <span style={{ display: "inline-flex", gap: 6 }}>
                <Button
                  size="small"
                  type="primary"
                  onClick={() =>
                    act(() => supervisorVerify(r.id, actor), "Supervisor verified")
                  }
                >
                  Verify
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    setRejectNote("");
                    setRejectRow(r);
                  }}
                >
                  Reject
                </Button>
              </span>
            );
          }
          return waiting("Waiting for supervisor");
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
                  Choose replacement
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    setRejectNote("");
                    setRejectRow(r);
                  }}
                >
                  Reject
                </Button>
              </span>
            );
          }
          return waiting("Waiting for shift in-charge");
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
                      "Manager approved — sent to Director",
                    )
                  }
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    setRejectNote("");
                    setRejectRow(r);
                  }}
                >
                  Reject
                </Button>
              </span>
            );
          }
          return waiting("Waiting for manager");
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
                      "Leave approved by Director",
                    )
                  }
                >
                  Director approve
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    setRejectNote("");
                    setRejectRow(r);
                  }}
                >
                  Reject
                </Button>
              </span>
            );
          }
          return waiting("Waiting for Director");
        }

        if (r.status === "PENDING_EMPLOYEE_CONSENT") {
          return waiting(`Waiting for ${r.employeeName}`);
        }

        if (r.status === "APPROVED" || r.status === "EXTENSION_REQUIRED") {
          if (canConfirmLeaveReturn(session)) {
            return (
              <Link href={`/leave/requests/${r.id}`}>
                <Button size="small">Confirm return</Button>
              </Link>
            );
          }
          return waiting("Approved");
        }

        return (
          <Link href={`/leave/requests/${r.id}`} style={{ fontSize: 12 }}>
            Open
          </Link>
        );
      },
    },
  ];

  const pendingColumns: ColumnsType<LeaveRequest> = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      render: (n, r) => (
        <Link href={`/leave/requests/${r.id}`} style={{ fontWeight: 600 }}>
          {n}
        </Link>
      ),
    },
    {
      title: "Site",
      dataIndex: "siteId",
      render: (id) => getSiteName(id),
    },
    { title: "Absent since", dataIndex: "startDate" },
    { title: "Days", dataIndex: "daysRequested" },
    {
      title: "Status",
      dataIndex: "status",
      render: (s: LeaveRequest["status"]) => (
        <Tag color={nectarColors.alert}>{LEAVE_STATUS_LABELS[s]}</Tag>
      ),
    },
    { title: "Supervisor", dataIndex: "supervisorName" },
    { title: "Site In-Charge", dataIndex: "siteInChargeName" },
    {
      title: "Last communication",
      dataIndex: "lastCommunication",
      render: (v) => v ?? "—",
    },
    {
      title: "",
      key: "follow",
      render: (_, r) => (
        <Link href={`/leave/requests/${r.id}`}>
          <Button size="small" type="primary">
            Follow up
          </Button>
        </Link>
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
          body: `${created.enteredByName} submitted leave on your behalf for ${created.startDate}–${created.endDate}. Approve or reject to continue.`,
          href: `/leave/requests/${created.id}`,
          meta: { leaveId: created.id },
        });
      }

      const warnCount = created.policyFlags?.filter((f) => f.severity === "warn")
        .length;
      message.success(
        created.status === "PENDING_EMPLOYEE_CONSENT"
          ? "Leave submitted — awaiting employee consent."
          : warnCount
            ? `Leave recorded with ${warnCount} policy warning(s).`
            : "Leave / absence recorded.",
      );
      setOpen(false);
      setPolicyPreview(null);
      form.resetFields();
      setTick((t) => t + 1);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not create leave");
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
        Absences that need employee follow-up — verbal, incomplete, unexplained,
        or overdue to close.
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
          {personalOnly
            ? "Your leave and absence requests."
            : "Open a name for the full record. Action column: supervisor verifies → shift in-charge covers → manager approves → Director finalizes."}
        </p>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setOpen(true)}
        >
          {personalOnly ? "Request leave" : "Record leave / absence"}
        </Button>
      </div>

      {showPendingTab ? (
        <Tabs
          activeKey={activeTab}
          onChange={setView}
          items={[
            {
              key: "requests",
              label: `Requests (${rows.length})`,
              children: requestsTable,
            },
            {
              key: "pending",
              label: `Pending justifications (${pendingRows.length})`,
              children: pendingTable,
            },
          ]}
        />
      ) : (
        requestsTable
      )}

      <Drawer
        title="Record leave or emergency absence"
        size={480}
        open={open}
        onClose={() => {
          setOpen(false);
          setPolicyPreview(null);
        }}
        destroyOnHidden
        extra={
          <Button
            type="primary"
            onClick={onCreate}
            disabled={policyPreview?.verdict === "BLOCK"}
          >
            Save
          </Button>
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
          <Form.Item
            name="employeeId"
            label="Employee"
            rules={[{ required: true }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              disabled={Boolean(filterEmployeeId)}
              options={employees
                .filter((e) => {
                  if (filterEmployeeId) return e.id === filterEmployeeId;
                  if (siteScope) return e.siteId === siteScope;
                  return true;
                })
                .map((e) => ({ value: e.id, label: `${e.name} · ${e.role}` }))}
            />
          </Form.Item>
          {canEnterOthers ? (
            <Form.Item name="entrySource" label="Entry source">
              <Radio.Group>
                <Radio value="employee">Employee self-request</Radio>
                <Radio value="supervisor_on_behalf">
                  Supervisor on behalf (needs employee consent)
                </Radio>
              </Radio.Group>
            </Form.Item>
          ) : null}
          <Form.Item name="mode" label="Mode" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="planned">Planned</Radio>
              <Radio value="emergency">Emergency</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="leaveType"
            label="Leave type"
            rules={[{ required: true }]}
          >
            <Select
              options={(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map(
                (value) => ({
                  value,
                  label: LEAVE_TYPE_LABELS[value],
                }),
              )}
            />
          </Form.Item>
          <Form.Item name="isHalfDay" label="Duration">
            <Radio.Group>
              <Radio value={false}>Full day(s)</Radio>
              <Radio value={true}>Half day</Radio>
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
                  label="Half-day slot"
                  rules={[{ required: true, message: "Pick morning or afternoon" }]}
                >
                  <Radio.Group>
                    <Radio value="morning">Morning</Radio>
                    <Radio value="afternoon">Afternoon</Radio>
                  </Radio.Group>
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, next) => prev.mode !== next.mode}
          >
            {({ getFieldValue }) => {
              const mode = getFieldValue("mode") as LeaveMode;
              const minDate =
                mode === "emergency"
                  ? dayjs().startOf("day").subtract(7, "day")
                  : dayjs().startOf("day");
              return (
                <Form.Item
                  name="range"
                  label="Dates"
                  rules={[{ required: true }]}
                >
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
                <Form.Item
                  name="expectedReturn"
                  label="Expected return"
                  rules={[{ required: true }]}
                >
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
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="lastCommunication" label="Last communication">
            <Input placeholder="Optional note" />
          </Form.Item>

          {policyChecking ? (
            <p style={{ fontSize: 12, color: nectarColors.muted }}>
              Checking leave policy…
            </p>
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
                Policy: {policyPreview.verdict}
                {policyPreview.daysRequested
                  ? ` · ${policyPreview.daysRequested} day(s)`
                  : ""}
              </div>
              {policyPreview.flags.length === 0 ? (
                <div style={{ fontSize: 12, color: nectarColors.muted }}>
                  No policy issues.
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                  {policyPreview.flags.map((f) => (
                    <li key={f.code + f.message}>{f.message}</li>
                  ))}
                </ul>
              )}
              {policyPreview.suggestions?.length ? (
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  {policyPreview.suggestions.join(" · ")}
                </div>
              ) : null}
            </div>
          ) : null}
        </Form>
      </Drawer>

      <Modal
        title={
          coverLeave
            ? `Who covers ${coverLeave.employeeName}?`
            : "Choose replacement"
        }
        open={Boolean(coverLeave)}
        okText="Cover this shift"
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
                ? "Covered with overtime"
                : "Replacement arranged",
            );
            setCoverLeave(null);
            setCoverChoice(undefined);
            setTick((t) => t + 1);
          } catch (err) {
            message.error(err instanceof Error ? err.message : "Action failed");
          }
        }}
      >
        <p style={{ marginTop: 0, color: nectarColors.muted, fontSize: 13 }}>
          People at this site are listed first, then the cluster.
        </p>
        <Radio.Group
          value={coverChoice}
          onChange={(e) => setCoverChoice(e.target.value)}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {coverOptions.local.map((person) => (
            <Radio key={person.relieverId} value={person.relieverId}>
              {person.name} · this site · {person.phone}
            </Radio>
          ))}
          {coverOptions.cluster.map((person) => (
            <Radio key={person.relieverId} value={person.relieverId}>
              {person.name} · cluster
              {person.homeSiteId ? ` · ${getSiteName(person.homeSiteId)}` : ""}
              {" · "}
              {person.phone}
            </Radio>
          ))}
          <Radio value="ot">No one — accept overtime</Radio>
        </Radio.Group>
      </Modal>

      <Modal
        title="Reject leave"
        open={Boolean(rejectRow)}
        okText="Reject"
        okButtonProps={{ danger: true }}
        onCancel={() => setRejectRow(null)}
        onOk={() => {
          if (!rejectRow) return;
          const note = rejectNote.trim();
          if (!note) {
            message.error("Add a remark before rejecting");
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
            message.success("Leave rejected");
            setRejectRow(null);
            setRejectNote("");
            setTick((t) => t + 1);
          } catch (err) {
            message.error(err instanceof Error ? err.message : "Action failed");
          }
        }}
      >
        <Input.TextArea
          rows={3}
          placeholder="Remark — why this leave is rejected"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}
