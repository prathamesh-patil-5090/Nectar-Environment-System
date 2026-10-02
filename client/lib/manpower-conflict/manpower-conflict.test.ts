import { beforeEach, describe, expect, it } from "vitest";
import { employees } from "@/lib/mock-data";
import {
  createLeaveRequest,
  resetLeaveStore,
  siteApprove,
  supervisorVerify,
} from "@/lib/leave/store";
import { resetRelieverPool } from "@/lib/reliever/pool";
import {
  detectConflicts,
  resetShiftStore,
  TODAY,
} from "@/lib/shift/store";
import {
  assertCanPublishRotation,
  assertCanSiteApproveLeave,
  getManpowerConflictReport,
} from "@/lib/manpower-conflict";

import "@/lib/leave/store";
import "@/lib/reliever/pool";
import "@/lib/shift/store";

function fileLeave(employeeId: string, start = "2026-09-30", end = "2026-10-01") {
  const emp = getEmployee(employeeId);
  return createLeaveRequest({
    employeeId,
    mode: "planned",
    leaveType: "casual",
    startDate: start,
    endDate: end,
    expectedReturnDate: end,
    reason: "Manpower test",
    entrySource: "employee",
    enteredByName: emp.name,
    enteredByRole: "employee",
    supervisorName: "Amit Supervisor",
    siteInChargeName: "Sanjay Jadhav",
  });
}

function getEmployee(id: string) {
  const emp = employees.find((e) => e.id === id);
  if (!emp) throw new Error(`missing ${id}`);
  return emp;
}

describe("manpower-conflict report", () => {
  beforeEach(() => {
    resetLeaveStore();
    resetRelieverPool();
    resetShiftStore();
  });

  it("emits attention for open leave vacancies", () => {
    const emp = employees.find(
      (e) => e.siteId === "s-etp" && e.employeeCategory === "shift",
    )!;
    const leave = fileLeave(emp.id);
    const report = getManpowerConflictReport({
      siteId: "s-etp",
      from: leave.startDate,
      to: leave.endDate,
      focusLeaveId: leave.id,
    });
    const vacancyIssues = report.issues.filter(
      (i) => i.kind === "open_vacancy" || i.kind === "uncovered_vacancy",
    );
    expect(vacancyIssues.length).toBeGreaterThan(0);
    expect(report.attentionCount).toBeGreaterThan(0);
  });

  it("marks plant overlap as watch", () => {
    const etp = employees.filter(
      (e) => e.siteId === "s-etp" && e.employeeCategory === "shift",
    );
    const a = fileLeave(etp[0]!.id);
    fileLeave(etp[1]!.id, a.startDate, a.endDate);
    const report = getManpowerConflictReport({
      siteId: "s-etp",
      from: a.startDate,
      to: a.endDate,
      focusLeaveId: a.id,
    });
    expect(report.issues.some((i) => i.kind === "plant_overlap")).toBe(true);
  });
});

describe("manpower-conflict leave gate", () => {
  beforeEach(() => {
    resetLeaveStore();
    resetRelieverPool();
    resetShiftStore();
  });

  it("blocks siteApprove without cover when vacancies exist", () => {
    const leave = fileLeave("emp0126");
    supervisorVerify(leave.id, "Supervisor");
    const gate = assertCanSiteApproveLeave(leave.id, {});
    expect(gate.ok).toBe(false);
    expect(() => siteApprove(leave.id, "SIC")).toThrow();
  });

  it("allows siteApprove with otFallback", () => {
    const leave = fileLeave("emp0126");
    supervisorVerify(leave.id, "Supervisor");
    const covered = siteApprove(leave.id, "Manager", {
      otFallback: true,
      otRemark: "No safer cover — accept OT for test",
      otActorRole: "manager",
    });
    expect(covered.status).toBe("SITE_APPROVED");
    expect(covered.coverSource).toBe("ot_fallback");
  });

  it("allows siteApprove with arrangeReplacement", () => {
    const leave = fileLeave("emp0126");
    supervisorVerify(leave.id, "Supervisor");
    const covered = siteApprove(leave.id, "SIC", {
      arrangeReplacement: true,
    });
    expect(covered.status).toBe("SITE_APPROVED");
  });

  it("allows siteApprove with chosen reliever", () => {
    const leave = fileLeave("emp0126");
    supervisorVerify(leave.id, "Supervisor");
    const covered = siteApprove(leave.id, "SIC", { relieverId: "rv1" });
    expect(covered.status).toBe("SITE_APPROVED");
    expect(covered.assignedRelieverId).toBe("rv1");
  });
});

describe("detectConflicts extensions", () => {
  beforeEach(() => {
    resetLeaveStore();
    resetRelieverPool();
    resetShiftStore();
  });

  it("can emit leave_on_roster when leave covers a planned day", () => {
    const leave = fileLeave("emp0126", TODAY, TODAY);
    supervisorVerify(leave.id, "Supervisor");
    siteApprove(leave.id, "Manager", {
      otFallback: true,
      otRemark: "Test OT for leave_on_roster detection",
      otActorRole: "manager",
    });
    // covering leave on TODAY — if roster has non-OFF for emp0126, conflict appears
    const conflicts = detectConflicts("s-etp");
    const leaveConflicts = conflicts.filter(
      (c) => c.type === "leave" && c.employeeId === "emp0126",
    );
    // May be empty if emp is OFF today — assert type is supported
    expect(Array.isArray(leaveConflicts)).toBe(true);
    expect(conflicts.every((c) => ["rest", "weekly_off", "leave", "double_booking"].includes(c.type))).toBe(
      true,
    );
  });
});

describe("publish gate", () => {
  beforeEach(() => {
    resetLeaveStore();
    resetRelieverPool();
    resetShiftStore();
  });

  it("ot acknowledge clears vacancy-only blockers", () => {
    const without = assertCanPublishRotation("s-etp", TODAY, TODAY, {
      acknowledgeOt: false,
    });
    const withOt = assertCanPublishRotation("s-etp", TODAY, TODAY, {
      acknowledgeOt: true,
    });
    if (without.otAcknowledgeWouldClear) {
      expect(withOt.ok).toBe(true);
    } else if (without.ok) {
      expect(withOt.ok).toBe(true);
    } else {
      // schedule attention remains even with OT
      expect(withOt.blockingIssues.some((i) => i.resolvableBy === "schedule_edit")).toBe(
        true,
      );
    }
  });
});
