"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, App, Button, Card, DatePicker, Form, Input, Radio, Select, Switch, Upload } from "antd";
import type { UploadFile } from "antd";
import { InboxOutlined, LockOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import {
  SAFETY_CATEGORY_LABELS,
  SAFETY_SEVERITY_LABELS,
  effectiveSeverity,
  type SafetyCategory,
  type SafetySeverity,
} from "@/lib/safety/rules";
import { createSafetyEvent, uploadSafetyMedia } from "@/lib/api/safety";
import { upsertSafetyEvent } from "@/lib/safety/store";
import { useDirectory, useSessionUser } from "@/lib/safety/hooks";
import { canSafety, canViewAllSites, safetyActorOf } from "@/lib/rbac";

/** What the manager reports: a near-miss, or the injury outcome (fatal injury and death included). */
type Outcome = "near_miss" | "first_aid" | "medical" | "lost_time" | "fatal" | "death";
type Kind = "concern" | "breakdown";

const OUTCOMES: { value: Outcome; label: string; severity: SafetySeverity }[] = [
  { value: "near_miss", label: "Near miss", severity: "medium" },
  { value: "first_aid", label: "First aid", severity: "low" },
  { value: "medical", label: "Medical treatment", severity: "medium" },
  { value: "lost_time", label: "Lost-time injury", severity: "high" },
  { value: "fatal", label: "Fatal injury", severity: "critical" },
  { value: "death", label: "Death", severity: "critical" },
];
const HAZARDS: SafetyCategory[] = ["fire", "chemical", "electrical", "plant_problem", "other"];

type FormValues = {
  kind: Kind;
  outcome: Outcome;
  hazard?: SafetyCategory;
  siteId: string;
  title: string;
  description?: string;
  location?: string;
  occurredAt?: Dayjs;
  severity: SafetySeverity;
  affected?: string;
  witness?: string;
  involved?: string[];
  isEmergency?: boolean;
  equipment?: string;
  whatFailed?: string;
  why?: string;
  how?: string;
};

const MB = 1024 * 1024;
const GRID = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 16 } as const;

function ReportForm() {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useSearchParams();
  const user = useSessionUser();
  const { employees, sites, error: dirError } = useDirectory();
  const [form] = Form.useForm<FormValues>();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [saving, setSaving] = useState(false);

  const canConcern = canSafety(user ?? null, "reportIncident");
  const canBreakdown = canSafety(user ?? null, "reportBreakdown");
  const orgWide = canViewAllSites(user ?? null);
  const wantBreakdown = params.get("type") === "breakdown";
  const defaultKind: Kind = canConcern && !wantBreakdown ? "concern" : "breakdown";

  const kind = Form.useWatch("kind", form) ?? defaultKind;
  const outcome = Form.useWatch("outcome", form) ?? "near_miss";
  const siteId = Form.useWatch("siteId", form);
  const affected = Form.useWatch("affected", form);
  const isEmergency = Form.useWatch("isEmergency", form);

  const siteOptions = useMemo(
    () => sites.filter((s) => orgWide || s.id === user?.siteId).map((s) => ({ value: s.id, label: s.name })),
    [sites, orgWide, user?.siteId],
  );
  const sitePeople = useMemo(
    () => employees.filter((e) => e.employmentStatus !== "inactive" && (!siteId || e.siteId === siteId)),
    [employees, siteId],
  );
  const peopleOptions = sitePeople.map((e) => ({ value: e.id, label: `${e.name} · ${e.designation || e.role}` }));
  // Who becomes responsible: the site's supervisor and shift in-charge, plus HR, the Director and the Safety In-charge
  const responsible = useMemo(() => {
    const site = sitePeople.filter((e) => e.employeeCategory === "supervisor" || e.employeeCategory === "shift_incharge");
    const hr = employees.filter((e) => e.employeeCategory === "hr" && e.employmentStatus !== "inactive");
    return [
      ...site.map((e) => `${e.name} (${e.employeeCategory === "supervisor" ? "Site Manager" : "Shift In-Charge"})`),
      ...hr.map((e) => `${e.name} (HR)`),
      "Director",
      "Safety In-Charge",
    ];
  }, [sitePeople, employees]);

  if (user === undefined) return null;
  if (!user) return <Alert type="warning" title="Please log in to report." />;

  if (!canConcern && !canBreakdown) {
    return (
      <Card style={{ maxWidth: 720 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <LockOutlined style={{ fontSize: 28, color: "#1C4463", marginTop: 4 }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Only your plant manager raises safety concerns</h2>
            <p style={{ margin: "8px 0 0", color: "rgba(0,0,0,0.6)" }}>
              Seen a near-miss, an injury or anything unsafe? Tell your manager straight away — they record it here and everyone responsible is
              brought in. You can follow every case in <Link href="/safety/incidents">Incidents &amp; near-miss</Link>.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const onFinish = async (v: FormValues) => {
    const actor = safetyActorOf(user);
    if (!actor) return;
    const isConcern = v.kind === "concern";
    const type = !isConcern ? "breakdown" : v.outcome === "near_miss" ? "near_miss" : "incident";
    if (!canSafety(user, isConcern ? "reportIncident" : "reportBreakdown", v.siteId)) {
      message.error(isConcern ? "Only the plant manager can raise a safety concern for this site." : "Your role cannot log a breakdown here.");
      return;
    }
    const category: SafetyCategory = !isConcern ? (v.hazard ?? "plant_problem") : v.outcome === "near_miss" ? (v.hazard ?? "other") : v.outcome;
    setSaving(true);
    try {
      const occurred = (v.occurredAt ?? dayjs()).toISOString();
      const created = await createSafetyEvent(actor, {
        type,
        siteId: v.siteId,
        title: v.title,
        description: v.description,
        location: v.location,
        occurredAt: occurred,
        category,
        severity: effectiveSeverity(category, v.severity),
        involved: isConcern ? (v.affected ? [v.affected] : []) : (v.involved ?? []),
        informedBy: isConcern && v.witness ? [v.witness] : [],
        isEmergency: isConcern && Boolean(v.isEmergency),
        ...(!isConcern ? { equipment: v.equipment, whatFailed: v.whatFailed, why: v.why, how: v.how, failedAt: occurred } : {}),
      });
      upsertSafetyEvent(created);

      let latest = created;
      const failed: string[] = [];
      for (const f of files) {
        if (!f.originFileObj) continue;
        try {
          latest = await uploadSafetyMedia(created.id, actor, f.originFileObj);
        } catch (err) {
          failed.push(`${f.name}: ${err instanceof Error ? err.message : "upload failed"}`);
        }
      }
      upsertSafetyEvent(latest);
      if (created.isEmergency) window.dispatchEvent(new Event("safety-emergencies-changed"));
      if (failed.length) message.warning(`Reported, but some files failed — ${failed.join("; ")}`);
      else message.success(v.isEmergency ? "Emergency raised — everyone at the site has been alerted." : "Raised. Everyone responsible has been notified.");
      router.push(`/safety/incidents/${created.id}`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not report — is the server reachable?");
    } finally {
      setSaving(false);
    }
  };

  const lockedCritical = kind === "concern" && (outcome === "fatal" || outcome === "death");

  return (
    <Card title={kind === "concern" ? "Raise a safety concern" : "Log a plant breakdown"} style={{ maxWidth: 900 }}>
      {dirError ? <Alert type="error" showIcon title={`People list unavailable: ${dirError}`} style={{ marginBottom: 16 }} /> : null}
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          kind: defaultKind,
          outcome: "near_miss",
          hazard: defaultKind === "breakdown" ? "plant_problem" : "other",
          siteId: user.siteId,
          severity: "medium",
          occurredAt: dayjs(),
          isEmergency: false,
        }}
        onValuesChange={(changed) => {
          if (changed.kind === "breakdown") form.setFieldsValue({ hazard: "plant_problem", isEmergency: false });
          if (changed.kind === "concern") form.setFieldsValue({ hazard: "other" });
          if (changed.outcome) form.setFieldsValue({ severity: OUTCOMES.find((o) => o.value === changed.outcome)?.severity ?? "medium" });
          if (changed.affected && changed.affected === form.getFieldValue("witness")) form.setFieldsValue({ witness: undefined });
        }}
      >
        {canConcern && canBreakdown ? (
          <Form.Item name="kind" label="What are you recording?">
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: "concern", label: "Safety concern (near miss / injury)" },
                { value: "breakdown", label: "Plant breakdown" },
              ]}
            />
          </Form.Item>
        ) : (
          <Form.Item name="kind" hidden><Input /></Form.Item>
        )}
        {!canConcern ? (
          <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Safety concerns (near miss, injury, fatal injury, death) are raised by the plant manager only. You can log plant breakdowns." />
        ) : null}

        {kind === "concern" ? (
          <Form.Item name="outcome" label="What happened?" rules={[{ required: true }]}>
            <Radio.Group optionType="button" options={OUTCOMES.map((o) => ({ value: o.value, label: o.label }))} />
          </Form.Item>
        ) : null}

        <div style={GRID}>
          <Form.Item name="siteId" label="Site" rules={[{ required: true, message: "Choose the site" }]}>
            <Select options={siteOptions} disabled={!orgWide} placeholder="Site" showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="occurredAt" label={kind === "breakdown" ? "Failed at" : "When did it happen?"}>
            <DatePicker showTime style={{ width: "100%" }} disabledDate={(d) => d.isAfter(dayjs())} />
          </Form.Item>
          {kind === "breakdown" || outcome === "near_miss" ? (
            <Form.Item name="hazard" label={kind === "breakdown" ? "Type of problem" : "Hazard"}>
              <Select options={HAZARDS.map((c) => ({ value: c, label: SAFETY_CATEGORY_LABELS[c] }))} />
            </Form.Item>
          ) : null}
          <Form.Item name="severity" label="Severity" rules={[{ required: true }]}>
            <Select
              disabled={lockedCritical}
              options={(Object.keys(SAFETY_SEVERITY_LABELS) as SafetySeverity[]).map((s) => ({ value: s, label: SAFETY_SEVERITY_LABELS[s] }))}
            />
          </Form.Item>
        </div>

        <Form.Item name="title" label="Short title" rules={[{ required: true, whitespace: true, message: "Add a title" }, { max: 200 }]}>
          <Input placeholder={kind === "breakdown" ? "e.g. Aeration blower B-2 tripped" : "e.g. Operator nearly stepped into open tank — no sign board"} />
        </Form.Item>
        <Form.Item name="location" label="Exact location">
          <Input placeholder="e.g. Equalisation tank, north walkway" maxLength={200} />
        </Form.Item>
        <Form.Item name="description" label="What happened?">
          <Input.TextArea rows={4} maxLength={4000} showCount />
        </Form.Item>

        {kind === "concern" ? (
          <>
            <div style={GRID}>
              <Form.Item
                name="affected"
                label="Employee 1 — who it happened to (or nearly happened to)"
                rules={[{ required: true, message: "Choose the person it happened to" }]}
              >
                <Select showSearch optionFilterProp="label" options={peopleOptions} placeholder="Search name" />
              </Form.Item>
              <Form.Item name="witness" label="Employee 2 — who saw it / prevented it">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={peopleOptions.filter((o) => o.value !== affected)}
                  placeholder="Search name"
                />
              </Form.Item>
            </div>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title="Responsible for this case — added automatically"
              description={
                <>
                  You (raising it), {responsible.join(", ")}. The case stays open, with reminders, until the <strong>Director closes it</strong>.
                </>
              }
            />
            <Form.Item name="isEmergency" label="Emergency — alert everyone at this site now" valuePropName="checked">
              <Switch />
            </Form.Item>
            {isEmergency ? (
              <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Every employee at the site, plus everyone responsible, gets an alert they must acknowledge." />
            ) : null}
            {lockedCritical ? (
              <Alert type="warning" showIcon style={{ marginBottom: 16 }} title={`${SAFETY_CATEGORY_LABELS[outcome as SafetyCategory]} is always critical. Reminders go out every hour until the Director closes the case.`} />
            ) : null}
          </>
        ) : (
          <>
            <div style={GRID}>
              <Form.Item name="equipment" label="Equipment" rules={[{ required: true, message: "Which equipment?" }]}>
                <Input maxLength={200} />
              </Form.Item>
              <Form.Item name="whatFailed" label="What broke?">
                <Input maxLength={1000} />
              </Form.Item>
              <Form.Item name="why" label="Why is the plant not working?">
                <Input.TextArea rows={2} maxLength={2000} />
              </Form.Item>
              <Form.Item name="how" label="How did it break?">
                <Input.TextArea rows={2} maxLength={2000} />
              </Form.Item>
            </div>
            <Form.Item name="involved" label="People affected">
              <Select mode="multiple" showSearch optionFilterProp="label" options={peopleOptions} placeholder="Search name" />
            </Form.Item>
            <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Repair overtime for a breakdown is requested from the case page and approved in Overtime → Decisions." />
          </>
        )}

        <Form.Item label="Photos / videos (photo ≤10 MB, video ≤50 MB)">
          <Upload.Dragger
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            fileList={files}
            beforeUpload={(file) => {
              const limit = file.type.startsWith("video/") ? 50 * MB : 10 * MB;
              if (file.size > limit) {
                message.error(`${file.name} is too large`);
                return Upload.LIST_IGNORE;
              }
              return false; // upload after the event is created
            }}
            onChange={({ fileList }) => setFiles(fileList)}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Click or drag files here</p>
          </Upload.Dragger>
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={saving} danger={Boolean(isEmergency)} size="large">
          {kind === "breakdown" ? "Log breakdown" : isEmergency ? "Raise emergency" : "Raise safety concern"}
        </Button>
      </Form>
    </Card>
  );
}

export default function SafetyReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportForm />
    </Suspense>
  );
}
