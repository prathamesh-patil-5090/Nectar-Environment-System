"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Alert, App, Button, DatePicker, Popover, Segmented, Select, theme } from "antd";
import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import {
  CERTIFICATE_TYPES,
  EPERMIT_CATEGORY_LABELS,
  EPERMIT_POLICY,
  EPERMIT_SUBCATEGORY_LABELS,
  FIRE_GAS_ITEMS,
  GAS_KEYS,
  GAS_LIMITS,
  PERMIT_RULES,
  PERMIT_SHIFTS,
  PLANT_UTC_OFFSET_MINUTES,
  PPE_ITEMS,
  SAFETY_MEASURES,
  SUBCATEGORIES,
  canEditLocationDepartments,
  type EPermitCategory,
  type PermitShiftCode,
} from "@/lib/e-permit/rules";
import type { Department, PermitLocation } from "@/lib/e-permit/types";
import type { PermitViewer } from "@/lib/e-permit/rules";
import { setDepartmentAvailability, setLocationDepartments } from "@/lib/api/e-permits";
import { useEPermitMasters, useNow, usePermitViewer } from "@/lib/e-permit/hooks";
import { useDirectory } from "@/lib/safety/hooks";
import { ePermitActorOf } from "@/lib/rbac";
import { getSession } from "@/lib/auth";
import { Dot, Panel, Section } from "@/components/quiet";
import { fmtShort } from "@/components/e-permit/PermitBits";
import { useTableMotion } from "@/lib/motion/use-table-motion";
import { tr, trData } from "@/lib/i18n";
import { plantDayTime, plantNow } from "@/lib/plant-time";

type Tab = "overview" | "approvers" | "locations" | "checklists" | "reference";

export default function EPermitPoliciesPage() {
  const { token } = theme.useToken();
  const masters = useEPermitMasters();
  const viewer = usePermitViewer(masters);
  const [tab, setTab] = useState<Tab>("overview");
  const now = useNow(60_000);
  const { pageRef } = useTableMotion(masters.departments.length ? "ready" : "");

  const myDept = useMemo(
    () => (viewer?.id ? masters.departments.find((d) => d.headUserId === viewer.id) : undefined),
    [viewer, masters.departments],
  );

  return (
    <div ref={pageRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div data-anim="intro" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Link href="/e-permits" style={{ fontSize: 13, width: "fit-content" }}>
          <ArrowLeftOutlined /> {tr("Permits")}
        </Link>
        <p style={{ margin: 0, fontSize: 14, color: token.colorTextSecondary, maxWidth: 640 }}>
          {tr("How every permit works. Permits keep the policy version they were issued under (v{v}).", { v: EPERMIT_POLICY.version })}
        </p>
      </div>

      {masters.error ? (
        <Alert type="warning" showIcon title={tr("Departments and locations unavailable: {error}", { error: trData(masters.error) })} />
      ) : null}

      {myDept ? <AvailabilityBar dept={myDept} now={now} reload={masters.reloadMasters} /> : null}

      <div data-anim="intro" style={{ overflowX: "auto", margin: "0 -2px", padding: "0 2px" }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: tr("Overview") },
            { value: "approvers", label: tr("Approvers") },
            { value: "locations", label: tr("Locations") },
            { value: "checklists", label: tr("Checklists") },
            { value: "reference", label: tr("Shifts & contacts") },
          ]}
        />
      </div>

      <div key={tab} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {tab === "overview" ? <OverviewTab /> : null}
        {tab === "approvers" ? <ApproversTab now={now} /> : null}
        {tab === "locations" ? <LocationsTab viewer={viewer} /> : null}
        {tab === "checklists" ? <ChecklistsTab /> : null}
        {tab === "reference" ? <ReferenceTab /> : null}
      </div>
    </div>
  );
}

/* ───────────────────────── HoD availability ───────────────────────── */

function AvailabilityBar({ dept, now, reload }: { dept: Department; now: number; reload: () => Promise<unknown> }) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [until, setUntil] = useState<Dayjs | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const away = Boolean(dept.headUnavailableUntil && Date.parse(dept.headUnavailableUntil) > now);
  const deputy = dept.deputyNames.map((n) => trData(n)).join(", ");

  async function save(next: Dayjs | null) {
    const actor = ePermitActorOf(getSession());
    if (!actor) return;
    setBusy(true);
    try {
      await setDepartmentAvailability(dept.id, actor, next ? next.toISOString() : null);
      await reload();
      message.success(next ? tr("Approval requests now also go to your deputy") : tr("Marked available"));
      setOpen(false);
      setUntil(null);
    } catch (err) {
      message.error(trData((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-anim="intro">
      <Panel style={{ background: away ? token.colorWarningBg : token.colorBgContainer }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px", minWidth: 0, fontSize: 13 }}>
            <Dot
              color={away ? token.colorWarning : token.colorSuccess}
              label={
                <span style={{ fontWeight: 500 }}>
                  {away
                    ? tr("You're away until {time}", { time: fmtShort(dept.headUnavailableUntil!) })
                    : tr("You're approving for {dept}", { dept: trData(dept.name) })}
                </span>
              }
            />
            <div style={{ marginTop: 2, paddingLeft: 14, color: token.colorTextSecondary }}>
              {away ? tr("Requests also go to {deputy}.", { deputy }) : tr("Deputy: {deputy}", { deputy })}
            </div>
          </div>
          {away ? (
            <Button loading={busy} onClick={() => save(null)}>
              {tr("I'm back")}
            </Button>
          ) : (
            <Popover
              open={open}
              onOpenChange={setOpen}
              trigger="click"
              placement="bottomRight"
              content={
                <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 240 }}>
                  <span style={{ fontSize: 13 }}>{tr("Away until")}</span>
                  <DatePicker
                    showTime={{ format: "HH:mm" }}
                    format="DD MMM HH:mm"
                    value={until}
                    onChange={setUntil}
                    disabledDate={(d) => d.endOf("day").valueOf() < plantNow()}
                    style={{ width: "100%" }}
                  />
                  {/* The picker follows the device clock; off IST, show what that means at the plant. */}
                  {until && until.utcOffset() !== PLANT_UTC_OFFSET_MINUTES ? (
                    <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{tr("Plant time (IST): {time}", { time: plantDayTime(until.valueOf()) })}</span>
                  ) : null}
                  <Button type="primary" disabled={!until} loading={busy} onClick={() => save(until)}>
                    {tr("Hand over to deputy")}
                  </Button>
                </div>
              }
            >
              <Button>{tr("Going away?")}</Button>
            </Popover>
          )}
        </div>
      </Panel>
    </div>
  );
}

/* ───────────────────────── Overview ───────────────────────── */

function OverviewTab() {
  const { token } = theme.useToken();
  const p = EPERMIT_POLICY;
  const stats: { value: string; label: string }[] = [
    { value: tr("1 shift"), label: tr("A permit is valid until its shift ends") },
    { value: tr("{n} renewals", { n: p.maxRenewals }), label: tr("{h} h in total, re-approved each time", { h: p.maxTotalHours }) },
    { value: tr("{m} min", { m: p.warnBeforeEndMinutes }), label: tr("Warning before the shift ends") },
    { value: tr("{h} hours", { h: p.clearanceValidityHours }), label: tr("Approvals lapse if work hasn't started") },
  ];
  const steps: [string, string][] = [
    [tr("Issue permit"), tr("Shift In-charge fills the form")],
    [tr("Approve"), tr("HoD of every concerned department")],
    [tr("Acknowledge"), tr("Holder and every worker")],
    [tr("Work"), tr("Active until the shift ends")],
    [tr("Return"), tr("Site safe → returned → accepted")],
  ];

  return (
    <>
      <Panel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{ padding: "16px 18px", borderRight: `1px solid ${token.colorSplit}`, borderBottom: `1px solid ${token.colorSplit}`, marginRight: -1, marginBottom: -1 }}
            >
              <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ marginTop: 4, fontSize: 13, color: token.colorTextSecondary }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Section title={tr("A permit's life")}>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {steps.map(([title, sub], i) => (
            <li key={title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span
                aria-hidden
                style={{
                  flex: "none",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: token.colorPrimary,
                  background: token.colorPrimaryBg,
                }}
              >
                {i + 1}
              </span>
              <div style={{ lineHeight: 1.35 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{sub}</div>
              </div>
            </li>
          ))}
        </ol>
        <p style={{ margin: "14px 0 0", fontSize: 12, color: token.colorTextTertiary }}>
          {tr("Never closes by itself — an overdue permit stays red until it is returned or renewed.")}
        </p>
      </Section>

      <div className="epermit-policy-two">
        <Section title={tr("Special cases")}>
          <Rows
            rows={[
              [tr("Safety gate"), tr("{work} also need the Safety In-charge", { work: p.requireSafetyFor.map((s) => tr(EPERMIT_SUBCATEGORY_LABELS[s])).join(", ") })],
              [tr("Hot work"), tr("Fire watcher, extinguishers and an oxygen reading")],
              [tr("Emergency"), tr("Breakdown repair only · Plant Manager approves · {h} h max · reviews within {r} h", { h: p.emergency.maxHours, r: p.emergency.postReviewWithinHours })],
              [tr("Can't overlap"), p.conflictRules.map((r) => `${tr(labelOf(r.a))} + ${tr(labelOf(r.b))}`).join(" · ")],
            ]}
          />
        </Section>
        <Section title={tr("Ground rules")} extra={String(PERMIT_RULES.length)}>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 13, lineHeight: 1.5 }}>
            {PERMIT_RULES.map((r, i) => (
              <li key={r} style={{ display: "grid", gridTemplateColumns: "20px minmax(0, 1fr)" }}>
                <span style={{ color: token.colorTextTertiary, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <span>{tr(r)}</span>
              </li>
            ))}
          </ol>
        </Section>
      </div>
      <TwoColStyle />
    </>
  );
}

/* ───────────────────────── Approvers ───────────────────────── */

function ApproversTab({ now }: { now: number }) {
  const { token } = theme.useToken();
  const masters = useEPermitMasters();

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12 }}>
        {masters.departments.map((d) => {
          const away = Boolean(d.headUnavailableUntil && Date.parse(d.headUnavailableUntil) > now);
          return (
            <Panel key={d.id}>
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{trData(d.name)}</span>
                  <Dot color={away ? token.colorWarning : token.colorSuccess} label={<span style={{ fontSize: 12, color: token.colorTextSecondary }}>{away ? tr("Away") : tr("Available")}</span>} />
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <div>{trData(d.headName)}</div>
                  <div style={{ color: token.colorTextSecondary }}>
                    {tr("Deputy: {deputy}", { deputy: d.deputyNames.map((n) => trData(n)).join(", ") })}
                  </div>
                  {away ? (
                    <div style={{ color: token.colorWarningText, fontSize: 12 }}>{tr("Back {time}", { time: fmtShort(d.headUnavailableUntil!) })}</div>
                  ) : null}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <Section title={tr("Extra clearances by type of work")} extra={tr("On top of each location's concerned departments")} flush>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {EPERMIT_POLICY.extraClearanceRules.map((r, i) => {
            const work =
              [r.categories?.map((c) => tr(EPERMIT_CATEGORY_LABELS[c])).join(", "), r.subCategories?.map((s) => tr(EPERMIT_SUBCATEGORY_LABELS[s])).join(", ")]
                .filter(Boolean)
                .join(" · ") || tr("Any work");
            return (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  padding: "12px 16px",
                  borderTop: i ? `1px solid ${token.colorSplit}` : undefined,
                  fontSize: 13,
                }}
              >
                <span style={{ minWidth: 0, flex: "1 1 260px" }}>
                  {work}
                  {r.locationTags?.length ? (
                    <span style={{ color: token.colorTextSecondary }}> · {tr("at {tags} locations", { tags: r.locationTags.join(", ") })}</span>
                  ) : null}
                </span>
                <span style={{ whiteSpace: "nowrap", color: token.colorTextSecondary }}>
                  → <span style={{ color: token.colorText, fontWeight: 500 }}>{r.departmentIds.map((d) => trData(masters.deptName(d))).join(", ")}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}

/* ───────────────────────── Locations ───────────────────────── */

function LocationsTab({ viewer }: { viewer: PermitViewer | null | undefined }) {
  const { token } = theme.useToken();
  const masters = useEPermitMasters();
  const dir = useDirectory();
  const sites = [...new Set(masters.locations.map((l) => l.siteId))];

  return (
    <>
      <p style={{ margin: 0, fontSize: 13, color: token.colorTextSecondary, maxWidth: 760 }}>
        {tr("Every location belongs to one department; its HoD is the Authoriser. Every other department concerned with the location must also clear each permit there.")}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 12, alignItems: "start" }}>
        {sites.map((siteId) => {
          const locs = masters.locations.filter((l) => l.siteId === siteId);
          return (
            <Section key={siteId} title={trData(dir.siteName(siteId))} extra={String(locs.length)} flush>
              {locs.map((l, i) => (
                <LocationRow key={l.id} location={l} first={i === 0} canEdit={canEditLocationDepartments(viewer, l.siteId)} />
              ))}
            </Section>
          );
        })}
      </div>
    </>
  );
}

function LocationRow({ location: l, first, canEdit }: { location: PermitLocation; first: boolean; canEdit: boolean }) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const masters = useEPermitMasters();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const concerned = (l.concernedDepartmentIds ?? []).filter((d) => d !== l.ownerDepartmentId);

  async function save() {
    const actor = ePermitActorOf(getSession());
    if (!actor) return;
    setBusy(true);
    try {
      await setLocationDepartments(l.id, actor, draft);
      await masters.reloadMasters();
      message.success(tr("Saved — new permits at {loc} need these clearances", { loc: trData(l.name) }));
      setEditing(false);
    } catch (err) {
      message.error(trData((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-location={l.id} style={{ padding: "12px 16px", borderTop: first ? undefined : `1px solid ${token.colorSplit}`, fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <span style={{ fontWeight: 500, minWidth: 0 }}>
          {trData(l.name)}
          {l.tags.length ? <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: token.colorTextTertiary }}>{l.tags.join(" · ")}</span> : null}
        </span>
        {canEdit && !editing ? (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            style={{ padding: 0, height: "auto" }}
            onClick={() => {
              setDraft(concerned);
              setEditing(true);
            }}
          >
            {tr("Edit")}
          </Button>
        ) : null}
      </div>
      <div style={{ marginTop: 4, color: token.colorTextSecondary }}>
        {tr("Authoriser")}: <span style={{ color: token.colorText }}>{tr("{dept} HoD", { dept: trData(masters.deptName(l.ownerDepartmentId)) })}</span>
      </div>
      {editing ? (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <Select
            mode="multiple"
            value={draft}
            onChange={setDraft}
            placeholder={tr("No other department")}
            options={masters.departments
              .filter((d) => d.id !== l.ownerDepartmentId)
              .map((d) => ({ value: d.id, label: trData(d.name) }))}
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button size="small" onClick={() => setEditing(false)}>{tr("Cancel")}</Button>
            <Button size="small" type="primary" loading={busy} onClick={save}>{tr("Save")}</Button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ color: token.colorTextSecondary }}>{tr("Also clears")}:</span>
          {concerned.length ? (
            concerned.map((d) => (
              <span key={d} style={{ fontSize: 12, padding: "1px 8px", borderRadius: 10, background: token.colorFillTertiary }}>
                {trData(masters.deptName(d))}
              </span>
            ))
          ) : (
            <span style={{ color: token.colorTextTertiary }}>{tr("No other department")}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Checklists ───────────────────────── */

function ChecklistsTab() {
  const { token } = theme.useToken();
  const subcats = (c: EPermitCategory) => SUBCATEGORIES[c].map((s) => tr(EPERMIT_SUBCATEGORY_LABELS[s]));
  const lists: [string, string[]][] = [
    [tr("B1 — safety measures"), SAFETY_MEASURES.map((d) => tr(d.label))],
    [tr("B3A — PPE & others"), PPE_ITEMS.map((d) => tr(d.label))],
    [tr("B3B — fire precautions & gas tests"), FIRE_GAS_ITEMS.map((d) => tr(d.label))],
    [tr("B3C — associated certificates"), CERTIFICATE_TYPES.map((d) => tr(d.label))],
  ];

  return (
    <>
      <Section title={tr("Types of work")}>
        <Rows
          rows={(["hot_work", "cold_work"] as EPermitCategory[]).map((c) => [
            tr(EPERMIT_CATEGORY_LABELS[c]),
            <Chips key={c} items={subcats(c)} />,
          ])}
        />
      </Section>
      <p style={{ margin: 0, fontSize: 13, color: token.colorTextSecondary }}>
        {tr("What the issuer ticks on Part B of every permit.")}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))", gap: 12, alignItems: "start" }}>
        {lists.map(([title, items]) => (
          <Section key={title} title={title} extra={String(items.length)}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 13, lineHeight: 1.75 }}>
              {items.map((i) => (
                <li key={i} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span aria-hidden style={{ width: 4, height: 4, borderRadius: "50%", background: token.colorTextQuaternary, flex: "none", transform: "translateY(-2px)" }} />
                  {i}
                </li>
              ))}
            </ul>
          </Section>
        ))}
      </div>
    </>
  );
}

/* ───────────────────────── Shifts, gas & contacts ───────────────────────── */

function ReferenceTab() {
  const { token } = theme.useToken();
  const masters = useEPermitMasters();
  const dir = useDirectory();
  const codes = Object.keys(PERMIT_SHIFTS) as PermitShiftCode[];
  const sites = [...new Set(masters.contacts.map((c) => c.siteId))];

  return (
    <>
      <Section title={tr("Shifts")}>
        <ShiftTimeline codes={codes} />
      </Section>

      <div className="epermit-policy-two">
        <Section title={tr("Gas limits")} flush>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: token.colorTextSecondary, textAlign: "left" }}>
                <th style={th}>{tr("Gas")}</th>
                <th style={th}>{tr("Safe (8 h)")}</th>
                <th style={th}>{tr("Flammable")}</th>
              </tr>
            </thead>
            <tbody>
              {GAS_KEYS.map((g) => (
                <tr key={g} style={{ borderTop: `1px solid ${token.colorSplit}` }}>
                  <td style={td}>{tr(GAS_LIMITS[g].label)}</td>
                  <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{GAS_LIMITS[g].safe}</td>
                  <td style={{ ...td, color: token.colorTextSecondary, fontVariantNumeric: "tabular-nums" }}>{GAS_LIMITS[g].flammable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title={tr("Emergency contacts")} flush>
          {sites.map((siteId, si) => (
            <div key={siteId} style={{ padding: "12px 16px", borderTop: si ? `1px solid ${token.colorSplit}` : undefined }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: token.colorTextSecondary, marginBottom: 6 }}>{trData(dir.siteName(siteId))}</div>
              {masters.contacts
                .filter((c) => c.siteId === siteId)
                .map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, lineHeight: 1.8 }}>
                    <span>{tr(c.team)}</span>
                    <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      <a href={`tel:${c.mobile.replace(/\s+/g, "")}`}>{c.mobile}</a>
                      {c.extension ? <span style={{ color: token.colorTextTertiary }}> · {tr("ext. {ext}", { ext: c.extension })}</span> : null}
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </Section>
      </div>
      <TwoColStyle />
    </>
  );
}

/** 24-hour bar per shift, so overlaps (G) and the overnight C shift read at a glance. */
function ShiftTimeline({ codes }: { codes: PermitShiftCode[] }) {
  const { token } = theme.useToken();
  const mins = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const pct = (m: number) => `${(m / 1440) * 100}%`;
  const segs = (s: number, e: number): [number, number][] => (e > s ? [[s, e]] : [[s, 1440], [0, e]]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {codes.map((code) => {
        const { start, end } = PERMIT_SHIFTS[code];
        return (
          <div key={code} style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) 96px", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{code}</span>
            <div style={{ position: "relative", height: 10, borderRadius: 5, background: token.colorFillTertiary }}>
              {segs(mins(start), mins(end)).map(([s, e]) => (
                <span
                  key={s}
                  style={{ position: "absolute", top: 0, bottom: 0, left: pct(s), width: pct(e - s), borderRadius: 5, background: code === "G" ? token.colorTextQuaternary : token.colorPrimary }}
                />
              ))}
            </div>
            <span style={{ color: token.colorTextSecondary, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
              {start}–{end}
            </span>
          </div>
        );
      })}
      <div style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) 96px", gap: 10, fontSize: 11, color: token.colorTextTertiary }}>
        <span />
        <div style={{ display: "flex", justifyContent: "space-between", fontVariantNumeric: "tabular-nums" }}>
          {["00", "06", "12", "18", "24"].map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}

/* ───────────────────────── Bits ───────────────────────── */

const th: React.CSSProperties = { padding: "10px 16px", fontWeight: 500, fontSize: 12 };
const td: React.CSSProperties = { padding: "9px 16px" };

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  const { token } = theme.useToken();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ lineHeight: 1.5 }}>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{label}</div>
          <div>{value}</div>
        </div>
      ))}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  const { token } = theme.useToken();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {items.map((i) => (
        <span key={i} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10, background: token.colorFillTertiary }}>
          {i}
        </span>
      ))}
    </div>
  );
}

function TwoColStyle() {
  return (
    <style>{`.epermit-policy-two{display:grid;gap:16px;grid-template-columns:minmax(0,1fr);align-items:start}
@media (min-width:900px){.epermit-policy-two{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}`}</style>
  );
}

/** A conflict-rule tag is either a category or a sub-category. */
function labelOf(tag: string): string {
  return (
    EPERMIT_CATEGORY_LABELS[tag as EPermitCategory] ??
    EPERMIT_SUBCATEGORY_LABELS[tag as keyof typeof EPERMIT_SUBCATEGORY_LABELS] ??
    tag
  );
}
