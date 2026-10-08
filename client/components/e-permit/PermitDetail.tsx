"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert, App, Button, Collapse, Input, InputNumber, Modal, Radio, Segmented, Select, Spin, Steps, Table, Timeline, theme } from "antd";
import {
  ArrowLeftOutlined,
  CheckOutlined,
  DownloadOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  APPROVAL_KIND_LABELS,
  CERTIFICATE_TYPES,
  EPERMIT_POLICY,
  EPERMIT_STATUS_LABELS,
  FIRE_GAS_ITEMS,
  GAS_LIMITS,
  LIVE_STATUSES,
  PERMIT_RULES,
  PPE_ITEMS,
  RETURN_OUTCOME_LABELS,
  SAFETY_MEASURES,
  TERMINAL_STATUSES,
  canActAsAuthoriser,
  canDecideApproval,
  canManageAsIssuer,
  canOverrideSoftBlocks,
  canRaisePermitOt,
  canSuspend,
  canSuspendSite,
  isOverdue,
  renewalBlocker,
  renewalRef,
  renewalWindow,
  requiresFireGas,
  type ApprovalKind,
  type ChecklistAnswer,
  type ReturnOutcome,
} from "@/lib/e-permit/rules";
import type { EPermit, EPermitApproval } from "@/lib/e-permit/types";
import {
  SoftBlockError,
  acceptEPermitReturn,
  acknowledgeEPermit,
  cancelEPermit,
  declareEPermitSiteSafe,
  decideEPermitApproval,
  decideEPermitRenewal,
  getEPermit,
  linkEPermitOt,
  postReviewEPermit,
  requestEPermitRenewal,
  resumeEPermit,
  returnEPermit,
  reviseEPermit,
  submitEPermit,
  suspendEPermit,
  suspendSitePermits,
} from "@/lib/api/e-permits";
import { getCachedEPermit, upsertEPermit } from "@/lib/e-permit/store";
import { pendingAcks } from "@/lib/e-permit/views";
import { useEPermitMasters, useNow, usePermitViewer } from "@/lib/e-permit/hooks";
import { downloadPermitPdf } from "@/lib/e-permit/permit-pdf";
import { useDirectory } from "@/lib/safety/hooks";
import { ePermitActorOf, roleLabel } from "@/lib/rbac";
import { getSession, type UserRole } from "@/lib/auth";
import { createEPermitOtDecision } from "@/lib/ot-decision";
import { Dot, Facts, Panel, Person, Prose, Quiet, Section } from "@/components/quiet";
import {
  CategoryText,
  GasReadingsInput,
  PermitStatusTag,
  ValidityClock,
  fmtShort,
  fmtTimeDayDate,
  gasDraftToReadings,
  type GasDraft,
} from "./PermitBits";
import { useTableMotion } from "@/lib/motion/use-table-motion";
import { tr, trData } from "@/lib/i18n";

type ModalKind =
  | { kind: "decide"; approval: EPermitApproval; decision: "approve" | "reject"; review?: boolean }
  | { kind: "renewal" }
  | { kind: "renewalDecide"; decision: "approve" | "reject" }
  | { kind: "suspend" }
  | { kind: "suspendSite" }
  | { kind: "resume" }
  | { kind: "return" }
  | { kind: "acceptReturn"; decision: "accept" | "send_back" }
  | { kind: "cancel" }
  | { kind: "ot" }
  | { kind: "override"; blocks: string[]; canOverride: boolean };

type DetailTab = "overview" | "safety" | "closeout" | "audit";

/** Best-effort location stamp for acknowledgements (never blocks the click). */
function currentCoords(): Promise<{ lat: number; lng: number } | undefined> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(undefined), 3000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(t);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(t);
        resolve(undefined);
      },
      { timeout: 3000, maximumAge: 300_000 },
    );
  });
}

export default function PermitDetail({ id }: { id: string }) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const masters = useEPermitMasters();
  const viewer = usePermitViewer(masters);
  const dir = useDirectory();
  const now = useNow();
  const [p, setP] = useState<EPermit | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [text, setText] = useState("");
  const [gas, setGas] = useState<GasDraft>({});
  const [outcome, setOutcome] = useState<ReturnOutcome>("complete");
  const [newIssuerId, setNewIssuerId] = useState<string | undefined>();
  const [newHolderId, setNewHolderId] = useState<string | undefined>();
  const [otHours, setOtHours] = useState<number | null>(2);
  const [tab, setTab] = useState<DetailTab>("overview");
  const { pageRef } = useTableMotion(p ? "ready" : "");

  const actor = useMemo(() => (viewer ? ePermitActorOf(getSession()) : null), [viewer]);

  useEffect(() => {
    let alive = true;
    const cached = getCachedEPermit(id);
    const raf = requestAnimationFrame(() => alive && cached && setP(cached));
    const me = ePermitActorOf(getSession());
    if (me) {
      getEPermit(id, me)
        .then((fresh) => {
          if (!alive) return;
          upsertEPermit(fresh);
          setP(fresh);
          setLoadError(null);
        })
        .catch((err: Error) => alive && setLoadError(err.message));
    }
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [id]);

  if (loadError && !p) {
    return (
      <Alert
        type="error"
        showIcon
        title={tr("Could not open this permit")}
        description={
          <>
            {trData(loadError)} · <Link href="/e-permits">{tr("Back to permits")}</Link>
          </>
        }
      />
    );
  }
  if (!p || viewer === undefined) return <div style={{ padding: 48, textAlign: "center" }}><Spin /></div>;

  const muted = { color: token.colorTextSecondary };
  const overdue = isOverdue(p, now);
  const terminal = TERMINAL_STATUSES.includes(p.status);
  const live = LIVE_STATUSES.includes(p.status);
  const asIssuer = canManageAsIssuer(viewer, p);
  const asAuthoriser = canActAsAuthoriser(viewer, p);
  const hot = requiresFireGas(p.category);
  const acksDue = pendingAcks(p);
  const myAck = acksDue.find((a) => a.personId === viewer?.id);
  const onDevice = viewer && (viewer.id === p.issuerId || viewer.id === p.holderId);
  const pendingRenewal = p.renewals.find((r) => r.status === "pending");
  const renewBlock = renewalBlocker(p);
  const nextWindow = !renewBlock && p.validTo && p.firstValidFrom ? renewalWindow(p) : null;
  const name = (personId?: string) => (personId ? trData(dir.empName(personId)) : "—");
  const deptName = (deptId?: string) => trData(masters.deptName(deptId));
  const contacts = masters.contacts.filter((c) => c.siteId === p.siteId);
  const siteWorkers = dir.employees.filter((e) => e.siteId === p.siteId && e.employmentStatus !== "inactive");
  const issuerCandidates = siteWorkers.filter((e) => ["supervisor", "shift_incharge", "manager"].includes(e.employeeCategory ?? ""));

  const run = async (key: string, fn: () => Promise<EPermit>, done?: string) => {
    setBusy(key);
    try {
      const next = await fn();
      upsertEPermit(next);
      setP(next);
      setModal(null);
      setText("");
      setGas({});
      if (done) message.success(done);
    } catch (err) {
      if (err instanceof SoftBlockError) setModal({ kind: "override", blocks: err.softBlocks, canOverride: err.canOverride });
      else message.error(trData((err as Error).message));
    } finally {
      setBusy(null);
    }
  };

  const ack = (personId: string) =>
    run(`ack-${personId}`, async () => acknowledgeEPermit(p.id, actor!, personId, await currentCoords()), tr("Acknowledged"));

  // ── Action bar ───────────────────────────────────────────────────────────
  const actions: React.ReactNode[] = [];
  if (myAck) {
    actions.push(
      <Button key="ack" type="primary" icon={<CheckOutlined />} loading={busy === `ack-${viewer!.id}`} onClick={() => ack(myAck.personId)}>
        {myAck.context === "renewal" ? tr("Acknowledge renewal") : tr("Acknowledge")}
      </Button>,
    );
  }
  if (asIssuer && viewer?.id === p.issuerId && p.status === "DRAFT") {
    actions.push(
      <Link key="edit" href={`/e-permits/new?draft=${p.id}`}><Button icon={<EditOutlined />}>{tr("Edit draft")}</Button></Link>,
      <Button key="submit" type="primary" loading={busy === "submit"} onClick={() => run("submit", () => submitEPermit(p.id, actor!), tr("Submitted for approval"))}>
        {tr("Acknowledge & submit")}
      </Button>,
    );
  }
  if (asIssuer && p.status === "REJECTED") {
    actions.push(<Button key="revise" type="primary" loading={busy === "revise"} onClick={() => run("revise", () => reviseEPermit(p.id, actor!), tr("Back to draft"))}>{tr("Revise")}</Button>);
  }
  if (asIssuer && p.status === "ACTIVE") {
    if (!renewBlock) actions.push(<Button key="renew" onClick={() => setModal({ kind: "renewal" })}>{tr("Request renewal (next shift)")}</Button>);
    else if (overdue || p.renewalCount >= EPERMIT_POLICY.maxRenewals) {
      actions.push(<Link key="continue" href={`/e-permits/new?from=${p.id}`}><Button>{tr("Continue in a new permit")}</Button></Link>);
    }
  }
  if (onDevice && (live || p.status === "SUSPENDED") && !p.returnInfo?.holderAt) {
    actions.push(
      <Button key="safe" loading={busy === "safe"} onClick={() => run("safe", () => declareEPermitSiteSafe(p.id, actor!), tr("Site declared safe"))}>
        {viewer!.id === p.holderId ? tr("Declare site safe") : tr("Holder declares site safe (in person)")}
      </Button>,
    );
  }
  if (asIssuer && (live || p.status === "SUSPENDED") && p.returnInfo?.holderAt) {
    actions.push(<Button key="return" type="primary" onClick={() => setModal({ kind: "return" })}>{tr("Return permit")}</Button>);
  }
  if (p.status === "RENEWAL_PENDING" && asAuthoriser) {
    actions.push(
      <Button key="rok" type="primary" onClick={() => setModal({ kind: "renewalDecide", decision: "approve" })}>{tr("Approve renewal")}</Button>,
      <Button key="rno" danger onClick={() => setModal({ kind: "renewalDecide", decision: "reject" })}>{tr("Reject renewal")}</Button>,
    );
  }
  if (p.status === "RETURN_PENDING" && asAuthoriser) {
    actions.push(
      <Button key="accept" type="primary" onClick={() => setModal({ kind: "acceptReturn", decision: "accept" })}>{tr("Accept return")}</Button>,
      <Button key="back" onClick={() => setModal({ kind: "acceptReturn", decision: "send_back" })}>{tr("Send back")}</Button>,
    );
  }
  if (p.status === "SUSPENDED" && asAuthoriser) {
    actions.push(<Button key="resume" type="primary" icon={<PlayCircleOutlined />} onClick={() => setModal({ kind: "resume" })}>{tr("Re-validate & resume")}</Button>);
  }
  if (live && canSuspend(viewer, p)) {
    actions.push(<Button key="suspend" danger icon={<PauseCircleOutlined />} onClick={() => setModal({ kind: "suspend" })}>{tr("Suspend work")}</Button>);
  }
  if ((live || p.status === "RETURN_PENDING" || terminal) && canRaisePermitOt(viewer, p) && p.status !== "CANCELLED") {
    actions.push(<Button key="ot" onClick={() => { setOtHours(2); setModal({ kind: "ot" }); }}>{tr("Raise OT for extra hours")}</Button>);
  }
  const canCancel =
    !terminal &&
    (["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(p.status) ? asIssuer : canOverrideSoftBlocks(viewer, p.siteId));
  if (canCancel) actions.push(<Button key="cancel" danger icon={<StopOutlined />} onClick={() => setModal({ kind: "cancel" })}>{tr("Cancel permit")}</Button>);
  actions.push(
    <Button key="pdf" icon={<DownloadOutlined />} onClick={() => downloadPermitPdf(p, { empName: dir.empName, siteName: dir.siteName, deptName: masters.deptName, contacts })}>
      {tr("PDF")}
    </Button>,
  );

  // ── Approvals table ──────────────────────────────────────────────────────
  const approvalRows = (rows: EPermitApproval[], review: boolean) =>
    rows.map((a, i) => {
      const mine = !terminal && a.status === "pending" && (review || p.status === "PENDING_APPROVAL") && canDecideApproval(viewer, a, p);
      return {
        key: `${a.kind}-${a.departmentId ?? i}`,
        who: `${tr(APPROVAL_KIND_LABELS[a.kind as ApprovalKind])}${a.departmentId ? ` — ${deptName(a.departmentId)}` : ""}`,
        status: a.status,
        waitingOn: a.status === "pending" ? approverNames(a) : "",
        by: a.decidedByName ? `${trData(a.decidedByName)}${a.onBehalfOf ? ` ${tr("(for {name})", { name: trData(a.onBehalfOf) })}` : ""}` : "",
        at: a.at,
        remark: a.remark,
        approval: a,
        mine,
      };
    });

  /** Who can decide a pending approval, by name — so the user knows whom to chase. */
  const approverNames = (a: EPermitApproval): string => {
    if (a.kind === "authoriser" || a.kind === "department") {
      const d = masters.departments.find((x) => x.id === a.departmentId);
      if (!d) return "";
      const away = d.headUnavailableUntil && Date.parse(d.headUnavailableUntil) > now;
      const head = `${trData(d.headName)} (${tr("HOD")}${away ? `, ${tr("away")}` : ""})`;
      const deputies = d.deputyNames.map((n) => `${trData(n)} (${tr("Deputy")})`);
      return [head, ...deputies].join(` ${tr("or")} `);
    }
    if (a.kind === "emergency") {
      const managers = dir.employees.filter((e) => e.siteId === p.siteId && e.employeeCategory === "manager");
      return managers.length
        ? managers.map((e) => `${trData(e.name)} (${tr("Plant Manager")})`).join(` ${tr("or")} `)
        : tr("Plant Manager");
    }
    if (a.kind === "safety") return tr("Safety In-Charge");
    return "";
  };

  const statusColor = (s: string) => (s === "approved" ? token.colorSuccess : s === "rejected" ? token.colorError : token.colorWarning);
  const approvalTable = (rows: EPermitApproval[], review: boolean) => (
    <div data-approvals={review ? "review" : "issue"}>
      {approvalRows(rows, review).map((r, i) => (
        <div
          key={r.key}
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? `1px solid ${token.colorSplit}` : undefined, fontSize: 13 }}
        >
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <Dot
              color={statusColor(r.status)}
              label={<span style={{ fontWeight: 500 }}>{r.who}</span>}
            />
            <div style={{ paddingLeft: 14, fontSize: 12, ...muted }}>
              {r.status === "approved" ? (review ? tr("Reviewed OK") : tr("Approved")) : r.status === "rejected" ? (review ? tr("Concern raised") : tr("Rejected")) : tr("Pending")}
              {r.by ? ` · ${r.by} · ${fmtTimeDayDate(r.at)}` : ""}
            </div>
            {r.waitingOn ? (
              <div style={{ paddingLeft: 14, marginTop: 2, fontSize: 12.5 }}>
                <span style={muted}>{tr("Waiting for")} </span>
                <span style={{ fontWeight: 500 }}>{r.waitingOn}</span>
              </div>
            ) : null}
            {r.remark ? <div style={{ paddingLeft: 14, marginTop: 2 }}>{trData(r.remark)}</div> : null}
          </div>
          {r.mine ? (
            <div style={{ display: "flex", gap: 6 }}>
              <Button size="small" type="primary" onClick={() => setModal({ kind: "decide", approval: r.approval, decision: "approve", review })}>
                {review ? tr("Reviewed OK") : tr("Approve")}
              </Button>
              <Button size="small" danger onClick={() => setModal({ kind: "decide", approval: r.approval, decision: "reject", review })}>
                {review ? tr("Raise concern") : tr("Reject")}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );

  // ── Acknowledgements ─────────────────────────────────────────────────────
  // One row per person (acks are per person); someone who is both issuer and holder gets both roles.
  const rolesById = new Map<string, string[]>();
  for (const [id, role] of [
    [p.issuerId, tr("Issuer")],
    [p.holderId, tr("Permit Holder")],
    ...p.workerIds.filter((w) => w !== p.holderId && w !== p.issuerId).map((w) => [w, tr("Worker")]),
  ]) {
    rolesById.set(id, [...(rolesById.get(id) ?? []), role]);
  }
  const people = [...rolesById].map(([id, roles]) => ({ id, role: roles.join(" · ") }));
  const ackOf = (personId: string, context: "issue" | "renewal", round: number) =>
    p.acks.find((a) => a.personId === personId && a.context === context && a.round === round);

  const modalTitle: Record<ModalKind["kind"], string> = {
    decide: modal?.kind === "decide" ? (modal.review ? (modal.decision === "approve" ? tr("Mark reviewed") : tr("Raise a concern")) : modal.decision === "approve" ? tr("Approve") : tr("Reject permit")) : "",
    renewal: tr("Request renewal into the next shift"),
    renewalDecide: modal?.kind === "renewalDecide" && modal.decision === "reject" ? tr("Reject renewal") : tr("Approve renewal"),
    suspend: tr("Suspend work on this permit"),
    suspendSite: tr("Stop all permitted work at this plant"),
    resume: tr("Re-validate and resume"),
    return: tr("Return the permit"),
    acceptReturn: modal?.kind === "acceptReturn" && modal.decision === "send_back" ? tr("Send the return back") : tr("Accept the return"),
    cancel: tr("Cancel permit"),
    ot: tr("Raise OT for extra hours"),
    override: tr("This permit is soft-blocked"),
  };

  const needsText =
    modal &&
    ((modal.kind === "decide" && modal.decision === "reject") ||
      (modal.kind === "renewalDecide" && modal.decision === "reject") ||
      modal.kind === "suspend" ||
      modal.kind === "suspendSite" ||
      modal.kind === "cancel" ||
      (modal.kind === "acceptReturn" && modal.decision === "send_back") ||
      (modal.kind === "return" && outcome !== "complete") ||
      (modal.kind === "override" && modal.canOverride));
  const needsGas = modal && hot && (modal.kind === "renewal" || modal.kind === "resume");
  const gasMissing = needsGas && typeof gas.oxygen !== "number";

  const onOk = () => {
    if (!modal || !actor) return;
    const t = text.trim();
    switch (modal.kind) {
      case "decide":
        return run(
          "decide",
          () =>
            modal.review
              ? postReviewEPermit(p.id, actor, { kind: modal.approval.kind, departmentId: modal.approval.departmentId }, modal.decision, t || undefined)
              : decideEPermitApproval(p.id, actor, { kind: modal.approval.kind, departmentId: modal.approval.departmentId }, modal.decision, t || undefined),
          modal.decision === "approve" ? tr("Approved") : tr("Recorded"),
        );
      case "renewal":
        return run(
          "renewal",
          () => requestEPermitRenewal(p.id, actor, { newIssuerId, newHolderId, gasReadings: hot ? gasDraftToReadings(gas) : undefined, remark: t || undefined }),
          tr("Renewal requested"),
        );
      case "renewalDecide":
        return run("renewalDecide", () => decideEPermitRenewal(p.id, actor, modal.decision, t || undefined), modal.decision === "approve" ? tr("Renewal approved") : tr("Renewal rejected"));
      case "suspend":
        return run("suspend", () => suspendEPermit(p.id, actor, t), tr("Work suspended"));
      case "suspendSite":
        setBusy("suspendSite");
        return suspendSitePermits(p.siteId, actor, t)
          .then(async (r) => {
            message.warning(tr("{n} permits suspended", { n: r.suspended.length }));
            const fresh = await getEPermit(p.id, actor);
            upsertEPermit(fresh);
            setP(fresh);
            setModal(null);
            setText("");
          })
          .catch((err: Error) => message.error(trData(err.message)))
          .finally(() => setBusy(null));
      case "resume":
        return run("resume", () => resumeEPermit(p.id, actor, hot ? gasDraftToReadings(gas) : undefined, t || undefined), tr("Work may resume"));
      case "return":
        return run("return", () => returnEPermit(p.id, actor, outcome, t || undefined), tr("Returned to the Authoriser"));
      case "acceptReturn":
        return run("acceptReturn", () => acceptEPermitReturn(p.id, actor, modal.decision, t || undefined), modal.decision === "accept" ? tr("Permit closed") : tr("Sent back"));
      case "cancel":
        return run("cancel", () => cancelEPermit(p.id, actor, t), tr("Permit cancelled"));
      case "ot": {
        const hours = otHours ?? 0;
        if (hours <= 0) return;
        const decision = createEPermitOtDecision({
          siteId: p.siteId,
          date: new Date().toISOString().slice(0, 10),
          hours,
          ePermitId: p.id,
          permitNo: p.permitNo,
          workTitle: p.description.slice(0, 80),
        });
        return run("ot", () => linkEPermitOt(p.id, actor, decision.id, t || undefined), tr("OT decision {id} raised — approve it in OverTime → Decisions", { id: decision.id }));
      }
      case "override":
        if (!modal.canOverride) {
          setModal(null);
          return;
        }
        return run("submit", () => submitEPermit(p.id, actor, { remark: t }), tr("Submitted for approval"));
    }
  };

  // ── Where the permit is in its life, and who it is waiting for ──────────
  const approvalsDone = p.approvals.length > 0 && p.approvals.every((a) => a.status === "approved");
  const stage =
    p.status === "DRAFT" ? 0
    : p.status === "PENDING_APPROVAL" || p.status === "REJECTED" ? (approvalsDone ? 2 : 1)
    : p.status === "RETURN_PENDING" ? 4
    : p.status === "COMPLETED" || p.status === "RETURNED_INCOMPLETE" ? 5
    : p.status === "CANCELLED" ? Math.max(0, p.firstValidFrom ? 3 : p.approvals.length ? 1 : 0)
    : 3;
  const stageStatus: "error" | "process" | "finish" =
    p.status === "REJECTED" || p.status === "CANCELLED" || p.status === "SUSPENDED" || overdue ? "error" : stage === 5 ? "finish" : "process";
  const pendingApprovals = p.approvals.filter((a) => a.status === "pending");
  const waitingFor: string[] = [];
  if (p.status === "PENDING_APPROVAL" || p.status === "RENEWAL_PENDING") {
    if (p.status === "PENDING_APPROVAL") {
      pendingApprovals.forEach((a) => waitingFor.push(`${tr(APPROVAL_KIND_LABELS[a.kind as ApprovalKind])}${a.departmentId ? ` — ${deptName(a.departmentId)}` : ""}`));
    } else if (pendingRenewal?.status === "pending") {
      waitingFor.push(tr("Authoriser — renewal"));
    }
    acksDue.forEach((a) => waitingFor.push(tr("{name} to acknowledge", { name: name(a.personId) })));
  }
  if (p.status === "RETURN_PENDING") waitingFor.push(tr("Authoriser to accept the return"));
  if ((live || p.status === "SUSPENDED") && p.returnInfo?.holderAt && !p.returnInfo.issuerAt) waitingFor.push(tr("Issuer to return the permit"));

  const card = { border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, background: token.colorBgContainer } as const;
  const primaryActions = actions.filter((a) => (a as React.ReactElement<{ type?: string }>)?.props?.type === "primary");
  const otherActions = actions.filter((a) => !primaryActions.includes(a));

  const fact = (label: string, value: React.ReactNode) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, ...muted }}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 2, wordBreak: "break-word" }}>{value}</div>
    </div>
  );

  const checklistGroups: { title: string; defs: { key: string; label: string }[]; value: typeof p.ppe; withRef?: boolean; note?: string }[] = [
    { title: tr("B1 — safety measures taken"), defs: SAFETY_MEASURES, value: p.safetyMeasures },
    { title: tr("B3A — PPE & others"), defs: [...PPE_ITEMS, ...p.customPpe.map((c) => ({ key: c.key, label: c.label ?? c.key }))], value: [...p.ppe, ...p.customPpe] },
    { title: tr("B3B — fire precautions & gas tests"), defs: FIRE_GAS_ITEMS, value: p.fireGas, note: hot ? tr("required for hot work") : undefined },
    { title: tr("B3C — associated certificates"), defs: CERTIFICATE_TYPES, value: p.certificates, withRef: true },
  ];
  const allAnswers = checklistGroups.flatMap((g) => g.defs.map((d) => g.value.find((a) => a.key === d.key)?.value ?? ""));
  const yesCount = allAnswers.filter((v) => v === "yes").length;
  const naCount = allAnswers.filter((v) => v === "na").length;

  const tabs: { value: DetailTab; label: string }[] = [
    { value: "overview", label: tr("Overview") },
    { value: "safety", label: tr("Safety checklist") },
    { value: "closeout", label: tr("Return & renewals") },
    { value: "audit", label: tr("Audit trail ({n})", { n: p.timeline.length }) },
  ];

  return (
    <div ref={pageRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Link data-anim="intro" href="/e-permits" style={{ fontSize: 13, width: "fit-content" }}>
        <ArrowLeftOutlined /> {tr("Permits")}
      </Link>

      {/* ── Header card ── */}
      <div data-anim="intro" style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{p.permitNo}</h2>
              <PermitStatusTag permit={p} now={now} />
              {p.emergency ? <span style={{ fontSize: 12, fontWeight: 600, color: token.colorError }}>{tr("Emergency")}</span> : null}
            </div>
            <p style={{ margin: "8px 0 4px", fontSize: 15, lineHeight: 1.45 }}>{trData(p.description)}</p>
            <div style={{ fontSize: 13, ...muted }}>
              <CategoryText permit={p} /> · {trData(p.locationName)} · {trData(dir.siteName(p.siteId))}
              {p.parentPermitId ? <> · <Link href={`/e-permits/${p.parentPermitId}`}>{tr("Continues an earlier permit")}</Link></> : null}
              {p.safetyEventId ? <> · <Link href={`/safety/breakdowns/${p.safetyEventId}`}>{tr("Breakdown {id}", { id: p.safetyEventId })}</Link></> : null}
            </div>
          </div>
          <div style={{ textAlign: "right", flex: "0 0 auto" }}>
            <div style={{ fontSize: 12, ...muted }}>{tr("Shift {code}", { code: p.shiftCode })} · {fmtShort(p.windowStart)} → {fmtShort(p.windowEnd)}</div>
            <div style={{ fontSize: 18, marginTop: 4 }}>
              {p.validTo ? <ValidityClock permit={p} now={now} /> : <span style={{ fontSize: 14, ...muted }}>{tr("Not active yet")}</span>}
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${token.colorSplit}`, overflowX: "auto" }}>
          <Steps
            size="small"
            responsive={false}
            current={stage}
            status={stageStatus}
            style={{ minWidth: 640 }}
            items={[
              { title: tr("Drafted") },
              { title: tr("Approval") },
              { title: tr("Acknowledge") },
              { title: p.status === "SUSPENDED" ? tr("Suspended") : tr("Work") },
              { title: tr("Return") },
              { title: p.status === "CANCELLED" ? tr("Cancelled") : tr("Closed") },
            ]}
          />
        </div>

        {waitingFor.length || actions.length ? (
          <div
            style={{
              padding: "12px 20px",
              borderTop: `1px solid ${token.colorSplit}`,
              background: token.colorFillQuaternary,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 13, minWidth: 0, flex: "1 1 280px" }}>
              {waitingFor.length ? (
                <>
                  <span style={muted}>{tr("Waiting for")}: </span>
                  {waitingFor.join(" · ")}
                </>
              ) : terminal ? (
                <span style={muted}>{tr("This permit is closed.")}</span>
              ) : null}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {otherActions}
              {primaryActions}
            </div>
          </div>
        ) : null}
      </div>

      {overdue ? (
        <Alert
          data-anim="intro"
          type="error"
          showIcon
          icon={<WarningOutlined />}
          title={tr("Overdue — the shift ended {time}", { time: fmtShort(p.validTo) })}
          description={tr("The permit is not closed automatically. Return it, request a renewal, or raise OT for the extra hours.")}
        />
      ) : null}
      {p.status === "SUSPENDED" && p.suspension ? (
        <Alert
          data-anim="intro"
          type="error"
          showIcon
          title={tr("Work suspended by {name}", { name: trData(p.suspension.byName) })}
          description={`${trData(p.suspension.reason)} · ${fmtTimeDayDate(p.suspension.at)} · ${tr("Only the Authoriser can re-validate it.")}`}
        />
      ) : null}
      {p.status === "REJECTED" ? (
        <Alert data-anim="intro" type="warning" showIcon title={tr("Rejected")} description={trData(p.approvals.find((a) => a.status === "rejected")?.remark ?? "")} />
      ) : null}

      <style>{`.epermit-detail-two{display:grid;gap:16px;grid-template-columns:minmax(0,1fr);align-items:start}
@media (min-width:900px){.epermit-detail-two{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.epermit-checklists{column-width:300px;column-gap:16px}
.epermit-checklists>*{break-inside:avoid;margin-bottom:16px}
.epermit-checklists>*:last-child{margin-bottom:0}`}</style>
      <div data-anim="intro" className="safety-case-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={{ overflowX: "auto", margin: "0 -2px", padding: "0 2px" }}>
            <Segmented<DetailTab> value={tab} onChange={setTab} options={tabs} />
          </div>

          {tab === "overview" ? (
            <>
              <Section title={tr("Part A — the work")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 16 }}>
                  {fact(tr("Location"), trData(p.locationName))}
                  {fact(tr("Work"), <CategoryText permit={p} wrap />)}
                  {fact(tr("Authoriser"), tr("{dept} HoD", { dept: deptName(p.authoriserDepartmentId) }))}
                  {fact(tr("JSA ref."), p.jsaRef || "—")}
                  {fact(tr("Shift"), `${p.shiftCode} · ${fmtShort(p.windowStart)} → ${fmtShort(p.windowEnd)}`)}
                  {fact(tr("Planned"), p.plannedFrom ? `${fmtShort(p.plannedFrom)} → ${fmtShort(p.plannedTo)}` : "—")}
                  {fact(tr("Valid"), p.validFrom ? `${fmtTimeDayDate(p.validFrom)} → ${fmtTimeDayDate(p.validTo)}` : tr("Not active yet"))}
                  {fact(tr("Policy"), tr("Policy v{v}", { v: p.policyVersion }))}
                </div>
              </Section>

              <Section title={tr("Part C — approvals & acknowledgements")} flush>
                {p.approvals.length ? approvalTable(p.approvals, false) : <div style={{ padding: 16 }}><Quiet>{tr("Not submitted yet.")}</Quiet></div>}
                {p.emergency && p.postReviews.length ? (
                  <>
                    <div style={{ padding: "10px 16px", borderTop: `1px solid ${token.colorSplit}`, fontSize: 12, fontWeight: 600, ...muted }}>
                      {tr("Emergency post-reviews (within {h} h)", { h: EPERMIT_POLICY.emergency.postReviewWithinHours })}
                    </div>
                    {approvalTable(p.postReviews, true)}
                  </>
                ) : null}
                <div style={{ padding: "10px 16px", borderTop: `1px solid ${token.colorSplit}`, fontSize: 12, fontWeight: 600, ...muted }}>{tr("Acknowledgements")}</div>
                {people.map((person) => (
                  <div
                    key={person.id}
                    style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: `1px solid ${token.colorSplit}` }}
                  >
                    <Person name={dir.empName(person.id)} sub={person.role} />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", fontSize: 12 }}>
                      {[0, ...p.renewals.map((r) => r.n)].map((round) => {
                        const a = ackOf(person.id, round === 0 ? "issue" : "renewal", round);
                        const label = round === 0 ? "" : `R${round} `;
                        if (a) {
                          return (
                            <span key={round} style={{ color: token.colorSuccess, whiteSpace: "nowrap" }}>
                              <CheckOutlined /> {label}{fmtShort(a.at)}
                              {a.via !== "self" ? <span style={muted}> · {a.via === "holder" ? tr("holder's device") : tr("issuer's device")}</span> : null}
                            </span>
                          );
                        }
                        const due = acksDue.find((x) => x.personId === person.id && x.round === round);
                        if (due && onDevice && person.id !== viewer?.id) {
                          return (
                            <Button key={round} size="small" loading={busy === `ack-${person.id}`} onClick={() => ack(person.id)}>
                              {label}{tr("Record in person")}
                            </Button>
                          );
                        }
                        return <span key={round} style={muted}>{label}{due ? tr("Waiting") : "—"}</span>;
                      })}
                    </div>
                  </div>
                ))}
              </Section>
            </>
          ) : null}

          {tab === "safety" ? (
            <>
              <Panel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                  {[
                    [String(yesCount), tr("Confirmed")],
                    [String(naCount), tr("Not applicable")],
                    [String(p.gasReadings.length), tr("Gas readings")],
                  ].map(([v, l]) => (
                    <div key={l} style={{ padding: "12px 16px", borderRight: `1px solid ${token.colorSplit}`, marginRight: -1 }}>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>{v}</div>
                      <div style={{ fontSize: 12, ...muted }}>{l}</div>
                    </div>
                  ))}
                </div>
              </Panel>
              {/* Masonry: cards of uneven length stack in columns with no empty gaps */}
              <div className="epermit-checklists">
                {checklistGroups.map((g) => (
                  <div key={g.title}>
                    <ChecklistCard title={g.title} note={g.note} defs={g.defs} value={g.value} withRef={g.withRef} />
                  </div>
                ))}
                <div>
                  <Section title={tr("B2 — potential hazards & special precautions")}>
                    <Prose text={p.hazardsText} empty={tr("None recorded.")} />
                  </Section>
                </div>
              </div>
              {p.gasReadings.length ? (
                <Section title={tr("Gas readings")} flush>
                  <Table
                    size="small"
                    pagination={false}
                    rowKey={(r) => `${r.gas}-${r.round}-${r.at}`}
                    dataSource={p.gasReadings}
                    scroll={{ x: "max-content" }}
                    columns={[
                      { title: tr("Gas"), key: "gas", render: (_, r) => tr(GAS_LIMITS[r.gas].label) },
                      { title: tr("Reading"), key: "v", render: (_, r) => <span style={{ color: r.ok ? token.colorText : token.colorError }}>{`${r.value} ${r.unit}`}</span> },
                      { title: tr("Safe"), key: "safe", render: (_, r) => GAS_LIMITS[r.gas].safe },
                      { title: tr("When"), key: "round", render: (_, r) => (r.round === 0 ? tr("At issue") : r.round === -1 ? tr("Before resuming") : tr("Renewal {n}", { n: r.round })) },
                      { title: tr("By"), key: "by", render: (_, r) => <span style={{ fontSize: 12 }}>{trData(r.byName)} · {fmtShort(r.at)}</span> },
                    ]}
                  />
                </Section>
              ) : null}
            </>
          ) : null}

          {tab === "closeout" ? (
            <div className="epermit-detail-two">
              <Section title={tr("Part D — return")}>
                {p.returnInfo || p.completedAt ? (
                  <Facts
                    rows={[
                      [tr("Outcome"), p.returnInfo ? tr(RETURN_OUTCOME_LABELS[p.returnInfo.outcome]) : tr(EPERMIT_STATUS_LABELS[p.status])],
                      [tr("1. Holder — site safe"), p.returnInfo?.holderAt ? `${trData(p.returnInfo.holderName ?? "")} · ${fmtTimeDayDate(p.returnInfo.holderAt)}` : "—"],
                      [tr("2. Issuer returned"), p.returnInfo?.issuerAt ? `${trData(p.returnInfo.issuerName ?? "")} · ${fmtTimeDayDate(p.returnInfo.issuerAt)}` : "—"],
                      [tr("3. Authoriser accepted"), p.returnInfo?.authoriserAt ? `${trData(p.returnInfo.authoriserName ?? "")} · ${fmtTimeDayDate(p.returnInfo.authoriserAt)}` : "—"],
                      [tr("Note"), p.returnInfo?.note ? trData(p.returnInfo.note) : "—"],
                      [tr("Completed"), fmtTimeDayDate(p.completedAt)],
                      [tr("Hours on permit"), p.actualHours !== undefined ? `${p.actualHours} h` : "—"],
                      [tr("Within validity"), p.completedAt && p.validTo ? (Date.parse(p.completedAt) <= Date.parse(p.validTo) ? tr("Yes") : tr("No — ran over")) : "—"],
                    ]}
                  />
                ) : (
                  <Quiet>{tr("Holder declares the site safe → Issuer returns → Authoriser accepts. Time, day and date are recorded at each step.")}</Quiet>
                )}
              </Section>

              <Section title={tr("Part E — re-validation")} extra={tr("{n} of {max} renewals", { n: p.renewalCount, max: EPERMIT_POLICY.maxRenewals })}>
                {[1, 2].map((n) => {
                  const r = p.renewals.filter((x) => x.n === n).slice(-1)[0];
                  return (
                    <div key={n} style={{ padding: "8px 0", borderTop: n > 1 ? `1px solid ${token.colorSplit}` : undefined, fontSize: 13 }}>
                      <div style={{ fontWeight: 500 }}>{tr("Renewal {n}", { n })} {r ? <span style={muted}>· {r.ref}</span> : null}</div>
                      {r ? (
                        <div style={muted}>
                          {tr("Shift {code}", { code: r.shiftCode })} · {fmtShort(r.validFrom)} → {fmtShort(r.validTo)} ·{" "}
                          <span style={{ color: statusColor(r.status) }}>
                            {r.status === "approved" ? tr("Approved") : r.status === "rejected" ? tr("Rejected") : tr("Pending")}
                          </span>
                          {r.decidedByName ? ` · ${trData(r.decidedByName)} ${fmtShort(r.decidedAt)}` : ""}
                          {r.newIssuerId ? ` · ${tr("incoming issuer {name}", { name: name(r.newIssuerId) })}` : ""}
                          {r.newHolderId ? ` · ${tr("new holder {name}", { name: name(r.newHolderId) })}` : ""}
                          {r.remark ? ` · ${trData(r.remark)}` : ""}
                        </div>
                      ) : (
                        <Quiet>{tr("Not used")}</Quiet>
                      )}
                    </div>
                  );
                })}
                {renewBlock && live ? <Quiet>{trData(renewBlock)}</Quiet> : null}
              </Section>
            </div>
          ) : null}

          {tab === "audit" ? (
            <Section title={tr("Audit trail")}>
              <Timeline
                items={[...p.timeline].reverse().map((t, i) => ({
                  key: `${t.at}-${i}`,
                  color:
                    t.kind === "suspend" || t.kind === "overdue" || t.kind === "cancel"
                      ? token.colorError
                      : t.kind === "activate" || t.kind === "approval" || t.kind === "return"
                        ? token.colorPrimary
                        : token.colorTextQuaternary,
                  content: (
                    <div>
                      <div style={{ fontWeight: 500 }}>{trData(t.title)}</div>
                      <div style={{ fontSize: 12, ...muted }}>
                        {trData(t.actorName)}
                        {t.actorRole !== "system" ? ` · ${trData(roleLabel(t.actorRole as UserRole))}` : ""} · {fmtTimeDayDate(t.at)}
                      </div>
                      {t.detail ? <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 }}>{trData(t.detail)}</div> : null}
                    </div>
                  ),
                }))}
              />
            </Section>
          ) : null}
        </div>

        {/* ── Side column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <Section title={tr("People")} extra={String(new Set([p.issuerId, p.holderId, ...p.workerIds]).size)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Person name={p.issuerName} sub={tr("Issuer")} />
              <Person name={dir.empName(p.holderId)} sub={tr("Permit Holder")} />
              {p.workerIds.filter((w) => w !== p.holderId).map((w) => (
                <Person key={w} name={dir.empName(w)} sub={tr("Worker")} />
              ))}
              {p.previousIssuerIds.length ? (
                <div style={{ fontSize: 12, ...muted }}>{tr("Earlier issuers: {names}", { names: p.previousIssuerIds.map(name).join(", ") })}</div>
              ) : null}
            </div>
          </Section>
          {p.otDecisionIds.length ? (
            <Section title={tr("Overtime")}>
              {p.otDecisionIds.map((o) => (
                <div key={o}><Link href="/overtime/decisions">{o}</Link></div>
              ))}
            </Section>
          ) : null}
          <Section title={tr("Emergency contacts")}>
            {contacts.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                {contacts.map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{tr(c.team)}</span>
                    <span style={{ whiteSpace: "nowrap" }}>
                      <a href={`tel:${c.mobile.replace(/\s/g, "")}`}>{c.mobile}</a>
                      {c.extension ? <span style={muted}> · {tr("ext. {ext}", { ext: c.extension })}</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Quiet>{tr("No contacts set for this plant.")}</Quiet>
            )}
          </Section>
          <Collapse
            size="small"
            items={[
              {
                key: "rules",
                label: tr("Permit rules"),
                children: (
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
                    {PERMIT_RULES.map((r) => (
                      <li key={r}>{tr(r)}</li>
                    ))}
                  </ol>
                ),
              },
            ]}
          />
          {live && canSuspendSite(viewer, p.siteId) ? (
            <Button danger block onClick={() => setModal({ kind: "suspendSite" })}>{tr("Stop all work at this plant")}</Button>
          ) : null}
        </div>
      </div>

      <Modal
        open={Boolean(modal)}
        title={modal ? modalTitle[modal.kind] : ""}
        onCancel={() => {
          setModal(null);
          setText("");
          setGas({});
        }}
        onOk={onOk}
        okText={modal?.kind === "override" && !modal.canOverride ? tr("OK") : tr("Confirm")}
        okButtonProps={{
          loading: Boolean(busy),
          danger: modal?.kind === "suspend" || modal?.kind === "suspendSite" || modal?.kind === "cancel",
          disabled: Boolean((needsText && !text.trim()) || gasMissing || (modal?.kind === "ot" && !(otHours && otHours > 0))),
        }}
        destroyOnHidden
      >
        {modal?.kind === "override" ? (
          <>
            <ul style={{ paddingLeft: 18 }}>
              {modal.blocks.map((b) => (
                <li key={b}>{trData(b)}</li>
              ))}
            </ul>
            {!modal.canOverride ? <p>{tr("Fix the issue, or ask the Plant Manager to override.")}</p> : null}
          </>
        ) : null}
        {modal?.kind === "renewal" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {nextWindow ? (
              <Alert
                type="info"
                showIcon
                title={tr("{ref}: shift {code}, {from} → {to}", {
                  ref: renewalRef(p.permitNo, p.renewalCount + 1),
                  code: nextWindow.shiftCode,
                  from: fmtShort(nextWindow.validFrom),
                  to: fmtShort(nextWindow.validTo),
                })}
                description={tr("The Authoriser approves it after the holder and workers acknowledge.")}
              />
            ) : null}
            <label style={{ fontSize: 13 }}>
              {tr("Incoming issuer (shift change, optional)")}
              <Select
                allowClear
                style={{ width: "100%" }}
                value={newIssuerId}
                onChange={setNewIssuerId}
                options={issuerCandidates.filter((e) => e.id !== p.issuerId).map((e) => ({ value: e.id, label: trData(e.name) }))}
              />
            </label>
            <label style={{ fontSize: 13 }}>
              {tr("New Permit Holder (optional)")}
              <Select allowClear style={{ width: "100%" }} value={newHolderId} onChange={setNewHolderId} options={p.workerIds.filter((w) => w !== p.holderId).map((w) => ({ value: w, label: name(w) }))} />
            </label>
            {hot ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{tr("Fresh gas readings (oxygen required)")}</div>
                <GasReadingsInput value={gas} onChange={setGas} required={["oxygen"]} />
              </>
            ) : null}
          </div>
        ) : null}
        {modal?.kind === "resume" && hot ? (
          <>
            <p style={{ marginTop: 0 }}>{tr("Hot work: take fresh gas readings before work resumes. The permit still ends at {time}.", { time: fmtShort(p.validTo) })}</p>
            <GasReadingsInput value={gas} onChange={setGas} required={["oxygen"]} />
          </>
        ) : null}
        {modal?.kind === "resume" && !hot ? <p style={{ marginTop: 0 }}>{tr("The permit still ends at {time}.", { time: fmtShort(p.validTo) })}</p> : null}
        {modal?.kind === "return" ? (
          <Radio.Group
            style={{ marginBottom: 12 }}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            options={(Object.keys(RETURN_OUTCOME_LABELS) as ReturnOutcome[]).map((o) => ({ value: o, label: tr(RETURN_OUTCOME_LABELS[o]) }))}
          />
        ) : null}
        {modal?.kind === "renewalDecide" && modal.decision === "approve" && pendingRenewal ? (
          <p style={{ marginTop: 0 }}>
            {acksDue.length
              ? tr("Still waiting for: {names}", { names: acksDue.map((a) => name(a.personId)).join(", ") })
              : tr("Everyone has acknowledged. Valid to {time}.", { time: fmtShort(pendingRenewal.validTo) })}
          </p>
        ) : null}
        {modal?.kind === "ot" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>{tr("Extra hours needed beyond the permit window")}</span>
            <InputNumber min={0.5} max={16} step={0.5} value={otHours} onChange={(v) => setOtHours(typeof v === "number" ? v : null)} />
          </div>
        ) : null}
        {modal?.kind === "suspendSite" ? (
          <p style={{ marginTop: 0, color: token.colorError }}>{tr("Every live permit at this plant stops until its Authoriser re-validates it.")}</p>
        ) : null}
        {modal && modal.kind !== "override" ? (
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={1000}
            placeholder={needsText ? tr("Reason / note (required)") : tr("Note (optional)")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        ) : modal?.kind === "override" && modal.canOverride ? (
          <Input.TextArea autoSize={{ minRows: 2 }} placeholder={tr("Why is it safe to go ahead? (required)")} value={text} onChange={(e) => setText(e.target.value)} />
        ) : null}
      </Modal>
    </div>
  );
}

/** One Part B checklist as a compact card: confirmed items first, NA items folded into one muted line. */
function ChecklistCard({
  title,
  note,
  defs,
  value,
  withRef,
}: {
  title: string;
  note?: string;
  defs: { key: string; label: string }[];
  value: ChecklistAnswer[];
  withRef?: boolean;
}) {
  const { token } = theme.useToken();
  const get = (key: string) => value.find((a) => a.key === key);
  const yes = defs.filter((d) => get(d.key)?.value === "yes");
  const na = defs.filter((d) => get(d.key)?.value === "na");
  const blank = defs.filter((d) => !get(d.key)?.value);
  return (
    <Section title={title} extra={`${yes.length} / ${defs.length}${note ? ` · ${note}` : ""}`}>
      {yes.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4, fontSize: 13, lineHeight: 1.5 }}>
          {yes.map((d) => (
            <li key={d.key} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <CheckOutlined style={{ color: token.colorSuccess, fontSize: 11, flex: "none" }} />
              <span>
                {tr(d.label)}
                {withRef && get(d.key)?.refNo ? <span style={{ color: token.colorTextSecondary }}> · {get(d.key)!.refNo}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Quiet>{tr("Nothing confirmed.")}</Quiet>
      )}
      {na.length || blank.length ? (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorSplit}`, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            [tr("Not applicable"), na, token.colorTextTertiary],
            [tr("Not answered"), blank, token.colorWarning],
          ].map(([label, list, color]) =>
            (list as typeof na).length ? (
              <div key={label as string}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: color as string, marginBottom: 4 }}>
                  {label as string} · {(list as typeof na).length}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {(list as typeof na).map((d) => (
                    <span
                      key={d.key}
                      style={{
                        fontSize: 12, lineHeight: "18px", padding: "1px 8px", borderRadius: 999,
                        background: token.colorFillTertiary, color: token.colorTextSecondary,
                      }}
                    >
                      {tr(d.label)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </Section>
  );
}
