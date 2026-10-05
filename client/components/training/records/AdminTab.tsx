"use client";

import { useState } from "react";
import Link from "next/link";
import { App, Button, Card, Form, Input, Modal, Select, Switch, Table, Tag } from "antd";
import { createCommunity, getCommunities, getMentors, upsertMentor } from "@/lib/api/training";
import { getPeople, getSite, useTrainingData } from "@/lib/training/store";
import { useAsync, useViewer } from "@/lib/training/hooks";
import type { MentorProfileRecord } from "@/lib/training/types";

const ROLE_OPTIONS = [
  { value: "employee", label: "Plant Operators" },
  { value: "shift_incharge", label: "Shift In-Charges" },
  { value: "supervisor", label: "Site Managers" },
  { value: "safety_incharge", label: "Safety In-Charges" },
  { value: "site_incharge", label: "Site In-Charges" },
  { value: "manager", label: "Plant Managers" },
  { value: "hr", label: "HR" },
];

/** HR / Director: who can mentor, and the communities (Meetup-style groups). */
export default function AdminTab() {
  const { message } = App.useApp();
  const viewer = useViewer();
  useTrainingData();
  const mentors = useAsync(() => getMentors(true), []);
  const communities = useAsync(() => getCommunities(viewer.personId), [viewer.personId]);
  const [mentorOpen, setMentorOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [mentorForm] = Form.useForm();
  const [communityForm] = Form.useForm();
  const people = getPeople();

  const saveMentor = async (v: { employeeId: string; bio?: string; specialties?: string[] }) => {
    try {
      await upsertMentor(v.employeeId, { bio: v.bio, specialties: v.specialties ?? [], active: true });
      message.success("Mentor saved");
      setMentorOpen(false);
      mentorForm.resetFields();
      void mentors.reload();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const saveCommunity = async (v: { name: string; description?: string; domain?: string; organizerEmployeeIds?: string[]; roles?: string[]; plantTypes?: string[] }) => {
    try {
      await createCommunity({
        name: v.name,
        description: v.description ?? "",
        domain: v.domain,
        organizerEmployeeIds: v.organizerEmployeeIds ?? [],
        autoJoin: { roles: v.roles ?? [], plantTypes: v.plantTypes ?? [] },
      });
      message.success("Community created");
      setCommunityOpen(false);
      communityForm.resetFields();
      void communities.reload();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card title="Mentors" extra={<Button type="primary" onClick={() => setMentorOpen(true)}>Add mentor</Button>}>
        <Table<MentorProfileRecord>
          rowKey="id"
          size="small"
          loading={mentors.loading}
          dataSource={mentors.data ?? []}
          pagination={false}
          scroll={{ x: 600 }}
          columns={[
            { title: "Mentor", dataIndex: "name", render: (n: string, m) => <div><strong>{n}</strong><div style={{ fontSize: 12, color: "#4A6375" }}>{m.title}</div></div> },
            { title: "Specialties", dataIndex: "specialties", render: (s: string[]) => s.map((x) => <Tag key={x}>{x}</Tag>) },
            {
              title: "Active",
              dataIndex: "active",
              render: (a: boolean, m) => (
                <Switch
                  checked={a}
                  onChange={async (checked) => {
                    try {
                      await upsertMentor(m.employeeId, { active: checked });
                      void mentors.reload();
                    } catch (err) {
                      message.error((err as Error).message);
                    }
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Card title="Communities" extra={<Button type="primary" onClick={() => setCommunityOpen(true)}>New community</Button>}>
        <Table
          rowKey="id"
          size="small"
          loading={communities.loading}
          dataSource={communities.data ?? []}
          pagination={false}
          scroll={{ x: 600 }}
          columns={[
            { title: "Community", dataIndex: "name", render: (n: string, c) => <Link href={`/training/communities/${c.slug}`}>{n}</Link> },
            { title: "Members", dataIndex: "memberCount", align: "center" },
            { title: "Organizers", dataIndex: "organizers", render: (o: { name: string }[]) => o.map((p) => p.name).join(", ") || "—" },
          ]}
        />
      </Card>

      <Modal open={mentorOpen} title="Add or update a mentor" onCancel={() => setMentorOpen(false)} onOk={() => mentorForm.submit()} destroyOnHidden>
        <Form form={mentorForm} layout="vertical" onFinish={saveMentor}>
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={people.map((p) => ({ value: p.id, label: `${p.name} · ${p.designation ?? ""}` }))} />
          </Form.Item>
          <Form.Item name="specialties" label="Specialties">
            <Select mode="tags" placeholder="Type and press Enter" />
          </Form.Item>
          <Form.Item name="bio" label="Short bio">
            <Input.TextArea rows={3} maxLength={400} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={communityOpen} title="New community" onCancel={() => setCommunityOpen(false)} onOk={() => communityForm.submit()} destroyOnHidden>
        <Form form={communityForm} layout="vertical" onFinish={saveCommunity}>
          <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={60} placeholder="e.g. Lab & Quality Circle" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} maxLength={300} />
          </Form.Item>
          <Form.Item name="domain" label="Domain / topic">
            <Input maxLength={40} placeholder="e.g. Safety" />
          </Form.Item>
          <Form.Item name="organizerEmployeeIds" label="Organizers">
            <Select mode="multiple" showSearch optionFilterProp="label" options={people.map((p) => ({ value: p.id, label: p.name }))} />
          </Form.Item>
          <Form.Item name="roles" label="Auto-join roles">
            <Select mode="multiple" options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item name="plantTypes" label="Auto-join plants">
            <Select
              mode="multiple"
              options={[...new Set(people.map((p) => getSite(p.siteId)?.plantType).filter(Boolean))].map((t) => ({ value: t, label: `${t} plant` }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
