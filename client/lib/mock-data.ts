export type PlantType = "ETP" | "STP" | "WTP" | "RO" | "MEE";

export type TrainingPriority = "critical" | "high" | "medium" | "low";

export type EmployeeCategory =
  | "director"
  | "manager"
  | "shift_incharge"
  | "supervisor"
  | "shift"
  | "general"
  | "hr";

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
      id: "emp0123",
      name: "Anand Dakave",
      email: "etp.manager@nectarenviro.com",
    },
    sic: {
      id: "emp0124",
      name: "Bidhichand Rajbhar",
      email: "etp.shift@nectarenviro.com",
    },
    sup: {
      id: "emp0125",
      name: "Neetesh Diwathe",
      email: "etp.supervisor@nectarenviro.com",
    },
    shift: [
      {
        id: "emp0126",
        name: "Shilpa Hotkar",
        email: "shilpa.hotkar@nectarenviro.com",
        shiftId: "sh-morning",
      },
      {
        id: "emp0127",
        name: "Rohit Kumar Singh",
        email: "rohit.singh@nectarenviro.com",
        shiftId: "sh-afternoon",
      },
      {
        id: "emp0128",
        name: "Mohee Vinchu",
        email: "mohee.vinchu@nectarenviro.com",
        shiftId: "sh-night",
      },
      {
        id: "emp0129",
        name: "Sanket Jagadale",
        email: "sanket.jagadale@nectarenviro.com",
        shiftId: "sh-morning",
      },
    ],
    general: {
      id: "emp0130",
      name: "Sandip Ohol",
      email: "sandip.ohol@nectarenviro.com",
    },
  },
  {
    siteId: "s-ro",
    siteName: "RO Plant",
    plantLabel: "RO",
    mgr: {
      id: "emp0131",
      name: "Uday Patil",
      email: "ro.manager@nectarenviro.com",
    },
    sic: {
      id: "emp0132",
      name: "Pawan Jagdhane",
      email: "ro.shift@nectarenviro.com",
    },
    sup: {
      id: "emp0133",
      name: "Vikas Dabade",
      email: "ro.supervisor@nectarenviro.com",
    },
    shift: [
      {
        id: "emp0134",
        name: "Rafik Shaikh",
        email: "rafik.shaikh@nectarenviro.com",
        shiftId: "sh-morning",
      },
      {
        id: "emp0135",
        name: "Siddhant Marale",
        email: "siddhant.marale@nectarenviro.com",
        shiftId: "sh-afternoon",
      },
      {
        id: "emp0136",
        name: "Surekha Sitaram Bhosale",
        email: "surekha.bhosale@nectarenviro.com",
        shiftId: "sh-night",
      },
      {
        id: "emp0137",
        name: "Akshay Bendkoli",
        email: "akshay.bendkoli@nectarenviro.com",
        shiftId: "sh-morning",
      },
    ],
    general: {
      id: "emp0138",
      name: "Pravin Chormule",
      email: "pravin.chormule@nectarenviro.com",
    },
  },
  {
    siteId: "s-mee",
    siteName: "MEE Plant",
    plantLabel: "MEE",
    mgr: {
      id: "emp0139",
      name: "Sanjay Waghaskar",
      email: "mee.manager@nectarenviro.com",
    },
    sic: {
      id: "emp0140",
      name: "Gaurav Khandagale",
      email: "mee.shift@nectarenviro.com",
    },
    sup: {
      id: "emp0141",
      name: "Rushikesh Pawar",
      email: "mee.supervisor@nectarenviro.com",
    },
    shift: [
      {
        id: "emp0142",
        name: "Abhinandan Sanjay Pawane",
        email: "abhinandan.pawane@nectarenviro.com",
        shiftId: "sh-morning",
      },
      {
        id: "emp0143",
        name: "Bhairavi Kadu",
        email: "bhairavi.kadu@nectarenviro.com",
        shiftId: "sh-afternoon",
      },
      {
        id: "emp0144",
        name: "Meghal Salgaonkar",
        email: "meghal.salgaonkar@nectarenviro.com",
        shiftId: "sh-night",
      },
      {
        id: "emp0145",
        name: "Anita Kadam",
        email: "anita.kadam@nectarenviro.com",
        shiftId: "sh-morning",
      },
    ],
    general: {
      id: "emp0146",
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

  // Central HR — org-wide, no plant assignment
  list.push({
    id: "emp0147",
    name: "Swati Ingle",
    role: "Head of Human Resources",
    siteId: undefined as unknown as string,
    skillScore: 94,
    trainingStatus: "compliant",
    email: "hr@nectarenviro.com",
    phone: "+91 98201 11026",
    joinedAt: "2018-03-15",
    yearsExperience: 12,
    department: "Human Resources",
    designation: "Head of Human Resources",
    shiftId: "sh-general",
    employmentStatus: "active",
    employeeType: "permanent",
    otEligible: false,
    payCategory: "lead",
    employeeCategory: "hr",
  });

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

export function getEmployeeTraining(employeeId: string): TrainingItem[] {
  try {
    const { getTrainingItems } = require("@/lib/training/store");
    return getTrainingItems({ employeeId });
  } catch {
    return [];
  }
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
  let urgentTraining = 0;
  try {
    const { getUrgentTrainingItems } = require("@/lib/training/store");
    urgentTraining = getUrgentTrainingItems(siteId).length;
  } catch {
    urgentTraining = 0;
  }
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
