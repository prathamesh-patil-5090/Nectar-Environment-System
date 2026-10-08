"use client";

import { useEffect, useState } from "react";
import { Button, InputNumber, Radio, Select, Space, theme } from "antd";
import { ArrowRightOutlined, ClockCircleOutlined, CloseOutlined, WarningOutlined } from "@ant-design/icons";
import {
  EPERMIT_CATEGORY_LABELS,
  EPERMIT_STATUS_LABELS,
  EPERMIT_SUBCATEGORY_LABELS,
  GAS_KEYS,
  GAS_LIMITS,
  isGasReadingOk,
  isOverdue,
  minutesLeft,
  type ChecklistAnswer,
  type ChecklistItemDef,
  type EPermitStatus,
  type GasKey,
  type YesNa,
} from "@/lib/e-permit/rules";
import type { EPermit } from "@/lib/e-permit/types";
import { Dot } from "@/components/quiet";
import { intlLocale, tr } from "@/lib/i18n";
import { PLANT_TZ, plantDay, plantDayKey, plantTime } from "@/lib/plant-time";

type Token = ReturnType<typeof theme.useToken>["token"];

export const permitStatusColor = (token: Token, status: EPermitStatus, overdue = false) =>
  overdue
    ? token.colorError
    : status === "ACTIVE"
      ? token.colorSuccess
      : status === "SUSPENDED" || status === "REJECTED"
        ? token.colorError
        : status === "COMPLETED"
          ? token.colorPrimary
          : status === "CANCELLED" || status === "RETURNED_INCOMPLETE" || status === "DRAFT"
            ? token.colorTextQuaternary
            : token.colorWarning;

/** Status dot; a live permit past its shift end reads "Overdue" in red. */
export function PermitStatusTag({ permit, now }: { permit: Pick<EPermit, "status" | "validTo">; now: number }) {
  const { token } = theme.useToken();
  const overdue = isOverdue(permit, now);
  return (
    <Dot
      color={permitStatusColor(token, permit.status, overdue)}
      label={overdue ? <span style={{ color: token.colorError, fontWeight: 600 }}>{tr("Overdue")}</span> : tr(EPERMIT_STATUS_LABELS[permit.status])}
    />
  );
}

export function CategoryText({ permit, wrap }: { permit: Pick<EPermit, "category" | "subCategory" | "emergency">; wrap?: boolean }) {
  const { token } = theme.useToken();
  return (
    <span style={{ whiteSpace: wrap ? "normal" : "nowrap" }}>
      <span style={{ color: permit.category === "hot_work" ? token.colorError : token.colorInfo, fontWeight: 500 }}>
        {tr(EPERMIT_CATEGORY_LABELS[permit.category])}
      </span>
      {" · "}
      {tr(EPERMIT_SUBCATEGORY_LABELS[permit.subCategory])}
      {permit.emergency ? (
        <span style={{ marginLeft: 8, color: token.colorError, fontWeight: 600 }}>
          <WarningOutlined /> {tr("Emergency")}
        </span>
      ) : null}
    </span>
  );
}

/** "14:32, Wednesday, 7 Oct 2026" — time, day and date in the viewer's language. */
export function fmtTimeDayDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const time = d.toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: PLANT_TZ });
  const day = d.toLocaleDateString(intlLocale(), { weekday: "long", timeZone: PLANT_TZ });
  const date = d.toLocaleDateString(intlLocale(), { day: "numeric", month: "short", year: "numeric", timeZone: PLANT_TZ });
  return `${time}, ${day}, ${date}`;
}

export function fmtShort(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(intlLocale(), { dateStyle: "medium", timeStyle: "short", timeZone: PLANT_TZ });
}

/** Countdown to the end of the permit's shift; red with elapsed overrun once past it. */
export function ValidityClock({ permit, now }: { permit: Pick<EPermit, "status" | "validTo">; now: number }) {
  const { token } = theme.useToken();
  const left = minutesLeft(permit, now);
  if (left === null) return <span style={{ color: token.colorTextTertiary }}>—</span>;
  const live = permit.status === "ACTIVE" || permit.status === "RENEWAL_PENDING";
  if (!live) return <span style={{ color: token.colorTextSecondary }}>{tr("Ends {time}", { time: fmtShort(permit.validTo) })}</span>;
  const abs = Math.abs(left);
  const hm = `${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, "0")}m`;
  if (left < 0) {
    return (
      <span style={{ color: token.colorError, fontWeight: 600, whiteSpace: "nowrap" }}>
        <ClockCircleOutlined /> {tr("Overdue by {hm}", { hm })}
      </span>
    );
  }
  const warn = left <= 60;
  return (
    <span style={{ color: warn ? token.colorWarning : token.colorText, fontWeight: warn ? 600 : 400, whiteSpace: "nowrap" }}>
      <ClockCircleOutlined /> {tr("{hm} left", { hm })}
    </span>
  );
}

/** Yes / NA rows for a permit checklist. Read-only when `onChange` is omitted. */
export function YesNaList({
  defs,
  value,
  onChange,
  withRef,
}: {
  defs: ChecklistItemDef[];
  value: ChecklistAnswer[];
  onChange?: (next: ChecklistAnswer[]) => void;
  withRef?: boolean;
}) {
  const { token } = theme.useToken();
  const get = (key: string) => value.find((a) => a.key === key);
  const set = (key: string, patch: Partial<ChecklistAnswer>) => {
    if (!onChange) return;
    const cur = get(key) ?? { key, value: "" as const };
    const next = { ...cur, ...patch };
    onChange([...value.filter((a) => a.key !== key), next]);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {defs.map((d, i) => {
        const a = get(d.key);
        return (
          <div
            key={d.key}
            style={{
              display: "grid",
              gridTemplateColumns: "28px minmax(0, 1fr) auto",
              gap: 8,
              alignItems: "center",
              padding: "6px 0",
              borderTop: i ? `1px solid ${token.colorSplit}` : undefined,
            }}
          >
            <span style={{ color: token.colorTextTertiary, fontSize: 12 }}>{i + 1}</span>
            <span style={{ fontSize: 13 }}>
              {tr(d.label)}
              {withRef && a?.value === "yes" ? (
                onChange ? (
                  <input
                    aria-label={tr("Reference number")}
                    placeholder={tr("Ref. no.")}
                    value={a.refNo ?? ""}
                    onChange={(e) => set(d.key, { refNo: e.target.value })}
                    style={{ marginLeft: 8, width: 140, fontSize: 12, padding: "2px 6px", border: `1px solid ${token.colorBorder}`, borderRadius: 4 }}
                  />
                ) : a.refNo ? (
                  <span style={{ marginLeft: 8, fontSize: 12, color: token.colorTextSecondary }}>{tr("Ref. {refNo}", { refNo: a.refNo })}</span>
                ) : null
              ) : null}
            </span>
            {onChange ? (
              <Radio.Group
                size="small"
                optionType="button"
                buttonStyle="solid"
                value={a?.value || undefined}
                onChange={(e) => set(d.key, { value: e.target.value as YesNa })}
                options={[
                  { value: "yes", label: tr("Yes") },
                  { value: "na", label: tr("NA") },
                ]}
              />
            ) : (
              <span style={{ fontSize: 13, fontWeight: 500, color: a?.value === "yes" ? token.colorSuccess : token.colorTextTertiary }}>
                {a?.value === "yes" ? tr("Yes") : a?.value === "na" ? tr("NA") : "—"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export type GasDraft = Partial<Record<GasKey, number | null>>;

export const gasDraftToReadings = (d: GasDraft) =>
  GAS_KEYS.filter((g) => typeof d[g] === "number").map((g) => ({ gas: g, value: d[g] as number }));

/** Numeric gas readings checked live against the safe limits. */
export function GasReadingsInput({ value, onChange, required = [] }: { value: GasDraft; onChange: (next: GasDraft) => void; required?: GasKey[] }) {
  const { token } = theme.useToken();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {GAS_KEYS.map((g) => {
        const lim = GAS_LIMITS[g];
        const v = value[g];
        const ok = typeof v === "number" ? isGasReadingOk({ gas: g, value: v }) : true;
        return (
          <label key={g} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            <span>
              {tr(lim.label)}
              {required.includes(g) ? <span style={{ color: token.colorError }}> *</span> : null}
              <span style={{ color: token.colorTextTertiary, fontSize: 12 }}> · {tr("safe {safe}", { safe: lim.safe === "—" ? `≤ ${lim.max} ${lim.unit}` : lim.safe })}</span>
            </span>
            <Space.Compact>
              <InputNumber
                min={0}
                step={0.1}
                value={v ?? null}
                status={ok ? undefined : "error"}
                onChange={(n) => onChange({ ...value, [g]: typeof n === "number" ? n : null })}
                style={{ width: "100%" }}
                aria-label={tr(lim.label)}
              />
              <span style={{ padding: "4px 8px", border: `1px solid ${token.colorBorder}`, borderLeft: 0, borderRadius: `0 ${token.borderRadius}px ${token.borderRadius}px 0`, fontSize: 12, color: token.colorTextSecondary, whiteSpace: "nowrap" }}>
                {lim.unit}
              </span>
            </Space.Compact>
            {!ok ? <span style={{ color: token.colorError, fontSize: 12 }}>{tr("Outside the safe limit")}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
// ── Shift & planned schedule ──────────────────────────────────────────────

const SLOT_MINUTES = 15;
const HOUR_MS = 60 * 60_000;

/** Every SLOT_MINUTES step from the shift start to its end (both included). */
function shiftSlots(w: { start: string; end: string }): number[] {
  const out: number[] = [];
  for (let t = Date.parse(w.start); t <= Date.parse(w.end); t += SLOT_MINUTES * 60_000) out.push(t);
  return out;
}

/** Slots as Select options, grouped by plant day when the shift crosses midnight. */
function slotOptions(slots: number[], current?: number) {
  const all = current !== undefined && !slots.includes(current) ? [...slots, current].sort((a, b) => a - b) : slots;
  const days = [...new Set(all.map(plantDayKey))];
  const opt = (t: number) => ({ value: t, label: plantTime(t), disabled: !slots.includes(t) });
  if (days.length === 1) return all.map(opt);
  return days.map((day) => {
    const ofDay = all.filter((t) => plantDayKey(t) === day);
    return { label: plantDay(ofDay[0]), title: day, options: ofDay.map(opt) };
  });
}

const fmtDuration = (min: number) =>
  min < 60 ? tr("{m} min", { m: min }) : min % 60 ? tr("{h} h {m} min", { h: Math.floor(min / 60), m: min % 60 }) : tr("{h} h", { h: min / 60 });

const minutesBetween = (a: number, b: number) => Math.max(0, Math.round((b - a) / 60_000));

/** First slot a plan may start at: the shift start, or — once the shift is running — the next slot from now. */
function earliestStart(w: { start: string; end: string }, now: number): number {
  const ws = Date.parse(w.start);
  const step = SLOT_MINUTES * 60_000;
  return now <= ws ? ws : Math.min(ws + Math.ceil((now - ws) / step) * step, Date.parse(w.end) - step);
}

/** Hour labels under the timeline: every 2 h from the shift start, plus the end. */
function timelineTicks(start: number, end: number): number[] {
  const out: number[] = [];
  for (let t = start; t < end - HOUR_MS; t += 2 * HOUR_MS) out.push(t);
  return [...out, end];
}

/** Light wash of the theme primary (antd's colorPrimaryBg turns grey for a dark navy primary). */
const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

const srOnly = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } as const;

/**
 * One panel for "when": shift tiles on top (the running shift first), and below them the planned
 * work inside the chosen shift — Start / End at 15-minute steps, drawn on that shift's timeline.
 * Tiles are native radios, so arrow keys and screen readers treat them as one radio group.
 */
export function ShiftSchedule<C extends string>({
  choices,
  shift,
  onShiftChange,
  planned,
  onPlannedChange,
  now,
  invalid,
}: {
  choices: { shiftCode: C; start: string; end: string; running: boolean }[];
  shift?: C;
  onShiftChange: (code: C) => void;
  planned: [string, string] | null;
  onPlannedChange: (next: [string, string] | null) => void;
  now: number;
  invalid?: boolean;
}) {
  const { token } = theme.useToken();
  const [focused, setFocused] = useState<C | null>(null);
  const sorted = [...choices].sort((a, b) => Number(b.running) - Number(a.running) || Date.parse(a.start) - Date.parse(b.start));
  const chosen = choices.find((c) => c.shiftCode === shift);

  return (
    <div
      style={{
        border: `1px solid ${invalid ? token.colorError : token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
        overflow: "hidden",
      }}
    >
      <div
        role="radiogroup"
        aria-label={tr("Shift")}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, padding: 8, background: token.colorBgLayout }}
      >
        {sorted.map((c) => {
          const start = Date.parse(c.start);
          const end = Date.parse(c.end);
          const on = c.shiftCode === shift;
          return (
            <label
              key={c.shiftCode}
              data-shift={c.shiftCode}
              data-running={c.running || undefined}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: token.borderRadius,
                border: `1px solid ${on ? token.colorPrimary : token.colorBorderSecondary}`,
                background: on ? tint(token.colorPrimary, 7) : token.colorBgContainer,
                boxShadow: focused === c.shiftCode ? `0 0 0 3px ${tint(token.colorPrimary, 25)}` : undefined,
                cursor: "pointer",
                transition: "background .15s, border-color .15s, box-shadow .15s",
              }}
            >
              <input
                type="radio"
                name="permit-shift"
                value={c.shiftCode}
                checked={on}
                onChange={() => onShiftChange(c.shiftCode)}
                onFocus={() => setFocused(c.shiftCode)}
                onBlur={() => setFocused(null)}
                style={{ position: "absolute", opacity: 0, width: 1, height: 1, margin: 0, pointerEvents: "none" }}
              />
              <span
                aria-hidden
                style={{
                  flex: "none",
                  display: "grid",
                  placeItems: "center",
                  width: 32,
                  height: 32,
                  borderRadius: token.borderRadius,
                  fontWeight: 700,
                  fontSize: 14,
                  color: token.colorPrimary,
                  background: on ? tint(token.colorPrimary, 16) : tint(token.colorPrimary, 7),
                }}
              >
                {c.shiftCode}
              </span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 1 }}>
                <span style={{ color: token.colorText, fontWeight: 600, fontSize: 14, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  <span style={srOnly}>{tr("Shift {code}", { code: c.shiftCode })} </span>
                  {plantTime(start)} – {plantTime(end)}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    color: c.running ? token.colorSuccess : token.colorTextSecondary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.running ? (
                    <>
                      <span aria-hidden style={{ flex: "none", width: 6, height: 6, borderRadius: 3, background: token.colorSuccess, boxShadow: `0 0 0 3px ${tint(token.colorSuccess, 20)}` }} />
                      <span style={{ fontWeight: 600 }}>{tr("Running now")}</span>
                    </>
                  ) : (
                    tr("Starts in {d}", { d: fmtDuration(minutesBetween(now, start)) })
                  )}
                </span>
                {c.running ? (
                  <span style={{ fontSize: 12, color: token.colorTextSecondary, whiteSpace: "nowrap" }}>
                    {tr("{hm} left", { hm: fmtDuration(minutesBetween(now, end)) })}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      <PlannedWork window={chosen} planned={planned} onChange={onPlannedChange} now={now} invalid={invalid} />
    </div>
  );
}

/** Lower half of {@link ShiftSchedule}: Start / End inside the chosen shift, drawn on its timeline. */
function PlannedWork({
  window: w,
  planned,
  onChange,
  now,
  invalid,
}: {
  window?: { start: string; end: string };
  planned: [string, string] | null;
  onChange: (next: [string, string] | null) => void;
  now: number;
  invalid?: boolean;
}) {
  const { token } = theme.useToken();
  const heading = (
    <span style={{ fontSize: 13, fontWeight: 500 }}>{tr("Planned schedule (optional)")}</span>
  );
  const firstSlot = w ? earliestStart(w, now) : undefined;
  /** Set when time ran past the planned start and it was moved forward, so the user is told. */
  const [movedTo, setMovedTo] = useState<number | null>(null);

  // Time moves on: a planned start that has slipped into the past moves up to the next free slot.
  useEffect(() => {
    if (!w || !planned || firstSlot === undefined) return;
    const from = Date.parse(planned[0]);
    const to = Date.parse(planned[1]);
    if (from >= firstSlot) return;
    const we = Date.parse(w.end);
    const iso = (t: number) => new Date(t).toISOString();
    onChange([iso(firstSlot), iso(to > firstSlot ? to : Math.min(firstSlot + HOUR_MS, we))]);
    // The clock, not the user, moved the plan; remember it so the panel can say so.
    setMovedTo(firstSlot); // eslint-disable-line react-hooks/set-state-in-effect
  }, [w, planned, firstSlot, onChange]);

  if (!w) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        {heading}
        <span style={{ fontSize: 13, color: token.colorTextTertiary }}>{tr("Choose the shift first")}</span>
      </div>
    );
  }

  const ws = Date.parse(w.start);
  const we = Date.parse(w.end);
  const slots = shiftSlots(w);
  const from = planned ? Date.parse(planned[0]) : undefined;
  const to = planned ? Date.parse(planned[1]) : undefined;
  const has = from !== undefined && to !== undefined && to > from;
  const iso = (t: number) => new Date(t).toISOString();
  const set = (next: [string, string] | null) => {
    setMovedTo(null);
    onChange(next);
  };
  const pickStart = (t: number) => set([iso(t), iso(to !== undefined && to > t ? to : Math.min(t + HOUR_MS, we))]);
  const pickEnd = (t: number) => set([iso(from ?? firstSlot!), iso(t)]);
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - ws) / (we - ws)) * 100));
  const showNow = now > ws && now < we;
  const ticks = timelineTicks(ws, we);
  const mid = ticks.slice(1, -1).reduce<number | undefined>((best, t) => (best === undefined || Math.abs(t - (ws + we) / 2) < Math.abs(best - (ws + we) / 2) ? t : best), undefined);
  const labels = [ws, ...(mid !== undefined ? [mid] : []), we];

  return (
    <div style={{ padding: "12px 16px 14px", borderTop: `1px solid ${token.colorBorderSecondary}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0 }}>{heading}</span>
        <span
          style={{
            padding: "2px 10px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            color: has ? token.colorPrimary : token.colorTextQuaternary,
            background: has ? tint(token.colorPrimary, 10) : token.colorFillQuaternary,
          }}
        >
          {has ? fmtDuration(minutesBetween(from!, to!)) : tr("Not set")}
        </span>
        {planned ? <Button type="text" size="small" icon={<CloseOutlined />} aria-label={tr("Clear")} onClick={() => set(null)} /> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, maxWidth: 360 }}>
        <Select<number>
          aria-label={tr("Start")}
          placeholder={tr("Start")}
          value={from}
          options={slotOptions(slots.slice(0, -1).filter((t) => t >= firstSlot!), from)}
          onChange={pickStart}
          style={{ flex: 1, minWidth: 0 }}
          popupMatchSelectWidth={false}
        />
        <ArrowRightOutlined style={{ color: token.colorTextTertiary, fontSize: 12 }} />
        <Select<number>
          aria-label={tr("End")}
          placeholder={tr("End")}
          value={to}
          options={slotOptions(slots.filter((t) => t > (from ?? firstSlot!)), to)}
          onChange={pickEnd}
          style={{ flex: 1, minWidth: 0 }}
          popupMatchSelectWidth={false}
        />
      </div>
      {movedTo !== null && planned ? (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: token.colorWarningText }}>
          <ClockCircleOutlined />
          {tr("Planned start moved to {time} — the earlier time has passed", { time: plantTime(movedTo) })}
        </div>
      ) : null}
      <div aria-hidden style={{ marginTop: 26 }}>
        <div style={{ position: "relative", height: 10, borderRadius: 5, background: tint(token.colorPrimary, 8) }}>
          {ticks.slice(1, -1).map((t) => (
            <div key={t} style={{ position: "absolute", top: 2, bottom: 2, left: `${pct(t)}%`, width: 1, background: tint(token.colorPrimary, 20) }} />
          ))}
          {showNow ? (
            <div
              title={tr("Already passed")}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: `${pct(now)}%`,
                borderRadius: "5px 0 0 5px",
                background: `repeating-linear-gradient(135deg, ${tint(token.colorText, 10)} 0 4px, transparent 4px 8px)`,
              }}
            />
          ) : null}
          {has ? (
            <div
              data-planned-bar
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${pct(from!)}%`,
                width: `${Math.max(1, pct(to!) - pct(from!))}%`,
                borderRadius: 5,
                background: invalid ? tint(token.colorError, 45) : tint(token.colorPrimary, 40),
                boxShadow: `inset 0 0 0 1px ${invalid ? token.colorError : tint(token.colorPrimary, 60)}`,
              }}
            />
          ) : null}
          {showNow ? (
            <div style={{ position: "absolute", top: -4, bottom: -4, left: `${pct(now)}%`, width: 2, marginLeft: -1, borderRadius: 1, background: token.colorText }}>
              <span
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  marginBottom: 2,
                  fontSize: 10,
                  fontWeight: 600,
                  color: token.colorText,
                  whiteSpace: "nowrap",
                }}
              >
                {tr("Now")}
              </span>
            </div>
          ) : null}
        </div>
        <div style={{ position: "relative", height: 16, marginTop: 6, fontSize: 11, color: token.colorTextTertiary, fontVariantNumeric: "tabular-nums" }}>
          {labels.map((t, i) => (
            <span
              key={t}
              style={{
                position: "absolute",
                left: `${pct(t)}%`,
                transform: i === 0 ? "none" : i === labels.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
                whiteSpace: "nowrap",
              }}
            >
              {plantTime(t)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
