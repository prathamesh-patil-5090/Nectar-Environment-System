"use client";

import React, { useState } from "react";
import { Table, Tag, Button, Modal, Form, Input, Select, DatePicker, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CalendarOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { TrainingSession } from "@/lib/training/types";
import { getTrainingSessions, createTrainingSession, getAllCourses } from "@/lib/training/store";
import { employees } from "@/lib/mock-data";
import { nectarColors } from "@/lib/theme";

interface TrainingScheduleViewProps {
  isManager?: boolean;
  employeeId?: string;
}

export default function TrainingScheduleView({
  isManager = false,
  employeeId,
}: TrainingScheduleViewProps) {
  const [sessions, setSessions] = useState<TrainingSession[]>(() =>
    getTrainingSessions(isManager ? undefined : employeeId),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const allCourses = getAllCourses();

  const handleCreate = (values: any) => {
    const newSess = createTrainingSession({
      title: values.title,
      type: values.type,
      scheduledBy: "emp0123",
      scheduledByName: "Rajesh Kulkarni (Plant Manager)",
      scheduledAt: values.scheduledAt.format("YYYY-MM-DD HH:mm"),
      venueOrLink: values.venueOrLink,
      employeeIds: values.employeeIds,
      courseId: values.courseId,
    });
    setSessions(getTrainingSessions(isManager ? undefined : employeeId));
    setModalOpen(false);
    form.resetFields();
    message.success("Training assessment session scheduled on plant calendar!");
  };

  const columns: ColumnsType<TrainingSession> = [
    {
      title: "Session Title & Assessment",
      dataIndex: "title",
      key: "title",
      render: (t: string, r) => (
        <div>
          <div style={{ fontWeight: 600, color: nectarColors.ink, fontSize: 13 }}>{t}</div>
          <div style={{ fontSize: 11, color: nectarColors.muted, marginTop: 2 }}>
            Conducted by: {r.scheduledByName}
          </div>
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
          <Tag color={color} style={{ borderRadius: 10, fontWeight: 600, fontSize: 11 }}>
            {type}
          </Tag>
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
          <span style={{ fontWeight: 500, color: nectarColors.ink }}>{dt}</span>
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
        const names = ids
          .map((id) => employees.find((e) => e.id === id)?.name || id)
          .join(", ");
        return <span style={{ fontSize: 12, fontWeight: 500 }}>{names}</span>;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      render: (s: string) => (
        <Tag color="cyan" style={{ borderRadius: 12, fontSize: 11, textTransform: "capitalize" }}>
          {s}
        </Tag>
      ),
    },
  ];

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 14,
        border: "1px solid rgba(28, 68, 99, 0.08)",
        boxShadow: "0 2px 10px rgba(11, 26, 36, 0.03)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(28, 68, 99, 0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: nectarColors.ink }}>
            {isManager ? "Plant Evaluation & Training Calendar" : "My Scheduled Assessment Sessions"}
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: nectarColors.muted }}>
            Hands-on plant floor observations and technical viva interview appointments.
          </p>
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

      <Table rowKey="id" columns={columns} dataSource={sessions} pagination={false} />

      {/* Schedule Modal */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        title="Schedule Practical / Oral Assessment"
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Session Title"
            rules={[{ required: true, message: "Please enter title" }]}
          >
            <Input placeholder="e.g. Practical Observation: PAC Dosing & SVI Settleability" />
          </Form.Item>

          <Form.Item name="type" label="Assessment Type" initialValue="PRACTICAL">
            <Select
              options={[
                { value: "PRACTICAL", label: "Practical Field Observation (1–7 Scale)" },
                { value: "ORAL", label: "Oral Viva Interview (1–7 Scale)" },
                { value: "ONLINE_VIDEO", label: "Group Technical Lecture" },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="courseId"
            label="Associated Course"
            rules={[{ required: true, message: "Select course" }]}
          >
            <Select
              options={allCourses.map((c) => ({
                value: c.id,
                label: `${c.code} — ${c.title}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="employeeIds"
            label="Candidate Employees"
            rules={[{ required: true, message: "Select candidates" }]}
          >
            <Select
              mode="multiple"
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.name} (${e.designation})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="scheduledAt"
            label="Date & Time"
            rules={[{ required: true, message: "Select date & time" }]}
          >
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="venueOrLink"
            label="Plant Venue or Video Link"
            rules={[{ required: true, message: "Enter venue" }]}
          >
            <Input placeholder="e.g. Pune ETP Facility — Secondary Clarifier Platform" />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" style={{ background: nectarColors.leaf }}>
              Confirm Schedule
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
