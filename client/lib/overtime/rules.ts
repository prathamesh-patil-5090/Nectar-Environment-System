import type { OtRulesConfig, OtRateRule, PayCategory } from "./types";

export const defaultOtRules: OtRulesConfig = {
  minimumOTMinutes: 30,
  roundingInterval: 30,
  maximumDailyOTHours: 4,
  weeklyOffOTEnabled: true,
  holidayOTEnabled: true,
  highOtHoursThreshold: 24,
  highOtSiteHoursThreshold: 180,
  repeatedOtDaysThreshold: 6,
  concentrationShareThreshold: 0.18,
};

export const otRateRules: OtRateRule[] = [
  {
    id: "r-op",
    payCategory: "operator",
    baseHourlyRate: 180,
    multiplier: 1.5,
    weeklyOffMultiplier: 2,
    holidayMultiplier: 2,
  },
  {
    id: "r-tech",
    payCategory: "technician",
    baseHourlyRate: 220,
    multiplier: 1.5,
    weeklyOffMultiplier: 2,
    holidayMultiplier: 2,
  },
  {
    id: "r-sup",
    payCategory: "supervisor",
    baseHourlyRate: 320,
    multiplier: 1.25,
    weeklyOffMultiplier: 1.75,
    holidayMultiplier: 2,
  },
  {
    id: "r-analyst",
    payCategory: "analyst",
    baseHourlyRate: 260,
    multiplier: 1.5,
    weeklyOffMultiplier: 2,
    holidayMultiplier: 2,
  },
  {
    id: "r-lead",
    payCategory: "lead",
    baseHourlyRate: 300,
    multiplier: 1.5,
    weeklyOffMultiplier: 2,
    holidayMultiplier: 2,
  },
];

export function getRateRule(payCategory: PayCategory): OtRateRule {
  return (
    otRateRules.find((r) => r.payCategory === payCategory) ?? otRateRules[0]
  );
}
