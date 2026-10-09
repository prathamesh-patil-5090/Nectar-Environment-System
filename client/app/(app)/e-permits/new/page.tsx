"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, App, Button, Input, Modal, Radio, Select, Steps, Switch, theme } from "antd";
import { ArrowLeftOutlined, LockOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { plantDayTime, plantTime } from "@/lib/plant-time";
import {
  CERTIFICATE_TYPES,
  EPERMIT_CATEGORY_LABELS,
  EPERMIT_POLICY,
  EPERMIT_SUBCATEGORY_LABELS,
  FIRE_GAS_ITEMS,
  MAX_CUSTOM_PPE,
  PPE_ITEMS,
  SAFETY_MEASURES,
  SUBCATEGORIES,
  canIssuePermits,
  extraClearances,
  requiresFireGas,
  requiresSafetyGate,
  shiftChoices,
  validateForSubmit,
  validatePlannedSchedule,
  type ChecklistAnswer,
  type EPermitCategory,
  type EPermitSubCategory,
  type GasKey,
  type PermitShiftCode,
} from "@/lib/e-permit/rules";
import type { EPermit, NewEPermitInput } from "@/lib/e-permit/types";
import {
  SoftBlockError,
  createEPermit,
  getEPermit,
  submitEPermit,
  updateEPermitDraft,
} from "@/lib/api/e-permits";
import { upsertEPermit } from "@/lib/e-permit/store";
import { useEPermitMasters, useNow, usePermitViewer } from "@/lib/e-permit/hooks";
import { useDirectory } from "@/lib/safety/hooks";
import { ePermitActorOf } from "@/lib/rbac";
import { getSession } from "@/lib/auth";
import { Panel, Section } from "@/components/quiet";
import { GasReadingsInput, ShiftSchedule, YesNaList, gasDraftToReadings, usePlanFollowsClock, type GasDraft } from "@/components/e-permit/PermitBits";
import { useTableMotion } from "@/lib/motion/use-table-motion";
import { tr, trData } from "@/lib/i18n";

const GRID = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(max(240px, 30%), 1fr))", gap: "0 16px" } as const;

type Draft = {
  locationId?: string;
  category: EPermitCategory;
  subCategory?: EPermitSubCategory;
  emergency: boolean;
  shiftCode?: PermitShiftCode;
  planned: [string, string] | null;
  description: string;
  hazardsText: string;
  jsaRef: string;
  workerIds: string[];
  holderId?: string;
  safetyMeasures: ChecklistAnswer[];
  ppe: ChecklistAnswer[];
  customPpe: ChecklistAnswer[];
  fireGas: ChecklistAnswer[];
  certificates: ChecklistAnswer[];
  gas: GasDraft;
  safetyEventId?: string;
  parentPermitId?: string;
};

const EMPTY: Draft = {
  category: "cold_work",
  emergency: false,
  planned: null,
  description: "",
  hazardsText: "",
  jsaRef: "",
  workerIds: [],
  safetyMeasures: [],
  ppe: [],
  customPpe: [],
  fireGas: [],
  certificates: [],
  gas: {},
};

function fromPermit(p: EPermit, asContinuation: boolean): Draft {
  const gas: GasDraft = {};
  for (const r of p.gasReadings.filter((x) => x.round === 0)) gas[r.gas] = r.value;
  return {
    locationId: p.locationId,
    category: p.category,
    subCategory: p.subCategory,
    emergency: asContinuation ? false : p.emergency,
    shiftCode: asContinuation ? undefined : p.shiftCode,
    planned: !asContinuation && p.plannedFrom && p.plannedTo ? [p.plannedFrom, p.plannedTo] : null,
    description: p.description,
    hazardsText: p.hazardsText,
    jsaRef: p.jsaRef,
    workerIds: p.workerIds,
    holderId: p.holderId,
    safetyMeasures: p.safetyMeasures,
    ppe: p.ppe,
    customPpe: p.customPpe,
    fireGas: p.fireGas,
    certificates: p.certificates,
    gas: asContinuation ? {} : gas,
    safetyEventId: p.safetyEventId,
    parentPermitId: asContinuation ? p.id : p.parentPermitId,
  };
}

function IssuePermitForm() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const router = useRouter();
  const params = useSearchParams();
  const masters = useEPermitMasters();
  const viewer = usePermitViewer(masters);
  const dir = useDirectory();
  const now = useNow(60_000);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [draftId, setDraftId] = useState<string | null>(params.get("draft"));
  const [busy, setBusy] = useState(false);
  const [blocks, setBlocks] = useState<{ list: string[]; canOverride: boolean } | null>(null);
  const [overrideRemark, setOverrideRemark] = useState("");
  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));
  const { pageRef } = useTableMotion("issue");

  const session = useMemo(() => (typeof window === "undefined" ? null : getSession()), []);
  const siteId = session?.siteId;

  // Prefill: ?draft=<id> edits a draft, ?from=<id> continues a permit past its renewal cap, ?breakdown=<caseId> repairs a breakdown
  useEffect(() => {
    const actor = ePermitActorOf(session);
    const draft = params.get("draft");
    const from = params.get("from");
    const breakdown = params.get("breakdown");
    let alive = true;
    if (actor && (draft || from)) {
      getEPermit((draft || from)!, actor)
        .then((p) => alive && setD(fromPermit(p, Boolean(from && !draft))))
        .catch((err: Error) => message.error(trData(err.message)));
    } else if (breakdown) {
      const id = requestAnimationFrame(() =>
        setD((cur) => ({ ...cur, safetyEventId: breakdown, emergency: true, subCategory: "breakdown_repair" })),
      );
      return () => cancelAnimationFrame(id);
    }
    return () => {
      alive = false;
    };
  }, [params, session, message]);

  const locations = useMemo(() => masters.locations.filter((l) => l.siteId === siteId), [masters.locations, siteId]);
  const location = locations.find((l) => l.id === d.locationId);
  const workers = useMemo(
    () => dir.employees.filter((e) => e.siteId === siteId && e.employmentStatus !== "inactive"),
    [dir.employees, siteId],
  );
  const choices = useMemo(() => shiftChoices(now), [now]);
  const shiftChoice = choices.find((c) => c.shiftCode === d.shiftCode);
  const hot = requiresFireGas(d.category);

  const approvalsPreview = useMemo(() => {
    if (!location || !d.subCategory) return [];
    if (d.emergency) return [tr("Plant Manager (emergency) — Authoriser and Safety review within {h} h", { h: EPERMIT_POLICY.emergency.postReviewWithinHours })];
    return [
      tr("Authoriser: {dept} HoD", { dept: trData(masters.deptName(location.ownerDepartmentId)) }),
      ...extraClearances(location, d.category, d.subCategory).map((x) => tr("{dept} clearance", { dept: trData(masters.deptName(x)) })),
      ...(requiresSafetyGate(d.subCategory) ? [tr("Safety In-charge")] : []),
    ];
  }, [location, d.subCategory, d.category, d.emergency, masters]);

  const input = (): NewEPermitInput => ({
    siteId: siteId ?? "",
    locationId: d.locationId ?? "",
    category: d.category,
    subCategory: d.subCategory as EPermitSubCategory,
    emergency: d.emergency,
    shiftCode: d.shiftCode as PermitShiftCode,
    plannedFrom: d.planned?.[0] ?? null,
    plannedTo: d.planned?.[1] ?? null,
    description: d.description,
    hazardsText: d.hazardsText,
    jsaRef: d.jsaRef,
    holderId: d.holderId ?? "",
    workerIds: d.workerIds,
    safetyMeasures: d.safetyMeasures,
    ppe: d.ppe,
    customPpe: d.customPpe,
    fireGas: hot ? d.fireGas : d.fireGas.filter((a) => a.value),
    certificates: d.certificates,
    gasReadings: gasDraftToReadings(d.gas),
    safetyEventId: d.safetyEventId,
    parentPermitId: d.parentPermitId,
  });

  // Runs on every step, so a plan whose start slips into the past is moved before Review / submit.
  const planMove = usePlanFollowsClock(shiftChoice, d.planned ?? null, (planned) => set({ planned }), now);
  const planErrors = validatePlannedSchedule(d.planned?.[0], d.planned?.[1], shiftChoice, now);
  const errors = useMemo(
    () => [...validateForSubmit({ ...input(), gasReadings: gasDraftToReadings(d.gas) }), ...planErrors],
    [d, siteId, shiftChoice, now], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const goTo = (next: number) => {
    if (step === 0 && next > 0 && planErrors.length) return;
    setStep(next);
  };

  if (viewer === undefined) return null;
  if (!viewer || !canIssuePermits(viewer)) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<LockOutlined />}
        title={tr("Only a Supervisor, Shift In-Charge or Plant Manager issues permits.")}
        description={<Link href="/e-permits">{tr("Back to permits")}</Link>}
      />
    );
  }

  const actor = ePermitActorOf(session)!;

  async function saveDraft(): Promise<EPermit> {
    const body = input();
    const saved = draftId ? await updateEPermitDraft(draftId, actor, body) : await createEPermit(actor, body);
    upsertEPermit(saved);
    setDraftId(saved.id);
    return saved;
  }

  async function onSave() {
    setBusy(true);
    try {
      const saved = await saveDraft();
      message.success(tr("Draft {no} saved", { no: saved.permitNo }));
      router.push(`/e-permits/${saved.id}`);
    } catch (err) {
      message.error(trData((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(override?: { remark: string }) {
    setBusy(true);
    try {
      const saved = await saveDraft();
      const submitted = await submitEPermit(saved.id, actor, override);
      upsertEPermit(submitted);
      setBlocks(null);
      message.success(tr("Permit {no} submitted for approval", { no: submitted.permitNo }));
      router.push(`/e-permits/${submitted.id}`);
    } catch (err) {
      if (err instanceof SoftBlockError) {
        setBlocks({ list: err.softBlocks, canOverride: err.canOverride });
      } else {
        message.error(trData((err as Error).message));
      }
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    { title: tr("Work & shift") },
    { title: tr("People") },
    { title: tr("Checklists") },
    { title: tr("Review") },
  ];

  const workStep = (
    <Section title={tr("Part A — the work")}>
      <div style={GRID}>
        <Field id="location" label={tr("Location")} required>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={tr("One seeded location")}
            value={d.locationId}
            onChange={(v) => set({ locationId: v })}
            options={locations.map((l) => ({ value: l.id, label: trData(l.name) }))}
          />
        </Field>
        <Field id="category" label={tr("Category")} required>
          <Radio.Group
            optionType="button"
            value={d.category}
            onChange={(e) => {
              const category = e.target.value as EPermitCategory;
              set({ category, subCategory: SUBCATEGORIES[category].includes(d.subCategory as EPermitSubCategory) ? d.subCategory : undefined });
            }}
            options={(["hot_work", "cold_work"] as EPermitCategory[]).map((c) => ({ value: c, label: tr(EPERMIT_CATEGORY_LABELS[c]) }))}
          />
        </Field>
        <Field id="subCategory" label={tr("Type of work")} required>
          <Select
            placeholder={tr("Choose")}
            value={d.subCategory}
            onChange={(v) => set({ subCategory: v, emergency: v === "breakdown_repair" ? d.emergency : false })}
            options={SUBCATEGORIES[d.category].map((s) => ({ value: s, label: tr(EPERMIT_SUBCATEGORY_LABELS[s]) }))}
          />
        </Field>
        <Field id="shift" label={tr("Shift")} required hint={tr("Valid until the end of the chosen shift")} error={planErrors[0] ? trData(planErrors[0]) : undefined} wide>
          <ShiftSchedule
            choices={choices}
            now={now}
            shift={d.shiftCode}
            onShiftChange={(v) => set({ shiftCode: v, planned: null })}
            planned={d.planned ?? null}
            onPlannedChange={(planned) => set({ planned })}
            invalid={planErrors.length > 0}
            moved={planMove}
          />
        </Field>
        <Field id="jsa" label={tr("JSA / risk assessment ref.")}>
          <Input value={d.jsaRef} maxLength={80} onChange={(e) => set({ jsaRef: e.target.value })} placeholder={tr("e.g. JSA/ETP/0042")} />
        </Field>
      </div>
      <Field id="description" label={tr("Work description")} required>
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} showCount value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder={tr("What work, on what equipment, and why")} />
      </Field>
      <Field id="hazards" label={tr("Part B2 — potential hazards & special precautions")}>
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} value={d.hazardsText} onChange={(e) => set({ hazardsText: e.target.value })} placeholder={tr("e.g. Fall hazard — use safety belt; sharp edges — gloves")} />
      </Field>
      {d.subCategory === "breakdown_repair" ? (
        <Field id="emergency" label={tr("Emergency permit")} hint={tr("Breakdown repair only — the Plant Manager approves, valid {h} h max, HoD reviews afterwards", { h: EPERMIT_POLICY.emergency.maxHours })}>
          <Switch checked={d.emergency} onChange={(v) => set({ emergency: v })} />
        </Field>
      ) : null}
      {d.safetyEventId ? (
        <Alert type="info" showIcon title={tr("Linked to breakdown {id}", { id: d.safetyEventId })} style={{ marginTop: 8 }} />
      ) : null}
      {d.parentPermitId ? (
        <Alert type="info" showIcon title={tr("Continues permit {id} — fresh approvals are needed", { id: d.parentPermitId })} style={{ marginTop: 8 }} />
      ) : null}
    </Section>
  );

  const peopleStep = (
    <Section title={tr("Workers and Permit Holder")}>
      <Field id="workers" label={tr("Workers on this permit")} required hint={tr("They acknowledge before work starts — on their own login or on your device")}>
        <Select
          mode="multiple"
          showSearch
          optionFilterProp="label"
          value={d.workerIds}
          onChange={(v: string[]) => set({ workerIds: v, holderId: v.includes(d.holderId ?? "") ? d.holderId : undefined })}
          options={workers.map((e) => ({ value: e.id, label: `${trData(e.name)} · ${trData(e.designation ?? "")}` }))}
        />
      </Field>
      <Field id="holder" label={tr("Permit Holder (crew lead)")} required hint={tr("Accepts the permit for the crew and declares the site safe at the end")}>
        <Select
          placeholder={tr("One of the workers")}
          value={d.holderId}
          onChange={(v) => set({ holderId: v })}
          options={d.workerIds.map((id) => ({ value: id, label: trData(dir.empName(id)) }))}
        />
      </Field>
    </Section>
  );

  const checklistStep = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Section title={tr("Part B1 — safety measures taken")}>
        <YesNaList defs={SAFETY_MEASURES} value={d.safetyMeasures} onChange={(v) => set({ safetyMeasures: v })} />
      </Section>
      <Section title={tr("Part B3A — PPE & others")}>
        <YesNaList defs={PPE_ITEMS} value={d.ppe} onChange={(v) => set({ ppe: v })} />
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {d.customPpe.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <Input
                value={c.label}
                maxLength={80}
                placeholder={tr("e.g. Use goggle")}
                onChange={(e) => set({ customPpe: d.customPpe.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
              />
              <Button icon={<DeleteOutlined />} aria-label={tr("Remove")} onClick={() => set({ customPpe: d.customPpe.filter((_, j) => j !== i) })} />
            </div>
          ))}
          {d.customPpe.length < MAX_CUSTOM_PPE ? (
            <Button icon={<PlusOutlined />} onClick={() => set({ customPpe: [...d.customPpe, { key: `custom_${d.customPpe.length + 1}`, value: "yes", label: "" }] })} style={{ alignSelf: "flex-start" }}>
              {tr("Add other PPE")}
            </Button>
          ) : null}
        </div>
      </Section>
      <Section title={tr("Part B3B — fire precautions & gas tests")} extra={hot ? tr("Required for hot work") : tr("Optional for cold work")}>
        <YesNaList defs={FIRE_GAS_ITEMS} value={d.fireGas} onChange={(v) => set({ fireGas: v })} />
        <div style={{ marginTop: 16 }}>
          <GasReadingsInput value={d.gas} onChange={(gas) => set({ gas })} required={hot ? (EPERMIT_POLICY.requiredGasReadings as GasKey[]) : []} />
        </div>
      </Section>
      <Section title={tr("Part B3C — associated certificates")} extra={tr("Tick + reference number")}>
        <YesNaList defs={CERTIFICATE_TYPES} value={d.certificates} onChange={(v) => set({ certificates: v })} withRef />
      </Section>
    </div>
  );

  const reviewStep = (
    <Section title={tr("Review & submit")}>
      {errors.length ? (
        <Alert
          type="warning"
          showIcon
          title={tr("Before you can submit")}
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((e) => (
                <li key={e}>{trData(e)}</li>
              ))}
            </ul>
          }
        />
      ) : (
        <Alert type="success" showIcon title={tr("Ready to submit. Submitting records your acknowledgement as issuer.")} />
      )}
      <div style={{ marginTop: 16, fontSize: 13, display: "grid", gridTemplateColumns: "160px minmax(0, 1fr)", rowGap: 8 }}>
        <span style={{ color: token.colorTextSecondary }}>{tr("Location")}</span>
        <span>{location ? trData(location.name) : "—"}</span>
        <span style={{ color: token.colorTextSecondary }}>{tr("Work")}</span>
        <span>{d.subCategory ? `${tr(EPERMIT_CATEGORY_LABELS[d.category])} · ${tr(EPERMIT_SUBCATEGORY_LABELS[d.subCategory])}` : "—"}{d.emergency ? ` · ${tr("Emergency")}` : ""}</span>
        <span style={{ color: token.colorTextSecondary }}>{tr("Shift")}</span>
        <span>{d.shiftCode ?? "—"}</span>
        <span style={{ color: token.colorTextSecondary }}>{tr("Holder")}</span>
        <span>{d.holderId ? trData(dir.empName(d.holderId)) : "—"}</span>
        <span style={{ color: token.colorTextSecondary }}>{tr("Workers")}</span>
        <span>{d.workerIds.map((w) => trData(dir.empName(w))).join(", ") || "—"}</span>
        <span style={{ color: token.colorTextSecondary }}>{tr("Approvals")}</span>
        <span>{approvalsPreview.join(" · ") || "—"}</span>
      </div>
    </Section>
  );

  const summaryRow = (label: string, value: React.ReactNode, sub?: React.ReactNode) => (
    <div style={{ padding: "10px 16px", borderTop: `1px solid ${token.colorSplit}`, fontSize: 13, lineHeight: 1.45 }}>
      <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{label}</div>
      <div style={{ color: value ? token.colorText : token.colorTextQuaternary }}>{value || tr("Not chosen yet")}</div>
      {sub ? <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{sub}</div> : null}
    </div>
  );

  const summary = (
    <aside style={{ position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <Panel>
        <div style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>{tr("Permit summary")}</div>
        {summaryRow(
          tr("Location"),
          location ? trData(location.name) : null,
          location ? tr("Authoriser: {dept} HoD", { dept: trData(masters.deptName(location.ownerDepartmentId)) }) : null,
        )}
        {summaryRow(
          tr("Work"),
          d.subCategory ? `${tr(EPERMIT_CATEGORY_LABELS[d.category])} · ${tr(EPERMIT_SUBCATEGORY_LABELS[d.subCategory])}` : null,
          d.emergency ? <span style={{ color: token.colorError }}>{tr("Emergency")}</span> : null,
        )}
        {summaryRow(
          tr("Shift"),
          d.shiftCode ? `${d.shiftCode}${shiftChoice ? ` · ${plantTime(shiftChoice.start)}–${plantTime(shiftChoice.end)}` : ""}` : null,
          shiftChoice ? (shiftChoice.running ? tr("running now") : tr("starts {day}", { day: plantDayTime(shiftChoice.start) })) : null,
        )}
        {summaryRow(
          tr("Workers"),
          d.workerIds.length ? d.workerIds.map((w) => trData(dir.empName(w))).join(", ") : null,
          d.holderId ? tr("Holder: {name}", { name: trData(dir.empName(d.holderId)) }) : null,
        )}
        {approvalsPreview.length ? (
          <div style={{ padding: "10px 16px", borderTop: `1px solid ${token.colorSplit}`, fontSize: 13 }}>
            <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>{tr("Approvals needed")}</div>
            {approvalsPreview.map((a) => (
              <div key={a} style={{ lineHeight: 1.6 }}>{a}</div>
            ))}
          </div>
        ) : null}
      </Panel>

      <Panel style={{ background: errors.length ? token.colorBgContainer : token.colorSuccessBg }}>
        <div style={{ padding: "12px 16px", fontSize: 13 }}>
          {errors.length ? (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{tr("Still needed ({n})", { n: errors.length })}</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4, color: token.colorTextSecondary }}>
                {errors.slice(0, 6).map((e) => (
                  <li key={e} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: token.colorWarning, flex: "none", transform: "translateY(-2px)" }} />
                    {trData(e)}
                  </li>
                ))}
              </ul>
              {errors.length > 6 ? <div style={{ marginTop: 4, color: token.colorTextTertiary }}>{tr("and {n} more", { n: errors.length - 6 })}</div> : null}
            </>
          ) : (
            <span style={{ fontWeight: 500, color: token.colorSuccessText }}>{tr("Ready to submit")}</span>
          )}
        </div>
      </Panel>
    </aside>
  );

  return (
    <div ref={pageRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div data-anim="intro">
        <Link href="/e-permits" style={{ fontSize: 13 }}>
          <ArrowLeftOutlined /> {tr("Permits")}
        </Link>
        <h2 style={{ margin: "8px 0 4px", fontSize: 20 }}>{draftId ? tr("Edit draft permit") : tr("Issue a permit")}</h2>
        <p style={{ margin: 0, fontSize: 13, color: token.colorTextSecondary }}>
          {tr("One location, one shift. It becomes active once the Authoriser (and any other required approvers) approve and every worker acknowledges.")}
        </p>
      </div>
      {masters.error ? <Alert type="error" showIcon title={tr("Departments and locations unavailable: {error}", { error: trData(masters.error) })} /> : null}
      <div data-anim="intro">
        <Steps current={step} onChange={goTo} items={steps} size="small" />
      </div>
      <div data-anim="intro" className="safety-case-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {[workStep, peopleStep, checklistStep, reviewStep][step]}
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
            <Button disabled={step === 0} onClick={() => setStep(step - 1)}>{tr("Back")}</Button>
            <div style={{ display: "flex", gap: 8 }}>
              <Button loading={busy} onClick={onSave} disabled={!d.locationId || !d.subCategory || !d.shiftCode}>{tr("Save draft")}</Button>
              {step < 3 ? (
                <Button type="primary" disabled={step === 0 && planErrors.length > 0} onClick={() => goTo(step + 1)}>{tr("Next")}</Button>
              ) : (
                <Button type="primary" loading={busy} disabled={errors.length > 0} onClick={() => onSubmit()}>{tr("Acknowledge & submit")}</Button>
              )}
            </div>
          </div>
        </div>
        {summary}
      </div>

      <Modal
        open={Boolean(blocks)}
        title={tr("This permit is soft-blocked")}
        onCancel={() => setBlocks(null)}
        okText={blocks?.canOverride ? tr("Override & submit") : tr("OK")}
        okButtonProps={{ disabled: Boolean(blocks?.canOverride) && !overrideRemark.trim(), loading: busy }}
        onOk={() => (blocks?.canOverride ? onSubmit({ remark: overrideRemark.trim() }) : setBlocks(null))}
      >
        <ul style={{ paddingLeft: 18 }}>
          {blocks?.list.map((b) => (
            <li key={b}>{trData(b)}</li>
          ))}
        </ul>
        {blocks?.canOverride ? (
          <Input.TextArea placeholder={tr("Why is it safe to go ahead? (required)")} value={overrideRemark} onChange={(e) => setOverrideRemark(e.target.value)} autoSize={{ minRows: 2 }} />
        ) : (
          <p style={{ margin: 0 }}>{tr("Your draft is saved. Fix the issue, or ask the Plant Manager to override.")}</p>
        )}
      </Modal>
    </div>
  );
}

function Field({ id, label, required, hint, error, wide, children }: { id: string; label: string; required?: boolean; hint?: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <div data-field={id} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, minWidth: 0, gridColumn: wide ? "1 / -1" : undefined }}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>
        {label}
        {required ? <span style={{ color: token.colorError }}> *</span> : null}
      </span>
      {children}
      {error ? <span role="alert" style={{ fontSize: 12, color: token.colorError }}>{error}</span> : hint ? <span style={{ fontSize: 12, color: token.colorTextTertiary }}>{hint}</span> : null}
    </div>
  );
}

export default function IssuePermitPage() {
  return (
    <Suspense fallback={null}>
      <IssuePermitForm />
    </Suspense>
  );
}
