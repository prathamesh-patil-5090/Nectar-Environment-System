"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  App,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  Radio,
  Select,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined } from "@ant-design/icons";
import { getSession } from "@/lib/auth";
import { employees, getEmployeeById, getSiteName } from "@/lib/mock-data";
import {
  createLeaveRequest,
  getLeaveRequests,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  type LeaveMode,
  type LeaveRequest,
  type LeaveType,
} from "@/lib/leave";
import { pushNotification } from "@/lib/notifications";
import {
  canEnterLeaveForOthers,
  leaveActorRole,
  scopedEmployeeId,
  scopedSiteId,
  selfEmployeeId,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

export default function LeaveRequestsContent() {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const mineOnly = searchParams.get("mine") === "1";
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const empScope = scopedEmployeeId(session);
  const selfId = selfEmployeeId(session);
  const personalOnly = Boolean(empScope) || mineOnly;
  const filterEmployeeId = empScope ?? (mineOnly ? selfId : undefined);
  const canEnterOthers = canEnterLeaveForOthers(session) && !personalOnly;
  const actorRole = leaveActorRole(session);

  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const rows = useMemo(() => {
    void tick;
    let list = getLeaveRequests(personalOnly ? undefined : siteScope);
    if (filterEmployeeId) {
      list = list.filter((l) => l.employeeId === filterEmployeeId);
    }
    return list;
  }, [siteScope, filterEmployeeId, personalOnly, tick]);

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
      render: (_, r) => `${r.startDate} → ${r.endDate}`,
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
      render: (s: LeaveRequest["status"]) => (
        <Tag>{LEAVE_STATUS_LABELS[s]}</Tag>
      ),
    },
  ];

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

    const created = createLeaveRequest({
      employeeId,
      mode: values.mode,
      leaveType: values.leaveType,
      startDate: values.range[0].format("YYYY-MM-DD"),
      endDate: values.range[1].format("YYYY-MM-DD"),
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

    message.success(
      created.status === "PENDING_EMPLOYEE_CONSENT"
        ? "Leave submitted — awaiting employee consent."
        : "Leave / absence recorded.",
    );
    setOpen(false);
    form.resetFields();
    setTick((t) => t + 1);
  };

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
            : "Planned leave and emergency absences — supervisor on-behalf requires employee consent before manager approval."}
        </p>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setOpen(true)}
        >
          {personalOnly ? "Request leave" : "Record leave / absence"}
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1000 }}
        style={{ background: nectarColors.white }}
      />

      <Drawer
        title="Record leave or emergency absence"
        size={480}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnHidden
        extra={
          <Button type="primary" onClick={onCreate}>
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
                (k) => ({ value: k, label: LEAVE_TYPE_LABELS[k] }),
              )}
            />
          </Form.Item>
          <Form.Item name="range" label="Dates" rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="expectedReturn"
            label="Expected return"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="lastCommunication" label="Last communication">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
