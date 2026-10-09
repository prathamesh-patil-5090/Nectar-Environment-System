"use client";

import { useMemo, useState } from "react";
import { App, DatePicker, Form, Input, Modal, Radio, Select } from "antd";
import type { Dayjs } from "dayjs";
import { createTrainingAssignment, getAllCourses, getPeople, useTrainingData } from "@/lib/training/store";
import { useViewer } from "@/lib/training/hooks";
import { tr, trData } from "@/lib/i18n";

/** Who this viewer may flag: the Director → anyone; a manager → their allotted employees (plan §7 Q1). */
export function flaggableIds(viewer: ReturnType<typeof useViewer>): Set<string> {
  const people = getPeople();
  if (viewer.role === "director") return new Set(people.map((p) => p.id));
  return new Set(people.filter((p) => p.managerId && p.managerId === viewer.personId).map((p) => p.id));
}

type Values = {
  employeeIds: string[];
  kind: "suggested" | "mandatory";
  courseId?: string;
  topic?: string;
  skills?: string[];
  dueDate?: Dayjs;
  priority: "critical" | "high" | "normal";
  reason: string;
};

/**
 * Flag a weak area (suggestion → boosts the learner's Recommended shelf with your name and note)
 * or assign mandatory training (→ "Assigned to you" with a due date). The learner is notified.
 */
export default function FlagTrainingNeedModal({
  open,
  onClose,
  onSaved,
  initialEmployeeIds,
  initialCourseId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialEmployeeIds?: string[];
  initialCourseId?: string;
}) {
  const { message } = App.useApp();
  const viewer = useViewer();
  useTrainingData();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  const kind = Form.useWatch("kind", form) ?? "suggested";

  const allowed = flaggableIds(viewer);
  const people = getPeople().filter((p) => allowed.has(p.id));
  const courses = getAllCourses();
  const skillOptions = useMemo(
    () => [...new Set(courses.flatMap((c) => c.skills ?? []))].sort().map((s) => ({ value: s, label: s })),
    [courses],
  );

  const submit = async (v: Values) => {
    setSaving(true);
    try {
      await createTrainingAssignment({
        employeeIds: v.employeeIds,
        assignedByEmployeeId: viewer.personId,
        kind: v.kind,
        courseId: v.courseId,
        topic: v.topic?.trim() || undefined,
        skills: v.skills ?? [],
        dueDate: v.dueDate?.format("YYYY-MM-DD"),
        priority: v.priority,
        reason: v.reason.trim(),
        source: "manager",
      });
      message.success(
        v.kind === "mandatory"
          ? tr("Assigned for {count} people. They have been notified.", { count: v.employeeIds.length })
          : tr("Flagged for {count} people. They have been notified.", { count: v.employeeIds.length }),
      );
      form.resetFields();
      onSaved?.();
      onClose();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={tr("Flag a weak area / assign training")}
      okText={kind === "mandatory" ? tr("Assign") : tr("Flag")}
      onOk={() => form.submit()}
      confirmLoading={saving}
      onCancel={onClose}
      destroyOnHidden
      width={620}
    >
      {people.length === 0 ? (
        <p style={{ color: "#4A6375" }}>
          {tr("Only the Director, or an employee's allotted manager, can flag or assign training. You have no allotted employees.")}
        </p>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          initialValues={{ kind: "suggested", priority: "normal", employeeIds: initialEmployeeIds?.filter((id) => allowed.has(id)), courseId: initialCourseId }}
        >
          <Form.Item name="employeeIds" label={tr("Employees")} rules={[{ required: true, message: tr("Pick at least one employee") }]}>
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder={tr("Your allotted employees")}
              options={people.map((p) => ({ value: p.id, label: `${trData(p.name)}${p.designation ? ` · ${trData(p.designation)}` : ""}` }))}
            />
          </Form.Item>
          <Form.Item name="kind" label={tr("Type")}>
            <Radio.Group
              optionType="button"
              options={[
                { value: "suggested", label: tr("Suggest (weak area)") },
                { value: "mandatory", label: tr("Mandatory (with due date)") },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="courseId"
            label={tr("Course")}
            rules={kind === "mandatory" ? [{ required: true, message: tr("Mandatory training needs a course") }] : []}
            extra={kind === "suggested" ? tr("Optional. Or describe the weak topic / skills below, and matching courses are suggested.") : undefined}
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={tr("Pick a course")}
              options={courses.map((c) => ({ value: c.id, label: `${c.code} · ${trData(c.title)}` }))}
            />
          </Form.Item>
          {kind === "suggested" && (
            <>
              <Form.Item name="topic" label={tr("Weak topic or concept")}>
                <Input placeholder={tr("e.g. Polymer dosing during shock loads")} maxLength={120} />
              </Form.Item>
              <Form.Item name="skills" label={tr("Skills (match courses)")}>
                <Select mode="multiple" allowClear placeholder={tr("Pick skills taught by courses")} options={skillOptions} />
              </Form.Item>
            </>
          )}
          {kind === "mandatory" && (
            <Form.Item name="dueDate" label={tr("Due date")} rules={[{ required: true, message: tr("Pick a due date") }]}>
              <DatePicker style={{ width: "100%" }} disabledDate={(d) => d.isBefore(new Date(), "day")} />
            </Form.Item>
          )}
          <Form.Item name="priority" label={tr("Priority")}>
            <Radio.Group
              options={[
                { value: "normal", label: tr("Normal") },
                { value: "high", label: tr("High") },
                { value: "critical", label: tr("Critical") },
              ]}
            />
          </Form.Item>
          <Form.Item name="reason" label={tr("Why (the employee sees this)")} rules={[{ required: true, whitespace: true, message: tr("Add a short reason") }]}>
            <Input.TextArea rows={2} maxLength={300} showCount placeholder={tr("e.g. Overdosing seen in the last 3 shifts")} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
