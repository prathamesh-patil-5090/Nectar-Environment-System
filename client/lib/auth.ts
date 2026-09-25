export const AUTH_STORAGE_KEY = "nectar-enviro-session";

/**
 * Application roles
 * - admin: full system control
 * - manager: ops visibility & escalation (all sites)
 * - hr: policy, leave balance, OT reports
 * - site_incharge: site manpower & leave approval
 * - shift_incharge: shift rotation / change / coverage
 * - safety_incharge: safety training & unexplained absence visibility
 * - supervisor: first-line leave/absence entry & verification
 * - employee: self-service (own leave / profile)
 * - management: legacy alias treated like manager
 */
export type UserRole =
  | "admin"
  | "manager"
  | "management"
  | "hr"
  | "site_incharge"
  | "shift_incharge"
  | "safety_incharge"
  | "supervisor"
  | "employee";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  management: "Management",
  hr: "HR",
  site_incharge: "Site In-Charge",
  shift_incharge: "Shift In-Charge",
  safety_incharge: "Safety In-Charge",
  supervisor: "Supervisor",
  employee: "Employee",
};

export const DEMO_USERS = [
  {
    email: "admin@nectarenviro.com",
    password: "nectar2026",
    name: "System Admin",
    role: "admin" as UserRole,
  },
  {
    email: "manager@nectarenviro.com",
    password: "nectar2026",
    name: "Ops Manager",
    role: "manager" as UserRole,
  },
  {
    email: "hr@nectarenviro.com",
    password: "nectar2026",
    name: "HR Partner",
    role: "hr" as UserRole,
  },
  {
    email: "site@nectarenviro.com",
    password: "nectar2026",
    name: "Thane Site Lead",
    role: "site_incharge" as UserRole,
    siteId: "s1",
  },
  {
    email: "shift@nectarenviro.com",
    password: "nectar2026",
    name: "Shift In-Charge",
    role: "shift_incharge" as UserRole,
    siteId: "s1",
  },
  {
    email: "safety@nectarenviro.com",
    password: "nectar2026",
    name: "Safety In-Charge",
    role: "safety_incharge" as UserRole,
    siteId: "s1",
  },
  {
    email: "supervisor@nectarenviro.com",
    password: "nectar2026",
    name: "Amit Supervisor",
    role: "supervisor" as UserRole,
    siteId: "s1",
  },
  {
    email: "employee@nectarenviro.com",
    password: "nectar2026",
    name: "Asha Patil",
    role: "employee" as UserRole,
    siteId: "s1",
    employeeId: "e1",
  },
] as const;

/** Default login hint — admin account */
export const DEMO_CREDENTIALS = {
  email: DEMO_USERS[0].email,
  password: DEMO_USERS[0].password,
} as const;

export type SessionUser = {
  email: string;
  name: string;
  role: UserRole;
  siteId?: string;
  employeeId?: string;
};

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    if (!parsed.role) {
      return { ...parsed, role: "manager" };
    }
    // Migrate legacy demo email that used to be management
    if (parsed.role === "management") {
      return { ...parsed, role: "manager" };
    }
    return parsed;
  } catch {
    return null;
  }
}

export function login(email: string, password: string): SessionUser | null {
  const match = DEMO_USERS.find(
    (u) =>
      u.email === email.trim().toLowerCase() && u.password === password,
  );
  if (!match) return null;
  const user: SessionUser = {
    email: match.email,
    name: match.name,
    role: match.role,
    siteId: "siteId" in match ? match.siteId : undefined,
    employeeId: "employeeId" in match ? match.employeeId : undefined,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  return user;
}

export function logout(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}
