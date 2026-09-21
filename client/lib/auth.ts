export const AUTH_STORAGE_KEY = "nectar-enviro-session";

export const DEMO_CREDENTIALS = {
  email: "admin@nectarenviro.com",
  password: "nectar2026",
} as const;

export type SessionUser = {
  email: string;
  name: string;
};

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function login(email: string, password: string): SessionUser | null {
  if (
    email.trim().toLowerCase() === DEMO_CREDENTIALS.email &&
    password === DEMO_CREDENTIALS.password
  ) {
    const user: SessionUser = {
      email: DEMO_CREDENTIALS.email,
      name: "Ops Admin",
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
  }
  return null;
}

export function logout(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}
