"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Col, DatePicker, Form, Input, InputNumber, Modal, Radio, Row, Select, Space, Switch } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { createEvent, getCommunities, getMentors, updateEvent, type EventInput } from "@/lib/api/training";
import { getAllCourses, getPeople, getSiteName, useTrainingData } from "@/lib/training/store";
import { useAsync, useViewer } from "@/lib/training/hooks";
import type { TrainingEvent } from "@/lib/training/types";
import { tr, trTable, trData } from "@/lib/i18n";

type Values = {
  title: string;
  type: TrainingEvent["type"];
  communityId?: string;
  coHosts?: string[];
  description?: string;
  agenda?: { time: string; item: string }[];
  topics?: string[];
  audienceRoles?: string[];
  audiencePlants?: string[];
  when: [Dayjs, Dayjs];
  repeat?: "none" | "week" | "month";
  repeatCount?: number;
  format: "online" | "in_person";
  meetLink?: string;
  siteId?: string;
  room?: string;
  capacity: number;
  waitlistEnabled: boolean;
  rsvpWindow?: [Dayjs | null, Dayjs | null];
  rsvpQuestion?: string;
};

const ROLE_OPTIONS = trTable([
  { value: "employee", label: "Plant Operators" },
  { value: "shift_incharge", label: "Shift In-Charges" },
  { value: "supervisor", label: "Site Managers" },
  { value: "safety_incharge", label: "Safety In-Charges" },
  { value: "manager", label: "Plant Managers" },
]);

/** Create or edit an event (Meetup organizer form). Save as draft or publish. */
export default function EventFormModal({
  open,
  event,
  onClose,
  onSaved,
}: {
  open: boolean;
  event?: TrainingEvent | null;
  onClose: () => void;
  onSaved: (events: TrainingEvent[]) => void;
}) {
  const { message } = App.useApp();
  const viewer = useViewer();
  useTrainingData();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const format = Form.useWatch("format", form) ?? "online";
  const repeat = Form.useWatch("repeat", form) ?? "none";
  const communities = useAsync(() => getCommunities(viewer.personId), [viewer.personId]);
  const mentors = useAsync(() => getMentors(), []);
  const editing = Boolean(event);

  const sites = useMemo(() => {
    const ids = [...new Set(getPeople().map((p) => p.siteId).filter(Boolean))] as string[];
    return ids;
  }, []);
  const skillOptions = useMemo(
    () => [...new Set(getAllCourses().flatMap((c) => c.skills ?? []))].sort().map((s) => ({ value: s, label: s })),
    [],
  );

  useEffect(() => {
    if (!open) return;
    if (event) {
      form.setFieldsValue({
        title: event.title,
        type: event.type,
        communityId: event.communityId,
        coHosts: event.hostEmployeeIds.filter((h) => h !== viewer.personId),
        description: event.description,
        agenda: event.agenda,
        topics: event.topics,
        audienceRoles: event.audience.roles,
        audiencePlants: event.audience.plantTypes,
        when: [dayjs(event.startsAt), dayjs(event.endsAt)],
        format: event.format,
        meetLink: event.meetLink,
        siteId: event.venue?.siteId,
        room: event.venue?.room,
        capacity: event.capacity,
        waitlistEnabled: event.waitlistEnabled,
        rsvpWindow: [event.rsvpOpensAt ? dayjs(event.rsvpOpensAt) : null, event.rsvpClosesAt ? dayjs(event.rsvpClosesAt) : null],
        rsvpQuestion: event.rsvpQuestion,
      });
    } else {
      form.resetFields();
    }
  }, [open, event, form, viewer.personId]);

  const toInput = (v: Values, publish: boolean): EventInput => ({
    title: v.title.trim(),
    type: v.type,
    communityId: v.communityId,
    hostEmployeeIds: [viewer.personId!, ...(v.coHosts ?? [])],
    description: v.description?.trim() ?? "",
    agenda: (v.agenda ?? []).filter((a) => a?.time && a?.item),
    topics: v.topics ?? [],
    audience: { roles: v.audienceRoles ?? [], plantTypes: v.audiencePlants ?? [] },
    startsAt: v.when[0].toISOString(),
    endsAt: v.when[1].toISOString(),
    format: v.format,
    meetLink: v.format === "online" ? v.meetLink?.trim() ?? "" : "",
    venue: v.format === "in_person" ? { siteId: v.siteId!, room: v.room?.trim() } : undefined,
    capacity: v.capacity,
    waitlistEnabled: v.waitlistEnabled,
    rsvpOpensAt: v.rsvpWindow?.[0]?.toISOString(),
    rsvpClosesAt: v.rsvpWindow?.[1]?.toISOString(),
    rsvpQuestion: v.rsvpQuestion?.trim() || undefined,
    ...(editing ? {} : { publish, ...(v.repeat && v.repeat !== "none" ? { repeat: { every: v.repeat, count: v.repeatCount ?? 4 } } : {}) }),
  });

  const save = async (publish: boolean) => {
    let v: Values;
    try {
      v = await form.validateFields();
    } catch {
      return;
    }
    if (!viewer.personId) return;
    setSaving(publish ? "publish" : "draft");
    try {
      if (event) {
        const updated = await updateEvent(event.id, toInput(v, publish), viewer.personId);
        message.success(event.status === "published" ? tr("Saved. Attendees were told if the time or place changed.") : tr("Saved"));
        onSaved([updated]);
      } else {
        const created = await createEvent(toInput(v, publish), viewer.personId);
        message.success(publish ? (created.length > 1 ? tr("Published {count} events. Community members were notified.", { count: created.length }) : tr("Published the event. Community members were notified.")) : tr("Saved as draft"));
        onSaved(created);
      }
      onClose();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal
      open={open}
      title={editing ? tr("Edit event") : tr("Create event")}
      onCancel={onClose}
      width={760}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          {(!editing || event?.status === "draft") && (
            <Button loading={saving === "draft"} onClick={() => save(false)}>{editing ? tr("Save draft") : tr("Save as draft")}</Button>
          )}
          {editing && event?.status === "published" ? (
            <Button type="primary" loading={saving === "publish"} onClick={() => save(true)}>{tr("Save changes")}</Button>
          ) : !editing ? (
            <Button type="primary" loading={saving === "publish"} onClick={() => save(true)}>{tr("Publish")}</Button>
          ) : null}
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ type: "masterclass", format: "online", capacity: 30, waitlistEnabled: true, repeat: "none", repeatCount: 4 }}>
        <Form.Item name="title" label={tr("Title")} rules={[{ required: true, whitespace: true }]}>
          <Input maxLength={120} placeholder={tr("e.g. Clarifier troubleshooting in the monsoon")} />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} md={8}>
            <Form.Item name="type" label={tr("Type")}>
              <Select options={[{ value: "masterclass", label: tr("Masterclass") }, { value: "seminar", label: tr("Seminar") }, { value: "workshop", label: tr("Workshop") }, { value: "clinic", label: tr("Clinic") }]} />
            </Form.Item>
          </Col>
          <Col xs={24} md={16}>
            <Form.Item name="communityId" label={tr("Community")}>
              <Select allowClear placeholder={tr("None")} options={(communities.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="coHosts" label={tr("Co-hosts")}>
          <Select
            mode="multiple"
            allowClear
            placeholder={tr("Other mentors")}
            options={(mentors.data ?? []).filter((m) => m.employeeId !== viewer.personId).map((m) => ({ value: m.employeeId, label: m.name }))}
          />
        </Form.Item>
        <Form.Item name="description" label={tr("Details")}>
          <Input.TextArea rows={4} maxLength={2000} showCount placeholder={tr("What will you cover? What should people prepare?")} />
        </Form.Item>
        <Form.List name="agenda">
          {(fields, { add, remove }) => (
            <Form.Item label={tr("Agenda")}>
              {fields.map((f) => (
                <Space key={f.key} align="baseline" style={{ display: "flex" }}>
                  <Form.Item name={[f.name, "time"]} style={{ width: 90 }}><Input placeholder="15:00" /></Form.Item>
                  <Form.Item name={[f.name, "item"]} style={{ flex: 1, minWidth: 260 }}><Input placeholder={tr("Topic")} /></Form.Item>
                  <MinusCircleOutlined onClick={() => remove(f.name)} aria-label={tr("Remove agenda item")} />
                </Space>
              ))}
              <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>{tr("Add agenda item")}</Button>
            </Form.Item>
          )}
        </Form.List>
        <Form.Item name="topics" label={tr("Topics (skills)")} extra={tr("Linked to course skills, so the event shows on related course pages.")}>
          <Select mode="tags" options={skillOptions} placeholder={tr("Pick or type")} />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="audienceRoles" label={tr("Who should attend (roles)")}>
              <Select mode="multiple" allowClear options={ROLE_OPTIONS} placeholder={tr("Everyone")} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="audiencePlants" label={tr("Plants")}>
              <Select mode="multiple" allowClear options={["ETP", "RO", "MEE"].map((p) => ({ value: p, label: tr("{p} plant", { p: trData(p) }) }))} placeholder={tr("All plants")} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="when" label={tr("Date and time (IST)")} rules={[{ required: true, message: tr("Pick the start and end") }]}>
          <DatePicker.RangePicker showTime={{ format: "HH:mm", minuteStep: 5 }} format="DD MMM YYYY HH:mm" style={{ width: "100%" }} disabledDate={(d) => d.isBefore(dayjs(), "day")} />
        </Form.Item>
        {!editing && (
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="repeat" label={tr("Repeat")}>
                <Radio.Group options={[{ value: "none", label: tr("Once") }, { value: "week", label: tr("Weekly") }, { value: "month", label: tr("Monthly") }]} />
              </Form.Item>
            </Col>
            {repeat !== "none" && (
              <Col xs={24} md={12}>
                <Form.Item name="repeatCount" label={tr("Number of events")}>
                  <InputNumber min={2} max={26} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            )}
          </Row>
        )}
        <Form.Item name="format" label={tr("Where")}>
          <Radio.Group optionType="button" options={[{ value: "online", label: tr("Online (Google Meet)") }, { value: "in_person", label: tr("At a plant") }]} />
        </Form.Item>
        {format === "online" ? (
          <Form.Item name="meetLink" label={tr("Google Meet link")} rules={[{ type: "url", message: tr("Enter a valid link") }]} extra={tr("Only people who are going (and hosts) can see it.")}>
            <Input placeholder="https://meet.google.com/…" />
          </Form.Item>
        ) : (
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="siteId" label={tr("Plant")} rules={[{ required: true, message: tr("Pick the plant") }]}>
                <Select options={sites.map((s) => ({ value: s, label: getSiteName(s) ?? s }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="room" label={tr("Room / spot")}>
                <Input placeholder={tr("e.g. Control room")} maxLength={60} />
              </Form.Item>
            </Col>
          </Row>
        )}
        <Row gutter={12}>
          <Col xs={12} md={8}>
            <Form.Item name="capacity" label={tr("Seats")} rules={[{ required: true }]}>
              <InputNumber min={1} max={500} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item name="waitlistEnabled" label={tr("Waitlist when full")} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="rsvpWindow" label={tr("Registration opens / closes (optional)")}>
          <DatePicker.RangePicker showTime={{ format: "HH:mm" }} format="DD MMM YYYY HH:mm" allowEmpty={[true, true]} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="rsvpQuestion" label={tr("Question for people who register (optional)")}>
          <Input maxLength={200} placeholder={tr("e.g. What problem do you want to discuss?")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
