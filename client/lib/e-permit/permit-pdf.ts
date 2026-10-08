import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  APPROVAL_KIND_LABELS,
  CERTIFICATE_TYPES,
  EPERMIT_CATEGORY_LABELS,
  EPERMIT_STATUS_LABELS,
  EPERMIT_SUBCATEGORY_LABELS,
  FIRE_GAS_ITEMS,
  GAS_LIMITS,
  PERMIT_RULES,
  PPE_ITEMS,
  RETURN_OUTCOME_LABELS,
  SAFETY_MEASURES,
  type ChecklistAnswer,
  type ChecklistItemDef,
} from "./rules";
import type { EPermit, SiteEmergencyContact } from "./types";
import { PLANT_TZ } from "@/lib/plant-time";

/** Plant-local "14:32, Wednesday, 7 Oct 2026" (PDFs stay in English like the Safety report). */
const fmt = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const opts = { timeZone: PLANT_TZ } as const;
  return `${d.toLocaleTimeString("en-IN", { ...opts, hour: "2-digit", minute: "2-digit", hour12: false })}, ${d.toLocaleDateString("en-IN", { ...opts, weekday: "long" })}, ${d.toLocaleDateString("en-IN", { ...opts, day: "numeric", month: "short", year: "numeric" })}`;
};

type Names = {
  empName: (id?: string) => string;
  siteName: (id?: string) => string;
  deptName: (id?: string) => string;
  contacts: SiteEmergencyContact[];
};

const answer = (list: ChecklistAnswer[], key: string) => {
  const a = list.find((x) => x.key === key);
  return a?.value === "yes" ? `Yes${a.refNo ? ` (${a.refNo})` : ""}` : a?.value === "na" ? "NA" : "—";
};

const rows = (defs: ChecklistItemDef[], list: ChecklistAnswer[]) => defs.map((d, i) => [String(i + 1), d.label, answer(list, d.key)]);

/** Permit-to-Work pack: Parts A–E, acknowledgements, audit trail and the rules / emergency contacts panel. */
export function downloadPermitPdf(p: EPermit, names: Names) {
  const doc = new jsPDF();
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20;
  const table = (head: string[], body: string[][], opts: { first?: number; startGap?: number } = {}) =>
    autoTable(doc, {
      startY: lastY() + (opts.startGap ?? 6),
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 1.6 },
      headStyles: { fillColor: [22, 101, 52] },
      columnStyles: opts.first ? { 0: { cellWidth: opts.first, fontStyle: "bold" } } : undefined,
      head: [head],
      body,
    });

  doc.setFontSize(15);
  doc.text(`PERMIT TO WORK — ${p.permitNo}`, 14, 16);
  doc.setFontSize(9);
  doc.text(
    `${EPERMIT_CATEGORY_LABELS[p.category]} · ${EPERMIT_SUBCATEGORY_LABELS[p.subCategory]}${p.emergency ? " · EMERGENCY" : ""} · Status: ${EPERMIT_STATUS_LABELS[p.status]} · Policy v${p.policyVersion} · generated ${fmt(new Date().toISOString())}`,
    14,
    22,
    { maxWidth: 182 },
  );

  autoTable(doc, {
    startY: 27,
    theme: "grid",
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 46, fontStyle: "bold" } },
    head: [["Part A — the work", ""]],
    headStyles: { fillColor: [22, 101, 52] },
    body: [
      ["Plant / location", `${names.siteName(p.siteId)} · ${p.locationName}`],
      ["Work description", p.description || "—"],
      ["Shift", `${p.shiftCode} · ${fmt(p.windowStart)} → ${fmt(p.windowEnd)}`],
      ["Planned", p.plannedFrom ? `${fmt(p.plannedFrom)} → ${fmt(p.plannedTo)}` : "—"],
      ["Valid", p.validFrom ? `${fmt(p.validFrom)} → ${fmt(p.validTo)}` : "Not active"],
      ["Issuer", p.issuerName],
      ["Permit Holder", names.empName(p.holderId)],
      ["Workers", p.workerIds.map(names.empName).join(", ")],
      ["Authoriser", `${names.deptName(p.authoriserDepartmentId)} HoD`],
      ["JSA ref.", p.jsaRef || "—"],
      ...(p.safetyEventId ? [["Breakdown", p.safetyEventId]] : []),
      ...(p.parentPermitId ? [["Continues permit", p.parentPermitId]] : []),
    ],
  });

  table(["#", "Part B1 — safety measures taken", "Yes / NA"], rows(SAFETY_MEASURES, p.safetyMeasures));
  table(["Part B2 — potential hazards & special precautions"], [[p.hazardsText || "—"]]);
  table(
    ["#", "Part B3A — PPE & others", "Yes / NA"],
    [...rows(PPE_ITEMS, p.ppe), ...p.customPpe.map((c, i) => [String(PPE_ITEMS.length + i + 1), c.label ?? c.key, c.value === "yes" ? "Yes" : "NA"])],
  );
  table(["#", "Part B3B — fire precautions & gas tests", "Yes / NA"], rows(FIRE_GAS_ITEMS, p.fireGas));
  if (p.gasReadings.length) {
    table(
      ["Gas", "Reading", "Safe limit", "When", "By"],
      p.gasReadings.map((r) => [
        GAS_LIMITS[r.gas].label,
        `${r.value} ${r.unit}${r.ok ? "" : " (OUT OF LIMIT)"}`,
        GAS_LIMITS[r.gas].safe,
        r.round === 0 ? "At issue" : r.round === -1 ? "Before resuming" : `Renewal ${r.round}`,
        `${r.byName} · ${fmt(r.at)}`,
      ]),
    );
  }
  table(["#", "Part B3C — associated certificates", "Yes / NA (ref.)"], rows(CERTIFICATE_TYPES, p.certificates));

  table(
    ["Part C — approvals", "Decision", "By", "When / remark"],
    [
      ...p.approvals.map((a) => [
        `${APPROVAL_KIND_LABELS[a.kind]}${a.departmentId ? ` — ${names.deptName(a.departmentId)}` : ""}`,
        a.status,
        a.decidedByName ? `${a.decidedByName}${a.onBehalfOf ? ` (for ${a.onBehalfOf})` : ""}` : "—",
        `${fmt(a.at)}${a.remark ? ` · ${a.remark}` : ""}`,
      ]),
      ...p.postReviews.map((a) => [
        `Post-review: ${APPROVAL_KIND_LABELS[a.kind]}${a.departmentId ? ` — ${names.deptName(a.departmentId)}` : ""}`,
        a.status,
        a.decidedByName ?? "—",
        `${fmt(a.at)}${a.remark ? ` · ${a.remark}` : ""}`,
      ]),
    ],
  );
  table(
    ["Acknowledged by", "As", "For", "When", "How"],
    p.acks.map((a) => [
      a.personName,
      a.role,
      a.context === "renewal" ? `Renewal ${a.round}` : a.context === "return" ? "Return — site safe" : "Issue",
      fmt(a.at),
      a.via === "self" ? "Own login" : a.via === "holder" ? "Holder's device" : "Issuer's device",
    ]),
  );

  table(
    ["Part D — return", ""],
    [
      ["Outcome", p.returnInfo ? RETURN_OUTCOME_LABELS[p.returnInfo.outcome] : EPERMIT_STATUS_LABELS[p.status]],
      ["1. Holder — site safe", p.returnInfo?.holderAt ? `${p.returnInfo.holderName ?? ""} · ${fmt(p.returnInfo.holderAt)}` : "—"],
      ["2. Issuer returned", p.returnInfo?.issuerAt ? `${p.returnInfo.issuerName ?? ""} · ${fmt(p.returnInfo.issuerAt)}` : "—"],
      ["3. Authoriser accepted", p.returnInfo?.authoriserAt ? `${p.returnInfo.authoriserName ?? ""} · ${fmt(p.returnInfo.authoriserAt)}` : "—"],
      ["Note", p.returnInfo?.note || "—"],
      ["Completed", fmt(p.completedAt)],
      ["Hours on permit", p.actualHours !== undefined ? `${p.actualHours} h` : "—"],
    ],
    { first: 46 },
  );

  table(
    ["Part E — re-validation", "Shift / validity", "Decision"],
    [1, 2].map((n) => {
      const r = p.renewals.filter((x) => x.n === n).slice(-1)[0];
      return r
        ? [r.ref, `${r.shiftCode} · ${fmt(r.validFrom)} → ${fmt(r.validTo)}`, `${r.status}${r.decidedByName ? ` · ${r.decidedByName}` : ""}${r.remark ? ` · ${r.remark}` : ""}`]
        : [`Renewal ${n}`, "Not used", "—"];
    }),
  );

  autoTable(doc, {
    startY: lastY() + 6,
    theme: "striped",
    styles: { fontSize: 7.5 },
    head: [["When", "Who", "What", "Detail"]],
    body: p.timeline.map((t) => [fmt(t.at), `${t.actorName} (${t.actorRole})`, t.title, t.detail ?? ""]),
  });

  table(["Rules"], PERMIT_RULES.map((r, i) => [`${i + 1}. ${r}`]));
  if (names.contacts.length) {
    table(["Emergency contacts", "Mobile", "Ext."], names.contacts.map((c) => [c.team, c.mobile, c.extension ?? "—"]));
  }

  doc.save(`permit-${p.permitNo.replace(/\//g, "-")}.pdf`);
}
