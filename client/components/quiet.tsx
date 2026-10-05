"use client";

import { Fragment, type ReactNode } from "react";
import { theme } from "antd";

/**
 * Quiet building blocks for list and detail pages (Safety, Dashboard): bordered panels and sections,
 * dot labels, person rows, label/value lists and a plain number row.
 * Everything takes its colours from the antd theme tokens — no per-page palettes.
 */

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Small coloured dot + plain label — status, severity, clearance. */
export function Dot({ color, label }: { color: string; label: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: color, flex: "none" }} />
      {label}
    </span>
  );
}

/** Bordered box — the same container the Sites and Employees tables sit in. */
export function Panel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
        overflow: "hidden",
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Panel with a plain heading row. `flush` drops the body padding (for tables and lists that bring their own). */
export function Section({
  title,
  extra,
  flush,
  children,
}: {
  title: string;
  extra?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <Panel>
      <section>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            borderBottom: `1px solid ${token.colorSplit}`,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: token.colorText }}>{title}</h3>
          {extra ? <span style={{ fontSize: 12, color: token.colorTextSecondary, textAlign: "right" }}>{extra}</span> : null}
        </div>
        <div style={flush ? undefined : { padding: 16 }}>{children}</div>
      </section>
    </Panel>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  return <div style={{ margin: "16px 0 4px", fontSize: 13, fontWeight: 500, color: token.colorTextSecondary }}>{children}</div>;
}

export function Quiet({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  return <div style={{ fontSize: 13, color: token.colorTextTertiary }}>{children}</div>;
}

/** Free text from the reporter / investigator; keeps their line breaks. */
export function Prose({ text, empty }: { text?: string; empty: string }) {
  const { token } = theme.useToken();
  if (!text?.trim()) return <Quiet>{empty}</Quiet>;
  return <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6, color: token.colorText, wordBreak: "break-word" }}>{text}</p>;
}

/** Grey initials circle + name (+ optional second line). */
export function Person({ name, sub }: { name: string; sub?: string }) {
  const { token } = theme.useToken();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <span
        aria-hidden
        style={{
          flex: "none",
          width: 28,
          height: 28,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 600,
          color: token.colorTextSecondary,
          background: token.colorFillSecondary,
        }}
      >
        {initials(name)}
      </span>
      <div style={{ minWidth: 0, lineHeight: 1.3 }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        {sub ? <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{sub}</div> : null}
      </div>
    </div>
  );
}

/** Label / value list. */
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  const { token } = theme.useToken();
  return (
    <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", rowGap: 12, columnGap: 12, fontSize: 13 }}>
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <dt style={{ color: token.colorTextSecondary }}>{label}</dt>
          <dd style={{ margin: 0, color: token.colorText, wordBreak: "break-word" }}>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** Row of plain numbers with a label — the overview summary. `alert` turns the number and hint the warning colour. */
export function NumberRow({ items }: { items: { label: string; value: ReactNode; hint?: string; alert?: boolean }[] }) {
  const { token } = theme.useToken();
  return (
    <Panel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {items.map((it) => (
          <div
            key={it.label}
            style={{
              padding: "14px 16px",
              borderRight: `1px solid ${token.colorSplit}`,
              borderBottom: `1px solid ${token.colorSplit}`,
              marginRight: -1,
              marginBottom: -1,
            }}
          >
            <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.3 }}>{it.label}</div>
            <div
              style={{
                marginTop: 4,
                fontSize: 22,
                fontWeight: 600,
                lineHeight: 1.2,
                fontVariantNumeric: "tabular-nums",
                color: it.alert ? token.colorError : token.colorText,
              }}
            >
              <span data-count={typeof it.value === "number" ? it.value : undefined}>{it.value}</span>
            </div>
            {it.hint ? (
              <div style={{ marginTop: 2, fontSize: 12, color: it.alert ? token.colorError : token.colorTextTertiary }}>{it.hint}</div>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}
