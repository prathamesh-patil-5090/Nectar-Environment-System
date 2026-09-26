import type {
  AttendanceSnapshot,
  OtRateRule,
  OtRulesConfig,
} from "./types";
import { defaultOtRules } from "./rules";

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function durationHours(start: string, end: string, breakMinutes: number): number {
  const startMin = parseTimeToMinutes(start);
  let endMin = parseTimeToMinutes(end);
  if (endMin <= startMin) endMin += 24 * 60;
  const raw = Math.max(0, endMin - startMin - breakMinutes);
  return raw / 60;
}

/** Round hours up to the nearest interval (in minutes), after applying minimum. */
export function roundOtHours(
  rawHours: number,
  rules: OtRulesConfig = defaultOtRules,
): number {
  const minutes = rawHours * 60;
  if (minutes < rules.minimumOTMinutes) return 0;
  const interval = rules.roundingInterval || 1;
  const rounded = Math.ceil(minutes / interval) * interval;
  let hours = rounded / 60;
  if (rules.maximumDailyOTHours != null) {
    hours = Math.min(hours, rules.maximumDailyOTHours);
  }
  return Math.round(hours * 100) / 100;
}

export type OtEngineInput = {
  attendance: AttendanceSnapshot;
  otEligible: boolean;
  rateRule: OtRateRule;
  rules?: OtRulesConfig;
};

export type OtEngineResult = {
  scheduledHours: number;
  actualHours: number;
  rawOtHours: number;
  otHours: number;
  otRate: number;
  otCost: number;
  eligible: boolean;
  skipReason?: string;
};

/**
 * Central OT calculation engine — single source of truth for hours and cost.
 * OT Hours = eligible actual duration − scheduled duration (with rule guards).
 */
export function calculateOt(input: OtEngineInput): OtEngineResult {
  const rules = input.rules ?? defaultOtRules;
  const { attendance, rateRule, otEligible } = input;

  const scheduledHours = durationHours(
    attendance.scheduledStart,
    attendance.scheduledEnd,
    attendance.breakMinutes,
  );
  const actualHours = durationHours(
    attendance.actualStart,
    attendance.actualEnd,
    attendance.breakMinutes,
  );

  if (!otEligible) {
    return {
      scheduledHours,
      actualHours,
      rawOtHours: 0,
      otHours: 0,
      otRate: 0,
      otCost: 0,
      eligible: false,
      skipReason: "Employee not OT-eligible",
    };
  }

  if (attendance.onApprovedLeave) {
    return {
      scheduledHours,
      actualHours,
      rawOtHours: 0,
      otHours: 0,
      otRate: 0,
      otCost: 0,
      eligible: false,
      skipReason: "Approved leave",
    };
  }

  let rawOt = 0;
  if (attendance.isWeeklyOff) {
    if (!rules.weeklyOffOTEnabled) {
      return {
        scheduledHours,
        actualHours,
        rawOtHours: 0,
        otHours: 0,
        otRate: 0,
        otCost: 0,
        eligible: false,
        skipReason: "Weekly-off OT disabled",
      };
    }
    rawOt = actualHours;
  } else if (attendance.isHoliday) {
    if (!rules.holidayOTEnabled) {
      return {
        scheduledHours,
        actualHours,
        rawOtHours: 0,
        otHours: 0,
        otRate: 0,
        otCost: 0,
        eligible: false,
        skipReason: "Holiday OT disabled",
      };
    }
    rawOt = actualHours;
  } else {
    rawOt = Math.max(0, actualHours - scheduledHours);
  }

  const otHours = roundOtHours(rawOt, rules);
  let multiplier = rateRule.multiplier;
  if (attendance.isHoliday) multiplier = rateRule.holidayMultiplier;
  else if (attendance.isWeeklyOff) multiplier = rateRule.weeklyOffMultiplier;

  const otRate = Math.round(rateRule.baseHourlyRate * multiplier * 100) / 100;
  const otCost = Math.round(otHours * otRate * 100) / 100;

  return {
    scheduledHours: Math.round(scheduledHours * 100) / 100,
    actualHours: Math.round(actualHours * 100) / 100,
    rawOtHours: Math.round(rawOt * 100) / 100,
    otHours,
    otRate,
    otCost,
    eligible: otHours > 0,
  };
}
