export const trainingAssignmentsSeed = [
  {
    id: 'asgn-0126-etp201',
    employeeId: 'emp0126', // Shilpa Hotkar (ETP Lead Operator)
    courseId: 'course-etp-201',
    moduleId: 'mod-etp-201-svi',
    assignedByEmployeeId: 'emp0125',
    assignedByName: 'Anand Dakave (ETP Plant Manager)',
    reason:
      'High SVI and filamentous bulking risk observed in Aeration Basin B. Mandatory operational drill on return sludge pacing.',
    priority: 'critical',
    status: 'assigned',
    dueDate: '2026-10-15T18:30:00.000Z',
    createdAt: '2026-09-27T08:30:00.000Z',
  },
  {
    id: 'asgn-0126-env202',
    employeeId: 'emp0126', // Shilpa Hotkar
    courseId: 'course-env-202',
    assignedByEmployeeId: 'emp0125',
    assignedByName: 'Anand Dakave (ETP Plant Manager)',
    reason:
      'SPCB real-time OCEMS analyzer recalibration and COD/TSS optical probe buffer drift verification before audit.',
    priority: 'high',
    status: 'assigned',
    dueDate: '2026-10-20T18:30:00.000Z',
    createdAt: '2026-09-28T10:00:00.000Z',
  },
  {
    id: 'asgn-0127-env101',
    employeeId: 'emp0127', // Rahul Kadam
    courseId: 'course-env-101',
    assignedByEmployeeId: 'emp0123',
    assignedByName: 'Prashant Patil (Executive Director)',
    reason:
      'Statutory compliance filing: SPCB Annual Environment Statement Form V submission & Consent to Operate renewal documentation.',
    priority: 'critical',
    status: 'assigned',
    dueDate: '2026-10-12T18:30:00.000Z',
    createdAt: '2026-09-26T09:00:00.000Z',
  },
  {
    id: 'asgn-0129-ops301',
    employeeId: 'emp0129', // Tanaji Ghadge
    courseId: 'course-ops-301',
    moduleId: 'mod-ro-301-cip',
    assignedByEmployeeId: 'emp0130',
    assignedByName: 'Vikram Solanki (WTP/RO Supervisor)',
    reason:
      'RO Stage-2 feed-to-concentrate differential pressure spike. High-pH CIP chemical cleaning procedure required.',
    priority: 'high',
    status: 'assigned',
    dueDate: '2026-10-18T18:30:00.000Z',
    createdAt: '2026-09-28T11:15:00.000Z',
  },
];
