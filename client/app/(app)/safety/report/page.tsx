"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, App, Button, DatePicker, Form, Input, Radio, Segmented, Select, Switch, Upload, theme } from "antd";
import type { UploadFile } from "antd";
import { ArrowLeftOutlined, InboxOutlined, LockOutlined } from "@ant-design/icons";
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
import { Panel, Section } from "@/components/safety/ui";
import { useTableMotion } from "@/lib/motion/use-table-motion";
import { tr, trTable, trNode, trData } from "@/lib/i18n";

/** What the manager reports: a near-miss, or the injury outcome (fatal injury and death included). */
type Outcome = "near_miss" | "first_aid" | "medical" | "lost_time" | "fatal" | "death";
type Kind = "concern" | "breakdown";

const OUTCOMES: { value: Outcome; label: string; severity: SafetySeverity }[] = trTable([
  { value: "near_miss", label: "Near miss", severity: "medium" },
  { value: "first_aid", label: "First aid", severity: "low" },
  { value: "medical", label: "Medical treatment", severity: "medium" },
  { value: "lost_time", label: "Lost-time injury", severity: "high" },
  { value: "fatal", label: "Fatal injury", severity: "critical" },
  { value: "death", label: "Death", severity: "critical" },
]);
const HAZARDS: SafetyCategory[] = ["fire", "chemical", "electrical", "plant_problem", "other"];

type FormValues = {
  kind: Kind;
  outcome: Outcome;
  hazard?: SafetyCategory;
  hazardOther?: string;
  siteId: string;
  title: string;
  description?: string;
  location?: string;
  occurredAt?: Dayjs;
  severity: SafetySeverity;
  affected?: string[];
  witnesses?: string[];
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
  const { token } = theme.useToken();
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
  const hazard = Form.useWatch("hazard", form);
  const affected = Form.useWatch("affected", form);
  const witnesses = Form.useWatch("witnesses", form);
  const isEmergency = Form.useWatch("isEmergency", form);

  const siteOptions = useMemo(
    () => sites.filter((s) => orgWide || s.id === user?.siteId).map((s) => ({ value: s.id, label: s.name })),
    [sites, orgWide, user?.siteId],
  );
  const sitePeople = useMemo(
    () => employees.filter((e) => e.employmentStatus !== "inactive" && (!siteId || e.siteId === siteId)),
    [employees, siteId],
  );
  const peopleOptions = sitePeople.map((e) => ({ value: e.id, label: `${trData(e.name)} · ${trData(e.designation || e.role)}` }));
  const overlap = (affected ?? []).filter((id) => (witnesses ?? []).includes(id));
  // Who becomes responsible: the site's supervisor and shift in-charge, plus HR, the Director and the Safety In-charge
  const responsible = useMemo(() => {
    const site = sitePeople.filter((e) => e.employeeCategory === "supervisor" || e.employeeCategory === "shift_incharge");
    const hr = employees.filter((e) => e.employeeCategory === "hr" && e.employmentStatus !== "inactive");
    return [
      ...site.map((e) => `${e.name} (${e.employeeCategory === "supervisor" ? tr("Site Manager") : tr("Shift In-Charge")})`),
      ...hr.map((e) => tr("{name} (HR)", { name: trData(e.name) })),
      tr("Director"),
      tr("Safety In-Charge"),
    ];
  }, [sitePeople, employees]);

  // Sections settle in once the form is on screen.
  const { pageRef } = useTableMotion("", user !== undefined);
  const muted = { color: token.colorTextSecondary };

  if (user === undefined) return null;
  if (!user) return <Alert type="warning" title={tr("Please log in to report.")} />;

  if (!canConcern && !canBreakdown) {
    return (
      <Panel style={{ maxWidth: 720, padding: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <LockOutlined style={{ fontSize: 22, color: token.colorTextSecondary, marginTop: 4 }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{tr("Only your plant manager raises safety concerns")}</h2>
            <p style={{ margin: "8px 0 0", ...muted }}>
              {trNode("Seen a near-miss, an injury or anything unsafe? Tell your manager straight away — they record it here and everyone responsible is brought in. You can follow every case in {link}.", { link: <Link href="/safety/incidents">{tr("Incidents & near-miss")}</Link> })}
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  const onFinish = async (v: FormValues) => {
    const actor = safetyActorOf(user);
    if (!actor) return;
    const isConcern = v.kind === "concern";
    const type = !isConcern ? "breakdown" : v.outcome === "near_miss" ? "near_miss" : "incident";
    if (!canSafety(user, isConcern ? "reportIncident" : "reportBreakdown", v.siteId)) {
      message.error(isConcern ? tr("Only the plant manager can raise a safety concern for this site.") : tr("Your role cannot log a breakdown here."));
      return;
    }
    const category: SafetyCategory = !isConcern ? (v.hazard ?? "plant_problem") : v.outcome === "near_miss" ? (v.hazard ?? "other") : v.outcome;
    const categoryOther = category === "other" ? v.hazardOther?.trim() : undefined;
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
        ...(categoryOther ? { categoryOther } : {}),
        severity: effectiveSeverity(category, v.severity),
        involved: isConcern ? (v.affected ?? []) : (v.involved ?? []),
        informedBy: isConcern ? (v.witnesses ?? []) : [],
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
          failed.push(`${f.name}: ${err instanceof Error ? trData(err.message) : tr("upload failed")}`);
        }
      }
      upsertSafetyEvent(latest);
      if (created.isEmergency) window.dispatchEvent(new Event("safety-emergencies-changed"));
      if (failed.length) message.warning(tr("Reported, but some files failed — {failed}", { failed: failed.join("; ") }));
      else message.success(v.isEmergency ? tr("Emergency raised — everyone at the site has been alerted.") : tr("Raised. Everyone responsible has been notified."));
      router.push(`/safety/incidents/${created.id}`);
    } catch (err) {
      message.error(err instanceof Error ? trData(err.message) : tr("Could not report — is the server reachable?"));
    } finally {
      setSaving(false);
    }
  };

  const lockedCritical = kind === "concern" && (outcome === "fatal" || outcome === "death");

  return (
    <div ref={pageRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header data-anim="intro">
        <Link href="/safety" style={{ fontSize: 13, ...muted }}>
          <ArrowLeftOutlined style={{ marginRight: 6 }} />
          {tr("Safety")}
        </Link>
        <h2 style={{ margin: "10px 0 0", fontSize: 22, fontWeight: 600, color: token.colorText }}>
          {kind === "concern" ? tr("Raise a safety concern") : tr("Log a plant breakdown")}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 14, ...muted }}>
          {kind === "concern"
            ? tr("Record it as soon as you can. Everyone responsible at the site is notified the moment you submit.")
            : tr("Record what stopped working. Repair overtime is requested later from the case page.")}
        </p>
      </header>

      {dirError ? <Alert type="error" showIcon title={tr("People list unavailable: {dirError}", { dirError: trData(dirError) })} /> : null}

      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        requiredMark="optional"
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
          if (changed.kind === "breakdown") form.setFieldsValue({ hazard: "plant_problem", hazardOther: undefined, isEmergency: false });
          if (changed.kind === "concern") form.setFieldsValue({ hazard: "other", hazardOther: undefined });
          if (changed.outcome) form.setFieldsValue({ severity: OUTCOMES.find((o) => o.value === changed.outcome)?.severity ?? "medium" });
          if ("hazard" in changed && changed.hazard !== "other") form.setFieldsValue({ hazardOther: undefined });
        }}
      >
        <div className="safety-case-grid">
          {/* Main column: what happened, who, evidence */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <div data-anim="intro">
              <Section title={tr("What happened")}>
                {canConcern && canBreakdown ? (
                  <Form.Item name="kind" label={tr("What are you recording?")}>
                    <Segmented
                      options={[
                        { value: "concern", label: tr("Safety concern") },
                        { value: "breakdown", label: tr("Plant breakdown") },
                      ]}
                    />
                  </Form.Item>
                ) : (
                  <Form.Item name="kind" hidden><Input /></Form.Item>
                )}
                {!canConcern ? (
                  <p style={{ margin: "0 0 16px", fontSize: 13, ...muted }}>
                    {tr("Safety concerns (near-miss, injury, fatal injury, death) are raised by the plant manager only. You can log plant breakdowns.")}
                  </p>
                ) : null}

                {kind === "concern" ? (
                  <Form.Item name="outcome" label={tr("Outcome")} rules={[{ required: true }]}>
                    <Radio.Group optionType="button" options={OUTCOMES.map((o) => ({ value: o.value, label: o.label }))} />
                  </Form.Item>
                ) : null}

                <Form.Item name="title" label={tr("Short title")} rules={[{ required: true, whitespace: true, message: tr("Add a title") }, { max: 200 }]}>
                  <Input placeholder={kind === "breakdown" ? tr("e.g. Aeration blower B-2 tripped") : tr("e.g. Operator nearly stepped into open tank — no sign board")} />
                </Form.Item>
                <Form.Item name="description" label={tr("Describe what happened")}>
                  <Input.TextArea autoSize={{ minRows: 4, maxRows: 12 }} maxLength={4000} showCount />
                </Form.Item>

                <div style={GRID}>
                  {kind === "breakdown" || outcome === "near_miss" ? (
                    <Form.Item name="hazard" label={kind === "breakdown" ? tr("Type of problem") : tr("Hazard")}>
                      <Select options={HAZARDS.map((c) => ({ value: c, label: SAFETY_CATEGORY_LABELS[c] }))} />
                    </Form.Item>
                  ) : null}
                  {(kind === "breakdown" || outcome === "near_miss") && hazard === "other" ? (
                    <Form.Item
                      name="hazardOther"
                      label={kind === "breakdown" ? tr("Name the problem") : tr("Name the hazard")}
                      rules={[{ required: true, whitespace: true, message: tr("Say what the hazard was") }, { max: 120 }]}
                    >
                      <Input placeholder={tr("e.g. Slippery floor, falling object")} maxLength={120} />
                    </Form.Item>
                  ) : null}
                  <Form.Item
                    name="severity"
                    label={tr("Severity")}
                    rules={[{ required: true }]}
                    extra={lockedCritical ? tr("{category} is always critical.", { category: SAFETY_CATEGORY_LABELS[outcome as SafetyCategory] }) : undefined}
                  >
                    <Select
                      disabled={lockedCritical}
                      options={(Object.keys(SAFETY_SEVERITY_LABELS) as SafetySeverity[]).map((s) => ({ value: s, label: SAFETY_SEVERITY_LABELS[s] }))}
                    />
                  </Form.Item>
                </div>
              </Section>
            </div>

            {kind === "concern" ? (
              <div data-anim="intro">
                <Section title={tr("People")}>
                  <div style={GRID}>
                    <Form.Item
                      name="affected"
                      label={tr("It happened (or nearly happened) to")}
                      rules={[{ required: true, type: "array", min: 1, message: tr("Choose at least one person") }]}
                    >
                      <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={peopleOptions} placeholder={tr("Search names")} />
                    </Form.Item>
                    <Form.Item name="witnesses" label={tr("Saw it or informed")}>
                      <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={peopleOptions} placeholder={tr("Search names")} />
                    </Form.Item>
                  </div>
                  {overlap.length ? (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                      title={tr(overlap.length > 1 ? "{names} are in both lists — check that's right." : "{names} is in both lists — check that's right.", { names: overlap.map((id) => sitePeople.find((e) => e.id === id)?.name ?? id).join(", ") })}
                    />
                  ) : null}
                  <div style={{ fontSize: 13, ...muted }}>
                    <span style={{ color: token.colorText, fontWeight: 500 }}>{tr("Responsible, added automatically:")}</span>
                    {" "}{tr("you (raising it), {people}. The case stays open, with reminders, until the Director closes it.", { people: responsible.join(", ") })}
                  </div>
                </Section>
              </div>
            ) : (
              <div data-anim="intro">
                <Section title={tr("Breakdown")}>
                  <div style={GRID}>
                    <Form.Item name="equipment" label={tr("Equipment")} rules={[{ required: true, message: tr("Which equipment?") }]}>
                      <Input maxLength={200} />
                    </Form.Item>
                    <Form.Item name="whatFailed" label={tr("What broke?")}>
                      <Input maxLength={1000} />
                    </Form.Item>
                    <Form.Item name="why" label={tr("Why is the plant not working?")}>
                      <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} />
                    </Form.Item>
                    <Form.Item name="how" label={tr("How did it break?")}>
                      <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} />
                    </Form.Item>
                  </div>
                  <Form.Item name="involved" label={tr("People affected")} style={{ marginBottom: 0 }}>
                    <Select mode="multiple" showSearch optionFilterProp="label" options={peopleOptions} placeholder={tr("Search names")} />
                  </Form.Item>
                </Section>
              </div>
            )}

            <div data-anim="intro">
              <Section title={tr("Photos & videos")} extra={tr("Photo up to 10 MB · video up to 50 MB")}>
                <Upload.Dragger
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  fileList={files}
                  beforeUpload={(file) => {
                    const limit = file.type.startsWith("video/") ? 50 * MB : 10 * MB;
                    if (file.size > limit) {
                      message.error(tr("{name} is too large", { name: trData(file.name) }));
                      return Upload.LIST_IGNORE;
                    }
                    return false; // upload after the event is created
                  }}
                  onChange={({ fileList }) => setFiles(fileList)}
                >
                  <p className="ant-upload-drag-icon" style={{ color: token.colorTextQuaternary }}><InboxOutlined /></p>
                  <p className="ant-upload-text">{tr("Click or drag files here")}</p>
                  <p className="ant-upload-hint">{tr("Reporting after the fact? Add what you have now; more can be added from the case page later.")}</p>
                </Upload.Dragger>
              </Section>
            </div>

          </div>

          {/* Side column stays in view: where and when, then submit */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0, position: "sticky", top: 16 }}>
            <div data-anim="intro">
              <Section title={tr("When and where")}>
                <div style={GRID}>
                  <Form.Item name="siteId" label={tr("Site")} rules={[{ required: true, message: tr("Choose the site") }]}>
                    <Select options={siteOptions} disabled={!orgWide} placeholder={tr("Site")} showSearch optionFilterProp="label" />
                  </Form.Item>
                  <Form.Item name="occurredAt" label={kind === "breakdown" ? tr("Failed at") : tr("When did it happen?")}>
                    <DatePicker showTime style={{ width: "100%" }} disabledDate={(d) => d.isAfter(dayjs())} />
                  </Form.Item>
                </div>
                <Form.Item name="location" label={tr("Exact location")} style={{ marginBottom: 0 }}>
                  <Input placeholder={tr("e.g. Equalisation tank, north walkway")} maxLength={200} />
                </Form.Item>
              </Section>
            </div>

            <div data-anim="intro">
              <Panel style={{ padding: 16 }}>
                {kind === "concern" ? (
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
                    <Form.Item name="isEmergency" valuePropName="checked" style={{ marginBottom: 0 }}>
                      <Switch />
                    </Form.Item>
                    <div style={{ lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 500 }}>{tr("Emergency — alert everyone at this site now")}</div>
                      <div style={{ fontSize: 13, color: isEmergency ? token.colorError : token.colorTextSecondary }}>
                        {isEmergency
                          ? tr("Every employee at the site, plus everyone responsible, gets an alert they must acknowledge.")
                          : lockedCritical
                            ? tr("Reminders go out every hour until the Director closes the case.")
                            : tr("Leave off unless people at the site need to act right now.")}
                      </div>
                    </div>
                  </div>
                ) : null}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                  <Link href="/safety"><Button>{tr("Cancel")}</Button></Link>
                  <Button type="primary" htmlType="submit" loading={saving} danger={Boolean(isEmergency)}>
                    {kind === "breakdown" ? tr("Log breakdown") : isEmergency ? tr("Raise emergency") : tr("Raise safety concern")}
                  </Button>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
}

export default function SafetyReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportForm />
    </Suspense>
  );
}
