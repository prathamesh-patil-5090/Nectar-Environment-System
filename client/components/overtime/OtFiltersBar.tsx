"use client";

import { Button, DatePicker, Dropdown, Select } from "antd";
import type { MenuProps } from "antd";
import {
  CalendarOutlined,
  ClearOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { employees, sites } from "@/lib/mock-data";
import {
  availableOtYears,
  departments,
  shifts,
  type EmployeeType,
  type OtFilters,
  type OtStatus,
} from "@/lib/overtime";
import { nectarColors } from "@/lib/theme";
import {
  OT_STATUS_COLORS,
  OT_STATUS_OPTIONS,
} from "@/components/overtime/OtStatusStrip";

const { RangePicker } = DatePicker;

type Props = {
  value: OtFilters;
  onChange: (next: OtFilters) => void;
  lockedSiteId?: string;
};

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex", flexDirection: "column", gap: 6, minWidth: wide ? 220 : 0,
        flex: wide ? "1 1 220px" : "1 1 140px",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: nectarColors.muted }}>{label}</span>
      {children}
    </label>
  );
}

export default function OtFiltersBar({ value, onChange, lockedSiteId }: Props) {
  const patch = (partial: Partial<OtFilters>) =>
    onChange({ ...value, ...partial });

  const rangeValue: [Dayjs, Dayjs] | null =
    value.dateFrom && value.dateTo
      ? [dayjs(value.dateFrom), dayjs(value.dateTo)]
      : null;

  const statusMenu: MenuProps["items"] = [
    { key: "all", label: "All statuses", onClick: () => patch({ status: undefined }) },
    { type: "divider" },
    ...OT_STATUS_OPTIONS.map((opt) => ({
      key: opt.value,
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: opt.color }} />
          {opt.label}
        </span>
      ),
      onClick: () => patch({ status: opt.value }),
    })),
  ];

  const activeCount = [
    value.dateFrom,
    value.year,
    value.month,
    value.siteId || lockedSiteId,
    value.department,
    value.employeeId,
    value.shiftId,
    value.employeeType,
    value.status,
  ].filter(Boolean).length;

  const clearFilters = () =>
    onChange({
      dateFrom: undefined,
      dateTo: undefined,
      year: undefined,
      month: undefined,
      siteId: lockedSiteId,
      department: undefined,
      employeeId: undefined,
      shiftId: undefined,
      employeeType: undefined,
      status: undefined,
    });

  const controlStyle = { width: "100%", minWidth: 120 };

  return (
    <div
      style={{
        background: nectarColors.white, border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 18px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 28, height: 28, borderRadius: 8, background: `${nectarColors.leaf}14`, color: nectarColors.leaf,
              display: "grid", placeItems: "center",
            }}
          >
            <FilterOutlined />
          </span>
          <div>
            <div
              style={{
                fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 16, color: nectarColors.ink,
                lineHeight: 1.2,
              }}
            >
              Filters
            </div>
            <div style={{ fontSize: 12, color: nectarColors.muted }}>
              {activeCount
                ? `${activeCount} active · hover OT Status for quick switch`
                : "Refine OT by period, site, people, and status"}
            </div>
          </div>
        </div>
        <Button
          type="text"
          icon={<ClearOutlined />}
          onClick={clearFilters}
          disabled={activeCount === 0}
          style={{ color: nectarColors.muted }}
        >
          Clear
        </Button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <Field label="Date range" wide>
          <RangePicker
            value={rangeValue}
            style={controlStyle}
            suffixIcon={<CalendarOutlined style={{ color: nectarColors.muted }} />}
            onChange={(dates) => {
              if (!dates?.[0] || !dates?.[1]) {
                patch({ dateFrom: undefined, dateTo: undefined });
                return;
              }
              patch({
                dateFrom: dates[0].format("YYYY-MM-DD"),
                dateTo: dates[1].format("YYYY-MM-DD"),
                year: undefined,
                month: undefined,
              });
            }}
          />
        </Field>

        <Field label="Year">
          <Select
            allowClear
            placeholder="Any year"
            style={controlStyle}
            value={value.year}
            options={availableOtYears.map((y) => ({ value: y, label: String(y) }))}
            onChange={(year) =>
              patch({ year, month: year ? value.month : undefined, dateFrom: undefined, dateTo: undefined })
            }
          />
        </Field>

        <Field label="Month">
          <Select
            allowClear
            placeholder="Any month"
            style={controlStyle}
            value={value.month}
            disabled={!value.year}
            options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: dayjs().month(i).format("MMMM") }))}
            onChange={(month) => patch({ month })}
          />
        </Field>

        <Field label="Site">
          <Select
            allowClear={!lockedSiteId}
            disabled={!!lockedSiteId}
            placeholder="All sites"
            style={controlStyle}
            value={lockedSiteId ?? value.siteId}
            options={sites.map((s) => ({ value: s.id, label: s.name }))}
            onChange={(siteId) => patch({ siteId })}
          />
        </Field>

        <Field label="Department">
          <Select
            allowClear
            placeholder="All departments"
            style={controlStyle}
            value={value.department}
            options={departments.map((d) => ({ value: d, label: d }))}
            onChange={(department) => patch({ department })}
          />
        </Field>

        <Field label="Employee">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="All employees"
            style={controlStyle}
            value={value.employeeId}
            options={employees.map((e) => ({ value: e.id, label: e.name }))}
            onChange={(employeeId) => patch({ employeeId })}
          />
        </Field>

        <Field label="Shift">
          <Select
            allowClear
            placeholder="All shifts"
            style={controlStyle}
            value={value.shiftId}
            options={shifts.map((s) => ({ value: s.id, label: s.name }))}
            onChange={(shiftId) => patch({ shiftId })}
          />
        </Field>

        <Field label="Employee type">
          <Select
            allowClear
            placeholder="All types"
            style={controlStyle}
            value={value.employeeType}
            options={(
              ["permanent", "contract", "deputed"] as EmployeeType[]
            ).map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
            onChange={(employeeType) => patch({ employeeType })}
          />
        </Field>

        <Field label="OT Status">
          <Select
            allowClear
            placeholder="All statuses"
            style={controlStyle}
            value={value.status}
            options={OT_STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            optionRender={(option) => {
              const status = option.value as OtStatus;
              return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: "50%", background: OT_STATUS_COLORS[status],
                      display: "inline-block",
                    }}
                  />
                  {option.label}
                </span>
              );
            }}
            onChange={(status: OtStatus | undefined) => patch({ status })}
          />
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {OT_STATUS_OPTIONS.map((opt) => (
              <Dropdown key={opt.value} menu={{ items: statusMenu }} trigger={["hover"]}>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      status:
                        value.status === opt.value ? undefined : opt.value,
                    })
                  }
                  style={{
                    border: `1px solid ${
                      value.status === opt.value
                        ? opt.color
                        : "rgba(28, 68, 99, 0.15)"
                    }`,
                    background:
                      value.status === opt.value
                        ? `${opt.color}18`
                        : nectarColors.white,
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: nectarColors.ink,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: opt.color }} />
                  {opt.label}
                </button>
              </Dropdown>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}
