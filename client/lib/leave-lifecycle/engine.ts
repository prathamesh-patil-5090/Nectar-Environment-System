import { getEmployeeById } from "@/lib/mock-data";
import {
  confirmReturn,
  getLeaveById,
  getLeaveRequests,
  markCoverDisrupted,
} from "@/lib/leave/store";
import { releaseRelieverForLeave } from "@/lib/reliever/pool";
import { TODAY } from "@/lib/shift";
import {
  addCoverDisruption,
  clearCoverDisruptions,
  getCoverDisruptions,
  hasOpenCoverDisruption,
} from "./store";
import type {
  CoverDisruptionKind,
  LifecycleCase,
  LifecycleKind,
  LifecycleReport,
} from "./types";

function kindLabel(kind: LifecycleKind): string {
  switch (kind) {
    case "active_cover":
      return "Active cover";
    case "due_return":
      return "Return due";
    case "early_return_ready":
      return "Early return possible";
    case "late_return":
      return "Late return";
    case "extension_open":
      return "Extension open";
    case "emergency_open":
      return "Emergency open";
    case "unexplained":
      return "Unexplained absence";
    case "cover_disrupted":
      return "Cover disrupted";
  }
}

function coverLabel(leave: {
  assignedRelieverId?: string;
  assignedCoverEmployeeId?: string;
  replacementPlan?: string;
}): { name?: string; relieverId?: string; employeeId?: string } {
  if (leave.assignedCoverEmployeeId) {
    return {
      name:
        getEmployeeById(leave.assignedCoverEmployeeId)?.name ??
        leave.replacementPlan,
      employeeId: leave.assignedCoverEmployeeId,
    };
  }
  if (leave.assignedRelieverId) {
    return {
      name: leave.replacementPlan ?? leave.assignedRelieverId,
      relieverId: leave.assignedRelieverId,
    };
  }
  return { name: leave.replacementPlan };
}

/**
 * Build lifecycle cases for the leave + cover queue.
 */
export function getLifecycleReport(opts?: {
  siteId?: string;
  asOf?: string;
  leaveId?: string;
}): LifecycleReport {
  const asOf = opts?.asOf ?? TODAY;
  const leaves = getLeaveRequests(opts?.siteId).filter((l) =>
    opts?.leaveId ? l.id === opts.leaveId : true,
  );

  const cases: LifecycleCase[] = [];

  for (const leave of leaves) {
    const cover = coverLabel(leave);
    const href = `/leave/requests/${leave.id}`;
    const base = {
      leaveId: leave.id,
      siteId: leave.siteId,
      employeeId: leave.employeeId,
      employeeName: leave.employeeName,
      startDate: leave.startDate,
      endDate: leave.endDate,
      expectedReturnDate: leave.expectedReturnDate,
      actualReturnDate: leave.actualReturnDate,
      mode: leave.mode,
      leaveStatus: leave.status,
      coverName: cover.name,
      coverRelieverId: cover.relieverId,
      coverEmployeeId: cover.employeeId,
      href,
    };

    if (hasOpenCoverDisruption(leave.id)) {
      const d = getCoverDisruptions(leave.id)[0]!;
      cases.push({
        ...base,
        id: `lc-disrupt-${leave.id}`,
        kind: "cover_disrupted",
        title: `${leave.employeeName} — cover disrupted`,
        message: `${d.kind.replaceAll("_", " ")}: ${d.note}. Re-cover via Match / Competition / OT.`,
        softBlock: "Shift not covered until re-assign or OT Decision",
      });
      continue;
    }

    if (leave.status === "EXTENSION_REQUIRED") {
      cases.push({
        ...base,
        id: `lc-ext-${leave.id}`,
        kind: "extension_open",
        title: `${leave.employeeName} — extension open`,
        message: `Late return ${leave.actualReturnDate ?? ""}; cover kept until Manager closes extension.`,
        softBlock: "Manager remark required to close",
      });
      continue;
    }

    if (leave.status === "UNEXPLAINED_ABSENCE") {
      cases.push({
        ...base,
        id: `lc-unex-${leave.id}`,
        kind: "unexplained",
        title: `${leave.employeeName} — unexplained absence`,
        message: "Attendance mismatch — open emergency coverage path.",
      });
      continue;
    }

    if (
      leave.mode === "emergency" &&
      ![
        "CLOSED",
        "REJECTED",
        "CANCELLED",
        "APPROVED",
        "EXTENSION_REQUIRED",
      ].includes(leave.status)
    ) {
      cases.push({
        ...base,
        id: `lc-emg-${leave.id}`,
        kind: "emergency_open",
        title: `${leave.employeeName} — emergency leave`,
        message: `Status ${leave.status}. Fast path — staffing checks still apply.`,
      });
    }

    if (leave.status === "APPROVED") {
      const hasCover = Boolean(
        leave.assignedRelieverId ||
          leave.assignedCoverEmployeeId ||
          leave.coverSource === "ot_fallback",
      );

      if (asOf > leave.expectedReturnDate) {
        cases.push({
          ...base,
          id: `lc-late-${leave.id}`,
          kind: "late_return",
          title: `${leave.employeeName} — overdue return`,
          message: `Expected ${leave.expectedReturnDate}; as of ${asOf}. Confirm return → extension keeps cover.`,
          softBlock: "Late confirm opens EXTENSION_REQUIRED",
        });
      } else if (asOf === leave.expectedReturnDate) {
        cases.push({
          ...base,
          id: `lc-due-${leave.id}`,
          kind: "due_return",
          title: `${leave.employeeName} — return due today`,
          message: "Confirm on-time return to release cover.",
        });
      } else if (asOf >= leave.startDate && asOf < leave.expectedReturnDate) {
        cases.push({
          ...base,
          id: `lc-early-${leave.id}`,
          kind: "early_return_ready",
          title: `${leave.employeeName} — on leave`,
          message: hasCover
            ? `Cover: ${cover.name ?? "arranged"}. Early return will release cover.`
            : "No cover assigned yet.",
        });
      }

      if (hasCover && asOf <= leave.expectedReturnDate) {
        cases.push({
          ...base,
          id: `lc-cover-${leave.id}`,
          kind: "active_cover",
          title: `${leave.employeeName} — cover active`,
          message: `Cover: ${cover.name ?? leave.coverSource ?? "arranged"} through ${leave.expectedReturnDate}.`,
        });
      }
    }
  }

  const byId = new Map(cases.map((c) => [c.id, c]));
  const deduped = [...byId.values()].sort((a, b) =>
    a.expectedReturnDate.localeCompare(b.expectedReturnDate),
  );

  return {
    asOf,
    siteId: opts?.siteId,
    cases: deduped,
    extensionCount: deduped.filter((c) => c.kind === "extension_open").length,
    disruptedCount: deduped.filter((c) => c.kind === "cover_disrupted").length,
    dueReturnCount: deduped.filter(
      (c) => c.kind === "due_return" || c.kind === "late_return",
    ).length,
    emergencyCount: deduped.filter((c) => c.kind === "emergency_open").length,
  };
}

export function confirmReturnLifecycle(input: {
  leaveId: string;
  actor: string;
  actualReturnDate: string;
  remark?: string;
  actorRole?:
    | "supervisor"
    | "manager"
    | "director"
    | "site_incharge"
    | "shift_incharge";
}) {
  const leave = getLeaveById(input.leaveId);
  if (!leave) throw new Error("Leave not found");

  if (leave.status === "EXTENSION_REQUIRED") {
    if (input.actorRole !== "manager" && input.actorRole !== "director") {
      throw new Error(
        "Only Manager or Director can close an extension (soft block).",
      );
    }
    if (!input.remark?.trim()) {
      throw new Error("Manager remark is required to close an extension.");
    }
  }

  const updated = confirmReturn(
    input.leaveId,
    input.actor,
    input.actualReturnDate,
    {
      remark: input.remark,
      requireManagerForExtension: true,
    },
  );
  if (updated.status === "CLOSED") {
    clearCoverDisruptions(input.leaveId);
  }
  return updated;
}

export function reportCoverDisruption(input: {
  leaveId: string;
  kind: CoverDisruptionKind;
  note: string;
  actor: string;
}) {
  if (!input.note.trim()) {
    throw new Error("A note is required to report cover disruption");
  }
  const leave = getLeaveById(input.leaveId);
  if (!leave) throw new Error("Leave not found");
  if (
    !leave.assignedRelieverId &&
    !leave.assignedCoverEmployeeId &&
    leave.coverSource !== "ot_fallback"
  ) {
    throw new Error("No cover assignment to disrupt on this leave");
  }

  const disruption = addCoverDisruption({
    leaveId: input.leaveId,
    kind: input.kind,
    note: input.note.trim(),
    actor: input.actor,
    coverRelieverId: leave.assignedRelieverId,
    coverEmployeeId: leave.assignedCoverEmployeeId,
  });

  releaseRelieverForLeave(input.leaveId);
  markCoverDisrupted(input.leaveId, input.actor, input.kind, input.note.trim());

  return disruption;
}

export function lifecycleKindLabel(kind: LifecycleKind): string {
  return kindLabel(kind);
}
