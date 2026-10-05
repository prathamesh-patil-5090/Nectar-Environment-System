import { beforeEach, describe, expect, it } from "vitest";
import { employees } from "@/lib/mock-data";
import {
  createLeaveRequest,
  confirmReturn,
  getLeaveById,
  resetLeaveStore,
  siteApprove,
  supervisorVerify,
  managerDecideLeave,
  adminFinalizeLeave,
} from "@/lib/leave/store";
import {
  confirmReturnLifecycle,
  getLifecycleReport,
  reportCoverDisruption,
  resetLifecycleStore,
} from "@/lib/leave-lifecycle";
import { getRelievers, resetRelieverPool } from "@/lib/reliever/pool";
import { resetShiftStore } from "@/lib/shift/store";

import "@/lib/leave/store";
import "@/lib/reliever/pool";
import "@/lib/shift/store";

function coverAndApprove(leaveId: string) {
  supervisorVerify(leaveId, "Supervisor");
  siteApprove(leaveId, "SIC", { relieverId: "rv1" });
  managerDecideLeave(leaveId, "Manager", "approved");
  adminFinalizeLeave(leaveId, "Director", "approved");
}

function fileLeave(employeeId: string, start = "2026-09-30", end = "2026-10-01") {
  const emp = employees.find((e) => e.id === employeeId)!;
  return createLeaveRequest({
    employeeId,
    mode: "planned",
    leaveType: "casual",
    startDate: start,
    endDate: end,
    expectedReturnDate: end,
    reason: "Lifecycle test",
    entrySource: "employee",
    enteredByName: emp.name,
    enteredByRole: "employee",
    supervisorName: "Amit Supervisor",
    siteInChargeName: "Sanjay Jadhav",
  });
}

describe("leave-lifecycle", () => {
  beforeEach(() => {
    resetLeaveStore();
    resetRelieverPool();
    resetShiftStore();
    resetLifecycleStore();
  });

  it("lists seeded extension case", () => {
    const report = getLifecycleReport({ siteId: "s-etp", asOf: "2026-09-23" });
    expect(report.cases.some((c) => c.kind === "extension_open")).toBe(true);
    expect(report.extensionCount).toBeGreaterThan(0);
  });

  it("late return opens extension and keeps cover; close needs remark", () => {
    const leave = fileLeave("emp0126");
    coverAndApprove(leave.id);
    const late = confirmReturn(leave.id, "Supervisor", "2026-10-03");
    expect(late.status).toBe("EXTENSION_REQUIRED");
    expect(getRelievers().find((r) => r.id === "rv1")?.availability).toBe(
      "assigned",
    );

    expect(() =>
      confirmReturnLifecycle({
        leaveId: leave.id,
        actor: "Supervisor",
        actualReturnDate: "2026-10-04",
        actorRole: "supervisor",
      }),
    ).toThrow(/Manager/);

    const closed = confirmReturnLifecycle({
      leaveId: leave.id,
      actor: "Manager",
      actualReturnDate: "2026-10-04",
      remark: "Back on duty after travel delay",
      actorRole: "manager",
    });
    expect(closed.status).toBe("CLOSED");
    expect(getRelievers().find((r) => r.id === "rv1")?.availability).toBe(
      "available",
    );
  });

  it("early return releases cover", () => {
    const leave = fileLeave("emp0126", "2026-09-30", "2026-10-02");
    coverAndApprove(leave.id);
    const early = confirmReturnLifecycle({
      leaveId: leave.id,
      actor: "Supervisor",
      actualReturnDate: "2026-10-01",
      actorRole: "supervisor",
    });
    expect(early.status).toBe("CLOSED");
    expect(getRelievers().find((r) => r.id === "rv1")?.availability).toBe(
      "available",
    );
  });

  it("cover disruption clears assignment and flags case", () => {
    const leave = fileLeave("emp0126");
    coverAndApprove(leave.id);
    reportCoverDisruption({
      leaveId: leave.id,
      kind: "no_show",
      note: "Reliever did not report for morning shift",
      actor: "SIC",
    });
    const updated = getLeaveById(leave.id)!;
    expect(updated.assignedRelieverId).toBeUndefined();
    expect(updated.replacementRequired).toBe(true);
    const report = getLifecycleReport({
      leaveId: leave.id,
      asOf: "2026-09-30",
    });
    expect(report.cases.some((c) => c.kind === "cover_disrupted")).toBe(true);
  });
});
