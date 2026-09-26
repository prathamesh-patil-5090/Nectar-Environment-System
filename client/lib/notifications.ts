/**
 * Simple in-app notifications (localStorage) for leave consent, leave decisions, OT assign.
 */

export const NOTIFICATIONS_STORAGE_KEY = "nectar-enviro-notifications";
export const NOTIFICATIONS_SEEDED_KEY = "nectar-enviro-notifications-seeded-v2";

export type NotificationKind =
  | "leave_consent"
  | "leave_decision"
  | "ot_assign"
  | "shift_message"
  | "manager_message"
  | "general";

export type AppNotification = {
  id: string;
  employeeId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  read: boolean;
  meta?: Record<string, string>;
};

/** Demo seed — shown for employee logins until cleared */
const DEMO_SEED: AppNotification[] = [
  // Asha Patil — primary employee demo
  {
    id: "seed-n-asha-ot1",
    employeeId: "e-etp-s1",
    kind: "ot_assign",
    title: "OT assigned — tomorrow morning",
    body: "Rajesh Kulkarni (ETP Manager) assigned you 4h OT on 2026-09-27 for coverage during Rohan's leave. Report by 06:00.",
    href: "/notifications",
    createdAt: "2026-09-25T09:15:00Z",
    read: false,
    meta: { assignmentId: "seed-ota-asha-1" },
  },
  {
    id: "seed-n-asha-sic1",
    employeeId: "e-etp-s1",
    kind: "shift_message",
    title: "Shift adjustment — A → B swap request",
    body: "Sanjay Jadhav (Shift In-Charge): Please confirm if you can move to B shift on 28 Sep to cover Kavita's night off.",
    href: "/shifts/schedule",
    createdAt: "2026-09-24T14:30:00Z",
    read: false,
  },
  {
    id: "seed-n-asha-mgr1",
    employeeId: "e-etp-s1",
    kind: "manager_message",
    title: "Toolbox talk — Friday 07:00",
    body: "Rajesh Kulkarni: Mandatory toolbox talk on hazardous waste handling this Friday before A shift. Attendance will be recorded.",
    href: "/training",
    createdAt: "2026-09-23T11:00:00Z",
    read: true,
  },
  {
    id: "seed-n-asha-leave1",
    employeeId: "e-etp-s1",
    kind: "leave_decision",
    title: "Leave approved — Sep 15–16",
    body: "Your casual leave for 15–16 Sep was approved by Rajesh Kulkarni. Manpower covered by general shift.",
    href: "/leave/requests",
    createdAt: "2026-09-11T10:05:00Z",
    read: true,
  },
  // Rohan — consent pending example
  {
    id: "seed-n-rohan-consent",
    employeeId: "e-etp-s2",
    kind: "leave_consent",
    title: "Leave request needs your consent",
    body: "Amit Supervisor submitted sick leave on your behalf for 28–29 Sep. Approve or reject to continue to the Manager.",
    href: "/leave/requests/lv2",
    createdAt: "2026-09-22T09:05:00Z",
    read: false,
  },
  {
    id: "seed-n-rohan-ot",
    employeeId: "e-etp-s2",
    kind: "ot_assign",
    title: "OT assigned — RO membrane support",
    body: "Rajesh Kulkarni assigned you 6h OT on 2026-09-26 for plant upset coverage.",
    href: "/notifications",
    createdAt: "2026-09-24T08:00:00Z",
    read: false,
    meta: { assignmentId: "seed-ota-rohan-1" },
  },
  // Imran — RO
  {
    id: "seed-n-imran-ot",
    employeeId: "e-ro-s1",
    kind: "ot_assign",
    title: "OT assigned — Night coverage",
    body: "Priya Iyer (RO Manager) assigned you 8h OT on 2026-09-25 for membrane CIP support.",
    href: "/notifications",
    createdAt: "2026-09-24T16:00:00Z",
    read: false,
    meta: { assignmentId: "seed-ota-imran-1" },
  },
  {
    id: "seed-n-imran-sic",
    employeeId: "e-ro-s1",
    kind: "shift_message",
    title: "Deployment note from Shift In-Charge",
    body: "Vikram Shah: You are tagged as primary for skid-2 checks this week. Confirm availability on WhatsApp group.",
    href: "/dashboard",
    createdAt: "2026-09-23T07:45:00Z",
    read: false,
  },
  // Vikram MEE
  {
    id: "seed-n-vikram-mgr",
    employeeId: "e-mee-s1",
    kind: "manager_message",
    title: "MEE vacuum check checklist",
    body: "Anil Desai: Complete the vacuum integrity checklist before end of shift and upload photos to the site folder.",
    href: "/dashboard",
    createdAt: "2026-09-24T10:20:00Z",
    read: false,
  },
  {
    id: "seed-n-vikram-ot",
    employeeId: "e-mee-s1",
    kind: "ot_assign",
    title: "OT assigned — Evaporator restart",
    body: "Anil Desai assigned you 5h OT on 2026-09-26 after planned shutdown.",
    href: "/notifications",
    createdAt: "2026-09-25T06:30:00Z",
    read: false,
    meta: { assignmentId: "seed-ota-vikram-1" },
  },
  // Nisha general
  {
    id: "seed-n-nisha-sic",
    employeeId: "e-etp-g1",
    kind: "shift_message",
    title: "Reliever standby today",
    body: "Sanjay Jadhav: Stay on standby as general-shift reliever for Asha's OT window tomorrow morning.",
    href: "/notifications",
    createdAt: "2026-09-25T12:00:00Z",
    read: false,
  },
];

function readAll(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

function writeAll(rows: AppNotification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(rows));
}

/** Merge demo seeds once per browser (stable ids — won't duplicate) */
export function ensureNotificationSeed(): void {
  if (typeof window === "undefined") return;
  const existing = readAll();
  const have = new Set(existing.map((n) => n.id));
  const missing = DEMO_SEED.filter((n) => !have.has(n.id));
  if (missing.length) {
    writeAll([...missing, ...existing]);
  }
  localStorage.setItem(NOTIFICATIONS_SEEDED_KEY, "1");
}

export function getNotificationsForEmployee(employeeId: string): AppNotification[] {
  ensureNotificationSeed();
  return readAll()
    .filter((n) => n.employeeId === employeeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getUnreadCount(employeeId: string): number {
  return getNotificationsForEmployee(employeeId).filter((n) => !n.read).length;
}

export function pushNotification(
  input: Omit<AppNotification, "id" | "createdAt" | "read"> & {
    id?: string;
    createdAt?: string;
    read?: boolean;
  },
): AppNotification {
  ensureNotificationSeed();
  const row: AppNotification = {
    id: input.id ?? `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId: input.employeeId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href,
    meta: input.meta,
    createdAt: input.createdAt ?? new Date().toISOString(),
    read: input.read ?? false,
  };
  writeAll([row, ...readAll()]);
  return row;
}

export function markNotificationRead(id: string) {
  writeAll(readAll().map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export function markAllRead(employeeId: string) {
  writeAll(
    readAll().map((n) =>
      n.employeeId === employeeId ? { ...n, read: true } : n,
    ),
  );
}
