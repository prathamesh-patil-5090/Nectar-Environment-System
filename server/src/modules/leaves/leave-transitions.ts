/** Mirrors client leave state machine — illegal jumps are rejected. */

export type LeaveMode = 'planned' | 'emergency';

const PLANNED_NEXT: Record<string, string[]> = {
  PENDING_EMPLOYEE_CONSENT: ['REQUESTED', 'REJECTED', 'CANCELLED'],
  REQUESTED: ['SUPERVISOR_VERIFIED', 'REJECTED', 'CANCELLED'],
  SUPERVISOR_VERIFIED: [
    'SITE_APPROVED',
    'PENDING_INFORMATION',
    'REJECTED',
    'CANCELLED',
  ],
  SITE_APPROVED: ['MANAGER_APPROVED', 'REJECTED', 'CANCELLED'],
  MANAGER_APPROVED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CLOSED', 'EXTENSION_REQUIRED', 'CANCELLED'],
  EXTENSION_REQUIRED: ['CLOSED', 'CANCELLED'],
};

const EMERGENCY_NEXT: Record<string, string[]> = {
  ABSENT: ['SUPERVISOR_RECORDED', 'REJECTED', 'CANCELLED'],
  SUPERVISOR_RECORDED: [
    'SITE_VERIFIED',
    'PENDING_INFORMATION',
    'REJECTED',
    'CANCELLED',
  ],
  SITE_VERIFIED: ['MANAGER_APPROVED', 'REJECTED', 'CANCELLED'],
  MANAGER_APPROVED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CLOSED', 'EXTENSION_REQUIRED', 'CANCELLED'],
  EXTENSION_REQUIRED: ['CLOSED', 'CANCELLED'],
};

export function assertLeaveTransition(
  mode: string | undefined,
  from: string,
  to: string,
): void {
  if (from === to) return;
  const table = mode === 'emergency' ? EMERGENCY_NEXT : PLANNED_NEXT;
  const allowed = table[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Cannot move leave from ${from} to ${to}`);
  }
}
