export type LifecycleKind =
  | "active_cover"
  | "due_return"
  | "early_return_ready"
  | "late_return"
  | "extension_open"
  | "emergency_open"
  | "unexplained"
  | "cover_disrupted";

export type CoverDisruptionKind = "no_show" | "became_unavailable" | "pool_toggled_off";

export type LifecycleCase = {
  id: string;
  kind: LifecycleKind;
  leaveId: string;
  siteId: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  mode: "planned" | "emergency";
  leaveStatus: string;
  coverName?: string;
  coverRelieverId?: string;
  coverEmployeeId?: string;
  title: string;
  message: string;
  href: string;
  softBlock?: string;
};

export type CoverDisruption = {
  id: string;
  leaveId: string;
  kind: CoverDisruptionKind;
  note: string;
  actor: string;
  at: string;
  coverRelieverId?: string;
  coverEmployeeId?: string;
};

export type LifecycleReport = {
  asOf: string;
  siteId?: string;
  cases: LifecycleCase[];
  extensionCount: number;
  disruptedCount: number;
  dueReturnCount: number;
  emergencyCount: number;
};
