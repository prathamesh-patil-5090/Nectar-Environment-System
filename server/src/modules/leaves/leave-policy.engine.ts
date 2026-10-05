/**
 * Pure Leave Policy Engine — no Nest/Mongo imports.
 * Used by LeavePolicyService and unit tests.
 */

export type PolicyVerdict = 'PASS' | 'WARN' | 'BLOCK';

export type PolicyFlag = {
  code: string;
  severity: 'warn' | 'block';
  message: string;
};

export type LeavePolicyConfig = {
  allowedLeaveTypes: string[];
  noticeDays: number;
  noticeSeverity: 'warn' | 'block';
  halfDayAllowed: boolean;
  restrictedPeriods: Array<{
    id: string;
    label: string;
    startDate: string;
    endDate: string;
  }>;
};

export type LeavePolicyInput = {
  employeeId: string;
  mode: 'planned' | 'emergency' | string;
  leaveType: string;
  startDate: string;
  endDate: string;
  expectedReturnDate?: string;
  entrySource?: 'employee' | 'supervisor_on_behalf' | string;
  isHalfDay?: boolean;
  halfDaySlot?: 'morning' | 'afternoon' | string;
  /** ISO date YYYY-MM-DD used as "today" for notice checks (injectable for tests). */
  asOfDate?: string;
};

export type LeavePolicyContext = {
  employee?: {
    id?: string;
    employeeId?: string;
    employmentStatus?: string;
  } | null;
  policy: LeavePolicyConfig;
  balances?: Record<string, number> | null;
  /** Existing leaves that still cover shift days for this employee. */
  overlappingLeaves?: Array<{
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
};

export type LeavePolicyResult = {
  verdict: PolicyVerdict;
  flags: PolicyFlag[];
  daysRequested: number;
  balanceSnapshot?: {
    leaveType: string;
    available: number;
    afterRequest: number;
  };
  suggestions: string[];
};

/** Statuses that still occupy the employee's planned days (mirrors client COVERING). */
export const COVERING_LEAVE_STATUSES = [
  'REQUESTED',
  'PENDING_EMPLOYEE_CONSENT',
  'SUPERVISOR_VERIFIED',
  'SITE_APPROVED',
  'MANAGER_APPROVED',
  'HR_VALIDATED',
  'APPROVED',
  'ABSENT',
  'SUPERVISOR_RECORDED',
  'SITE_VERIFIED',
  'PENDING_INFORMATION',
  'UNEXPLAINED_ABSENCE',
  'EXTENSION_REQUIRED',
] as const;

export function dayCount(start: string, end: string): number {
  const a = new Date(start + 'T00:00:00Z').getTime();
  const b = new Date(end + 'T00:00:00Z').getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export function calendarDaysUntil(fromDate: string, toDate: string): number {
  const a = new Date(fromDate + 'T00:00:00Z').getTime();
  const b = new Date(toDate + 'T00:00:00Z').getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function pushFlag(
  flags: PolicyFlag[],
  code: string,
  severity: 'warn' | 'block',
  message: string,
) {
  flags.push({ code, severity, message });
}

export function evaluateLeavePolicy(
  input: LeavePolicyInput,
  ctx: LeavePolicyContext,
): LeavePolicyResult {
  const flags: PolicyFlag[] = [];
  const suggestions: string[] = [];
  const asOf = input.asOfDate ?? new Date().toISOString().slice(0, 10);

  // 1. Employee active
  const emp = ctx.employee;
  if (!emp) {
    pushFlag(flags, 'EMPLOYEE_NOT_FOUND', 'block', 'Employee not found');
  } else if ((emp.employmentStatus ?? 'active') !== 'active') {
    pushFlag(
      flags,
      'EMPLOYEE_INACTIVE',
      'block',
      'Employee is not active and cannot request leave',
    );
  }

  // 2. Dates
  const { startDate, endDate, expectedReturnDate } = input;
  if (!startDate || !endDate || startDate > endDate) {
    pushFlag(
      flags,
      'INVALID_DATES',
      'block',
      'Leave start date must be on or before end date',
    );
  }
  if (expectedReturnDate && endDate && expectedReturnDate < endDate) {
    pushFlag(
      flags,
      'INVALID_RETURN_DATE',
      'block',
      'Expected return date must be on or after leave end date',
    );
  }

  // 8 (early): Half-day constraints affect daysRequested
  let daysRequested = 0;
  if (input.isHalfDay) {
    if (!ctx.policy.halfDayAllowed) {
      pushFlag(
        flags,
        'HALF_DAY_NOT_ALLOWED',
        'block',
        'Half-day leave is not allowed by policy',
      );
    }
    if (startDate && endDate && startDate !== endDate) {
      pushFlag(
        flags,
        'HALF_DAY_MULTI_DAY',
        'block',
        'Half-day leave must be a single calendar day',
      );
    }
    if (!input.halfDaySlot || !['morning', 'afternoon'].includes(input.halfDaySlot)) {
      pushFlag(
        flags,
        'HALF_DAY_SLOT_REQUIRED',
        'block',
        'Half-day leave requires morning or afternoon slot',
      );
    }
    daysRequested = 0.5;
  } else if (startDate && endDate && startDate <= endDate) {
    daysRequested = dayCount(startDate, endDate);
  }

  // 3. Leave type
  const allowed = ctx.policy.allowedLeaveTypes ?? [];
  if (!input.leaveType || !allowed.includes(input.leaveType)) {
    pushFlag(
      flags,
      'INVALID_LEAVE_TYPE',
      'block',
      `Leave type "${input.leaveType || ''}" is not allowed`,
    );
  }

  // 4. Overlap
  const overlaps = (ctx.overlappingLeaves ?? []).filter((l) =>
    COVERING_LEAVE_STATUSES.includes(
      l.status as (typeof COVERING_LEAVE_STATUSES)[number],
    ),
  );
  if (startDate && endDate) {
    const hit = overlaps.find((l) =>
      rangesOverlap(startDate, endDate, l.startDate, l.endDate),
    );
    if (hit) {
      pushFlag(
        flags,
        'OVERLAPPING_LEAVE',
        'block',
        `Overlaps existing leave ${hit.id} (${hit.startDate} → ${hit.endDate})`,
      );
    }
  }

  // 5. Notice period (planned only)
  if (input.mode === 'planned' && startDate && !flags.some((f) => f.code === 'INVALID_DATES')) {
    const daysOut = calendarDaysUntil(asOf, startDate);
    if (daysOut < ctx.policy.noticeDays) {
      const severity = ctx.policy.noticeSeverity;
      pushFlag(
        flags,
        'SHORT_NOTICE',
        severity,
        `Planned leave requires ${ctx.policy.noticeDays} day(s) notice; requested ${daysOut} day(s) out`,
      );
    }
  }

  // 6. Restricted periods
  if (startDate && endDate) {
    for (const rp of ctx.policy.restrictedPeriods ?? []) {
      if (rangesOverlap(startDate, endDate, rp.startDate, rp.endDate)) {
        pushFlag(
          flags,
          'RESTRICTED_PERIOD',
          'warn',
          `Leave intersects restricted period: ${rp.label} (${rp.startDate} → ${rp.endDate})`,
        );
      }
    }
  }

  // 7. Balance
  const balances = ctx.balances ?? {};
  const available =
    typeof balances[input.leaveType] === 'number'
      ? balances[input.leaveType]
      : input.leaveType === 'unpaid'
        ? 999
        : 0;
  const afterRequest = available - daysRequested;
  const balanceSnapshot =
    input.leaveType && daysRequested > 0
      ? {
          leaveType: input.leaveType,
          available,
          afterRequest,
        }
      : undefined;

  if (
    input.leaveType &&
    input.leaveType !== 'unpaid' &&
    daysRequested > 0 &&
    afterRequest < 0
  ) {
    pushFlag(
      flags,
      'INSUFFICIENT_BALANCE',
      'warn',
      `Insufficient ${input.leaveType} balance: need ${daysRequested} day(s), have ${available}`,
    );
    suggestions.push('Convert excess days to unpaid / exception path');
  }

  // 9. On-behalf consent path
  if (
    input.entrySource === 'supervisor_on_behalf' &&
    input.mode === 'planned'
  ) {
    pushFlag(
      flags,
      'REQUIRES_EMPLOYEE_CONSENT',
      'warn',
      'Supervisor-filed planned leave requires employee consent before verification',
    );
  }

  const hasBlock = flags.some((f) => f.severity === 'block');
  const hasWarn = flags.some((f) => f.severity === 'warn');
  const verdict: PolicyVerdict = hasBlock ? 'BLOCK' : hasWarn ? 'WARN' : 'PASS';

  return {
    verdict,
    flags,
    daysRequested,
    balanceSnapshot,
    suggestions,
  };
}
