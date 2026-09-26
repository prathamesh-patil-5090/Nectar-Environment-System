export type PlantType = "ETP" | "STP" | "WTP" | "RO" | "MEE";

export type TrainingPriority = "critical" | "high" | "medium" | "low";

export type EmployeeCategory =
  | "manager"
  | "shift_incharge"
  | "supervisor"
  | "shift"
  | "general";

export type Employee = {
  id: string;
  name: string;
  role: string;
  siteId: string;
  skillScore: number;
  trainingStatus: "compliant" | "due-soon" | "overdue";
  email: string;
  phone: string;
  joinedAt: string;
  yearsExperience: number;
  department: string;
  designation: string;
  shiftId: string;
  employmentStatus: "active" | "inactive";
  employeeType: "permanent" | "contract" | "deputed";
  otEligible: boolean;
  payCategory:
    | "operator"
    | "technician"
    | "supervisor"
    | "analyst"
    | "lead";
  employeeCategory: EmployeeCategory;
  /** Direct reports-to (usually manager or supervisor) */
  reportsToEmployeeId?: string;
  managerId?: string;
  shiftInChargeId?: string;
  supervisorId?: string;
};

export type Site = {
  id: string;
  name: string;
  plantType: PlantType;
  location: string;
  headcount: number;
  readiness: number;
};

export type SkillKey =
  | "etpOps"
  | "roOps"
  | "safety"
  | "sampling"
  | "maintenance"
  | "compliance";

export type SkillMatrixRow = {
  role: string;
  etpOps: number;
  roOps: number;
  safety: number;
  sampling: number;
  maintenance: number;
  compliance: number;
};

export type TrainingItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  siteName: string;
  course: string;
  dueDate: string;
  priority: TrainingPriority;
  status: "overdue" | "due-soon" | "scheduled" | "completed";
  /** Set when status is completed */
  completedAt?: string;
  provider?: string;
  score?: number;
};

export const skillLabels: Record<SkillKey, string> = {
  etpOps: "ETP Ops",
  roOps: "RO Ops",
  safety: "Safety",
  sampling: "Sampling",
  maintenance: "Maintenance",
  compliance: "Compliance",
};

/** Active demo plants — ETP / RO / MEE */
export const DEMO_SITE_IDS = ["s-etp", "s-ro", "s-mee"] as const;

export const sites: Site[] = [
  {
    id: "s-etp",
    name: "ETP Plant",
    plantType: "ETP",
    location: "Thane, MH",
    headcount: 7,
    readiness: 92,
  },
  {
    id: "s-ro",
    name: "RO Plant",
    plantType: "RO",
    location: "Pune, MH",
    headcount: 7,
    readiness: 84,
  },
  {
    id: "s-mee",
    name: "MEE Plant",
    plantType: "MEE",
    location: "Vashi, MH",
    headcount: 7,
    readiness: 78,
  },
];

/** Legacy site types kept for type/compat; not in active demo roster */
export const legacySites: Site[] = [
  {
    id: "s-stp-legacy",
    name: "Belapur STP Unit (legacy)",
    plantType: "STP",
    location: "CBD Belapur, MH",
    headcount: 6,
    readiness: 78,
  },
  {
    id: "s-wtp-legacy",
    name: "Nashik WTP (legacy)",
    plantType: "WTP",
    location: "Nashik, MH",
    headcount: 7,
    readiness: 88,
  },
];

type PlantStaffSeed = {
  siteId: string;
  siteName: string;
  plantLabel: string;
  mgr: { id: string; name: string; email: string };
  sic: { id: string; name: string; email: string };
  sup: { id: string; name: string; email: string };
  shift: { id: string; name: string; email: string; shiftId: string }[];
  general: { id: string; name: string; email: string };
};

const plantSeeds: PlantStaffSeed[] = [
  {
    siteId: "s-etp",
    siteName: "ETP Plant",
    plantLabel: "ETP",
    mgr: {
      id: "e-etp-mgr",
      name: "Rajesh Kulkarni",
      email: "etp.manager@nectarenviro.com",
    },
    sic: {
      id: "e-etp-sic",
      name: "Sanjay Jadhav",
      email: "etp.shift@nectarenviro.com",
    },
    sup: {
      id: "e-etp-sup",
      name: "Amit Supervisor",
      email: "etp.supervisor@nectarenviro.com",
    },
    shift: [
      {
        id: "e-etp-s1",
        name: "Asha Patil",
        email: "asha.patil@nectarenviro.com",
        shiftId: "sh-morning",
      },
      {
        id: "e-etp-s2",
        name: "Rohan Deshmukh",
        email: "rohan.deshmukh@nectarenviro.com",
        shiftId: "sh-afternoon",
      },
      {
        id: "e-etp-s3",
        name: "Kavita Rao",
        email: "kavita.rao@nectarenviro.com",
        shiftId: "sh-night",
      },
      {
        id: "e-etp-s4",
        name: "Deepak More",
        email: "deepak.more@nectarenviro.com",
        shiftId: "sh-morning",
      },
    ],
    general: {
      id: "e-etp-g1",
      name: "Nisha Salvi",
      email: "nisha.salvi@nectarenviro.com",
    },
  },
  {
    siteId: "s-ro",
    siteName: "RO Plant",
    plantLabel: "RO",
    mgr: {
      id: "e-ro-mgr",
      name: "Priya Iyer",
      email: "ro.manager@nectarenviro.com",
    },
    sic: {
      id: "e-ro-sic",
      name: "Vikram Shah",
      email: "ro.shift@nectarenviro.com",
    },
    sup: {
      id: "e-ro-sup",
      name: "Neha Kamat",
      email: "ro.supervisor@nectarenviro.com",
    },
    shift: [
      {
        id: "e-ro-s1",
        name: "Imran Shaikh",
        email: "imran.shaikh@nectarenviro.com",
        shiftId: "sh-morning",
      },
      {
        id: "e-ro-s2",
        name: "Arjun Mehta",
        email: "arjun.mehta@nectarenviro.com",
        shiftId: "sh-afternoon",
      },
      {
        id: "e-ro-s3",
        name: "Sneha Bhosale",
        email: "sneha.bhosale@nectarenviro.com",
        shiftId: "sh-night",
      },
      {
        id: "e-ro-s4",
        name: "Rahul Pawar",
        email: "rahul.pawar@nectarenviro.com",
        shiftId: "sh-morning",
      },
    ],
    general: {
      id: "e-ro-g1",
      name: "Meera Naik",
      email: "meera.naik@nectarenviro.com",
    },
  },
  {
    siteId: "s-mee",
    siteName: "MEE Plant",
    plantLabel: "MEE",
    mgr: {
      id: "e-mee-mgr",
      name: "Anil Desai",
      email: "mee.manager@nectarenviro.com",
    },
    sic: {
      id: "e-mee-sic",
      name: "Farhan Qureshi",
      email: "mee.shift@nectarenviro.com",
    },
    sup: {
      id: "e-mee-sup",
      name: "Sunita Rane",
      email: "mee.supervisor@nectarenviro.com",
    },
    shift: [
      {
        id: "e-mee-s1",
        name: "Vikram Nair",
        email: "vikram.nair@nectarenviro.com",
        shiftId: "sh-morning",
      },
      {
        id: "e-mee-s2",
        name: "Pooja Ghate",
        email: "pooja.ghate@nectarenviro.com",
        shiftId: "sh-afternoon",
      },
      {
        id: "e-mee-s3",
        name: "Suresh Pawar",
        email: "suresh.pawar@nectarenviro.com",
        shiftId: "sh-night",
      },
      {
        id: "e-mee-s4",
        name: "Anita Kadam",
        email: "anita.kadam@nectarenviro.com",
        shiftId: "sh-morning",
      },
    ],
    general: {
      id: "e-mee-g1",
      name: "Ravi Thakur",
      email: "ravi.thakur@nectarenviro.com",
    },
  },
];

function buildEmployees(): Employee[] {
  const list: Employee[] = [];
  let phone = 11001;

  for (const p of plantSeeds) {
    const mgrId = p.mgr.id;
    const sicId = p.sic.id;
    const supId = p.sup.id;

    list.push({
      id: mgrId,
      name: p.mgr.name,
      role: `${p.plantLabel} Plant Manager`,
      siteId: p.siteId,
      skillScore: 94,
      trainingStatus: "compliant",
      email: p.mgr.email,
      phone: `+91 98201 ${phone++}`,
      joinedAt: "2019-04-01",
      yearsExperience: 14,
      department: "Operations",
      designation: `${p.plantLabel} Plant Manager`,
      shiftId: "sh-general",
      employmentStatus: "active",
      employeeType: "permanent",
      otEligible: false,
      payCategory: "lead",
      employeeCategory: "manager",
    });

    list.push({
      id: sicId,
      name: p.sic.name,
      role: "Shift In-Charge",
      siteId: p.siteId,
      skillScore: 88,
      trainingStatus: "compliant",
      email: p.sic.email,
      phone: `+91 98201 ${phone++}`,
      joinedAt: "2020-06-15",
      yearsExperience: 10,
      department: "Operations",
      designation: "Shift In-Charge",
      shiftId: "sh-general",
      employmentStatus: "active",
      employeeType: "permanent",
      otEligible: true,
      payCategory: "lead",
      employeeCategory: "shift_incharge",
      reportsToEmployeeId: mgrId,
      managerId: mgrId,
    });

    list.push({
      id: supId,
      name: p.sup.name,
      role: "Supervisor",
      siteId: p.siteId,
      skillScore: 86,
      trainingStatus: "compliant",
      email: p.sup.email,
      phone: `+91 98201 ${phone++}`,
      joinedAt: "2021-02-10",
      yearsExperience: 8,
      department: "Operations",
      designation: "Supervisor",
      shiftId: "sh-general",
      employmentStatus: "active",
      employeeType: "permanent",
      otEligible: true,
      payCategory: "supervisor",
      employeeCategory: "supervisor",
      reportsToEmployeeId: mgrId,
      managerId: mgrId,
      shiftInChargeId: sicId,
    });

    p.shift.forEach((s, idx) => {
      list.push({
        id: s.id,
        name: s.name,
        role: "Shift Employee",
        siteId: p.siteId,
        skillScore: 70 + ((idx * 7) % 25),
        trainingStatus:
          idx === 1 ? "due-soon" : idx === 2 ? "overdue" : "compliant",
        email: s.email,
        phone: `+91 98201 ${phone++}`,
        joinedAt: `202${2 + (idx % 3)}-0${(idx % 8) + 1}-15`,
        yearsExperience: 3 + idx,
        department: "Operations",
        designation: "Plant Operator",
        shiftId: s.shiftId,
        employmentStatus: "active",
        employeeType: "deputed",
        otEligible: true,
        payCategory: "operator",
        employeeCategory: "shift",
        reportsToEmployeeId: supId,
        managerId: mgrId,
        shiftInChargeId: sicId,
        supervisorId: supId,
      });
    });

    list.push({
      id: p.general.id,
      name: p.general.name,
      role: "General Employee",
      siteId: p.siteId,
      skillScore: 80,
      trainingStatus: "compliant",
      email: p.general.email,
      phone: `+91 98201 ${phone++}`,
      joinedAt: "2022-08-01",
      yearsExperience: 5,
      department: "Operations",
      designation: "General Shift Operator",
      shiftId: "sh-general",
      employmentStatus: "active",
      employeeType: "deputed",
      otEligible: true,
      payCategory: "operator",
      employeeCategory: "general",
      reportsToEmployeeId: supId,
      managerId: mgrId,
      shiftInChargeId: sicId,
      supervisorId: supId,
    });
  }

  return list;
}

export const employees: Employee[] = buildEmployees();

export const skillMatrix: SkillMatrixRow[] = [
  {
    role: "Shift Employee",
    etpOps: 86,
    roOps: 72,
    safety: 90,
    sampling: 65,
    maintenance: 58,
    compliance: 78,
  },
  {
    role: "General Employee",
    etpOps: 75,
    roOps: 70,
    safety: 88,
    sampling: 60,
    maintenance: 55,
    compliance: 80,
  },
  {
    role: "Supervisor",
    etpOps: 78,
    roOps: 68,
    safety: 92,
    sampling: 60,
    maintenance: 70,
    compliance: 94,
  },
  {
    role: "Shift In-Charge",
    etpOps: 82,
    roOps: 74,
    safety: 93,
    sampling: 55,
    maintenance: 72,
    compliance: 90,
  },
  {
    role: "ETP Plant Manager",
    etpOps: 95,
    roOps: 60,
    safety: 94,
    sampling: 50,
    maintenance: 70,
    compliance: 96,
  },
  {
    role: "RO Plant Manager",
    etpOps: 55,
    roOps: 95,
    safety: 94,
    sampling: 50,
    maintenance: 72,
    compliance: 96,
  },
  {
    role: "MEE Plant Manager",
    etpOps: 70,
    roOps: 65,
    safety: 94,
    sampling: 48,
    maintenance: 75,
    compliance: 96,
  },
];

function trainingFor(
  emp: Employee,
  siteName: string,
  extras: Omit<TrainingItem, "employeeId" | "employeeName" | "siteName">[],
): TrainingItem[] {
  return extras.map((t) => ({
    ...t,
    employeeId: emp.id,
    employeeName: emp.name,
    siteName,
  }));
}

export const trainingItems: TrainingItem[] = (() => {
  const items: TrainingItem[] = [];
  const asha = employees.find((e) => e.id === "e-etp-s1")!;
  items.push(
    ...trainingFor(asha, "ETP Plant", [
      {
        id: "t-etp-s1-1",
        course: "ETP Process Fundamentals",
        dueDate: "2024-06-15",
        completedAt: "2024-06-12",
        priority: "high",
        status: "completed",
        provider: "Nectar Academy",
        score: 92,
      },
      {
        id: "t-etp-s1-2",
        course: "PPE & Site Induction",
        dueDate: "2024-08-01",
        completedAt: "2024-07-28",
        priority: "critical",
        status: "completed",
        provider: "Site HSE",
        score: 98,
      },
      {
        id: "t-etp-s1-3",
        course: "Confined Space Entry",
        dueDate: "2025-02-20",
        completedAt: "2025-02-18",
        priority: "critical",
        status: "completed",
        provider: "External — SafeWork MH",
        score: 88,
      },
      {
        id: "t-etp-s1-4",
        course: "Hazardous Waste Handling",
        dueDate: "2025-09-10",
        completedAt: "2025-09-08",
        priority: "high",
        status: "completed",
        provider: "Nectar Academy",
        score: 90,
      },
      {
        id: "t-etp-s1-5",
        course: "First Aid Refresh",
        dueDate: "2026-11-30",
        priority: "medium",
        status: "scheduled",
        provider: "Site HSE",
      },
    ]),
  );

  const rohan = employees.find((e) => e.id === "e-etp-s2")!;
  items.push(
    ...trainingFor(rohan, "ETP Plant", [
      {
        id: "t-etp-s2-1",
        course: "Confined Space Entry",
        dueDate: "2026-09-28",
        priority: "high",
        status: "due-soon",
      },
      {
        id: "t-etp-s2-2",
        course: "ETP Process Fundamentals",
        dueDate: "2025-04-10",
        completedAt: "2025-04-08",
        priority: "high",
        status: "completed",
        provider: "Nectar Academy",
        score: 78,
      },
    ]),
  );

  const kavita = employees.find((e) => e.id === "e-etp-s3")!;
  items.push(
    ...trainingFor(kavita, "ETP Plant", [
      {
        id: "t-etp-s3-1",
        course: "Hazardous Waste Handling",
        dueDate: "2026-09-05",
        priority: "critical",
        status: "overdue",
      },
    ]),
  );

  const imran = employees.find((e) => e.id === "e-ro-s1")!;
  items.push(
    ...trainingFor(imran, "RO Plant", [
      {
        id: "t-ro-s1-1",
        course: "RO Membrane Safety",
        dueDate: "2025-12-01",
        completedAt: "2025-11-28",
        priority: "high",
        status: "completed",
        provider: "External — MembraneTech",
        score: 87,
      },
      {
        id: "t-ro-s1-2",
        course: "Preventive Maintenance Schedule",
        dueDate: "2026-10-20",
        priority: "low",
        status: "scheduled",
      },
    ]),
  );

  const arjun = employees.find((e) => e.id === "e-ro-s2")!;
  items.push(
    ...trainingFor(arjun, "RO Plant", [
      {
        id: "t-ro-s2-1",
        course: "RO Membrane Safety",
        dueDate: "2026-09-12",
        priority: "high",
        status: "overdue",
      },
    ]),
  );

  const vikram = employees.find((e) => e.id === "e-mee-s1")!;
  items.push(
    ...trainingFor(vikram, "MEE Plant", [
      {
        id: "t-mee-s1-1",
        course: "MEE Process Control",
        dueDate: "2026-09-10",
        priority: "critical",
        status: "overdue",
      },
      {
        id: "t-mee-s1-2",
        course: "Lockout / Tagout Basics",
        dueDate: "2025-06-01",
        completedAt: "2025-05-29",
        priority: "high",
        status: "completed",
        provider: "Nectar Academy",
        score: 76,
      },
    ]),
  );

  const suresh = employees.find((e) => e.id === "e-mee-s3")!;
  items.push(
    ...trainingFor(suresh, "MEE Plant", [
      {
        id: "t-mee-s3-1",
        course: "PPE & Site Induction Refresh",
        dueDate: "2026-10-08",
        priority: "medium",
        status: "due-soon",
      },
    ]),
  );

  return items;
})();

export function getSiteName(siteId: string): string {
  return (
    sites.find((s) => s.id === siteId)?.name ??
    legacySites.find((s) => s.id === siteId)?.name ??
    "Unassigned"
  );
}

export function getEmployeeById(id: string): Employee | undefined {
  return employees.find((e) => e.id === id);
}

export function getSiteById(id: string): Site | undefined {
  return sites.find((s) => s.id === id) ?? legacySites.find((s) => s.id === id);
}

export function getEmployeesForSite(siteId: string): Employee[] {
  return employees.filter((e) => e.siteId === siteId);
}

export function getEmployeeTraining(employeeId: string): TrainingItem[] {
  return trainingItems
    .filter((t) => t.employeeId === employeeId)
    .sort((a, b) => {
      const aKey = a.completedAt ?? a.dueDate;
      const bKey = b.completedAt ?? b.dueDate;
      return bKey.localeCompare(aKey);
    });
}

export function getEmployeeSkills(
  employee: Employee,
): Record<SkillKey, number> {
  const row = skillMatrix.find((r) => r.role === employee.role);
  const keys = Object.keys(skillLabels) as SkillKey[];
  if (!row) {
    return Object.fromEntries(keys.map((k) => [k, 0])) as Record<
      SkillKey,
      number
    >;
  }
  const roleAvg = Math.round(
    keys.reduce((sum, k) => sum + row[k], 0) / keys.length,
  );
  const delta = employee.skillScore - roleAvg;
  return Object.fromEntries(
    keys.map((k) => [k, Math.max(0, Math.min(100, row[k] + delta))]),
  ) as Record<SkillKey, number>;
}

export function getDashboardKpis(siteId?: string) {
  const scopedEmployees = (
    siteId ? employees.filter((e) => e.siteId === siteId) : employees
  ).filter((e) => e.employmentStatus === "active");
  const scopedSites = siteId ? sites.filter((s) => s.id === siteId) : sites;
  const totalEmployees = scopedEmployees.length || 1;
  const activeSites = scopedSites.length;
  const skillCoverage = Math.round(
    scopedEmployees.reduce((sum, e) => sum + e.skillScore, 0) / totalEmployees,
  );
  const urgentTraining = trainingItems.filter((t) => {
    if (!(t.status === "overdue" || t.priority === "critical")) return false;
    if (!siteId) return true;
    return scopedEmployees.some((e) => e.id === t.employeeId);
  }).length;
  const complianceReadySites = scopedSites.filter(
    (s) => s.readiness >= 80,
  ).length;

  return {
    totalEmployees: scopedEmployees.length,
    activeSites,
    skillCoverage,
    urgentTraining,
    complianceReadySites,
  };
}

export function getUrgentTraining(siteId?: string) {
  const allowed = siteId
    ? new Set(employees.filter((e) => e.siteId === siteId).map((e) => e.id))
    : null;
  return [...trainingItems]
    .filter((t) => {
      if (!(t.status === "overdue" || t.status === "due-soon")) return false;
      if (!allowed) return true;
      return allowed.has(t.employeeId);
    })
    .sort((a, b) => {
      const priorityOrder: Record<TrainingPriority, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}
