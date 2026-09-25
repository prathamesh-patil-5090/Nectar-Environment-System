"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import dayjs from "dayjs";
import { PlusOutlined } from "@ant-design/icons";
import { getSession } from "@/lib/auth";
import { employees, getSiteName } from "@/lib/mock-data";
import {
  createLeaveRequest,
  getLeaveRequests,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  type LeaveMode,
  type LeaveRequest,
  type LeaveType,
} from "@/lib/leave";
import {
  canEnterLeaveForOthers,
  leaveActorRole,
  scopedEmployeeId,
  scopedSiteId,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

export default function LeaveRequestsPage() {
  const { message } = App.useApp();
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const empScope = scopedEmployeeId(session);
  const canEnterOthers = canEnterLeaveForOthers(session);
  const actorRole = leaveActorRole(session);

  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const rows = useMemo(() => {
    let list = getLeaveRequests(siteScope);
    if (empScope) list = list.filter((l) => l.employeeId === empScope);
    return list;
  }, [siteScope, empScope, tick]);

  const columns: ColumnsType<LeaveRequest> = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      render: (name, r) => (
        <Link href={`/leave/requests/${r.id}`} style={{ color: nectarColors.leaf, fontWeight: 600 }}>
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
    const employeeId = empScope ?? values.employeeId;
    const isOnBehalf =
      canEnterOthers &&
      (values.entrySource === "supervisor_on_behalf" ||
        actorRole === "supervisor" ||
        actorRole === "site_incharge");

    createLeaveRequest({
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
      supervisorName:
        actorRole === "supervisor" ? (session?.name ?? "Supervisor") : "Amit Supervisor",
      siteInChargeName:
        actorRole === "site_incharge"
          ? (session?.name ?? "Site In-Charge")
          : "Site In-Charge",
      lastCommunication: values.lastCommunication,
    });
    message.success("Leave / absence recorded.");
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
          {empScope
            ? "Your leave and absence requests."
            : "Planned leave and emergency absences — including supervisor-assisted entry for verbal / low-literacy reporting."}
        </p>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          {empScope ? "Request leave" : "Record leave / absence"}
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
            employeeId: empScope,
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
              disabled={Boolean(empScope)}
              options={employees
                .filter((e) => {
                  if (empScope) return e.id === empScope;
                  if (siteScope) return e.siteId === siteScope;
                  return true;
                })
                .map((e) => ({
                  value: e.id,
                  label: `${e.name} (${getSiteName(e.siteId)})`,
                }))}
            />
          </Form.Item>
          <Form.Item name="mode" label="Mode">
            <Radio.Group
              optionType="button"
              options={[
                { value: "planned", label: "Planned leave" },
                { value: "emergency", label: "Emergency absence" },
              ]}
            />
          </Form.Item>
          {canEnterOthers ? (
            <Form.Item name="entrySource" label="How was this entered?">
              <Radio.Group
                options={[
                  { value: "employee", label: "Requested by employee" },
                  {
                    value: "supervisor_on_behalf",
                    label: "Entered by supervisor on behalf",
                  },
                ]}
              />
            </Form.Item>
          ) : null}
          <Form.Item name="leaveType" label="Leave type" rules={[{ required: true }]}>
            <Select
              options={(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map(
                (t) => ({ value: t, label: LEAVE_TYPE_LABELS[t] }),
              )}
            />
          </Form.Item>
          <Form.Item
            name="range"
            label="Leave dates"
            rules={[{ required: true }]}
          >
            <DatePicker.RangePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="expectedReturn"
            label="Expected return date"
            rules={[{ required: true }]}
            initialValue={dayjs().add(2, "day")}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="lastCommunication" label="Last communication (optional)">
            <Input placeholder="e.g. Called at 07:10 — family emergency" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
