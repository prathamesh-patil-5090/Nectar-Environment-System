import {
  evaluateLeavePolicy,
  type LeavePolicyConfig,
} from './leave-policy.engine';

const basePolicy: LeavePolicyConfig = {
  allowedLeaveTypes: [
    'casual',
    'sick',
    'family_emergency',
    'unpaid',
    'other',
  ],
  noticeDays: 2,
  noticeSeverity: 'warn',
  halfDayAllowed: true,
  restrictedPeriods: [
    {
      id: 'rp-diwali',
      label: 'Diwali critical staffing window',
      startDate: '2026-11-08',
      endDate: '2026-11-14',
    },
  ],
};

const activeEmployee = {
  id: 'emp0126',
  employeeId: 'emp0126',
  employmentStatus: 'active',
};

describe('evaluateLeavePolicy', () => {
  it('PASS for valid planned leave with notice and balance', () => {
    const result = evaluateLeavePolicy(
      {
        employeeId: 'emp0126',
        mode: 'planned',
        leaveType: 'casual',
        startDate: '2026-10-10',
        endDate: '2026-10-11',
        expectedReturnDate: '2026-10-12',
        entrySource: 'employee',
        asOfDate: '2026-10-01',
      },
      {
        employee: activeEmployee,
        policy: basePolicy,
        balances: { casual: 8 },
        overlappingLeaves: [],
      },
    );
    expect(result.verdict).toBe('PASS');
    expect(result.daysRequested).toBe(2);
  });

  it('BLOCK overlapping covering leave', () => {
    const result = evaluateLeavePolicy(
      {
        employeeId: 'emp0126',
        mode: 'planned',
        leaveType: 'casual',
        startDate: '2026-09-25',
        endDate: '2026-09-26',
        asOfDate: '2026-09-20',
      },
      {
        employee: activeEmployee,
        policy: basePolicy,
        balances: { casual: 8 },
        overlappingLeaves: [
          {
            id: 'lv1',
            startDate: '2026-09-25',
            endDate: '2026-09-26',
            status: 'REQUESTED',
          },
        ],
      },
    );
    expect(result.verdict).toBe('BLOCK');
    expect(result.flags.some((f) => f.code === 'OVERLAPPING_LEAVE')).toBe(true);
  });

  it('WARN short notice for planned leave', () => {
    const result = evaluateLeavePolicy(
      {
        employeeId: 'emp0126',
        mode: 'planned',
        leaveType: 'casual',
        startDate: '2026-09-24',
        endDate: '2026-09-24',
        asOfDate: '2026-09-23',
      },
      {
        employee: activeEmployee,
        policy: basePolicy,
        balances: { casual: 8 },
        overlappingLeaves: [],
      },
    );
    expect(result.verdict).toBe('WARN');
    expect(result.flags.some((f) => f.code === 'SHORT_NOTICE')).toBe(true);
  });

  it('skips notice WARN for emergency leave', () => {
    const result = evaluateLeavePolicy(
      {
        employeeId: 'emp0126',
        mode: 'emergency',
        leaveType: 'family_emergency',
        startDate: '2026-09-24',
        endDate: '2026-09-24',
        asOfDate: '2026-09-23',
      },
      {
        employee: activeEmployee,
        policy: basePolicy,
        balances: { family_emergency: 3 },
        overlappingLeaves: [],
      },
    );
    expect(result.flags.some((f) => f.code === 'SHORT_NOTICE')).toBe(false);
    expect(result.verdict).not.toBe('BLOCK');
  });

  it('WARN insufficient balance with unpaid suggestion', () => {
    const result = evaluateLeavePolicy(
      {
        employeeId: 'emp0135',
        mode: 'planned',
        leaveType: 'sick',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        asOfDate: '2026-10-01',
      },
      {
        employee: { ...activeEmployee, id: 'emp0135', employeeId: 'emp0135' },
        policy: basePolicy,
        balances: { sick: 0.5 },
        overlappingLeaves: [],
      },
    );
    expect(result.verdict).toBe('WARN');
    expect(result.flags.some((f) => f.code === 'INSUFFICIENT_BALANCE')).toBe(
      true,
    );
    expect(result.suggestions[0]).toMatch(/unpaid/i);
  });

  it('half-day sets daysRequested to 0.5', () => {
    const result = evaluateLeavePolicy(
      {
        employeeId: 'emp0126',
        mode: 'planned',
        leaveType: 'casual',
        startDate: '2026-10-10',
        endDate: '2026-10-10',
        isHalfDay: true,
        halfDaySlot: 'morning',
        asOfDate: '2026-10-01',
      },
      {
        employee: activeEmployee,
        policy: basePolicy,
        balances: { casual: 8 },
        overlappingLeaves: [],
      },
    );
    expect(result.daysRequested).toBe(0.5);
    expect(result.verdict).toBe('PASS');
  });

  it('WARN restricted period intersection', () => {
    const result = evaluateLeavePolicy(
      {
        employeeId: 'emp0126',
        mode: 'planned',
        leaveType: 'casual',
        startDate: '2026-11-10',
        endDate: '2026-11-11',
        asOfDate: '2026-11-01',
      },
      {
        employee: activeEmployee,
        policy: basePolicy,
        balances: { casual: 8 },
        overlappingLeaves: [],
      },
    );
    expect(result.verdict).toBe('WARN');
    expect(result.flags.some((f) => f.code === 'RESTRICTED_PERIOD')).toBe(true);
  });

  it('BLOCK inactive employee', () => {
    const result = evaluateLeavePolicy(
      {
        employeeId: 'emp0999',
        mode: 'planned',
        leaveType: 'casual',
        startDate: '2026-10-10',
        endDate: '2026-10-10',
        asOfDate: '2026-10-01',
      },
      {
        employee: {
          id: 'emp0999',
          employmentStatus: 'inactive',
        },
        policy: basePolicy,
        balances: { casual: 8 },
        overlappingLeaves: [],
      },
    );
    expect(result.verdict).toBe('BLOCK');
    expect(result.flags.some((f) => f.code === 'EMPLOYEE_INACTIVE')).toBe(true);
  });
});
