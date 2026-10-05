export const leavePolicySeed = {
  id: 'org-default',
  allowedLeaveTypes: [
    'casual',
    'sick',
    'family_emergency',
    'unpaid',
    'other',
  ],
  noticeDays: 2,
  noticeSeverity: 'warn' as const,
  halfDayAllowed: true,
  restrictedPeriods: [
    {
      id: 'rp-year-end',
      label: 'Year-end operations freeze',
      startDate: '2026-12-24',
      endDate: '2026-12-31',
    },
    {
      id: 'rp-diwali',
      label: 'Diwali critical staffing window',
      startDate: '2026-11-08',
      endDate: '2026-11-14',
    },
  ],
  active: true,
};

/** Demo balances — shortfall cases for emp0135 (low sick) and ample for operators. */
export const leaveBalancesSeed = [
  {
    employeeId: 'emp0126',
    balances: { casual: 8, sick: 6, family_emergency: 3, unpaid: 30, other: 2 },
  },
  {
    employeeId: 'emp0127',
    balances: { casual: 6, sick: 4, family_emergency: 2, unpaid: 30, other: 2 },
  },
  {
    employeeId: 'emp0128',
    balances: { casual: 5, sick: 5, family_emergency: 3, unpaid: 30, other: 2 },
  },
  {
    employeeId: 'emp0130',
    balances: { casual: 10, sick: 8, family_emergency: 3, unpaid: 30, other: 2 },
  },
  {
    employeeId: 'emp0134',
    balances: { casual: 5, sick: 5, family_emergency: 2, unpaid: 30, other: 2 },
  },
  {
    employeeId: 'emp0135',
    balances: { casual: 1, sick: 0.5, family_emergency: 1, unpaid: 30, other: 1 },
  },
  {
    employeeId: 'emp0142',
    balances: { casual: 4, sick: 3, family_emergency: 2, unpaid: 30, other: 2 },
  },
  {
    employeeId: 'emp0143',
    balances: { casual: 7, sick: 5, family_emergency: 3, unpaid: 30, other: 2 },
  },
  // Default template for remaining demo staff
  ...[
    'emp0123',
    'emp0124',
    'emp0125',
    'emp0129',
    'emp0131',
    'emp0132',
    'emp0133',
    'emp0136',
    'emp0137',
    'emp0138',
    'emp0139',
    'emp0140',
    'emp0141',
    'emp0144',
    'emp0145',
    'emp0146',
    'emp0147',
  ].map((employeeId) => ({
    employeeId,
    balances: {
      casual: 8,
      sick: 6,
      family_emergency: 3,
      unpaid: 30,
      other: 2,
    },
  })),
];
