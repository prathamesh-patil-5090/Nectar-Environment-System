"use client";

import { InputNumber, Radio, Space, theme } from "antd";
import { ClockCircleOutlined, WarningOutlined } from "@ant-design/icons";
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
  const time = d.toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  const day = d.toLocaleDateString(intlLocale(), { weekday: "long", timeZone: "Asia/Kolkata" });
  const date = d.toLocaleDateString(intlLocale(), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  return `${time}, ${day}, ${date}`;
}

export function fmtShort(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(intlLocale(), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
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
