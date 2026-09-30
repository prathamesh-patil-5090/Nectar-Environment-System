import { beforeEach, describe, expect, it } from "vitest";
import type { SessionUser, UserRole } from "@/lib/auth";
import {
  cancelLeave,
  confirmReturn,
  createLeaveRequest,
  employeeConsentLeave,
  getLeaveById,
  managerDecideLeave,
  adminFinalizeLeave,
  rejectLeave,
  resetLeaveStore,
  siteApprove,
  supervisorVerify,
  type CreateLeaveInput,
} from "@/lib/leave/store";
import {
  canAdminFinalizeLeave,
  canAdminFinalizeRotation,
  canManagerDecideLeave,
  canManagerDecideRotation,
  canPublishRotation,
  canGenerateRotation,
  canSupervisorVerifyLeave,
} from "@/lib/rbac";
import {
  getRelievers,
  resetRelieverPool,
  setRelieverAvailability,
} from "@/lib/reliever/pool";
import { resetDemoLocalData } from "@/lib/demo-reset";
import {
  adminDecideRotation,
  buildMonthScheduleAssignments,
  createChangeRequest,
  decideChangeRequest,
  getChangeRequests,
  getPlannedDays,
  getRotationPreviews,
  managerDecideRotation,
  markRotationScheduleViewed,
  resetShiftStore,
  submitMonthlyScheduleDraft,
  validateScheduleAssignments,
  type RotationAssignmentCell,
} from "@/lib/shift";

function session(role: UserRole): SessionUser {
  return {
    email: `${role}@test.local`,
    name: role,
    role,
    siteId: "s-etp",
    employeeId: "emp0126",
  };
}

function fileLeave(
  patch: Partial<CreateLeaveInput> & Pick<CreateLeaveInput, "employeeId" | "entrySource" | "enteredByRole">,
): ReturnType<typeof createLeaveRequest> {
  return createLeaveRequest({
    mode: "planned",
    leaveType: "casual",
    startDate: "2026-09-30",
    endDate: "2026-10-01",
    expectedReturnDate: "2026-10-02",
    reason: "Family function",
    enteredByName: "Test actor",
    supervisorName: "Amit Supervisor",
    siteInChargeName: "Sanjay Jadhav",
    ...patch,
  });
}

function coverAndApprove(id: string) {
  supervisorVerify(id, "Amit Supervisor");
  siteApprove(id, "Sanjay Jadhav", { arrangeReplacement: true });
  managerDecideLeave(id, "Rajesh Kulkarni", "approved");
  return adminFinalizeLeave(id, "Director", "approved");
}

beforeEach(() => {
  resetLeaveStore();
  resetRelieverPool();
  resetShiftStore();
});

describe("leave approval chain", () => {
  it("walks employee request through local reliever, manager, director, and return", () => {
    const created = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
    });
    expect(created.status).toBe("REQUESTED");

    const verified = supervisorVerify(created.id, "Amit Supervisor");
    expect(verified.status).toBe("SUPERVISOR_VERIFIED");

    const covered = siteApprove(created.id, "Sanjay Jadhav", {
      arrangeReplacement: true,
    });
    expect(covered.status).toBe("SITE_APPROVED");
    expect(covered.assignedRelieverId).toBe("rv1");
    expect(covered.replacementPlan).toMatch(/local reliever pool/);
    expect(getRelievers().find((r) => r.id === "rv1")).toMatchObject({
      availability: "assigned",
      assignedAbsenceId: created.id,
    });

    const managerOk = managerDecideLeave(
      created.id,
      "Rajesh Kulkarni",
      "approved",
    );
    expect(managerOk.status).toBe("MANAGER_APPROVED");

    const approved = adminFinalizeLeave(created.id, "Director", "approved");
    expect(approved.status).toBe("APPROVED");

    const closed = confirmReturn(created.id, "Amit Supervisor", "2026-10-02");
    expect(closed.status).toBe("CLOSED");
    expect(getRelievers().find((r) => r.id === "rv1")).toMatchObject({
      availability: "available",
      assignedAbsenceId: undefined,
    });
  });

  it("stops a supervisor-filed leave when the employee rejects consent", () => {
    const created = fileLeave({
      employeeId: "emp0127",
      entrySource: "supervisor_on_behalf",
      enteredByRole: "supervisor",
    });
    expect(created.status).toBe("PENDING_EMPLOYEE_CONSENT");

    const rejected = employeeConsentLeave(
      created.id,
      "Rohit Kumar Singh",
      "rejected",
      "I did not ask for this",
    );
    expect(rejected.status).toBe("REJECTED");
    expect(() => supervisorVerify(created.id, "Amit Supervisor")).toThrow(
      /Cannot move leave from REJECTED/,
    );
  });

  it("continues after the employee consents to an on-behalf leave", () => {
    const created = fileLeave({
      employeeId: "emp0127",
      entrySource: "supervisor_on_behalf",
      enteredByRole: "supervisor",
    });
    const consented = employeeConsentLeave(created.id, "Rohit Kumar Singh", "approved");
    expect(consented.status).toBe("REQUESTED");
    expect(supervisorVerify(created.id, "Amit Supervisor").status).toBe(
      "SUPERVISOR_VERIFIED",
    );
  });

  it("lets the supervisor reject with a remark before cover", () => {
    const created = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
    });
    const rejected = rejectLeave(
      created.id,
      "Amit Supervisor",
      "Shift is already short",
      "supervisor",
    );
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Shift is already short");
  });

  it("picks a cluster reliever when nobody local is available", () => {
    setRelieverAvailability("rv1", "unavailable");
    setRelieverAvailability("rv7", "unavailable");
    const created = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
    });
    supervisorVerify(created.id, "Amit Supervisor");
    const covered = siteApprove(created.id, "Sanjay Jadhav", {
      arrangeReplacement: true,
    });
    expect(covered.assignedRelieverId).toBe("rv3");
    expect(covered.replacementPlan).toMatch(/cluster reliever pool/);
    expect(getRelievers().find((r) => r.id === "rv3")?.availability).toBe(
      "assigned",
    );
  });

  it("assigns the person the shift in-charge chooses", () => {
    const created = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
    });
    supervisorVerify(created.id, "Amit Supervisor");
    const covered = siteApprove(created.id, "Sanjay Jadhav", {
      relieverId: "rv7",
    });
    expect(covered.assignedRelieverId).toBe("rv7");
    expect(covered.replacementPlan).toMatch(/Rohit Kumar Singh/);
    expect(getRelievers().find((r) => r.id === "rv1")?.availability).toBe(
      "available",
    );
  });

  it("records OT last resort when the pool has no match", () => {
    setRelieverAvailability("rv1", "unavailable");
    setRelieverAvailability("rv7", "unavailable");
    setRelieverAvailability("rv3", "unavailable");
    const created = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
    });
    supervisorVerify(created.id, "Amit Supervisor");
    const covered = siteApprove(created.id, "Sanjay Jadhav", {
      arrangeReplacement: true,
    });
    expect(covered.status).toBe("SITE_APPROVED");
    expect(covered.assignedRelieverId).toBeUndefined();
    expect(covered.replacementPlan).toMatch(/OT last resort/);
    expect(
      getRelievers().some((r) => r.assignedAbsenceId === created.id),
    ).toBe(false);
  });

  it("refuses manager approval before the shift is covered", () => {
    const created = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
    });
    expect(() =>
      managerDecideLeave(created.id, "Rajesh Kulkarni", "approved"),
    ).toThrow(/Cannot move leave from REQUESTED to MANAGER_APPROVED/);
    expect(getLeaveById(created.id)?.status).toBe("REQUESTED");
  });

  it("refuses director finalize before manager approval", () => {
    const created = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
    });
    supervisorVerify(created.id, "Amit Supervisor");
    siteApprove(created.id, "Sanjay Jadhav", { arrangeReplacement: true });
    expect(() =>
      adminFinalizeLeave(created.id, "Director", "approved"),
    ).toThrow(/Cannot move leave from SITE_APPROVED to APPROVED/);
  });

  it("keeps the reliever on a late return and releases them when the extension closes", () => {
    const created = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
    });
    coverAndApprove(created.id);
    const late = confirmReturn(created.id, "Amit Supervisor", "2026-10-03");
    expect(late.status).toBe("EXTENSION_REQUIRED");
    expect(getRelievers().find((r) => r.id === "rv1")?.availability).toBe(
      "assigned",
    );
    const closed = confirmReturn(created.id, "Amit Supervisor", "2026-10-04");
    expect(closed.status).toBe("CLOSED");
    expect(getRelievers().find((r) => r.id === "rv1")?.availability).toBe(
      "available",
    );
  });

  it("blocks soft-withdraw after site approval", () => {
    const created = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
    });
    supervisorVerify(created.id, "Amit Supervisor");
    siteApprove(created.id, "Sanjay Jadhav", { arrangeReplacement: true });
    expect(() =>
      cancelLeave(created.id, "Rajesh Kulkarni", "Plans changed"),
    ).toThrow(/Cannot move leave/);
  });

  it("soft-withdraws leave with reason before site approval and keeps audit fields", () => {
    const created = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
    });
    supervisorVerify(created.id, "Amit Supervisor");
    const cancelled = cancelLeave(
      created.id,
      "Rajesh Kulkarni",
      "Plans changed",
      "employee",
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancellationReason).toBe("Plans changed");
    expect(cancelled.cancelledByName).toBe("Rajesh Kulkarni");
    expect(() => cancelLeave(created.id, "X", "again")).toThrow();
  });

  it("requires a withdrawal reason", () => {
    const created = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
    });
    expect(() => cancelLeave(created.id, "Rajesh Kulkarni", "  ")).toThrow(
      /reason/i,
    );
  });
});

describe("role gates", () => {
  it("lets only supervisor and above verify, manager decide, and director finalize", () => {
    expect(canSupervisorVerifyLeave(session("employee"))).toBe(false);
    expect(canSupervisorVerifyLeave(session("supervisor"))).toBe(true);
    expect(canManagerDecideLeave(session("supervisor"))).toBe(false);
    expect(canManagerDecideLeave(session("shift_incharge"))).toBe(false);
    expect(canManagerDecideLeave(session("manager"))).toBe(true);
    expect(canManagerDecideLeave(session("director"))).toBe(true);
    expect(canAdminFinalizeLeave(session("manager"))).toBe(false);
    expect(canAdminFinalizeLeave(session("director"))).toBe(true);
  });

  it("lets SIC generate drafts; manager reviews; only director finalizes", () => {
    expect(canGenerateRotation(session("shift_incharge"))).toBe(true);
    expect(canManagerDecideRotation(session("shift_incharge"))).toBe(false);
    expect(canAdminFinalizeRotation(session("shift_incharge"))).toBe(false);
    expect(canManagerDecideRotation(session("manager"))).toBe(true);
    expect(canAdminFinalizeRotation(session("manager"))).toBe(false);
    expect(canAdminFinalizeRotation(session("director"))).toBe(true);
    expect(canPublishRotation(session("manager"))).toBe(true);
    expect(canGenerateRotation(session("supervisor"))).toBe(false);
  });
});

describe("shift change guards", () => {
  it("rewrites the planned day when rest rules allow it", () => {
    const before = getPlannedDays({
      employeeId: "emp0126",
      from: "2026-09-24",
      to: "2026-09-24",
    })[0];
    expect(before.plannedCode).toBe("A");

    const req = createChangeRequest({
      employeeId: "emp0126",
      employeeName: "Shilpa Hotkar",
      siteId: "s-etp",
      date: "2026-09-24",
      fromShiftId: before.plannedShiftId,
      toShiftId: "sh-general",
      reason: "Clinic visit",
      requestedBy: "Shilpa Hotkar",
      potentialOtHours: 0,
      manpowerOk: true,
    });
    decideChangeRequest(req.id, "APPROVED");

    const after = getPlannedDays({
      employeeId: "emp0126",
      from: "2026-09-24",
      to: "2026-09-24",
    })[0];
    expect(after.plannedCode).toBe("G");
    expect(after.plannedShiftId).toBe("sh-general");
  });

  it("refuses a change on a date covered by approved leave", () => {
    const created = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
      startDate: "2026-10-05",
      endDate: "2026-10-05",
      expectedReturnDate: "2026-10-06",
    });
    coverAndApprove(created.id);

    const day = getPlannedDays({
      employeeId: "emp0126",
      from: "2026-10-05",
      to: "2026-10-05",
    })[0];
    const req = createChangeRequest({
      employeeId: "emp0126",
      employeeName: "Shilpa Hotkar",
      siteId: "s-etp",
      date: "2026-10-05",
      fromShiftId: day.plannedShiftId,
      toShiftId: "sh-general",
      reason: "Swap",
      requestedBy: "Shilpa Hotkar",
      potentialOtHours: 0,
      manpowerOk: true,
    });
    expect(() => decideChangeRequest(req.id, "APPROVED")).toThrow(
      /leave covering/,
    );
    expect(getChangeRequests().find((c) => c.id === req.id)?.status).toBe(
      "PENDING",
    );
    expect(
      getPlannedDays({
        employeeId: "emp0126",
        from: "2026-10-05",
        to: "2026-10-05",
      })[0].plannedCode,
    ).toBe(day.plannedCode);
  });

  it("refuses a change that breaks minimum rest", () => {
    const day = getPlannedDays({
      employeeId: "emp0127",
      from: "2026-09-24",
      to: "2026-09-24",
    })[0];
    expect(day.plannedCode).toBe("B");
    const req = createChangeRequest({
      employeeId: "emp0127",
      employeeName: "Rohit Kumar Singh",
      siteId: "s-etp",
      date: "2026-09-24",
      fromShiftId: day.plannedShiftId,
      toShiftId: "sh-morning",
      reason: "Early start",
      requestedBy: "Amit Supervisor",
      potentialOtHours: 0,
      manpowerOk: true,
    });
    expect(() => decideChangeRequest(req.id, "APPROVED")).toThrow(
      /Insufficient rest/,
    );
    expect(getChangeRequests().find((c) => c.id === req.id)?.status).toBe(
      "PENDING",
    );
    expect(
      getPlannedDays({
        employeeId: "emp0127",
        from: "2026-09-24",
        to: "2026-09-24",
      })[0].plannedCode,
    ).toBe("B");
  });
});

describe("monthly schedule draft and publish", () => {
  function smallDraft(codes: RotationAssignmentCell[] = [
    { employeeId: "emp0126", date: "2026-10-02", code: "A" },
    { employeeId: "emp0126", date: "2026-10-03", code: "A" },
  ]) {
    return submitMonthlyScheduleDraft({
      siteId: "s-etp",
      monthKey: "2026-10",
      patternId: "weekly_abc",
      groupIds: ["A"],
      assignments: codes,
    });
  }

  function publishThroughApprovals(draftId: string) {
    markRotationScheduleViewed(draftId, "manager");
    managerDecideRotation(draftId, {
      by: "Manager",
      remark: "Looks fine",
      outcome: "approved",
    });
    markRotationScheduleViewed(draftId, "director");
    return adminDecideRotation(draftId, {
      by: "Admin",
      remark: "Publish",
      outcome: "approved",
    });
  }

  it("lets SIC submit a draft while manager/director gates stay separate", () => {
    expect(canGenerateRotation(session("shift_incharge"))).toBe(true);
    expect(canAdminFinalizeRotation(session("shift_incharge"))).toBe(false);

    const draft = smallDraft();
    expect(draft.status).toBe("pending_manager");
    expect(draft.assignments?.length).toBe(2);
    expect(getRotationPreviews().some((p) => p.id === draft.id)).toBe(true);
  });

  it("requires view + remarks; director publish rewrites planned days", () => {
    const draft = smallDraft([
      { employeeId: "emp0126", date: "2026-10-02", code: "G" },
      { employeeId: "emp0126", date: "2026-10-03", code: "G" },
    ]);

    expect(() =>
      managerDecideRotation(draft.id, {
        by: "Manager",
        remark: "ok",
        outcome: "approved",
      }),
    ).toThrow(/View the schedule/);

    markRotationScheduleViewed(draft.id, "manager");
    expect(() =>
      managerDecideRotation(draft.id, {
        by: "Manager",
        remark: "   ",
        outcome: "approved",
      }),
    ).toThrow(/Remark/);

    managerDecideRotation(draft.id, {
      by: "Manager",
      remark: "Covered",
      outcome: "approved",
    });
    expect(getRotationPreviews().find((p) => p.id === draft.id)?.status).toBe(
      "pending_director",
    );

    expect(() =>
      adminDecideRotation(draft.id, {
        by: "Admin",
        remark: "Go",
        outcome: "approved",
      }),
    ).toThrow(/View the schedule/);

    markRotationScheduleViewed(draft.id, "director");
    adminDecideRotation(draft.id, {
      by: "Admin",
      remark: "Live",
      outcome: "approved",
    });

    expect(
      getPlannedDays({
        employeeId: "emp0126",
        from: "2026-10-02",
        to: "2026-10-02",
      })[0].plannedCode,
    ).toBe("G");
    expect(getRotationPreviews().find((p) => p.id === draft.id)?.status).toBe(
      "active",
    );
  });

  it("blocks another SIC draft for the same month after publish", () => {
    const draft = smallDraft();
    publishThroughApprovals(draft.id);
    expect(() => smallDraft()).toThrow(/already published/);
  });

  it("blocks draft submit when rest or covering leave needs attention", () => {
    const restClash: RotationAssignmentCell[] = [
      { employeeId: "emp0126", date: "2026-10-02", code: "C" },
      { employeeId: "emp0126", date: "2026-10-03", code: "A" },
    ];
    expect(
      validateScheduleAssignments("s-etp", restClash).some(
        (c) => c.severity === "attention" && c.type === "rest",
      ),
    ).toBe(true);
    expect(() =>
      submitMonthlyScheduleDraft({
        siteId: "s-etp",
        monthKey: "2026-10",
        patternId: "weekly_abc",
        assignments: restClash,
      }),
    ).toThrow(/conflict/);

    const leave = fileLeave({
      employeeId: "emp0126",
      entrySource: "employee",
      enteredByRole: "employee",
      startDate: "2026-10-06",
      endDate: "2026-10-06",
      expectedReturnDate: "2026-10-07",
    });
    coverAndApprove(leave.id);

    const leaveClash: RotationAssignmentCell[] = [
      { employeeId: "emp0126", date: "2026-10-06", code: "A" },
    ];
    expect(
      validateScheduleAssignments("s-etp", leaveClash).some(
        (c) => c.severity === "attention" && c.type === "leave",
      ),
    ).toBe(true);
    expect(() =>
      submitMonthlyScheduleDraft({
        siteId: "s-etp",
        monthKey: "2026-10",
        patternId: "weekly_abc",
        assignments: leaveClash,
      }),
    ).toThrow(/conflict/);
  });

  it("auto-fills both rotation patterns without rest attention conflicts", () => {
    for (const patternId of ["weekly_abc", "paired_aabbcc"] as const) {
      const assignments = buildMonthScheduleAssignments({
        siteId: "s-etp",
        monthKey: "2026-10",
        patternId,
      });
      const restAttention = validateScheduleAssignments("s-etp", assignments).filter(
        (c) => c.severity === "attention" && c.type === "rest",
      );
      expect(restAttention, patternId).toHaveLength(0);
      expect(() =>
        submitMonthlyScheduleDraft({
          siteId: "s-etp",
          monthKey: "2026-10",
          patternId,
          assignments,
        }),
      ).not.toThrow();
    }
  });
});

describe("demo reset", () => {
  it("resetDemoLocalData does not throw", () => {
    const store = new Map<string, string>();
    const localStorageMock = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    store.set("nectar-enviro-ot-assignments", "[]");
    store.set("nectar-enviro-notifications", "[]");
    store.set("nectar-enviro-session", "keep-me");

    // @ts-expect-error test stub
    globalThis.window = { localStorage: localStorageMock };
    // @ts-expect-error test stub
    globalThis.localStorage = localStorageMock;

    expect(() => resetDemoLocalData()).not.toThrow();
    expect(store.has("nectar-enviro-ot-assignments")).toBe(false);
    expect(store.has("nectar-enviro-notifications")).toBe(false);
    expect(store.get("nectar-enviro-session")).toBe("keep-me");

    // @ts-expect-error cleanup
    delete globalThis.window;
    // @ts-expect-error cleanup
    delete globalThis.localStorage;
  });
});
