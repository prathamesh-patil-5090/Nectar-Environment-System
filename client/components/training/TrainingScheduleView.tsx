"use client";

import React, { useState } from "react";
import { Table, Tag, Button, Modal, Form, Input, Select, DatePicker, App } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CalendarOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { TrainingSession } from "@/lib/training/types";
import { getTrainingSessions, createTrainingSession, getAllCourses, getPeople, getPersonName, useTrainingData } from "@/lib/training/store";
import { useViewer } from "@/lib/training/hooks";
import { nectarColors } from "@/lib/theme";
import { sWhiteR14BorderShadow } from "@/lib/styles";

interface TrainingScheduleViewProps {
  /** Show only this employee's sessions (learner view). Omit for the manager / Director view. */
  employeeId?: string;
}

/** On-site practical / oral assessment slots (database). Managers and the Director can schedule. */
export default function TrainingScheduleView({ employeeId }: TrainingScheduleViewProps) {
  const { message } = App.useApp();
  const viewer = useViewer();
  const { ready } = useTrainingData();
  const isManager = !employeeId && (viewer.role === "manager" || viewer.role === "director");
  const sessions = getTrainingSessions(employeeId);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const allCourses = getAllCourses();
  const candidates = getPeople().filter((p) => viewer.role === "director" || p.managerId === viewer.personId);

  const handleCreate = async (values: {
    title: string;
    type: TrainingSession["type"];
    scheduledAt: { toISOString: () => string };
    venueOrLink: string;
    employeeIds: string[];
    courseId: string;
  }) => {
    if (!viewer.personId) return;
    setSaving(true);
    try {
      await createTrainingSession({
        actorId: viewer.personId,
        title: values.title,
        type: values.type,
        scheduledBy: viewer.personId,
        scheduledByName: viewer.session?.name ?? "",
        scheduledAt: values.scheduledAt.toISOString(),
        venueOrLink: values.venueOrLink,
        employeeIds: values.employeeIds,
        courseId: values.courseId,
      });
      setModalOpen(false);
      form.resetFields();
      message.success("Assessment scheduled. The candidates have been notified.");
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<TrainingSession> = [
    {
      title: "Session Title & Assessment",
      dataIndex: "title",
      key: "title",
      render: (t: string, r) => (
        <div>
          <div style={{ fontWeight: 600, color: nectarColors.ink, fontSize: 13 }}>{t}</div>
          <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 2 }}>Conducted by: {r.scheduledByName}</div>
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type: TrainingSession["type"]) => {
        const color = type === "PRACTICAL" ? "green" : type === "ORAL" ? "blue" : "purple";
        return (
          <Tag color={color} style={{ borderRadius: 10, fontWeight: 600, fontSize: 11 }}>{type}</Tag>
        );
      },
    },
    {
      title: "Scheduled Date & Time",
      dataIndex: "scheduledAt",
      key: "scheduledAt",
      render: (dt: string) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <CalendarOutlined style={{ color: nectarColors.leaf }} />
          <span style={{ fontWeight: 500, color: nectarColors.ink }}>
            {isNaN(Date.parse(dt)) ? dt : new Date(dt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
          </span>
        </div>
      ),
    },
    {
      title: "Venue / Station",
      dataIndex: "venueOrLink",
      key: "venueOrLink",
      render: (v: string) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: nectarColors.muted }}>
          <EnvironmentOutlined />
          <span>{v}</span>
        </div>
      ),
    },
    {
      title: "Assigned Candidates",
      dataIndex: "employeeIds",
      key: "employeeIds",
      render: (ids: string[]) => {
        const names = ids.map((id) => getPersonName(id) ?? id).join(", ");
        return <span style={{ fontSize: 12, fontWeight: 500 }}>{names}</span>;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      render: (s: string) => (
        <Tag color="cyan" style={{ borderRadius: 12, fontSize: 11, textTransform: "capitalize" }}>{s}</Tag>
      ),
    },
  ];

  return (
    <div style={sWhiteR14BorderShadow}>
      <div
        style={{
          padding: "16px 20px", borderBottom: "1px solid rgba(28, 68, 99, 0.08)", display: "flex",
          justifyContent: "space-between", alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: nectarColors.ink }}>{isManager ? "Plant Evaluation & Training Calendar" : "My Scheduled Assessment Sessions"}</h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: nectarColors.muted }}>Hands-on plant floor observations and technical viva interview appointments.</p>
        </div>

        {isManager && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
            style={{ borderRadius: 8, background: nectarColors.leaf }}
          >
            Schedule Assessment Slot
          </Button>
        )}
      </div>

      <Table rowKey="id" columns={columns} dataSource={sessions} pagination={false} loading={!ready} scroll={{ x: 800 }} locale={{ emptyText: "No assessments scheduled" }} />

      {/* Schedule Modal */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        title="Schedule Practical / Oral Assessment"
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Session Title" rules={[{ required: true, message: "Please enter title" }]}><Input placeholder="e.g. Practical Observation: PAC Dosing & SVI Settleability" /></Form.Item>

          <Form.Item name="type" label="Assessment Type" initialValue="PRACTICAL">
            <Select
              options={[
                { value: "PRACTICAL", label: "Practical Field Observation (1–7 Scale)" },
                { value: "ORAL", label: "Oral Viva Interview (1–7 Scale)" },
                { value: "ONLINE_VIDEO", label: "Group Technical Lecture" },
              ]}
            />
          </Form.Item>

          <Form.Item name="courseId" label="Associated Course" rules={[{ required: true, message: "Select course" }]}><Select options={allCourses.map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))} /></Form.Item>

          <Form.Item
            name="employeeIds"
            label="Candidate Employees"
            rules={[{ required: true, message: "Select candidates" }]}
          >
            <Select
              mode="multiple"
              options={candidates.map((e) => ({ value: e.id, label: `${e.name} (${e.designation ?? ""})` }))}
            />
          </Form.Item>

          <Form.Item name="scheduledAt" label="Date & Time" rules={[{ required: true, message: "Select date & time" }]}><DatePicker showTime style={{ width: "100%" }} /></Form.Item>

          <Form.Item
            name="venueOrLink"
            label="Plant Venue or Video Link"
            rules={[{ required: true, message: "Enter venue" }]}
          >
            <Input placeholder="e.g. Pune ETP Facility — Secondary Clarifier Platform" />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving} style={{ background: nectarColors.leaf }}>Confirm Schedule</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
