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
import { tr, trNode, trData, trCell } from "@/lib/i18n";

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
    { title: tr("Employee"), dataIndex: "employeeName", render: trCell },
    { title: tr("Plant"), dataIndex: "siteId", render: (id) => trData(getSiteName(id)) },
    { title: tr("Date"), dataIndex: "date" },
    { title: tr("Hours"), dataIndex: "hours", render: (h) => `${h}h` },
    { title: tr("Reason"), dataIndex: "reason", render: trCell },
    { title: tr("Status"), dataIndex: "status", render: (s) => <Tag>{trData(s)}</Tag> },
    { title: tr("Assigned by"), dataIndex: "assignedBy", render: trCell },
  ];

  const onAssign = async () => {
    if (!canAssign) {
      message.error(tr("Only plant managers (and director) can assign OT."));
      return;
    }
    const values = await form.validateFields();
    // Soft-block: person is involved in an open high/critical safety incident
    const hold = openSeriousIncidentFor(values.employeeId);
    if (hold) {
      const ok = await modal.confirm({
        title: tr("Assign OT despite open safety incident?"),
        content: tr("This person is involved in \"{title}\" ({severity}), which is still open. Assign only if they are fit for duty.", { title: trData(hold.title), severity: trData(hold.severity) }),
        okText: tr("Assign anyway"),
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
      message.success(tr("OT assigned — employee notified."));
      form.resetFields();
      setTick((t) => t + 1);
    } catch {
      message.error(tr("Could not assign OT"));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
        {siteScope
          ? tr("Assign and notify OT for {siteName} staff.", { siteName: trData(getSiteName(siteScope)) })
          : tr("Assign and notify OT across plants (director).")}{" "}
        {trNode("Gap-driven OT: prefer {link}.", { link: <Link href="/overtime/decisions">{tr("OT Decisions")}</Link> })}
      </p>

      {approvedSuggestions.length > 0 ? (
        <Alert
          type="info"
          showIcon
          message={tr("Approved OT decisions with assignees")}
          description={
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {approvedSuggestions.slice(0, 5).map((d) => (
                <li key={d.id}>
                  {trData(d.chosenEmployeeName)} · {d.date} · {d.hours}h · {trData(d.title)}{" "}
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
                    {tr("Prefill")}
                  </Button>
                </li>
              ))}
            </ul>
          }
        />
      ) : null}

      {canAssign ? (
        <div style={sWhitePadR10}>
          <div style={sSerifText18Mb12}>{tr("Assign OT")}</div>
          <Form form={form} layout="vertical" style={{ maxWidth: 520 }} initialValues={{ hours: 4, date: dayjs() }}>
            <Form.Item name="employeeId" label={tr("Employee")} rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={plantEmployees.map((e) => ({ value: e.id, label: `${trData(e.name)} · ${trData(e.role)}` }))}
              />
            </Form.Item>
            {safetyHold ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title={trNode("Open safety incident: {link} — confirm they are fit before assigning OT.", { link: <Link href={`/safety/incidents/${safetyHold.id}`}>{trData(safetyHold.title)}</Link> })}
              />
            ) : null}
            <Form.Item name="date" label={tr("Date")} rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="hours" label={tr("Hours")} rules={[{ required: true }]}><InputNumber min={1} max={12} style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="reason" label={tr("Reason")} rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
            <Form.Item name="notes" label={tr("Notes")}><Input.TextArea rows={2} placeholder={tr("Optional instructions")} /></Form.Item>
            <Button type="primary" onClick={onAssign}>{tr("Assign & notify")}</Button>
          </Form>
        </div>
      ) : (
        <p style={{ color: nectarColors.muted }}>
          {tr("View-only: OT assignments for your plant. Managers assign OT from this screen.")}
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
