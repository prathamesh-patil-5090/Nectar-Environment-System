"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Checkbox,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Spin,
  Tooltip,
  Upload,
  theme,
} from "antd";
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  EditOutlined,
  PhoneOutlined,
  PlusOutlined,
  UploadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  SAFETY_CATEGORY_LABELS,
  SAFETY_SEVERITY_LABELS,
  SAFETY_STATUS_LABELS,
  SAFETY_TRANSITIONS,
  SAFETY_TYPE_LABELS,
  actionForStatus,
  canActOnSafetyCase,
  clearanceAction,
  closeBlocker,
  downtimeDays,
  otTotals,
  resolveBlocker,
  safetyCategoryLabel,
  type SafetyCategory,
  type SafetySeverity,
  type SafetyStatus,
} from "@/lib/safety/rules";
import type { SafetyEvent } from "@/lib/safety/types";
import {
  ackSafetyEmergency,
  addSafetyAction,
  changeSafetyStatus,
  commentSafetyEvent,
  decideSafetyClearance,
  getSafetyEvent,
  linkSafetyLeave,
  promoteNearMiss,
  safetyMediaUrl,
  setSafetyActionDone,
  updateSafetyEvent,
  uploadSafetyMedia,
} from "@/lib/api/safety";
import { getLeaves } from "@/lib/api/leaves";
import { getCachedSafetyEvent, upsertSafetyEvent } from "@/lib/safety/store";
import { downloadSafetyReport } from "@/lib/safety/report-pdf";
import { useDirectory, useSessionUser } from "@/lib/safety/hooks";
import { canSafety, roleLabel, safetyActorOf } from "@/lib/rbac";
import { getSession, type UserRole } from "@/lib/auth";
import type { LeaveRequest } from "@/lib/leave/types";
import { LEAVE_STATUS_LABELS } from "@/lib/leave/types";
import { createBreakdownOtDecision, getOtDecisionById } from "@/lib/ot-decision";
import EventTimeline from "./EventTimeline";
import { useEPermits } from "@/lib/e-permit/hooks";
import { permitsForBreakdown } from "@/lib/e-permit/views";
import { EPERMIT_STATUS_LABELS } from "@/lib/e-permit/rules";
import { E_PERMITS_ENABLED } from "@/lib/e-permit/feature";
import { canIssueEPermit } from "@/lib/rbac";
import { useTableMotion } from "@/lib/motion/use-table-motion";
import { Dot, Facts, Person, Prose, Quiet, Section, SubHeading, severityColor, statusColor } from "./ui";
import { tr, trNode, intlLocale, trData } from "@/lib/i18n";

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(intlLocale()) : "—");
const MB = 1024 * 1024;
const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

function StillDown() {
  const { token } = theme.useToken();
  return <Dot color={token.colorError} label={tr("Still down")} />;
}

function PeopleList({ title, ids, name }: { title: string; ids: string[]; name: (id: string) => string }) {
  const { token } = theme.useToken();
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: 10, fontSize: 13, color: token.colorTextSecondary }}>
        {trData(title)} <span style={{ color: token.colorTextQuaternary }}>· {ids.length}</span>
      </div>
      {ids.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ids.map((id) => (
            <Person key={id} name={name(id)} />
          ))}
        </div>
      ) : (
        <Quiet>{tr("Nobody named.")}</Quiet>
      )}
    </div>
  );
}

export default function EventDetail({ id }: { id: string }) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const router = useRouter();
  const user = useSessionUser();
  const dir = useDirectory();
  // Cache is read after mount (not in the initializer) so server and client first render match
  const [ev, setEv] = useState<SafetyEvent | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<SafetyStatus | null>(null);
  const [remark, setRemark] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [waiveFor, setWaiveFor] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [leavesByEmp, setLeavesByEmp] = useState<Record<string, LeaveRequest[]>>({});

  const actor = safetyActorOf(user ?? null);

  useEffect(() => {
    const me = safetyActorOf(getSession());
    const cached = getCachedSafetyEvent(id);
    const raf = requestAnimationFrame(() => {
      if (cached) setEv((cur) => cur ?? cached);
    });
    let alive = true;
    if (!me) return () => cancelAnimationFrame(raf);
    getSafetyEvent(id, me)
      .then((fresh) => {
        if (!alive) return;
        setEv(fresh);
        upsertSafetyEvent(fresh);
        setLoadError(null);
      })
      .catch((err) => alive && setLoadError(err instanceof Error ? trData(err.message) : tr("Could not load")));
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [id]);

  // Leaves of involved people (for linking to return-to-work)
  const involvedKey = ev?.involved.join(",") ?? "";
  useEffect(() => {
    if (!involvedKey) return;
    let alive = true;
    Promise.all(
      involvedKey.split(",").map((emp) =>
        getLeaves({ employeeId: emp })
          .then((rows) => [emp, rows] as const)
          .catch(() => [emp, [] as LeaveRequest[]] as const),
      ),
    ).then((pairs) => alive && setLeavesByEmp(Object.fromEntries(pairs)));
    return () => {
      alive = false;
    };
  }, [involvedKey]);

  /** Run an API write, show its error, refresh state from the response. */
  const run = async (key: string, fn: () => Promise<SafetyEvent>, ok?: string) => {
    if (!actor) return;
    setBusy(key);
    try {
      const updated = await fn();
      setEv(updated);
      upsertSafetyEvent(updated);
      if (ok) message.success(ok);
      return updated;
    } catch (err) {
      message.error(err instanceof Error ? trData(err.message) : tr("Action failed"));
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  // Everyone can read a case; only people on it (and the plant's leads) can act on it
  const onCase = Boolean(ev) && canActOnSafetyCase(actor, ev!);
  const can = (action: Parameters<typeof canSafety>[1]) => onCase && canSafety(user ?? null, action, ev?.siteId);

  // Header, next step and the case body settle in once the case is on screen.
  const { pageRef } = useTableMotion("", Boolean(ev));

  const nextStatuses = useMemo(() => {
    if (!ev || !canActOnSafetyCase(safetyActorOf(user ?? null), ev)) return [];
    return SAFETY_TRANSITIONS[ev.status].filter((s) => canSafety(user ?? null, actionForStatus(s), ev.siteId));
  }, [ev, user]);

  if (!ev) {
    return loadError ? (
      <Alert type="error" showIcon title={tr("Could not load case {id}", { id })} description={trData(loadError)} />
    ) : (
      <div style={{ padding: 48, textAlign: "center" }}><Spin /></div>
    );
  }

  const isRecipient = Boolean(actor && ev.isEmergency && ev.emergencyRecipients.includes(actor.id));
  const needsAck = isRecipient && actor && !ev.emergencyAcks.includes(actor.id) && !["RESOLVED", "CLOSED"].includes(ev.status);
  const blockerFor = (s: SafetyStatus) => (s === "RESOLVED" ? resolveBlocker(ev) : s === "CLOSED" ? closeBlocker(ev) : null);
  const ot = otTotals(ev.otEntries);
  const peopleOptions = dir.employees
    .filter((e) => e.siteId === ev.siteId)
    .map((e) => ({ value: e.id, label: e.name }));
  // People already on the case stay selectable even if they have since moved site
  const casePeopleOptions = [
    ...peopleOptions,
    ...[...new Set([...ev.involved, ...ev.informedBy])]
      .filter((id) => !peopleOptions.some((o) => o.value === id))
      .map((id) => ({ value: id, label: dir.empName(id) })),
  ];
  const responsible = ev.stakeholders.filter((s) => s.personId !== ev.reportedBy.personId);
  const actionsDone = ev.correctiveActions.filter((a) => a.done).length;
  const muted = { color: token.colorTextSecondary };

  const doStatus = async (s: SafetyStatus, r?: string) => {
    const done = await run(`status-${s}`, () => changeSafetyStatus(ev.id, actor!, s, r), tr("Moved to {value}", { value: SAFETY_STATUS_LABELS[s] }));
    if (done) {
      setStatusModal(null);
      setRemark("");
    }
  };

  const facts: [string, React.ReactNode][] = [
    [tr("Status"), <Dot key="status" color={statusColor(token, ev.status)} label={SAFETY_STATUS_LABELS[ev.status]} />],
    [tr("Severity"), <Dot key="severity" color={severityColor(token, ev.severity)} label={SAFETY_SEVERITY_LABELS[ev.severity]} />],
    [tr("Category"), safetyCategoryLabel(ev)],
    [tr("Occurred"), fmt(ev.occurredAt)],
    [tr("Location"), ev.location || "—"],
    [
      tr("Reported"),
      <span key="reported">
        {trData(ev.reportedBy.name)}
        <div style={{ fontSize: 12, ...muted }}>
          {trData(roleLabel(ev.reportedBy.role as UserRole))} · {fmt(ev.reportedAt)}
        </div>
      </span>,
    ],
  ];
  if (ev.isEmergency) facts.push([tr("Acknowledged"), tr("{count} of {count2}", { count: ev.emergencyAcks.length, count2: ev.emergencyRecipients.length })]);
  if (ev.status !== "CLOSED") facts.push([tr("Reminders"), tr("{notifyCount} sent · until the Director closes it", { notifyCount: ev.notifyCount })]);

  return (
    <div ref={pageRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {needsAck ? (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          title={tr("Emergency — please acknowledge you have seen this")}
          action={
            <Button danger type="primary" loading={busy === "ack"} onClick={async () => {
              await run("ack", () => ackSafetyEmergency(ev.id, actor!), tr("Acknowledged"));
              window.dispatchEvent(new Event("safety-emergencies-changed"));
            }}>
              {tr("Acknowledge")}
            </Button>
          }
        />
      ) : null}
      {loadError ? <Alert type="warning" showIcon title={tr("Showing cached copy — {loadError}", { loadError: trData(loadError) })} /> : null}

      <header data-anim="intro" style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: "1 1 420px" }}>
          <Link href="/safety/incidents" style={{ fontSize: 13, ...muted }}>
            <ArrowLeftOutlined style={{ marginRight: 6 }} />
            {tr("Safety cases")}
          </Link>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 14px", marginTop: 10, fontSize: 13, ...muted }}>
            <span>{SAFETY_TYPE_LABELS[ev.type]}</span>
            <Dot color={statusColor(token, ev.status)} label={SAFETY_STATUS_LABELS[ev.status]} />
            <Dot color={severityColor(token, ev.severity)} label={tr("{severity} severity", { severity: SAFETY_SEVERITY_LABELS[ev.severity] })} />
            {ev.isEmergency ? (
              <span style={{ color: token.colorError, fontWeight: 500 }}>
                <WarningOutlined style={{ marginRight: 4 }} />
                {tr("Emergency")}
              </span>
            ) : null}
          </div>
          <h2 style={{ margin: "6px 0 0", fontSize: 22, lineHeight: 1.3, fontWeight: 600, color: token.colorText, wordBreak: "break-word" }}>
            {trData(ev.title)}
          </h2>
          <div style={{ marginTop: 6, fontSize: 13, ...muted }}>
            {trData(dir.siteName(ev.siteId))} · {ev.id}
          </div>
          {ev.promotedFrom ? (
            <div style={{ marginTop: 6, fontSize: 13 }}>
              {tr("Escalated from near-miss")}{" "}<Link href={`/safety/incidents/${ev.promotedFrom}`}>{trData(ev.promotedFrom)}</Link>
            </div>
          ) : null}
          {ev.promotedTo ? (
            <div style={{ marginTop: 6, fontSize: 13 }}>
              {tr("Escalated to incident")}{" "}<Link href={`/safety/incidents/${ev.promotedTo}`}>{trData(ev.promotedTo)}</Link>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {/* Safety meetings are a coming-soon feature: nothing to call or join yet */}
          <Tooltip title={tr("Safety meetings are coming soon")}>
            <Button icon={<PhoneOutlined />} disabled>
              {tr("Safety meeting")}
              <span style={{ marginLeft: 6, fontSize: 12, color: token.colorTextTertiary }}>{tr("· Coming soon")}</span>
            </Button>
          </Tooltip>
          {canSafety(user ?? null, "downloadReport") ? (
            <Button icon={<DownloadOutlined />} onClick={() => downloadSafetyReport(ev, dir)}>{tr("Report PDF")}</Button>
          ) : null}
          {can("investigate") || (ev.type === "breakdown" && can("updateBreakdown")) ? (
            <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>{tr("Edit")}</Button>
          ) : null}
          {ev.type === "near_miss" && !ev.promotedTo && ev.status !== "CLOSED" && can("reportIncident") ? (
            <Button danger onClick={() => setPromoteOpen(true)}>{tr("Escalate to incident")}</Button>
          ) : null}
        </div>
      </header>

      {nextStatuses.length ? (
        <div
          data-anim="intro"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px 10px 16px",
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            background: token.colorBgContainer,
          }}
        >
          <span style={{ fontSize: 13, marginRight: "auto", ...muted }}>{tr("Next step")}</span>
          {nextStatuses.map((s) => {
            const blocker = blockerFor(s);
            const btn = (
              <Button
                key={s}
                type={s === "RESOLVED" || s === "CLOSED" ? "primary" : "default"}
                disabled={Boolean(blocker)}
                loading={busy === `status-${s}`}
                onClick={() => (s === "REOPENED" || s === "RESOLVED" || s === "CLOSED" ? setStatusModal(s) : doStatus(s))}
              >
                {SAFETY_STATUS_LABELS[s]}
              </Button>
            );
            return blocker ? <Tooltip key={s} title={trData(blocker)}>{btn}</Tooltip> : btn;
          })}
        </div>
      ) : null}

      <div data-anim="intro" className="safety-case-grid">
        {/* Main column: the story of the case */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <Section title={tr("What happened")}>
            <Prose text={trData(ev.description)} empty={tr("No description yet.")} />
            <SubHeading>{tr("Root cause")}</SubHeading>
            <Prose text={trData(ev.rootCause)} empty={tr("Not found yet — added during the investigation.")} />
          </Section>

          <Section title={tr("People")}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 20 }}>
              <PeopleList
                title={ev.type === "breakdown" ? tr("People affected") : tr("It nearly happened to")}
                ids={ev.involved}
                name={dir.empName}
              />
              <PeopleList
                title={ev.type === "breakdown" ? tr("Informed by") : tr("Saw it or informed")}
                ids={ev.informedBy}
                name={dir.empName}
              />
            </div>
          </Section>

          {ev.type === "breakdown" ? (
            <BreakdownCard ev={ev} canEdit={can("updateBreakdown")} peopleOptions={peopleOptions} empName={dir.empName} busy={busy === "bd"}
              onSave={(patch) => run("bd", () => updateSafetyEvent(ev.id, actor!, patch), tr("Breakdown updated"))} ot={ot} />
          ) : null}

          <Section
            title={tr("Corrective actions")}
            extra={ev.correctiveActions.length ? tr("{actionsDone} of {correctiveActionCount} done", { actionsDone, correctiveActionCount: ev.correctiveActions.length }) : undefined}
          >
            {ev.correctiveActions.length ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {ev.correctiveActions.map((a, i) => {
                  const mayTick = can("investigate") || a.ownerId === actor?.id;
                  return (
                    <div key={a.id} style={{ padding: "8px 0", borderTop: i ? `1px solid ${token.colorSplit}` : undefined }}>
                      <Checkbox
                        checked={a.done}
                        disabled={!mayTick || busy === a.id}
                        onChange={(e) => run(a.id, () => setSafetyActionDone(ev.id, a.id, actor!, e.target.checked))}
                      >
                        <span style={{ textDecoration: a.done ? "line-through" : undefined, color: a.done ? token.colorTextSecondary : undefined }}>
                          {trData(a.text)}
                        </span>
                      </Checkbox>
                      {a.ownerId || a.dueDate ? (
                        <div style={{ fontSize: 12, marginLeft: 24, ...muted }}>
                          {[a.ownerId ? trData(dir.empName(a.ownerId)) : null, a.dueDate ? tr("Due {dueDate}", { dueDate: a.dueDate }) : null].filter(Boolean).join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Quiet>{tr("No actions yet.")}</Quiet>
            )}
            {can("investigate") && ["ACKNOWLEDGED", "INVESTIGATING", "ACTION_PENDING", "REOPENED"].includes(ev.status) ? (
              <ActionForm peopleOptions={peopleOptions} busy={busy === "add-action"}
                onAdd={(a) => run("add-action", () => addSafetyAction(ev.id, actor!, a), tr("Action added"))} />
            ) : null}
          </Section>

          {ev.clearance.length ? (
            <Section title={tr("Return to work")} extra={tr("Leave can't close back to duty until cleared")}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {ev.clearance.map((c, i) => {
                  const mayClear = can(clearanceAction(ev.category, ev.severity, "cleared"));
                  const mayWaive = can("waiveClearance");
                  const leaves = leavesByEmp[c.employeeId] ?? [];
                  const linked = leaves.filter((l) => ev.linkedLeaveIds.includes(l.id));
                  const linkable = leaves.filter((l) => !ev.linkedLeaveIds.includes(l.id) && !["REJECTED", "CANCELLED"].includes(l.status));
                  return (
                    <div key={c.employeeId} style={{ padding: "12px 0", borderTop: i ? `1px solid ${token.colorSplit}` : undefined }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 500 }}>{trData(dir.empName(c.employeeId))}</span>
                        <Dot
                          color={c.status === "pending" ? token.colorWarning : c.status === "cleared" ? token.colorSuccess : token.colorTextQuaternary}
                          label={c.status === "pending" ? tr("Clearance pending") : c.status === "cleared" ? tr("Cleared") : tr("Waived")}
                        />
                      </div>
                      {c.status !== "pending" ? (
                        <div style={{ fontSize: 12, marginTop: 2, ...muted }}>
                          {trData(c.clearedBy)} ({trData(roleLabel(c.clearedByRole as UserRole))}) · {fmt(c.at)}{c.remark ? ` · ${c.remark}` : ""}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
                          {mayClear ? (
                            <Button size="small" type="primary" loading={busy === `clr-${c.employeeId}`}
                              onClick={() => run(`clr-${c.employeeId}`, () => decideSafetyClearance(ev.id, c.employeeId, actor!, "cleared"), tr("Cleared for duty"))}>
                              {tr("Clear for duty")}
                            </Button>
                          ) : (
                            <span style={{ fontSize: 12, ...muted }}>
                              {ev.severity === "critical" || ev.category === "fatal" ? tr("Safety In-charge or Director clears this case.") : tr("Safety In-charge or Manager clears this case.")}
                            </span>
                          )}
                          {mayWaive ? <Button size="small" onClick={() => setWaiveFor(c.employeeId)}>{tr("Waive…")}</Button> : null}
                        </div>
                      )}
                      <div style={{ marginTop: 8, fontSize: 13 }}>
                        <span style={muted}>{tr("Linked leave:")}</span>
                        {linked.length
                          ? linked.map((l) => (
                              <Link key={l.id} href={`/leave/requests/${l.id}`} style={{ marginRight: 8 }}>
                                {l.id} ({LEAVE_STATUS_LABELS[l.status] ?? l.status})
                              </Link>
                            ))
                          : tr("none")}
                      </div>
                      {can("linkLeave") && linkable.length ? (
                        <Select
                          size="small"
                          style={{ minWidth: 240, marginTop: 6 }}
                          placeholder={tr("Link a leave request")}
                          value={null}
                          loading={busy === `link-${c.employeeId}`}
                          options={linkable.map((l) => ({ value: l.id, label: `${l.id} · ${l.leaveType} · ${l.startDate}→${l.endDate} · ${LEAVE_STATUS_LABELS[l.status] ?? l.status}` }))}
                          onChange={(leaveId: string) => run(`link-${c.employeeId}`, () => linkSafetyLeave(ev.id, actor!, leaveId), tr("Leave linked"))}
                        />
                      ) : null}
                      {c.status === "pending" && !leaves.some((l) => !["REJECTED", "CANCELLED", "CLOSED"].includes(l.status)) && can("linkLeave") ? (
                        <div style={{ fontSize: 12, marginTop: 6, ...muted }}>
                          {trNode("No open leave. {link} for them, then link it here.", { link: <Link href="/leave/requests">{tr("Open a sick leave")}</Link> })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Section>
          ) : null}

          <Section title={tr("Photos & videos")} extra={ev.media.length ? String(ev.media.length) : undefined}>
            {ev.media.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))", gap: 8 }}>
                {ev.media.map((m) => (
                  <figure key={m.id} style={{ margin: 0, minWidth: 0 }}>
                    {m.kind === "video" ? (
                      <video src={safetyMediaUrl(m.url)} controls preload="metadata" style={{ width: "100%", height: 120, background: "#000", borderRadius: 6 }} />
                    ) : (
                      <a href={safetyMediaUrl(m.url)} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={safetyMediaUrl(m.url)} alt={trData(m.name)} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6 }} />
                      </a>
                    )}
                    <figcaption style={{ fontSize: 12, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...muted }} title={trData(m.name)}>
                      {m.kind === "video" ? tr("Video") : tr("Photo")} · {trData(m.uploadedBy)} · {fmt(m.at)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <Quiet>{tr("No photos or videos yet.")}</Quiet>
            )}
            {can("comment") ? (
              <Upload
                multiple
                showUploadList={false}
                accept={MEDIA_ACCEPT}
                beforeUpload={(file) => {
                  const limit = file.type.startsWith("video/") ? 50 * MB : 10 * MB;
                  if (file.size > limit) {
                    message.error(tr("{name} is too large — photos ≤10 MB, videos ≤50 MB", { name: trData(file.name) }));
                    return Upload.LIST_IGNORE;
                  }
                  void run(`media-${file.uid}`, () => uploadSafetyMedia(ev.id, actor!, file), tr("{name} uploaded", { name: trData(file.name) }));
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />} loading={Boolean(busy?.startsWith("media-"))} style={{ marginTop: 12 }}>{tr("Add photos / videos")}</Button>
              </Upload>
            ) : null}
          </Section>

          <Section title={tr("Activity")}>
            {can("comment") ? (
              <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "flex-start" }}>
                <Input.TextArea value={comment} onChange={(e) => setComment(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} placeholder={tr("Add an update or comment")} />
                <Button type="primary" disabled={!comment.trim()} loading={busy === "comment"}
                  onClick={async () => {
                    const done = await run("comment", () => commentSafetyEvent(ev.id, actor!, comment.trim()));
                    if (done) setComment("");
                  }}>
                  {tr("Post")}
                </Button>
              </div>
            ) : null}
            <EventTimeline entries={ev.timeline} />
          </Section>
        </div>

        {/* Side column: facts about the case */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <Section title={tr("Case details")}>
            <Facts rows={facts} />
          </Section>

          <Section title={tr("Responsible")} extra={responsible.length ? String(responsible.length) : undefined}>
            {responsible.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {responsible.map((s) => (
                  <Person key={s.personId} name={s.name} sub={trData(roleLabel(s.role as UserRole))} />
                ))}
              </div>
            ) : (
              <Quiet>{tr("Nobody assigned.")}</Quiet>
            )}
          </Section>

        </div>
      </div>

      <Modal
        open={Boolean(statusModal)}
        title={statusModal ? tr("Move to {status}", { status: SAFETY_STATUS_LABELS[statusModal] }) : ""}
        okText={tr("Confirm")}
        confirmLoading={Boolean(statusModal && busy === `status-${statusModal}`)}
        okButtonProps={{ disabled: statusModal === "REOPENED" && !remark.trim() }}
        onOk={() => statusModal && doStatus(statusModal, remark.trim() || undefined)}
        onCancel={() => { setStatusModal(null); setRemark(""); }}
        destroyOnHidden
      >
        <Input.TextArea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)}
          placeholder={statusModal === "REOPENED" ? tr("Why is it being reopened? (required)") : tr("Remark (optional)")} />
      </Modal>

      <Modal
        open={Boolean(waiveFor)}
        title={tr("Waive return-to-work clearance")}
        okText={tr("Waive")}
        okButtonProps={{ danger: true, disabled: !remark.trim() }}
        confirmLoading={busy === `waive-${waiveFor}`}
        onOk={async () => {
          const emp = waiveFor!;
          const done = await run(`waive-${emp}`, () => decideSafetyClearance(ev.id, emp, actor!, "waived", remark.trim()), tr("Clearance waived"));
          if (done) { setWaiveFor(null); setRemark(""); }
        }}
        onCancel={() => { setWaiveFor(null); setRemark(""); }}
        destroyOnHidden
      >
        <p>{tr("Director only. The reason is kept on the case record.")}</p>
        <Input.TextArea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder={tr("Reason (required)")} />
      </Modal>

      <EditModal ev={ev} open={editOpen} onClose={() => setEditOpen(false)} busy={busy === "edit"}
        canInvestigate={can("investigate")} peopleOptions={casePeopleOptions}
        onSave={async (patch) => {
          const done = await run("edit", () => updateSafetyEvent(ev.id, actor!, patch), tr("Saved"));
          if (done) setEditOpen(false);
        }} />

      <PromoteModal open={promoteOpen} onClose={() => setPromoteOpen(false)} busy={busy === "promote"}
        onPromote={async (opts) => {
          if (!actor) return;
          setBusy("promote");
          try {
            const incident = await promoteNearMiss(ev.id, actor, opts);
            upsertSafetyEvent(incident);
            message.success(tr("Escalated to incident"));
            setPromoteOpen(false);
            router.push(`/safety/incidents/${incident.id}`);
          } catch (err) {
            message.error(err instanceof Error ? trData(err.message) : tr("Could not escalate"));
          } finally {
            setBusy(null);
          }
        }} />
    </div>
  );
}

function ActionForm({ peopleOptions, onAdd, busy }: {
  peopleOptions: { value: string; label: string }[];
  onAdd: (a: { text: string; ownerId?: string; dueDate?: string }) => Promise<unknown>;
  busy: boolean;
}) {
  const [form] = Form.useForm();
  return (
    <Form form={form} layout="vertical" style={{ marginTop: 12 }}
      onFinish={async (v) => {
        const done = await onAdd({ text: v.text, ownerId: v.ownerId, dueDate: v.dueDate ? v.dueDate.format("YYYY-MM-DD") : undefined });
        if (done) form.resetFields();
      }}>
      <Form.Item name="text" rules={[{ required: true, whitespace: true, message: tr("Describe the action") }]} style={{ marginBottom: 8 }}>
        <Input placeholder={tr("e.g. Fix sign board and barricade at tank cap")} maxLength={1000} />
      </Form.Item>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Form.Item name="ownerId" style={{ marginBottom: 0, minWidth: 180, flex: 1 }}>
          <Select allowClear showSearch optionFilterProp="label" placeholder={tr("Owner")} options={peopleOptions} />
        </Form.Item>
        <Form.Item name="dueDate" style={{ marginBottom: 0 }}>
          <DatePicker placeholder={tr("Due")} disabledDate={(d) => d.isBefore(dayjs().startOf("day"))} />
        </Form.Item>
        <Button htmlType="submit" icon={<PlusOutlined />} loading={busy}>{tr("Add")}</Button>
      </div>
    </Form>
  );
}

function BreakdownCard({ ev, canEdit, peopleOptions, empName, onSave, busy, ot }: {
  ev: SafetyEvent;
  canEdit: boolean;
  peopleOptions: { value: string; label: string }[];
  empName: (id?: string) => string;
  onSave: (patch: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
  ot: { people: number; hours: number };
}) {
  const [rows, setRows] = useState(ev.otEntries);
  const [restoredAt, setRestoredAt] = useState(ev.restoredAt ?? "");
  const [otHours, setOtHours] = useState(4);
  // Breakdown repair needs an E-Permit before repair OT (plan §13)
  const { permits } = useEPermits();
  const linkedPermits = permitsForBreakdown(permits, ev.id);
  const permitRequired = E_PERMITS_ENABLED && !linkedPermits.length;
  const session = getSession();
  const canIssueHere = canIssueEPermit(session) && session?.siteId === ev.siteId;
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setRows(ev.otEntries);
      setRestoredAt(ev.restoredAt ?? "");
    });
    return () => cancelAnimationFrame(id);
  }, [ev.otEntries, ev.restoredAt]);

  return (
    <Section title={tr("Breakdown")}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label={tr("Equipment")}>{ev.equipment || "—"}</Descriptions.Item>
        <Descriptions.Item label={tr("What broke")}>{ev.whatFailed || "—"}</Descriptions.Item>
        <Descriptions.Item label={tr("Why not working")}>{ev.why || "—"}</Descriptions.Item>
        <Descriptions.Item label={tr("How")}>{ev.how || "—"}</Descriptions.Item>
        <Descriptions.Item label={tr("Failed at")}>{fmt(ev.failedAt)}</Descriptions.Item>
        <Descriptions.Item label={tr("Restored at")}>{ev.restoredAt ? fmt(ev.restoredAt) : <StillDown />}</Descriptions.Item>
        <Descriptions.Item label={tr("Downtime")}>{tr("{downtimeDays} days", { downtimeDays: downtimeDays(ev.failedAt, ev.restoredAt ?? undefined) })}</Descriptions.Item>
        <Descriptions.Item label={tr("OT to fix")}>{tr("{people} people · {hours} h", { people: ot.people, hours: ot.hours })}</Descriptions.Item>
        <Descriptions.Item label={tr("OT decisions")}>
          {ev.otDecisionIds.length
            ? ev.otDecisionIds.map((id) => {
                const d = getOtDecisionById(id);
                return (
                  <Link key={id} href="/overtime/decisions" style={{ marginRight: 8 }}>
                    {id}{d ? ` (${d.status})` : ""}
                  </Link>
                );
              })
            : "—"}
        </Descriptions.Item>
        {E_PERMITS_ENABLED ? (
          <Descriptions.Item label={tr("E-Permits")}>
            {linkedPermits.length
              ? linkedPermits.map((p) => (
                  <Link key={p.id} href={`/e-permits/${p.id}`} style={{ marginRight: 8 }}>
                    {p.permitNo} ({tr(EPERMIT_STATUS_LABELS[p.status])})
                  </Link>
                ))
              : tr("None yet — repair work needs an E-Permit")}
          </Descriptions.Item>
        ) : null}
      </Descriptions>
      {E_PERMITS_ENABLED && !ev.restoredAt && canIssueHere ? (
        <div style={{ margin: "8px 0" }}>
          <Link href={`/e-permits/new?breakdown=${encodeURIComponent(ev.id)}`}>
            <Button>{linkedPermits.length ? tr("Issue another E-Permit for this repair") : tr("Issue E-Permit for this repair")}</Button>
          </Link>
        </div>
      ) : null}
      {canEdit && !ev.restoredAt ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "8px 0" }}>
          <InputNumber min={1} max={12} value={otHours} onChange={(v) => setOtHours(Number(v) || 1)} suffix="h" />
          <Button
            disabled={permitRequired}
            title={permitRequired ? tr("Issue an E-Permit for the repair first") : undefined}
            loading={busy}
            onClick={() => {
              const decision = createBreakdownOtDecision({
                siteId: ev.siteId,
                date: dayjs().format("YYYY-MM-DD"),
                hours: otHours,
                safetyEventId: ev.id,
                breakdownTitle: ev.title,
              });
              void onSave({ linkOtDecisionId: decision.id });
            }}
          >
            {tr("Request repair OT (manager approves in OT → Decisions)")}
          </Button>
        </div>
      ) : null}
      {!canEdit ? (
        ev.otEntries.length ? <div style={{ fontSize: 12 }}>{ev.otEntries.map((e) => `${empName(e.employeeId)} ${e.hours}h`).join(" · ")}</div> : null
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <div>
            {tr("Restored at:")}{" "}
            <DatePicker showTime value={restoredAt ? dayjs(restoredAt) : null}
              disabledDate={(d) => d.isAfter(dayjs()) || (ev.failedAt ? d.isBefore(dayjs(ev.failedAt).startOf("day")) : false)}
              onChange={(d) => setRestoredAt(d ? d.toISOString() : "")} />
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Select style={{ minWidth: 180, flex: 1 }} showSearch optionFilterProp="label" options={peopleOptions} value={r.employeeId || undefined}
                placeholder={tr("Employee")} onChange={(v: string) => setRows(rows.map((x, j) => (j === i ? { ...x, employeeId: v } : x)))} />
              <InputNumber min={0.5} max={744} step={0.5} value={r.hours} suffix="h"
                onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, hours: Number(v) || 0 } : x)))} />
              <Button danger onClick={() => setRows(rows.filter((_, j) => j !== i))}>{tr("Remove")}</Button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <Button icon={<PlusOutlined />} onClick={() => setRows([...rows, { employeeId: "", hours: 1 }])}>{tr("Add OT entry")}</Button>
            <Button type="primary" loading={busy}
              onClick={() => onSave({ restoredAt, otEntries: rows.filter((r) => r.employeeId && r.hours > 0) })}>
              {tr("Save")}
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

function EditModal({ ev, open, onClose, onSave, busy, canInvestigate, peopleOptions }: {
  ev: SafetyEvent;
  open: boolean;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  busy: boolean;
  canInvestigate: boolean;
  peopleOptions: { value: string; label: string }[];
}) {
  const [form] = Form.useForm();
  const category = Form.useWatch("category", form) ?? ev.category;
  return (
    <Modal open={open} title={tr("Edit details")} okText={tr("Save")} confirmLoading={busy} onCancel={onClose} onOk={() => form.submit()} destroyOnHidden>
      <Form form={form} layout="vertical" preserve={false}
        initialValues={{
          title: ev.title, description: ev.description, location: ev.location, rootCause: ev.rootCause,
          category: ev.category, categoryOther: ev.categoryOther, severity: ev.severity,
          equipment: ev.equipment, whatFailed: ev.whatFailed, why: ev.why, how: ev.how,
          involved: ev.involved, informedBy: ev.informedBy,
        }}
        onFinish={(v) => onSave(v)}>
        <Form.Item name="title" label={tr("Title")} rules={[{ required: true, whitespace: true }]}><Input maxLength={200} /></Form.Item>
        <Form.Item name="location" label={tr("Location")}><Input maxLength={200} /></Form.Item>
        <Form.Item name="description" label={tr("Description")}><Input.TextArea rows={3} maxLength={4000} /></Form.Item>
        {canInvestigate ? (
          <>
            <Form.Item name="rootCause" label={tr("Root cause")}><Input.TextArea rows={3} maxLength={4000} /></Form.Item>
            <div style={{ display: "flex", gap: 8 }}>
              <Form.Item name="category" label={tr("Category")} style={{ flex: 1 }}>
                <Select options={(Object.keys(SAFETY_CATEGORY_LABELS) as SafetyCategory[]).map((c) => ({ value: c, label: SAFETY_CATEGORY_LABELS[c] }))} />
              </Form.Item>
              <Form.Item name="severity" label={tr("Severity")} style={{ flex: 1 }}>
                <Select options={(Object.keys(SAFETY_SEVERITY_LABELS) as SafetySeverity[]).map((s) => ({ value: s, label: SAFETY_SEVERITY_LABELS[s] }))} />
              </Form.Item>
            </div>
            {category === "other" ? (
              <Form.Item name="categoryOther" label={tr("Name the hazard")} rules={[{ required: true, whitespace: true, message: tr("Say what the hazard was") }, { max: 120 }]}>
                <Input maxLength={120} placeholder={tr("e.g. Slippery floor")} />
              </Form.Item>
            ) : null}
            <Form.Item
              name="involved"
              label={ev.type === "breakdown" ? tr("People affected") : tr("People it happened to")}
              rules={ev.type === "breakdown" ? [] : [{ required: true, type: "array", min: 1, message: tr("Keep at least one person") }]}
            >
              <Select mode="multiple" showSearch optionFilterProp="label" options={peopleOptions} placeholder={tr("Search names")} />
            </Form.Item>
            <Form.Item name="informedBy" label={ev.type === "breakdown" ? tr("Informed by") : tr("People who saw it or informed")}>
              <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={peopleOptions} placeholder={tr("Search names (optional)")} />
            </Form.Item>
          </>
        ) : null}
        {ev.type === "breakdown" ? (
          <>
            <Form.Item name="equipment" label={tr("Equipment")}><Input maxLength={200} /></Form.Item>
            <Form.Item name="whatFailed" label={tr("What broke")}><Input maxLength={1000} /></Form.Item>
            <Form.Item name="why" label={tr("Why not working")}><Input.TextArea rows={2} maxLength={2000} /></Form.Item>
            <Form.Item name="how" label={tr("How")}><Input.TextArea rows={2} maxLength={2000} /></Form.Item>
          </>
        ) : null}
      </Form>
    </Modal>
  );
}

function PromoteModal({ open, onClose, onPromote, busy }: {
  open: boolean;
  onClose: () => void;
  onPromote: (opts: { category: string; categoryOther?: string; severity: string; remark?: string; isEmergency?: boolean }) => Promise<void>;
  busy: boolean;
}) {
  const [form] = Form.useForm();
  const category = Form.useWatch("category", form);
  return (
    <Modal open={open} title={tr("Escalate near-miss to incident")} okText={tr("Escalate")} okButtonProps={{ danger: true }} confirmLoading={busy}
      onCancel={onClose} onOk={() => form.submit()} destroyOnHidden>
      <Form form={form} layout="vertical" preserve={false} initialValues={{ category: "first_aid", severity: "medium" }} onFinish={(v) => onPromote(v)}>
        <Form.Item name="category" label={tr("Incident category")} rules={[{ required: true }]}>
          <Select options={(Object.keys(SAFETY_CATEGORY_LABELS) as SafetyCategory[]).map((c) => ({ value: c, label: SAFETY_CATEGORY_LABELS[c] }))} />
        </Form.Item>
        {category === "other" ? (
          <Form.Item name="categoryOther" label={tr("Name the hazard")} rules={[{ required: true, whitespace: true, message: tr("Say what the hazard was") }, { max: 120 }]}>
            <Input maxLength={120} />
          </Form.Item>
        ) : null}
        <Form.Item name="severity" label={tr("Severity")} rules={[{ required: true }]}>
          <Select options={(Object.keys(SAFETY_SEVERITY_LABELS) as SafetySeverity[]).map((s) => ({ value: s, label: SAFETY_SEVERITY_LABELS[s] }))} />
        </Form.Item>
        <Form.Item name="remark" label={tr("Why escalate?")}><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
      </Form>
    </Modal>
  );
}
