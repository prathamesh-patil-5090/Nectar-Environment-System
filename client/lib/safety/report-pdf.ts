import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  SAFETY_CATEGORY_LABELS,
  SAFETY_SEVERITY_LABELS,
  SAFETY_STATUS_LABELS,
  SAFETY_TYPE_LABELS,
  downtimeDays,
  otTotals,
} from "./rules";
import type { SafetyEvent } from "./types";

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN") : "—");

type Names = { empName: (id?: string) => string; siteName: (id?: string) => string };

/** Detailed incident / near-miss / breakdown report (PDF download). */
export function downloadSafetyReport(ev: SafetyEvent, names: Names) {
  const doc = new jsPDF();
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20;

  doc.setFontSize(15);
  doc.text(`${SAFETY_TYPE_LABELS[ev.type]} report — ${ev.title}`, 14, 16, { maxWidth: 180 });
  doc.setFontSize(9);
  doc.text(`Case ${ev.id} · generated ${new Date().toLocaleString("en-IN")}`, 14, 23);

  autoTable(doc, {
    startY: 28,
    theme: "grid",
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: "bold" } },
    body: [
      ["Site", names.siteName(ev.siteId)],
      ["Status", SAFETY_STATUS_LABELS[ev.status]],
      ["Category", SAFETY_CATEGORY_LABELS[ev.category]],
      ["Severity", SAFETY_SEVERITY_LABELS[ev.severity]],
      ["Occurred", fmt(ev.occurredAt)],
      ["Reported", `${fmt(ev.reportedAt)} by ${ev.reportedBy.name}`],
      ["Location", ev.location || "—"],
      ["Involved", ev.involved.map(names.empName).join(", ") || "—"],
      ["Informed by", ev.informedBy.map(names.empName).join(", ") || "—"],
      ["Emergency", ev.isEmergency ? `Yes — ${ev.emergencyAcks.length}/${ev.emergencyRecipients.length} acknowledged` : "No"],
      ["Description", ev.description || "—"],
      ["Root cause", ev.rootCause || "—"],
      ...(ev.promotedFrom ? [["Promoted from", ev.promotedFrom]] : []),
      ...(ev.promotedTo ? [["Promoted to", ev.promotedTo]] : []),
    ],
  });

  if (ev.type === "breakdown") {
    const ot = otTotals(ev.otEntries);
    autoTable(doc, {
      startY: lastY() + 6,
      theme: "grid",
      head: [["Breakdown", ""]],
      styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 45, fontStyle: "bold" } },
      body: [
        ["Equipment", ev.equipment || "—"],
        ["What failed", ev.whatFailed || "—"],
        ["Why", ev.why || "—"],
        ["How", ev.how || "—"],
        ["Failed at", fmt(ev.failedAt)],
        ["Restored at", fmt(ev.restoredAt)],
        ["Downtime", `${downtimeDays(ev.failedAt, ev.restoredAt ?? undefined)} days${ev.restoredAt ? "" : " (still down)"}`],
        ["OT to fix", `${ot.people} people · ${ot.hours} h`],
        ...ev.otEntries.map((e) => [`  ${names.empName(e.employeeId)}`, `${e.hours} h${e.date ? ` · ${e.date}` : ""}`]),
      ],
    });
  }

  if (ev.correctiveActions.length) {
    autoTable(doc, {
      startY: lastY() + 6,
      theme: "striped",
      styles: { fontSize: 9 },
      head: [["Corrective action", "Owner", "Due", "Done"]],
      body: ev.correctiveActions.map((a) => [
        a.text,
        names.empName(a.ownerId) || "—",
        a.dueDate || "—",
        a.done ? `Yes (${a.doneBy ?? ""})` : "No",
      ]),
    });
  }

  if (ev.clearance.length) {
    autoTable(doc, {
      startY: lastY() + 6,
      theme: "striped",
      styles: { fontSize: 9 },
      head: [["Return to work", "Status", "By", "Remark"]],
      body: ev.clearance.map((c) => [
        names.empName(c.employeeId),
        c.status,
        c.clearedBy ?? "—",
        c.remark ?? "—",
      ]),
    });
  }

  autoTable(doc, {
    startY: lastY() + 6,
    theme: "striped",
    styles: { fontSize: 8 },
    head: [["When", "Who", "What", "Detail"]],
    body: ev.timeline.map((t) => [fmt(t.at), `${t.actorName} (${t.actorRole})`, t.title, t.detail ?? ""]),
  });

  doc.save(`safety-${ev.id}.pdf`);
}
