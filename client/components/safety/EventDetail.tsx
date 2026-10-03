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
  joinSafetyCall,
  linkSafetyLeave,
  promoteNearMiss,
  safetyMediaUrl,
  setSafetyActionDone,
  startSafetyCall,
  updateSafetyEvent,
  uploadSafetyMedia,
} from "@/lib/api/safety";
import { getLeaves } from "@/lib/api/leaves";
import { getCachedSafetyEvent, upsertSafetyEvent } from "@/lib/safety/store";
import { downloadSafetyReport } from "@/lib/safety/report-pdf";
import { useDirectory, useSessionUser } from "@/lib/safety/hooks";
import { canSafety, roleLabel, safetyActorOf } from "@/lib/rbac";
import type { UserRole } from "@/lib/auth";
import type { LeaveRequest } from "@/lib/leave/types";
import { LEAVE_STATUS_LABELS } from "@/lib/leave/types";
import { createBreakdownOtDecision, getOtDecisionById } from "@/lib/ot-decision";
import EventTimeline from "./EventTimeline";
import { useTableMotion } from "@/lib/motion/use-table-motion";
import { Dot, Facts, Person, Prose, Quiet, Section, SubHeading, severityColor, statusColor } from "./ui";

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN") : "—");
const MB = 1024 * 1024;
const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

function StillDown() {
  const { token } = theme.useToken();
  return <Dot color={token.colorError} label="Still down" />;
}

function PeopleList({ title, ids, name }: { title: string; ids: string[]; name: (id: string) => string }) {
  const { token } = theme.useToken();
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: 10, fontSize: 13, color: token.colorTextSecondary }}>
        {title} <span style={{ color: token.colorTextQuaternary }}>· {ids.length}</span>
      </div>
      {ids.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ids.map((id) => (
            <Person key={id} name={name(id)} />
          ))}
        </div>
      ) : (
        <Quiet>Nobody named.</Quiet>
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
    const cached = getCachedSafetyEvent(id);
    const raf = requestAnimationFrame(() => {
      if (cached) setEv((cur) => cur ?? cached);
    });
    let alive = true;
    getSafetyEvent(id)
      .then((fresh) => {
        if (!alive) return;
        setEv(fresh);
        upsertSafetyEvent(fresh);
        setLoadError(null);
      })
      .catch((err) => alive && setLoadError(err instanceof Error ? err.message : "Could not load"));
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
      message.error(err instanceof Error ? err.message : "Action failed");
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  const can = (action: Parameters<typeof canSafety>[1]) => canSafety(user ?? null, action, ev?.siteId);

  // Header, next step and the case body settle in once the case is on screen.
  const { pageRef } = useTableMotion("", Boolean(ev));

  const nextStatuses = useMemo(() => {
    if (!ev) return [];
    return SAFETY_TRANSITIONS[ev.status].filter((s) => canSafety(user ?? null, actionForStatus(s), ev.siteId));
  }, [ev, user]);

  if (!ev) {
    return loadError ? (
      <Alert type="error" showIcon title={`Could not load case ${id}`} description={loadError} />
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
  const callPeople = [...new Set([...(ev.callJoined ?? []), ...(ev.callInvited ?? [])])];
  const muted = { color: token.colorTextSecondary };

  const doStatus = async (s: SafetyStatus, r?: string) => {
    const done = await run(`status-${s}`, () => changeSafetyStatus(ev.id, actor!, s, r), `Moved to ${SAFETY_STATUS_LABELS[s]}`);
    if (done) {
      setStatusModal(null);
      setRemark("");
    }
  };

  const facts: [string, React.ReactNode][] = [
    ["Status", <Dot key="status" color={statusColor(token, ev.status)} label={SAFETY_STATUS_LABELS[ev.status]} />],
    ["Severity", <Dot key="severity" color={severityColor(token, ev.severity)} label={SAFETY_SEVERITY_LABELS[ev.severity]} />],
    ["Category", safetyCategoryLabel(ev)],
    ["Occurred", fmt(ev.occurredAt)],
    ["Location", ev.location || "—"],
    [
      "Reported",
      <span key="reported">
        {ev.reportedBy.name}
        <div style={{ fontSize: 12, ...muted }}>
          {roleLabel(ev.reportedBy.role as UserRole)} · {fmt(ev.reportedAt)}
        </div>
      </span>,
    ],
  ];
  if (ev.isEmergency) facts.push(["Acknowledged", `${ev.emergencyAcks.length} of ${ev.emergencyRecipients.length}`]);
  if (ev.status !== "CLOSED") facts.push(["Reminders", `${ev.notifyCount} sent · until the Director closes it`]);

  return (
    <div ref={pageRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {needsAck ? (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          title="Emergency — please acknowledge you have seen this"
          action={
            <Button danger type="primary" loading={busy === "ack"} onClick={async () => {
              await run("ack", () => ackSafetyEmergency(ev.id, actor!), "Acknowledged");
              window.dispatchEvent(new Event("safety-emergencies-changed"));
            }}>
              Acknowledge
            </Button>
          }
        />
      ) : null}
      {loadError ? <Alert type="warning" showIcon title={`Showing cached copy — ${loadError}`} /> : null}

      <header data-anim="intro" style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: "1 1 420px" }}>
          <Link href="/safety/incidents" style={{ fontSize: 13, ...muted }}>
            <ArrowLeftOutlined style={{ marginRight: 6 }} />
            Safety cases
          </Link>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 14px", marginTop: 10, fontSize: 13, ...muted }}>
            <span>{SAFETY_TYPE_LABELS[ev.type]}</span>
            <Dot color={statusColor(token, ev.status)} label={SAFETY_STATUS_LABELS[ev.status]} />
            <Dot color={severityColor(token, ev.severity)} label={`${SAFETY_SEVERITY_LABELS[ev.severity]} severity`} />
            {ev.isEmergency ? (
              <span style={{ color: token.colorError, fontWeight: 500 }}>
                <WarningOutlined style={{ marginRight: 4 }} />
                Emergency
              </span>
            ) : null}
          </div>
          <h2 style={{ margin: "6px 0 0", fontSize: 22, lineHeight: 1.3, fontWeight: 600, color: token.colorText, wordBreak: "break-word" }}>
            {ev.title}
          </h2>
          <div style={{ marginTop: 6, fontSize: 13, ...muted }}>
            {dir.siteName(ev.siteId)} · {ev.id}
          </div>
          {ev.promotedFrom ? (
            <div style={{ marginTop: 6, fontSize: 13 }}>
              Escalated from near-miss <Link href={`/safety/incidents/${ev.promotedFrom}`}>{ev.promotedFrom}</Link>
            </div>
          ) : null}
          {ev.promotedTo ? (
            <div style={{ marginTop: 6, fontSize: 13 }}>
              Escalated to incident <Link href={`/safety/incidents/${ev.promotedTo}`}>{ev.promotedTo}</Link>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ev.meetLink ? (
            <Button
              type={actor && ev.callInvited?.includes(actor.id) && !ev.callJoined?.includes(actor.id) ? "primary" : "default"}
              icon={<PhoneOutlined />}
              loading={busy === "join"}
              onClick={async () => {
                window.open(ev.meetLink, "_blank", "noreferrer");
                if (actor && ev.callStartedAt && !ev.callJoined?.includes(actor.id)) {
                  await run("join", () => joinSafetyCall(ev.id, actor), "Marked as joined — your meeting reminders stop");
                }
              }}
            >
              Join meeting
            </Button>
          ) : can("startCall") ? (
            <Button icon={<PhoneOutlined />} loading={busy === "call"} onClick={() => run("call", () => startSafetyCall(ev.id, actor!), "Meeting called — everyone on the case was notified")}>
              Call safety meeting
            </Button>
          ) : null}
          <Button icon={<DownloadOutlined />} onClick={() => downloadSafetyReport(ev, dir)}>Report PDF</Button>
          {can("investigate") || (ev.type === "breakdown" && can("updateBreakdown")) ? (
            <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>Edit</Button>
          ) : null}
          {ev.type === "near_miss" && !ev.promotedTo && ev.status !== "CLOSED" && can("reportIncident") ? (
            <Button danger onClick={() => setPromoteOpen(true)}>Escalate to incident</Button>
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
          <span style={{ fontSize: 13, marginRight: "auto", ...muted }}>Next step</span>
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
            return blocker ? <Tooltip key={s} title={blocker}>{btn}</Tooltip> : btn;
          })}
        </div>
      ) : null}

      <div data-anim="intro" className="safety-case-grid">
        {/* Main column: the story of the case */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <Section title="What happened">
            <Prose text={ev.description} empty="No description yet." />
            <SubHeading>Root cause</SubHeading>
            <Prose text={ev.rootCause} empty="Not found yet — added during the investigation." />
          </Section>

          <Section title="People">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 20 }}>
              <PeopleList
                title={ev.type === "breakdown" ? "People affected" : "It nearly happened to"}
                ids={ev.involved}
                name={dir.empName}
              />
              <PeopleList
                title={ev.type === "breakdown" ? "Informed by" : "Saw it or informed"}
                ids={ev.informedBy}
                name={dir.empName}
              />
            </div>
          </Section>

          {ev.type === "breakdown" ? (
            <BreakdownCard ev={ev} canEdit={can("updateBreakdown")} peopleOptions={peopleOptions} empName={dir.empName} busy={busy === "bd"}
              onSave={(patch) => run("bd", () => updateSafetyEvent(ev.id, actor!, patch), "Breakdown updated")} ot={ot} />
          ) : null}

          <Section
            title="Corrective actions"
            extra={ev.correctiveActions.length ? `${actionsDone} of ${ev.correctiveActions.length} done` : undefined}
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
                          {a.text}
                        </span>
                      </Checkbox>
                      {a.ownerId || a.dueDate ? (
                        <div style={{ fontSize: 12, marginLeft: 24, ...muted }}>
                          {[a.ownerId ? dir.empName(a.ownerId) : null, a.dueDate ? `due ${a.dueDate}` : null].filter(Boolean).join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Quiet>No actions yet.</Quiet>
            )}
            {can("investigate") && ["ACKNOWLEDGED", "INVESTIGATING", "ACTION_PENDING", "REOPENED"].includes(ev.status) ? (
              <ActionForm peopleOptions={peopleOptions} busy={busy === "add-action"}
                onAdd={(a) => run("add-action", () => addSafetyAction(ev.id, actor!, a), "Action added")} />
            ) : null}
          </Section>

          {ev.clearance.length ? (
            <Section title="Return to work" extra="Leave can't close back to duty until cleared">
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
                        <span style={{ fontWeight: 500 }}>{dir.empName(c.employeeId)}</span>
                        <Dot
                          color={c.status === "pending" ? token.colorWarning : c.status === "cleared" ? token.colorSuccess : token.colorTextQuaternary}
                          label={c.status === "pending" ? "Clearance pending" : c.status === "cleared" ? "Cleared" : "Waived"}
                        />
                      </div>
                      {c.status !== "pending" ? (
                        <div style={{ fontSize: 12, marginTop: 2, ...muted }}>
                          {c.clearedBy} ({roleLabel(c.clearedByRole as UserRole)}) · {fmt(c.at)}{c.remark ? ` · ${c.remark}` : ""}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
                          {mayClear ? (
                            <Button size="small" type="primary" loading={busy === `clr-${c.employeeId}`}
                              onClick={() => run(`clr-${c.employeeId}`, () => decideSafetyClearance(ev.id, c.employeeId, actor!, "cleared"), "Cleared for duty")}>
                              Clear for duty
                            </Button>
                          ) : (
                            <span style={{ fontSize: 12, ...muted }}>
                              {ev.severity === "critical" || ev.category === "fatal" ? "Safety In-charge or Director clears this case." : "Safety In-charge or Manager clears this case."}
                            </span>
                          )}
                          {mayWaive ? <Button size="small" onClick={() => setWaiveFor(c.employeeId)}>Waive…</Button> : null}
                        </div>
                      )}
                      <div style={{ marginTop: 8, fontSize: 13 }}>
                        <span style={muted}>Linked leave: </span>
                        {linked.length
                          ? linked.map((l) => (
                              <Link key={l.id} href={`/leave/requests/${l.id}`} style={{ marginRight: 8 }}>
                                {l.id} ({LEAVE_STATUS_LABELS[l.status] ?? l.status})
                              </Link>
                            ))
                          : "none"}
                      </div>
                      {can("linkLeave") && linkable.length ? (
                        <Select
                          size="small"
                          style={{ minWidth: 240, marginTop: 6 }}
                          placeholder="Link a leave request"
                          value={null}
                          loading={busy === `link-${c.employeeId}`}
                          options={linkable.map((l) => ({ value: l.id, label: `${l.id} · ${l.leaveType} · ${l.startDate}→${l.endDate} · ${LEAVE_STATUS_LABELS[l.status] ?? l.status}` }))}
                          onChange={(leaveId: string) => run(`link-${c.employeeId}`, () => linkSafetyLeave(ev.id, actor!, leaveId), "Leave linked")}
                        />
                      ) : null}
                      {c.status === "pending" && !leaves.some((l) => !["REJECTED", "CANCELLED", "CLOSED"].includes(l.status)) && can("linkLeave") ? (
                        <div style={{ fontSize: 12, marginTop: 6, ...muted }}>
                          No open leave. <Link href="/leave/requests">Open a sick leave</Link> for them, then link it here.
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Section>
          ) : null}

          <Section title="Photos & videos" extra={ev.media.length ? String(ev.media.length) : undefined}>
            {ev.media.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))", gap: 8 }}>
                {ev.media.map((m) => (
                  <figure key={m.id} style={{ margin: 0, minWidth: 0 }}>
                    {m.kind === "video" ? (
                      <video src={safetyMediaUrl(m.url)} controls preload="metadata" style={{ width: "100%", height: 120, background: "#000", borderRadius: 6 }} />
                    ) : (
                      <a href={safetyMediaUrl(m.url)} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={safetyMediaUrl(m.url)} alt={m.name} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6 }} />
                      </a>
                    )}
                    <figcaption style={{ fontSize: 12, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...muted }} title={m.name}>
                      {m.kind === "video" ? "Video" : "Photo"} · {m.uploadedBy} · {fmt(m.at)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <Quiet>No photos or videos yet.</Quiet>
            )}
            {can("comment") ? (
              <Upload
                multiple
                showUploadList={false}
                accept={MEDIA_ACCEPT}
                beforeUpload={(file) => {
                  const limit = file.type.startsWith("video/") ? 50 * MB : 10 * MB;
                  if (file.size > limit) {
                    message.error(`${file.name} is too large — photos ≤10 MB, videos ≤50 MB`);
                    return Upload.LIST_IGNORE;
                  }
                  void run(`media-${file.uid}`, () => uploadSafetyMedia(ev.id, actor!, file), `${file.name} uploaded`);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />} loading={Boolean(busy?.startsWith("media-"))} style={{ marginTop: 12 }}>Add photos / videos</Button>
              </Upload>
            ) : null}
          </Section>

          <Section title="Activity">
            {can("comment") ? (
              <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "flex-start" }}>
                <Input.TextArea value={comment} onChange={(e) => setComment(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} placeholder="Add an update or comment" />
                <Button type="primary" disabled={!comment.trim()} loading={busy === "comment"}
                  onClick={async () => {
                    const done = await run("comment", () => commentSafetyEvent(ev.id, actor!, comment.trim()));
                    if (done) setComment("");
                  }}>
                  Post
                </Button>
              </div>
            ) : null}
            <EventTimeline entries={ev.timeline} />
          </Section>
        </div>

        {/* Side column: facts about the case */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <Section title="Case details">
            <Facts rows={facts} />
          </Section>

          <Section title="Responsible" extra={responsible.length ? String(responsible.length) : undefined}>
            {responsible.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {responsible.map((s) => (
                  <Person key={s.personId} name={s.name} sub={roleLabel(s.role as UserRole)} />
                ))}
              </div>
            ) : (
              <Quiet>Nobody assigned.</Quiet>
            )}
          </Section>

          {ev.callStartedAt ? (
            <Section title="Safety meeting" extra={`${(ev.callJoined ?? []).length} of ${callPeople.length} joined`}>
              <div style={{ fontSize: 13, marginBottom: 12, ...muted }}>
                Called {fmt(ev.callStartedAt)}. Anyone who hasn&apos;t joined is reminded in the app every 4 hours until they join or
                the Director closes the case. Email and WhatsApp reminders are coming soon.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {callPeople.map((p) => {
                  const joined = (ev.callJoined ?? []).includes(p);
                  const stake = ev.stakeholders.find((s) => s.personId === p);
                  const name = stake?.name ?? (p === ev.reportedBy.personId ? ev.reportedBy.name : dir.empName(p));
                  const last = ev.callNudgedAt?.[p];
                  return (
                    <div key={p} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                      <span>{name}</span>
                      <Tooltip title={!joined && last ? `Last reminded ${fmt(last)}` : undefined}>
                        <span>
                          <Dot color={joined ? token.colorSuccess : token.colorWarning} label={joined ? "Joined" : "Not joined"} />
                        </span>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            </Section>
          ) : null}
        </div>
      </div>

      <Modal
        open={Boolean(statusModal)}
        title={statusModal ? `Move to ${SAFETY_STATUS_LABELS[statusModal]}` : ""}
        okText="Confirm"
        confirmLoading={Boolean(statusModal && busy === `status-${statusModal}`)}
        okButtonProps={{ disabled: statusModal === "REOPENED" && !remark.trim() }}
        onOk={() => statusModal && doStatus(statusModal, remark.trim() || undefined)}
        onCancel={() => { setStatusModal(null); setRemark(""); }}
        destroyOnHidden
      >
        <Input.TextArea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)}
          placeholder={statusModal === "REOPENED" ? "Why is it being reopened? (required)" : "Remark (optional)"} />
      </Modal>

      <Modal
        open={Boolean(waiveFor)}
        title="Waive return-to-work clearance"
        okText="Waive"
        okButtonProps={{ danger: true, disabled: !remark.trim() }}
        confirmLoading={busy === `waive-${waiveFor}`}
        onOk={async () => {
          const emp = waiveFor!;
          const done = await run(`waive-${emp}`, () => decideSafetyClearance(ev.id, emp, actor!, "waived", remark.trim()), "Clearance waived");
          if (done) { setWaiveFor(null); setRemark(""); }
        }}
        onCancel={() => { setWaiveFor(null); setRemark(""); }}
        destroyOnHidden
      >
        <p>Director only. The reason is kept on the case record.</p>
        <Input.TextArea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Reason (required)" />
      </Modal>

      <EditModal ev={ev} open={editOpen} onClose={() => setEditOpen(false)} busy={busy === "edit"}
        canInvestigate={can("investigate")} peopleOptions={casePeopleOptions}
        onSave={async (patch) => {
          const done = await run("edit", () => updateSafetyEvent(ev.id, actor!, patch), "Saved");
          if (done) setEditOpen(false);
        }} />

      <PromoteModal open={promoteOpen} onClose={() => setPromoteOpen(false)} busy={busy === "promote"}
        onPromote={async (opts) => {
          if (!actor) return;
          setBusy("promote");
          try {
            const incident = await promoteNearMiss(ev.id, actor, opts);
            upsertSafetyEvent(incident);
            message.success("Escalated to incident");
            setPromoteOpen(false);
            router.push(`/safety/incidents/${incident.id}`);
          } catch (err) {
            message.error(err instanceof Error ? err.message : "Could not escalate");
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
      <Form.Item name="text" rules={[{ required: true, whitespace: true, message: "Describe the action" }]} style={{ marginBottom: 8 }}>
        <Input placeholder="e.g. Fix sign board and barricade at tank cap" maxLength={1000} />
      </Form.Item>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Form.Item name="ownerId" style={{ marginBottom: 0, minWidth: 180, flex: 1 }}>
          <Select allowClear showSearch optionFilterProp="label" placeholder="Owner" options={peopleOptions} />
        </Form.Item>
        <Form.Item name="dueDate" style={{ marginBottom: 0 }}>
          <DatePicker placeholder="Due" disabledDate={(d) => d.isBefore(dayjs().startOf("day"))} />
        </Form.Item>
        <Button htmlType="submit" icon={<PlusOutlined />} loading={busy}>Add</Button>
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
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setRows(ev.otEntries);
      setRestoredAt(ev.restoredAt ?? "");
    });
    return () => cancelAnimationFrame(id);
  }, [ev.otEntries, ev.restoredAt]);

  return (
    <Section title="Breakdown">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Equipment">{ev.equipment || "—"}</Descriptions.Item>
        <Descriptions.Item label="What broke">{ev.whatFailed || "—"}</Descriptions.Item>
        <Descriptions.Item label="Why not working">{ev.why || "—"}</Descriptions.Item>
        <Descriptions.Item label="How">{ev.how || "—"}</Descriptions.Item>
        <Descriptions.Item label="Failed at">{fmt(ev.failedAt)}</Descriptions.Item>
        <Descriptions.Item label="Restored at">{ev.restoredAt ? fmt(ev.restoredAt) : <StillDown />}</Descriptions.Item>
        <Descriptions.Item label="Downtime">{downtimeDays(ev.failedAt, ev.restoredAt ?? undefined)} days</Descriptions.Item>
        <Descriptions.Item label="OT to fix">{ot.people} people · {ot.hours} h</Descriptions.Item>
        <Descriptions.Item label="OT decisions">
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
      </Descriptions>
      {canEdit && !ev.restoredAt ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "8px 0" }}>
          <InputNumber min={1} max={12} value={otHours} onChange={(v) => setOtHours(Number(v) || 1)} suffix="h" />
          <Button
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
            Request repair OT (manager approves in OT → Decisions)
          </Button>
        </div>
      ) : null}
      {!canEdit ? (
        ev.otEntries.length ? <div style={{ fontSize: 12 }}>{ev.otEntries.map((e) => `${empName(e.employeeId)} ${e.hours}h`).join(" · ")}</div> : null
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <div>
            Restored at:{" "}
            <DatePicker showTime value={restoredAt ? dayjs(restoredAt) : null}
              disabledDate={(d) => d.isAfter(dayjs()) || (ev.failedAt ? d.isBefore(dayjs(ev.failedAt).startOf("day")) : false)}
              onChange={(d) => setRestoredAt(d ? d.toISOString() : "")} />
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Select style={{ minWidth: 180, flex: 1 }} showSearch optionFilterProp="label" options={peopleOptions} value={r.employeeId || undefined}
                placeholder="Employee" onChange={(v: string) => setRows(rows.map((x, j) => (j === i ? { ...x, employeeId: v } : x)))} />
              <InputNumber min={0.5} max={744} step={0.5} value={r.hours} suffix="h"
                onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, hours: Number(v) || 0 } : x)))} />
              <Button danger onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <Button icon={<PlusOutlined />} onClick={() => setRows([...rows, { employeeId: "", hours: 1 }])}>Add OT entry</Button>
            <Button type="primary" loading={busy}
              onClick={() => onSave({ restoredAt, otEntries: rows.filter((r) => r.employeeId && r.hours > 0) })}>
              Save
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
    <Modal open={open} title="Edit details" okText="Save" confirmLoading={busy} onCancel={onClose} onOk={() => form.submit()} destroyOnHidden>
      <Form form={form} layout="vertical" preserve={false}
        initialValues={{
          title: ev.title, description: ev.description, location: ev.location, rootCause: ev.rootCause,
          category: ev.category, categoryOther: ev.categoryOther, severity: ev.severity,
          equipment: ev.equipment, whatFailed: ev.whatFailed, why: ev.why, how: ev.how,
          involved: ev.involved, informedBy: ev.informedBy,
        }}
        onFinish={(v) => onSave(v)}>
        <Form.Item name="title" label="Title" rules={[{ required: true, whitespace: true }]}><Input maxLength={200} /></Form.Item>
        <Form.Item name="location" label="Location"><Input maxLength={200} /></Form.Item>
        <Form.Item name="description" label="Description"><Input.TextArea rows={3} maxLength={4000} /></Form.Item>
        {canInvestigate ? (
          <>
            <Form.Item name="rootCause" label="Root cause"><Input.TextArea rows={3} maxLength={4000} /></Form.Item>
            <div style={{ display: "flex", gap: 8 }}>
              <Form.Item name="category" label="Category" style={{ flex: 1 }}>
                <Select options={(Object.keys(SAFETY_CATEGORY_LABELS) as SafetyCategory[]).map((c) => ({ value: c, label: SAFETY_CATEGORY_LABELS[c] }))} />
              </Form.Item>
              <Form.Item name="severity" label="Severity" style={{ flex: 1 }}>
                <Select options={(Object.keys(SAFETY_SEVERITY_LABELS) as SafetySeverity[]).map((s) => ({ value: s, label: SAFETY_SEVERITY_LABELS[s] }))} />
              </Form.Item>
            </div>
            {category === "other" ? (
              <Form.Item name="categoryOther" label="Name the hazard" rules={[{ required: true, whitespace: true, message: "Say what the hazard was" }, { max: 120 }]}>
                <Input maxLength={120} placeholder="e.g. Slippery floor" />
              </Form.Item>
            ) : null}
            <Form.Item
              name="involved"
              label={ev.type === "breakdown" ? "People affected" : "People it happened to"}
              rules={ev.type === "breakdown" ? [] : [{ required: true, type: "array", min: 1, message: "Keep at least one person" }]}
            >
              <Select mode="multiple" showSearch optionFilterProp="label" options={peopleOptions} placeholder="Search names" />
            </Form.Item>
            <Form.Item name="informedBy" label={ev.type === "breakdown" ? "Informed by" : "People who saw it or informed"}>
              <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={peopleOptions} placeholder="Search names (optional)" />
            </Form.Item>
          </>
        ) : null}
        {ev.type === "breakdown" ? (
          <>
            <Form.Item name="equipment" label="Equipment"><Input maxLength={200} /></Form.Item>
            <Form.Item name="whatFailed" label="What broke"><Input maxLength={1000} /></Form.Item>
            <Form.Item name="why" label="Why not working"><Input.TextArea rows={2} maxLength={2000} /></Form.Item>
            <Form.Item name="how" label="How"><Input.TextArea rows={2} maxLength={2000} /></Form.Item>
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
    <Modal open={open} title="Escalate near-miss to incident" okText="Escalate" okButtonProps={{ danger: true }} confirmLoading={busy}
      onCancel={onClose} onOk={() => form.submit()} destroyOnHidden>
      <Form form={form} layout="vertical" preserve={false} initialValues={{ category: "first_aid", severity: "medium" }} onFinish={(v) => onPromote(v)}>
        <Form.Item name="category" label="Incident category" rules={[{ required: true }]}>
          <Select options={(Object.keys(SAFETY_CATEGORY_LABELS) as SafetyCategory[]).map((c) => ({ value: c, label: SAFETY_CATEGORY_LABELS[c] }))} />
        </Form.Item>
        {category === "other" ? (
          <Form.Item name="categoryOther" label="Name the hazard" rules={[{ required: true, whitespace: true, message: "Say what the hazard was" }, { max: 120 }]}>
            <Input maxLength={120} />
          </Form.Item>
        ) : null}
        <Form.Item name="severity" label="Severity" rules={[{ required: true }]}>
          <Select options={(Object.keys(SAFETY_SEVERITY_LABELS) as SafetySeverity[]).map((s) => ({ value: s, label: SAFETY_SEVERITY_LABELS[s] }))} />
        </Form.Item>
        <Form.Item name="remark" label="Why escalate?"><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
      </Form>
    </Modal>
  );
}
