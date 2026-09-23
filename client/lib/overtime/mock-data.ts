import { employees, sites } from "@/lib/mock-data";
import { calculateOt } from "./engine";
import { getRateRule } from "./rules";
import type {
  OtReasonCode,
  OtRecord,
  OtStatus,
  Shift,
} from "./types";

export const shifts: Shift[] = [
  {
    id: "sh-morning",
    name: "A Shift (Morning)",
    type: "morning",
    startTime: "06:00",
    endTime: "14:00",
    scheduledHours: 8,
    breakMinutes: 30,
  },
  {
    id: "sh-afternoon",
    name: "B Shift (Afternoon)",
    type: "afternoon",
    startTime: "14:00",
    endTime: "22:00",
    scheduledHours: 8,
    breakMinutes: 30,
  },
  {
    id: "sh-night",
    name: "C Shift (Night)",
    type: "night",
    startTime: "22:00",
    endTime: "06:00",
    scheduledHours: 8,
    breakMinutes: 30,
  },
  {
    id: "sh-general",
    name: "General Shift",
    type: "morning",
    startTime: "09:00",
    endTime: "18:00",
    scheduledHours: 8,
    breakMinutes: 60,
  },
];

export function getShiftById(id: string): Shift | undefined {
  return shifts.find((s) => s.id === id);
}

const REASONS: OtReasonCode[] = [
  "employee_absence",
  "operational_requirement",
  "emergency",
  "shift_gap",
  "plant_upset",
];

const STATUSES: OtStatus[] = [
  "APPROVED",
  "APPROVED",
  "APPROVED",
  "PAID",
  "PAID",
  "PENDING",
  "REJECTED",
];

function seeded(n: number): number {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const norm = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(norm / 60)).padStart(2, "0");
  const mm = String(norm % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Deterministic OT dataset spanning available years — generated via the OT engine. */
function buildOtRecords(): OtRecord[] {
  const records: OtRecord[] = [];
  const start = new Date("2025-07-01T00:00:00Z");
  const end = new Date("2026-09-20T00:00:00Z");
  let seq = 0;

  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const dateStr = formatDate(day);
    const dow = day.getUTCDay();
    const daySeed = day.getUTCFullYear() * 1000 + day.getUTCMonth() * 40 + day.getUTCDate();

    for (let ei = 0; ei < employees.length; ei++) {
      const emp = employees[ei];
      if (!emp.otEligible || emp.employmentStatus !== "active") continue;

      const roll = seeded(daySeed * 17 + ei * 31);
      // ~28% of employee-days produce OT candidates
      if (roll > 0.28) continue;

      const shift = getShiftById(emp.shiftId) ?? shifts[0];
      const isWeeklyOff = dow === 0;
      const isHoliday =
        (day.getUTCMonth() === 0 && day.getUTCDate() === 26) ||
        (day.getUTCMonth() === 7 && day.getUTCDate() === 15);

      const extraMinutes = Math.round(30 + seeded(daySeed + ei * 7) * 150);
      const actualEnd = addMinutes(shift.endTime, extraMinutes);
      const onLeave = seeded(daySeed + ei) < 0.03;

      const calc = calculateOt({
        otEligible: emp.otEligible,
        rateRule: getRateRule(emp.payCategory),
        attendance: {
          scheduledStart: shift.startTime,
          scheduledEnd: shift.endTime,
          actualStart: shift.startTime,
          actualEnd,
          breakMinutes: shift.breakMinutes,
          isWeeklyOff,
          isHoliday,
          onApprovedLeave: onLeave,
        },
      });

      if (!calc.eligible || calc.otHours <= 0) continue;

      const reason =
        REASONS[Math.floor(seeded(daySeed + ei * 3) * REASONS.length)];
      const status =
        STATUSES[Math.floor(seeded(daySeed + ei * 5) * STATUSES.length)];

      const hourBucket = Math.floor(
        (parseInt(shift.endTime.split(":")[0], 10) +
          Math.floor(extraMinutes / 60)) %
          24,
      );

      seq += 1;
      const id = `ot-${seq.toString().padStart(4, "0")}`;
      const approved =
        status === "APPROVED" || status === "PAID"
          ? {
              approvedBy: "hr.ops@nectarenviro.com",
              approvedAt: `${dateStr}T18:00:00Z`,
            }
          : {};

      records.push({
        id,
        employeeId: emp.id,
        siteId: emp.siteId,
        date: dateStr,
        shiftId: shift.id,
        department: emp.department,
        scheduledHours: calc.scheduledHours,
        actualHours: calc.actualHours,
        otHours: calc.otHours,
        otRate: calc.otRate,
        otCost: calc.otCost,
        reason,
        status,
        dayOfWeek: dow,
        hourBucket,
        ...approved,
        createdAt: `${dateStr}T12:00:00Z`,
        updatedAt: `${dateStr}T18:00:00Z`,
      });
    }
  }

  return records;
}

export const otRecords: OtRecord[] = buildOtRecords();

export const departments = [
  ...new Set(employees.map((e) => e.department)),
].sort();

export const availableOtYears = [
  ...new Set(otRecords.map((r) => Number(r.date.slice(0, 4)))),
].sort();

export function getSiteAbsenteeismProxy(siteId: string, from: string, to: string) {
  // Proxy: count of OT reasons tagged employee_absence / shift_gap in period
  const relevant = otRecords.filter(
    (r) =>
      r.siteId === siteId &&
      r.date >= from &&
      r.date <= to &&
      (r.reason === "employee_absence" || r.reason === "shift_gap"),
  );
  return {
    absenceLinkedOtHours: relevant.reduce((s, r) => s + r.otHours, 0),
    absenceLinkedCount: relevant.length,
    siteHeadcount: sites.find((s) => s.id === siteId)?.headcount ?? 0,
  };
}
