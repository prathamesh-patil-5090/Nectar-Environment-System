export const AUTH_STORAGE_KEY = "nectar-enviro-session";

export type UserRole = "management" | "hr" | "site_incharge" | "supervisor";

export const DEMO_USERS = [
  {
    email: "admin@nectarenviro.com",
    password: "nectar2026",
    name: "Ops Admin",
    role: "management" as UserRole,
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
    email: "supervisor@nectarenviro.com",
    password: "nectar2026",
    name: "Amit Supervisor",
    role: "supervisor" as UserRole,
    siteId: "s1",
  },
] as const;

/** @deprecated use DEMO_USERS — kept for login form hint */
export const DEMO_CREDENTIALS = {
  email: DEMO_USERS[0].email,
  password: DEMO_USERS[0].password,
} as const;

export type SessionUser = {
  email: string;
  name: string;
  role: UserRole;
  siteId?: string;
};

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    if (!parsed.role) {
      return { ...parsed, role: "management" };
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
