export const AUTH_STORAGE_KEY = "nectar-enviro-session";

/**
 * Application roles
 * - director: full system control (org-wide) — formerly "admin"
 * - manager: plant-scoped ops (demo: ETP / RO / MEE)
 * - hr: policy / leave / compliance (org-wide)
 * - site_incharge: site manpower (hidden from demo login)
 * - shift_incharge: shift rotation / coverage (plant-scoped)
 * - safety_incharge: safety training visibility (hidden from demo login)
 * - supervisor: first-line leave/absence (plant-scoped)
 * - employee: self-service
 * - management: legacy alias → manager
 */
export type UserRole =
  | "director"
  | "manager"
  | "management"
  | "hr"
  | "site_incharge"
  | "shift_incharge"
  | "safety_incharge"
  | "supervisor"
  | "employee";

export const ROLE_LABELS: Record<UserRole, string> = {
  director: "Director",
  manager: "Manager",
  management: "Management",
  hr: "HR Manager",
  site_incharge: "Site In-Charge",
  shift_incharge: "Shift In-Charge",
  safety_incharge: "Safety In-Charge",
  supervisor: "Supervisor",
  employee: "Employee",
};

export type DemoUser = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  siteId?: string;
  employeeId?: string;
};

const DEMO_PASSWORD = "nectar2026";

/** Active demo logins — Director + HR + three plants */
export const DEMO_USERS: DemoUser[] = [
  {
    email: "director@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Prashant Rohidas Adsul",
    role: "director",
  },
  {
    email: "hr@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Swati Ingle",
    role: "hr",
    employeeId: "emp0147",
  },
  // ETP
  {
    email: "etp.manager@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Anand Dakave",
    role: "manager",
    siteId: "s-etp",
    employeeId: "emp0123",
  },
  {
    email: "etp.shift@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Bidhichand Rajbhar",
    role: "shift_incharge",
    siteId: "s-etp",
    employeeId: "emp0124",
  },
  {
    email: "etp.supervisor@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Neetesh Diwathe",
    role: "supervisor",
    siteId: "s-etp",
    employeeId: "emp0125",
  },
  {
    email: "shilpa.hotkar@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Shilpa Hotkar",
    role: "employee",
    siteId: "s-etp",
    employeeId: "emp0126",
  },
  {
    email: "rohit.singh@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Rohit Kumar Singh",
    role: "employee",
    siteId: "s-etp",
    employeeId: "emp0127",
  },
  {
    email: "mohee.vinchu@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Mohee Vinchu",
    role: "employee",
    siteId: "s-etp",
    employeeId: "emp0128",
  },
  {
    email: "sanket.jagadale@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Sanket Jagadale",
    role: "employee",
    siteId: "s-etp",
    employeeId: "emp0129",
  },
  {
    email: "sandip.ohol@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Sandip Ohol",
    role: "employee",
    siteId: "s-etp",
    employeeId: "emp0130",
  },
  // RO
  {
    email: "ro.manager@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Uday Patil",
    role: "manager",
    siteId: "s-ro",
    employeeId: "emp0131",
  },
  {
    email: "ro.shift@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Pawan Jagdhane",
    role: "shift_incharge",
    siteId: "s-ro",
    employeeId: "emp0132",
  },
  {
    email: "ro.supervisor@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Vikas Dabade",
    role: "supervisor",
    siteId: "s-ro",
    employeeId: "emp0133",
  },
  {
    email: "rafik.shaikh@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Rafik Shaikh",
    role: "employee",
    siteId: "s-ro",
    employeeId: "emp0134",
  },
  {
    email: "siddhant.marale@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Siddhant Marale",
    role: "employee",
    siteId: "s-ro",
    employeeId: "emp0135",
  },
  {
    email: "surekha.bhosale@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Surekha Sitaram Bhosale",
    role: "employee",
    siteId: "s-ro",
    employeeId: "emp0136",
  },
  {
    email: "akshay.bendkoli@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Akshay Bendkoli",
    role: "employee",
    siteId: "s-ro",
    employeeId: "emp0137",
  },
  {
    email: "pravin.chormule@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Pravin Chormule",
    role: "employee",
    siteId: "s-ro",
    employeeId: "emp0138",
  },
  // MEE
  {
    email: "mee.manager@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Sanjay Waghaskar",
    role: "manager",
    siteId: "s-mee",
    employeeId: "emp0139",
  },
  {
    email: "mee.shift@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Gaurav Khandagale",
    role: "shift_incharge",
    siteId: "s-mee",
    employeeId: "emp0140",
  },
  {
    email: "mee.supervisor@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Rushikesh Pawar",
    role: "supervisor",
    siteId: "s-mee",
    employeeId: "emp0141",
  },
  {
    email: "abhinandan.pawane@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Abhinandan Sanjay Pawane",
    role: "employee",
    siteId: "s-mee",
    employeeId: "emp0142",
  },
  {
    email: "bhairavi.kadu@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Bhairavi Kadu",
    role: "employee",
    siteId: "s-mee",
    employeeId: "emp0143",
  },
  {
    email: "meghal.salgaonkar@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Meghal Salgaonkar",
    role: "employee",
    siteId: "s-mee",
    employeeId: "emp0144",
  },
  {
    email: "anita.kadam@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Anita Kadam",
    role: "employee",
    siteId: "s-mee",
    employeeId: "emp0145",
  },
  {
    email: "ravi.thakur@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Ravi Thakur",
    role: "employee",
    siteId: "s-mee",
    employeeId: "emp0146",
  },
];

/**
 * Hidden from demo login UI — roles kept for compatibility / future demos.
 * Still authenticable if credentials are entered manually.
 */
export const DEMO_USERS_HIDDEN: DemoUser[] = [
  // Legacy aliases for backward compatibility
  {
    email: "asha.patil@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Shilpa Hotkar",
    role: "employee",
    siteId: "s-etp",
    employeeId: "emp0126",
  },
  {
    email: "priyanka.sharma@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Swati Ingle",
    role: "hr",
    employeeId: "emp0147",
  },
  {
    email: "site@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Legacy Site Lead",
    role: "site_incharge",
    siteId: "s-etp",
    employeeId: "emp0123",
  },
  {
    email: "safety@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Safety In-Charge",
    role: "safety_incharge",
    siteId: "s-etp",
  },
];

/** Accounts shown on the login page */
export const DEMO_USERS_VISIBLE = DEMO_USERS;

const ALL_LOGIN_USERS = [...DEMO_USERS, ...DEMO_USERS_HIDDEN];

/** Default login hint — director account */
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
      parsed.role = "manager";
    }
    if (parsed.role === "management") {
      parsed.role = "manager";
    }
    // Auto-migrate legacy "admin" sessions to "director"
    if ((parsed.role as string) === "admin") {
      parsed.role = "director";
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
    }
    // Auto-migrate legacy employeeIds (e.g. e-etp-* -> emp012*)
    if (parsed.email) {
      const match = ALL_LOGIN_USERS.find(
        (u) => u.email.toLowerCase() === parsed.email.toLowerCase(),
      );
      if (match?.employeeId && parsed.employeeId !== match.employeeId) {
        parsed.employeeId = match.employeeId;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function login(email: string, password: string): SessionUser | null {
  const match = ALL_LOGIN_USERS.find(
    (u) =>
      u.email === email.trim().toLowerCase() && u.password === password,
  );
  if (!match) return null;
  const user: SessionUser = {
    email: match.email,
    name: match.name,
    role: match.role,
    siteId: match.siteId,
    employeeId: match.employeeId,
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
