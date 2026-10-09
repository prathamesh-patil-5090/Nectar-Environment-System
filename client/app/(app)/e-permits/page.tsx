"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Button, Input, Select } from "antd";
import {
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileProtectOutlined,
  SearchOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Quiet } from "@/components/quiet";
import { CategoryText, PermitStatusTag, ValidityClock } from "@/components/e-permit/PermitBits";
import { useEPermitMasters, useEPermits, useNow, usePermitViewer } from "@/lib/e-permit/hooks";
import { ePermitKpis, inBucket, todosFor, type InboxBucket, type PermitTodo } from "@/lib/e-permit/views";
import type { EPermit } from "@/lib/e-permit/types";
import { isOverdue, LIVE_STATUSES } from "@/lib/e-permit/rules";
import { useDirectory } from "@/lib/safety/hooks";
import { useTableMotion } from "@/lib/motion/use-table-motion";
import { E_PERMITS_ENABLED } from "@/lib/e-permit/feature";
import { nectarColors } from "@/lib/theme";
import { tr, trData } from "@/lib/i18n";

const TODO_LABEL: Record<PermitTodo, string> = {
  approve: "Approve",
  acknowledge: "Acknowledge",
  renewal_ack: "Acknowledge renewal",
  approve_renewal: "Approve renewal",
  accept_return: "Accept return",
  post_review: "Post-review",
  submit: "Submit draft",
  revise: "Revise",
  return_or_renew: "Return or renew",
  declare_safe: "Declare site safe",
  resume: "Re-validate",
};

const BUCKETS: { value: InboxBucket; label: string; hint: string }[] = [
  { value: "all", label: "All permits", hint: "Everything you can see" },
  { value: "mine", label: "Needs you", hint: "Approvals, acknowledgements, returns" },
  { value: "pending", label: "Pending approval", hint: "Not active until approved" },
  { value: "active", label: "Active", hint: "Work running this shift" },
  { value: "overdue", label: "Overdue", hint: "Past shift end — return or renew" },
  { value: "suspended", label: "Suspended", hint: "Work stopped" },
  { value: "closed", label: "Closed", hint: "Returned or cancelled" },
];

/** Buckets that turn the count orange when anything is in them. */
const ALERT_BUCKETS: InboxBucket[] = ["mine", "overdue", "suspended"];

const PAGE = 24;

export default function EPermitsInboxPage() {
  const masters = useEPermitMasters();
  const viewer = usePermitViewer(masters);
  const { permits, loading, error } = useEPermits();
  const dir = useDirectory();
  const now = useNow();
  const [bucket, setBucket] = useState<InboxBucket>("all");
  const [siteId, setSiteId] = useState<string | undefined>();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const k = useMemo(() => ePermitKpis(permits, now), [permits, now]);
  const scoped = useMemo(() => permits.filter((p) => !siteId || p.siteId === siteId), [permits, siteId]);
  const counts = useMemo(() => {
    const c = {} as Record<InboxBucket, number>;
    for (const b of BUCKETS) c[b.value] = scoped.filter((p) => inBucket(p, b.value, viewer ?? null, now)).length;
    return c;
  }, [scoped, viewer, now]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scoped.filter(
      (p) =>
        inBucket(p, bucket, viewer ?? null, now) &&
        (!needle ||
          p.permitNo.toLowerCase().includes(needle) ||
          p.description.toLowerCase().includes(needle) ||
          p.locationName.toLowerCase().includes(needle)),
    );
  }, [scoped, bucket, viewer, now, q]);

  const ready = !loading || permits.length > 0;
  const { pageRef, tableRef } = useTableMotion(ready ? `${bucket}|${rows.map((p) => p.id).join("|")}` || "empty" : "");
  const siteIds = useMemo(() => [...new Set(permits.map((p) => p.siteId))], [permits]);
  const active = BUCKETS.find((b) => b.value === bucket)!;

  if (!E_PERMITS_ENABLED) {
    return <Alert type="info" showIcon title={tr("E-Permits are switched off for this installation.")} />;
  }

  const pick = (b: InboxBucket) => {
    setBucket(b);
    setLimit(PAGE);
  };

  return (
    <div ref={pageRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{`
.ep-layout{display:grid;gap:20px;grid-template-columns:minmax(0,1fr);align-items:start}
@media (min-width:1000px){.ep-layout{grid-template-columns:240px minmax(0,1fr)}}
.ep-rail{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
@media (min-width:1000px){.ep-rail{flex-direction:column;overflow:visible;position:sticky;top:84px}}
.ep-rail-btn{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 12px;border-radius:10px;white-space:nowrap;font-size:13.5px;color:${nectarColors.ink};transition:background .15s}
.ep-rail-btn:hover{background:rgba(28,68,99,.06)}
.ep-rail-btn:focus-visible{outline:2px solid ${nectarColors.leaf};outline-offset:2px}
.ep-rail-btn[aria-pressed="true"]{background:${nectarColors.leaf};color:#fff}
.ep-cards{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.ep-card{display:flex;flex-direction:column;gap:10px;padding:16px 16px 14px;background:#fff;border:1px solid #E2E8F0;
  border-radius:12px;position:relative;overflow:hidden;color:inherit;transition:box-shadow .15s,transform .15s}
.ep-card:hover{box-shadow:0 8px 24px -12px rgba(11,26,36,.25);transform:translateY(-1px)}
.ep-card:focus-visible{outline:2px solid ${nectarColors.leaf};outline-offset:2px}
`}</style>

      {/* Header band */}
      <div
        data-anim="intro"
        style={{
          borderRadius: 12, padding: "18px 20px", color: nectarColors.ink,
          background: nectarColors.white, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end", justifyContent: "space-between",
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: nectarColors.muted, marginBottom: 6 }}>
            {tr("Permit to work")}
          </div>
          <div style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 20, lineHeight: 1.25, marginBottom: 6 }}>
            {counts.mine
              ? tr("{n} permits need you", { n: counts.mine })
              : tr("Nothing needs you right now.")}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: nectarColors.muted, lineHeight: 1.5 }}>
            {tr("Permission to work at one location for one shift, authorised by the Head of Department who owns the location. Only the people concerned with a permit see it.")}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 24 }}>
            {[
              [tr("Active"), k.active, false],
              [tr("Overdue"), k.overdue, k.overdue > 0],
              [tr("Suspended"), k.suspended, k.suspended > 0],
              [tr("Closed, 30 days"), k.closed30d, false],
            ].map(([label, value, hot]) => (
              <div key={label as string} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1, color: hot ? nectarColors.alert : nectarColors.ink }}>{value as number}</div>
                <div style={{ fontSize: 11.5, color: nectarColors.muted, marginTop: 4, whiteSpace: "nowrap" }}>{label as string}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error ? <Alert type="warning" showIcon title={tr("Server unreachable — showing the last saved data ({error})", { error: trData(error) })} /> : null}

      <div className="ep-layout">
        {/* Bucket rail */}
        <nav data-anim="intro" className="ep-rail" aria-label={tr("Permits")}>
          {BUCKETS.map((b) => {
            const on = bucket === b.value;
            const hot = ALERT_BUCKETS.includes(b.value) && counts[b.value] > 0;
            return (
              <button key={b.value} type="button" className="ep-rail-btn" aria-pressed={on} onClick={() => pick(b.value)}>
                <span style={{ fontWeight: on ? 600 : 500 }}>{tr(b.label)}</span>
                <span
                  style={{
                    minWidth: 24, textAlign: "center", fontSize: 12, fontWeight: 600, padding: "1px 7px", borderRadius: 999,
                    background: on ? "rgba(255,255,255,.18)" : hot ? `${nectarColors.alert}1A` : "rgba(28,68,99,.07)",
                    color: on ? "#fff" : hot ? nectarColors.alert : nectarColors.muted,
                  }}
                >
                  {counts[b.value]}
                </span>
              </button>
            );
          })}
          {k.emergencyReviewsDue ? (
            <div style={{ fontSize: 12, color: nectarColors.alert, padding: "8px 12px", whiteSpace: "nowrap" }}>
              {tr("{emergencyReviewsDue} emergency reviews open", { emergencyReviewsDue: k.emergencyReviewsDue })}
            </div>
          ) : null}
        </nav>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {/* Toolbar */}
          <div data-anim="intro" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: nectarColors.ink }}>{tr(active.label)}</div>
              <div style={{ fontSize: 12.5, color: nectarColors.muted }}>
                {tr(active.hint)} · {tr("{n} shown", { n: rows.length })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "1 1 320px", justifyContent: "flex-end" }}>
              {siteIds.length > 1 ? (
                <Select
                  allowClear
                  placeholder={tr("All plants")}
                  value={siteId}
                  onChange={(v) => {
                    setSiteId(v);
                    setLimit(PAGE);
                  }}
                  style={{ minWidth: 160 }}
                  options={siteIds.map((s) => ({ value: s, label: trData(dir.siteName(s)) }))}
                />
              ) : null}
              <Input
                allowClear
                prefix={<SearchOutlined style={{ color: nectarColors.muted }} />}
                placeholder={tr("Permit no., location or work")}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setLimit(PAGE);
                }}
                style={{ maxWidth: 300 }}
              />
            </div>
          </div>

          {/* Permit cards */}
          <div ref={tableRef}>
            {rows.length ? (
              <>
                <div className="ep-cards">
                  {rows.slice(0, limit).map((p) => (
                    <PermitCard key={p.id} permit={p} now={now} todos={todosFor(p, viewer ?? null, now)} siteName={dir.siteName(p.siteId)} holderName={dir.empName(p.holderId)} />
                  ))}
                </div>
                {rows.length > limit ? (
                  <div style={{ textAlign: "center", marginTop: 16 }}>
                    <Button onClick={() => setLimit((n) => n + PAGE)}>
                      {tr("Show more")} ({rows.length - limit})
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <div
                style={{
                  border: "1px dashed #CBD5E1", borderRadius: 12, padding: "40px 16px", textAlign: "center", background: "#fff",
                }}
              >
                <FileProtectOutlined style={{ fontSize: 28, color: "#CBD5E1", marginBottom: 8 }} />
                <Quiet>{loading ? tr("Loading…") : bucket === "mine" ? tr("Nothing needs you right now.") : tr("No permits here.")}</Quiet>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Share of the shift window already used, 0–1 (null when there is no window yet). */
function shiftProgress(p: EPermit, now: number): number | null {
  if (!p.validFrom || !p.validTo) return null;
  const from = new Date(p.validFrom).getTime();
  const to = new Date(p.validTo).getTime();
  if (!(to > from)) return null;
  return Math.min(1, Math.max(0, (now - from) / (to - from)));
}

function PermitCard({
  permit: p,
  now,
  todos,
  siteName,
  holderName,
}: {
  permit: EPermit;
  now: number;
  todos: PermitTodo[];
  siteName: string;
  holderName: string;
}) {
  const progress = LIVE_STATUSES.includes(p.status) ? shiftProgress(p, now) : null;
  const late = isOverdue(p, now);
  return (
    <Link href={`/e-permits/${p.id}`} className="ep-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <code style={{ fontSize: 12, fontWeight: 600, color: nectarColors.leaf, letterSpacing: "0.02em" }}>{p.permitNo}</code>
        <PermitStatusTag permit={p} now={now} />
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: nectarColors.ink, lineHeight: 1.35, marginBottom: 4 }}>
          {trData(p.description)}
        </div>
        <div style={{ fontSize: 12.5 }}>
          <CategoryText permit={p} />
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12.5, color: nectarColors.muted }}>
        <span><EnvironmentOutlined /> {trData(p.locationName)} · {trData(siteName)}</span>
        <span><TeamOutlined /> {trData(holderName)} +{p.workerIds.length}</span>
      </div>

      {/* Shift validity */}
      <div style={{ marginTop: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5, color: nectarColors.muted }}>
          <span>
            <ClockCircleOutlined /> {tr("Shift {code}", { code: p.shiftCode })}
            {p.renewalCount ? ` · R${p.renewalCount}` : ""}
          </span>
          <ValidityClock permit={p} now={now} />
        </div>
        {progress !== null ? (
          <div style={{ height: 4, borderRadius: 999, background: "rgba(28,68,99,.08)", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.round(progress * 100)}%`, height: "100%", borderRadius: 999,
                background: late ? nectarColors.alert : progress > 0.85 ? "#D97706" : nectarColors.leaf,
              }}
            />
          </div>
        ) : null}
      </div>

      {todos.length ? (
        <div
          style={{
            margin: "2px -16px -14px", padding: "8px 16px", fontSize: 12.5, fontWeight: 600,
            background: `${nectarColors.alert}12`, color: nectarColors.alert, borderTop: `1px solid ${nectarColors.alert}26`,
          }}
        >
          {tr("For you")}: {todos.map((t) => tr(TODO_LABEL[t])).join(", ")}
        </div>
      ) : null}
    </Link>
  );
}
