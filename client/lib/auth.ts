export const AUTH_STORAGE_KEY = "nectar-enviro-session";

/**
 * Application roles
 * - admin: full system control (org-wide)
 * - manager: plant-scoped ops (demo: ETP / RO / MEE)
 * - hr: policy / leave (hidden from demo login)
 * - site_incharge: site manpower (hidden from demo login)
 * - shift_incharge: shift rotation / coverage (plant-scoped)
 * - safety_incharge: safety training visibility (hidden from demo login)
 * - supervisor: first-line leave/absence (plant-scoped)
 * - employee: self-service
 * - management: legacy alias → manager
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

export type DemoUser = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  siteId?: string;
  employeeId?: string;
};

const DEMO_PASSWORD = "nectar2026";

/** Active demo logins — five roles across Admin + three plants */
export const DEMO_USERS: DemoUser[] = [
  {
    email: "admin@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "System Admin",
    role: "admin",
  },
  // ETP
  {
    email: "etp.manager@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Rajesh Kulkarni",
    role: "manager",
    siteId: "s-etp",
    employeeId: "e-etp-mgr",
  },
  {
    email: "etp.shift@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Sanjay Jadhav",
    role: "shift_incharge",
    siteId: "s-etp",
    employeeId: "e-etp-sic",
  },
  {
    email: "etp.supervisor@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Amit Supervisor",
    role: "supervisor",
    siteId: "s-etp",
    employeeId: "e-etp-sup",
  },
  {
    email: "asha.patil@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Asha Patil",
    role: "employee",
    siteId: "s-etp",
    employeeId: "e-etp-s1",
  },
  {
    email: "rohan.deshmukh@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Rohan Deshmukh",
    role: "employee",
    siteId: "s-etp",
    employeeId: "e-etp-s2",
  },
  {
    email: "kavita.rao@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Kavita Rao",
    role: "employee",
    siteId: "s-etp",
    employeeId: "e-etp-s3",
  },
  {
    email: "deepak.more@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Deepak More",
    role: "employee",
    siteId: "s-etp",
    employeeId: "e-etp-s4",
  },
  {
    email: "nisha.salvi@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Nisha Salvi",
    role: "employee",
    siteId: "s-etp",
    employeeId: "e-etp-g1",
  },
  // RO
  {
    email: "ro.manager@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Priya Iyer",
    role: "manager",
    siteId: "s-ro",
    employeeId: "e-ro-mgr",
  },
  {
    email: "ro.shift@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Vikram Shah",
    role: "shift_incharge",
    siteId: "s-ro",
    employeeId: "e-ro-sic",
  },
  {
    email: "ro.supervisor@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Neha Kamat",
    role: "supervisor",
    siteId: "s-ro",
    employeeId: "e-ro-sup",
  },
  {
    email: "imran.shaikh@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Imran Shaikh",
    role: "employee",
    siteId: "s-ro",
    employeeId: "e-ro-s1",
  },
  {
    email: "arjun.mehta@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Arjun Mehta",
    role: "employee",
    siteId: "s-ro",
    employeeId: "e-ro-s2",
  },
  {
    email: "sneha.bhosale@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Sneha Bhosale",
    role: "employee",
    siteId: "s-ro",
    employeeId: "e-ro-s3",
  },
  {
    email: "rahul.pawar@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Rahul Pawar",
    role: "employee",
    siteId: "s-ro",
    employeeId: "e-ro-s4",
  },
  {
    email: "meera.naik@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Meera Naik",
    role: "employee",
    siteId: "s-ro",
    employeeId: "e-ro-g1",
  },
  // MEE
  {
    email: "mee.manager@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Anil Desai",
    role: "manager",
    siteId: "s-mee",
    employeeId: "e-mee-mgr",
  },
  {
    email: "mee.shift@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Farhan Qureshi",
    role: "shift_incharge",
    siteId: "s-mee",
    employeeId: "e-mee-sic",
  },
  {
    email: "mee.supervisor@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Sunita Rane",
    role: "supervisor",
    siteId: "s-mee",
    employeeId: "e-mee-sup",
  },
  {
    email: "vikram.nair@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Vikram Nair",
    role: "employee",
    siteId: "s-mee",
    employeeId: "e-mee-s1",
  },
  {
    email: "pooja.ghate@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Pooja Ghate",
    role: "employee",
    siteId: "s-mee",
    employeeId: "e-mee-s2",
  },
  {
    email: "suresh.pawar@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Suresh Pawar",
    role: "employee",
    siteId: "s-mee",
    employeeId: "e-mee-s3",
  },
  {
    email: "anita.kadam@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Anita Kadam",
    role: "employee",
    siteId: "s-mee",
    employeeId: "e-mee-s4",
  },
  {
    email: "ravi.thakur@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Ravi Thakur",
    role: "employee",
    siteId: "s-mee",
    employeeId: "e-mee-g1",
  },
];

/**
 * Hidden from demo login UI — roles kept for compatibility / future demos.
 * Still authenticable if credentials are entered manually.
 */
export const DEMO_USERS_HIDDEN: DemoUser[] = [
  {
    email: "hr@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "HR Partner",
    role: "hr",
  },
  {
    email: "site@nectarenviro.com",
    password: DEMO_PASSWORD,
    name: "Legacy Site Lead",
    role: "site_incharge",
    siteId: "s-etp",
    employeeId: "e-etp-mgr",
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
    if (parsed.role === "management") {
      return { ...parsed, role: "manager" };
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
