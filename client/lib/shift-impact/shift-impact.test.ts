import { beforeEach, describe, expect, it } from "vitest";
import { employees } from "@/lib/mock-data";
import {
  createLeaveRequest,
  resetLeaveStore,
  supervisorVerify,
} from "@/lib/leave/store";
import { resetRelieverPool } from "@/lib/reliever/pool";
import { resetShiftStore } from "@/lib/shift/store";
import {
  computeShiftImpact,
  employeeSkillTags,
  inferRequiredSkills,
  leaveImpactFromEngine,
  listCoverOptionsForSite,
  rankCoverCandidates,
} from "@/lib/shift-impact";

// Side-effect imports register Shift Impact APIs
import "@/lib/leave/store";
import "@/lib/reliever/pool";
import "@/lib/shift/store";

describe("shift-impact skills", () => {
  it("infers plant ops + safety for a site", () => {
    const skills = inferRequiredSkills("s-etp", "A");
    expect(skills).toContain("ETP Ops");
    expect(skills).toContain("Safety");
  });

  it("maps employee skill matrix into SkillTags", () => {
    const emp = employees.find((e) => e.siteId === "s-etp" && e.employmentStatus === "active");
    expect(emp).toBeTruthy();
    const tags = employeeSkillTags(emp!);
    expect(tags.length).toBeGreaterThan(0);
    expect(tags).toContain("ETP Ops");
  });
});

describe("shift-impact candidates", () => {
  beforeEach(() => {
    resetLeaveStore();
    resetRelieverPool();
    resetShiftStore();
  });

  it("ranks local employees above cluster pool", () => {
    const ranked = rankCoverCandidates({
      siteId: "s-etp",
      date: "2026-09-30",
      requiredSkills: inferRequiredSkills("s-etp", "A"),
      excludeEmployeeIds: [],
      coveringLeave: () => false,
      plannedDay: () => ({ plannedCode: "OFF" }),
    });
    expect(ranked.length).toBeGreaterThan(0);
    const first = ranked[0];
    expect(
      first.source === "local_employee" || first.source === "local_pool",
    ).toBe(true);
  });

  it("excludes employees on covering leave", () => {
    const emp = employees.find(
      (e) => e.siteId === "s-etp" && e.employmentStatus === "active",
    )!;
    const ranked = rankCoverCandidates({
      siteId: "s-etp",
      date: "2026-09-30",
      requiredSkills: inferRequiredSkills("s-etp", "A"),
      coveringLeave: (id) => id === emp.id,
      plannedDay: () => ({ plannedCode: "OFF" }),
    });
    expect(ranked.every((c) => c.employeeId !== emp.id && c.id !== emp.id)).toBe(
      true,
    );
  });
});

describe("shift-impact engine", () => {
  beforeEach(() => {
    resetLeaveStore();
    resetRelieverPool();
    resetShiftStore();
  });

  it("emits leave vacancies for covering leave working days", () => {
    const emp = employees.find(
      (e) => e.siteId === "s-etp" && e.employeeCategory === "shift",
    )!;
    const leave = createLeaveRequest({
      employeeId: emp.id,
      mode: "planned",
      leaveType: "casual",
      startDate: "2026-09-30",
      endDate: "2026-10-01",
      expectedReturnDate: "2026-10-01",
      reason: "Test",
      entrySource: "employee",
      enteredByName: emp.name,
      enteredByRole: "employee",
      supervisorName: "Amit Supervisor",
      siteInChargeName: "Sanjay Jadhav",
    });

    const report = computeShiftImpact({
      siteId: "s-etp",
      from: "2026-09-30",
      to: "2026-10-01",
      focusLeaveId: leave.id,
    });

    const leaveVacancies = report.vacancies.filter(
      (v) => v.source === "leave" && v.leaveId === leave.id,
    );
    expect(leaveVacancies.length).toBeGreaterThan(0);
    expect(leaveVacancies.every((v) => v.shiftCode !== "OFF")).toBe(true);
  });

  it("emits roster gaps without leave when headcount short", () => {
    const report = computeShiftImpact({
      siteId: "s-etp",
      from: "2026-09-23",
      to: "2026-09-23",
    });
    // May or may not have gaps depending on seeded roster — assert shape
    for (const v of report.vacancies.filter((x) => x.source === "roster_gap")) {
      expect(v.leaveId).toBeUndefined();
      expect(v.candidates).toBeDefined();
    }
    expect(report.risk === "none" || report.risk === "low" || report.risk === "high").toBe(
      true,
    );
  });

  it("flags OT when a vacancy has no candidates", () => {
    const report = computeShiftImpact({
      siteId: "s-etp",
      from: "2026-09-23",
      to: "2026-09-23",
    });
    const uncovered = report.vacancies.filter(
      (v) => v.status === "open" && v.candidates.length === 0,
    );
    expect(report.uncoveredCount).toBe(uncovered.length);
    expect(report.potentialOtHours).toBe(uncovered.length * 8);
  });

  it("leaveImpactFromEngine returns LeaveImpact-compatible shape", () => {
    const emp = employees.find((e) => e.siteId === "s-etp")!;
    const impact = leaveImpactFromEngine(emp.id, "2026-09-30", "2026-10-01");
    expect(impact.employeeId).toBe(emp.id);
    expect(impact.affectedShiftDays.length).toBeGreaterThanOrEqual(0);
    expect(impact.report).toBeTruthy();
    expect(["none", "low", "high"]).toContain(impact.risk);
  });

  it("listCoverOptionsForSite includes employees and pool", () => {
    const { all } = listCoverOptionsForSite("s-etp", "2026-09-30");
    const kinds = new Set(all.map((c) => c.kind));
    expect(kinds.has("employee") || kinds.has("reliever")).toBe(true);
  });

  it("keeps focus leave vacancies after supervisor verify", () => {
    const emp = employees.find(
      (e) => e.siteId === "s-etp" && e.employeeCategory === "shift",
    )!;
    const leave = createLeaveRequest({
      employeeId: emp.id,
      mode: "planned",
      leaveType: "casual",
      startDate: "2026-09-30",
      endDate: "2026-09-30",
      expectedReturnDate: "2026-10-01",
      reason: "Test",
      entrySource: "employee",
      enteredByName: emp.name,
      enteredByRole: "employee",
      supervisorName: "Amit Supervisor",
      siteInChargeName: "Sanjay Jadhav",
    });
    supervisorVerify(leave.id, "Supervisor");
    const report = computeShiftImpact({
      focusLeaveId: leave.id,
      from: leave.startDate,
      to: leave.endDate,
    });
    expect(report.focusLeaveId).toBe(leave.id);
    expect(
      report.vacancies.some((v) => v.leaveId === leave.id),
    ).toBe(true);
  });
});
