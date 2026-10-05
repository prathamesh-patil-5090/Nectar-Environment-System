"use client";

import { useMemo, useState } from "react";
import {
  App,
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { employees, getSiteName } from "@/lib/mock-data";
import {
  assignOt,
  getOtAssignments,
  type OtAssignment,
} from "@/lib/overtime";
import { getOtDecisions } from "@/lib/ot-decision";
import { canAssignOt, scopedSiteId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { sSerifText18Mb12, sWhitePadR10 } from "@/lib/styles";
import { openSeriousIncidentFor } from "@/lib/safety/gates";

export default function OtAssignPage() {
  const { message, modal } = App.useApp();
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const canAssign = canAssignOt(session);
  const [tick, setTick] = useState(0);
  const [form] = Form.useForm();
  const pickedEmployeeId: string | undefined = Form.useWatch("employeeId", form);
  const safetyHold = pickedEmployeeId ? openSeriousIncidentFor(pickedEmployeeId) : undefined;

  const approvedSuggestions = useMemo(() => {
    void tick;
    return getOtDecisions({
      siteId: siteScope,
      status: "approved",
    }).filter((d) => d.chosenEmployeeId);
  }, [siteScope, tick]);

  const plantEmployees = useMemo(
    () =>
      employees.filter(
        (e) =>
          e.otEligible &&
          e.employmentStatus === "active" &&
          e.employeeCategory !== "manager" &&
          (siteScope ? e.siteId === siteScope : true),
      ),
    [siteScope],
  );

  const rows = useMemo(() => {
    void tick;
    return getOtAssignments({ siteId: siteScope, employeeId: undefined });
  }, [siteScope, tick]);

  const columns: ColumnsType<OtAssignment> = [
    { title: "Employee", dataIndex: "employeeName" },
    { title: "Plant", dataIndex: "siteId", render: (id) => getSiteName(id) },
    { title: "Date", dataIndex: "date" },
    { title: "Hours", dataIndex: "hours", render: (h) => `${h}h` },
    { title: "Reason", dataIndex: "reason" },
    { title: "Status", dataIndex: "status", render: (s) => <Tag>{s}</Tag> },
    { title: "Assigned by", dataIndex: "assignedBy" },
  ];

  const onAssign = async () => {
    if (!canAssign) {
      message.error("Only plant managers (and director) can assign OT.");
      return;
    }
    const values = await form.validateFields();
    // Soft-block: person is involved in an open high/critical safety incident
    const hold = openSeriousIncidentFor(values.employeeId);
    if (hold) {
      const ok = await modal.confirm({
        title: "Assign OT despite open safety incident?",
        content: `This person is involved in "${hold.title}" (${hold.severity}), which is still open. Assign only if they are fit for duty.`,
        okText: "Assign anyway",
        okButtonProps: { danger: true },
      });
      if (!ok) return;
      values.notes = [values.notes, `Safety hold overridden by ${session?.name ?? "Manager"} (case ${hold.id})`].filter(Boolean).join(" · ");
    }
    try {
      assignOt({
        employeeId: values.employeeId,
        date: values.date.format("YYYY-MM-DD"),
        hours: values.hours,
        reason: values.reason,
        assignedBy: session?.name ?? "Manager",
        assignedByEmployeeId: session?.employeeId,
        notes: values.notes,
      });
      message.success("OT assigned — employee notified.");
      form.resetFields();
      setTick((t) => t + 1);
    } catch {
      message.error("Could not assign OT");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
        {siteScope
          ? `Assign and notify OT for ${getSiteName(siteScope)} staff.`
          : "Assign and notify OT across plants (director)."}{" "}
        Gap-driven OT: prefer{" "}
        <Link href="/overtime/decisions">OT Decisions</Link>.
      </p>

      {approvedSuggestions.length > 0 ? (
        <Alert
          type="info"
          showIcon
          message="Approved OT decisions with assignees"
          description={
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {approvedSuggestions.slice(0, 5).map((d) => (
                <li key={d.id}>
                  {d.chosenEmployeeName} · {d.date} · {d.hours}h · {d.title}{" "}
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      form.setFieldsValue({
                        employeeId: d.chosenEmployeeId,
                        date: dayjs(d.date),
                        hours: d.hours,
                        reason: d.remark ?? d.title,
                      });
                    }}
                  >
                    Prefill
                  </Button>
                </li>
              ))}
            </ul>
          }
        />
      ) : null}

      {canAssign ? (
        <div style={sWhitePadR10}>
          <div style={sSerifText18Mb12}>Assign OT</div>
          <Form form={form} layout="vertical" style={{ maxWidth: 520 }} initialValues={{ hours: 4, date: dayjs() }}>
            <Form.Item name="employeeId" label="Employee" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={plantEmployees.map((e) => ({ value: e.id, label: `${e.name} · ${e.role}` }))}
              />
            </Form.Item>
            {safetyHold ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title={<>Open safety incident: <Link href={`/safety/incidents/${safetyHold.id}`}>{safetyHold.title}</Link> — confirm they are fit before assigning OT.</>}
              />
            ) : null}
            <Form.Item name="date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="hours" label="Hours" rules={[{ required: true }]}><InputNumber min={1} max={12} style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="reason" label="Reason" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
            <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} placeholder="Optional instructions" /></Form.Item>
            <Button type="primary" onClick={onAssign}>Assign & notify</Button>
          </Form>
        </div>
      ) : (
        <p style={{ color: nectarColors.muted }}>
          View-only: OT assignments for your plant. Managers assign OT from this
          screen.
        </p>
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 8 }}
        style={{ background: nectarColors.white }}
      />
    </div>
  );
}
