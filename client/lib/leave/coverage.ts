type CoveringLeaveCheck = (employeeId: string, date: string) => boolean;

let check: CoveringLeaveCheck | null = null;

/** Registered by the leave store so shift approval can see leave without a circular import. */
export function registerCoveringLeaveCheck(fn: CoveringLeaveCheck) {
  check = fn;
}

export function employeeHasCoveringLeave(
  employeeId: string,
  date: string,
): boolean {
  if (!check) {
    throw new Error("Leave coverage check is not registered");
  }
  return check(employeeId, date);
}
