"use client";

import { useMemo, useState } from "react";
import { App, DatePicker, Form, Input, Modal, Radio, Select } from "antd";
import type { Dayjs } from "dayjs";
import { createTrainingAssignment, getAllCourses, getPeople, useTrainingData } from "@/lib/training/store";
import { useViewer } from "@/lib/training/hooks";

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
        `${v.kind === "mandatory" ? "Assigned" : "Flagged"} for ${v.employeeIds.length} ${v.employeeIds.length === 1 ? "person" : "people"}. They have been notified.`,
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
      title="Flag a weak area / assign training"
      okText={kind === "mandatory" ? "Assign" : "Flag"}
      onOk={() => form.submit()}
      confirmLoading={saving}
      onCancel={onClose}
      destroyOnHidden
      width={620}
    >
      {people.length === 0 ? (
        <p style={{ color: "#4A6375" }}>
          Only the Director, or an employee&apos;s allotted manager, can flag or assign training. You have no allotted employees.
        </p>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          initialValues={{ kind: "suggested", priority: "normal", employeeIds: initialEmployeeIds?.filter((id) => allowed.has(id)), courseId: initialCourseId }}
        >
          <Form.Item name="employeeIds" label="Employees" rules={[{ required: true, message: "Pick at least one employee" }]}>
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="Your allotted employees"
              options={people.map((p) => ({ value: p.id, label: `${p.name}${p.designation ? ` · ${p.designation}` : ""}` }))}
            />
          </Form.Item>
          <Form.Item name="kind" label="Type">
            <Radio.Group
              optionType="button"
              options={[
                { value: "suggested", label: "Suggest (weak area)" },
                { value: "mandatory", label: "Mandatory (with due date)" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="courseId"
            label="Course"
            rules={kind === "mandatory" ? [{ required: true, message: "Mandatory training needs a course" }] : []}
            extra={kind === "suggested" ? "Optional. Or describe the weak topic / skills below, and matching courses are suggested." : undefined}
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Pick a course"
              options={courses.map((c) => ({ value: c.id, label: `${c.code} · ${c.title}` }))}
            />
          </Form.Item>
          {kind === "suggested" && (
            <>
              <Form.Item name="topic" label="Weak topic or concept">
                <Input placeholder="e.g. Polymer dosing during shock loads" maxLength={120} />
              </Form.Item>
              <Form.Item name="skills" label="Skills (match courses)">
                <Select mode="multiple" allowClear placeholder="Pick skills taught by courses" options={skillOptions} />
              </Form.Item>
            </>
          )}
          {kind === "mandatory" && (
            <Form.Item name="dueDate" label="Due date" rules={[{ required: true, message: "Pick a due date" }]}>
              <DatePicker style={{ width: "100%" }} disabledDate={(d) => d.isBefore(new Date(), "day")} />
            </Form.Item>
          )}
          <Form.Item name="priority" label="Priority">
            <Radio.Group
              options={[
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
              ]}
            />
          </Form.Item>
          <Form.Item name="reason" label="Why (the employee sees this)" rules={[{ required: true, whitespace: true, message: "Add a short reason" }]}>
            <Input.TextArea rows={2} maxLength={300} showCount placeholder="e.g. Overdosing seen in the last 3 shifts" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
