"use client";

import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import {
  OT_STATUS_LABELS,
  type OtStatus,
} from "@/lib/overtime";
import { nectarColors } from "@/lib/theme";
import { tr, trData } from "@/lib/i18n";

export const OT_STATUS_COLORS: Record<OtStatus, string> = {
  PENDING: "#D97706",
  APPROVED: nectarColors.leaf,
  REJECTED: nectarColors.alert,
  PAID: nectarColors.sky,
  CANCELLED: nectarColors.muted,
};

export const OT_STATUS_OPTIONS = (
  Object.keys(OT_STATUS_LABELS) as OtStatus[]
).map((status) => ({ value: status, label: OT_STATUS_LABELS[status], color: OT_STATUS_COLORS[status] }));

type ChipProps = {
  status: OtStatus;
  count?: number;
  hoursLabel?: string;
  active?: boolean;
  onSelect: (status: OtStatus | undefined) => void;
};

export function OtStatusChip({
  status,
  count,
  hoursLabel,
  active,
  onSelect,
}: ChipProps) {
  const color = OT_STATUS_COLORS[status];
  const items: MenuProps["items"] = [
    { key: "all", label: tr("All statuses"), onClick: () => onSelect(undefined) },
    { type: "divider" },
    ...OT_STATUS_OPTIONS.map((opt) => ({
      key: opt.value,
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: opt.color, flexShrink: 0 }} />
          {trData(opt.label)}
        </span>
      ),
      onClick: () => onSelect(opt.value),
    })),
  ];

  return (
    <Dropdown menu={{ items }} trigger={["hover"]} placement="bottomLeft">
      <button
        type="button"
        onClick={() => onSelect(active ? undefined : status)}
        aria-pressed={active}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          border: `1px solid ${active ? color : "rgba(28, 68, 99, 0.15)"}`,
          background: active ? `${color}14` : nectarColors.white, color: nectarColors.ink, borderRadius: 999,
          padding: "8px 14px", cursor: "pointer",
          transition: "border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
          boxShadow: active ? `0 0 0 3px ${color}22` : "none", fontFamily: "inherit",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.borderColor = color;
            e.currentTarget.style.boxShadow = `0 4px 14px ${color}22`;
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.borderColor = "rgba(28, 68, 99, 0.15)";
            e.currentTarget.style.boxShadow = "none";
          }
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 13 }}>{OT_STATUS_LABELS[status]}</span>
        {count != null ? (
          <span style={{ fontSize: 12, color: nectarColors.muted, fontVariantNumeric: "tabular-nums" }}>
            {count}
            {hoursLabel ? ` · ${hoursLabel}` : ""}
          </span>
        ) : null}
      </button>
    </Dropdown>
  );
}

type StripProps = {
  items: { status: OtStatus; count: number; hoursLabel: string }[];
  activeStatus?: OtStatus;
  onSelect: (status: OtStatus | undefined) => void;
};

export function OtStatusStrip({ items, activeStatus, onSelect }: StripProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {items.map((item) => (
        <OtStatusChip
          key={item.status}
          status={item.status}
          count={item.count}
          hoursLabel={item.hoursLabel}
          active={activeStatus === item.status}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
