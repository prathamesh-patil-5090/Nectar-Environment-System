export type PlantType = "ETP" | "STP" | "WTP" | "RO";

export type TrainingPriority = "critical" | "high" | "medium" | "low";

export type Employee = {
  id: string;
  name: string;
  role: string;
  siteId: string;
  skillScore: number;
  trainingStatus: "compliant" | "due-soon" | "overdue";
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
  status: "overdue" | "due-soon" | "scheduled";
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
    id: "s1",
    name: "Thane ETP Hub",
    plantType: "ETP",
    location: "Thane, MH",
    headcount: 8,
    readiness: 92,
  },
  {
    id: "s2",
    name: "Belapur STP Unit",
    plantType: "STP",
    location: "CBD Belapur, MH",
    headcount: 6,
    readiness: 78,
  },
  {
    id: "s3",
    name: "Pune RO Plant",
    plantType: "RO",
    location: "Pune, MH",
    headcount: 5,
    readiness: 64,
  },
  {
    id: "s4",
    name: "Nashik WTP",
    plantType: "WTP",
    location: "Nashik, MH",
    headcount: 7,
    readiness: 88,
  },
  {
    id: "s5",
    name: "Vashi MEE Facility",
    plantType: "ETP",
    location: "Vashi, MH",
    headcount: 4,
    readiness: 55,
  },
  {
    id: "s6",
    name: "Aurangabad STP",
    plantType: "STP",
    location: "Aurangabad, MH",
    headcount: 5,
    readiness: 81,
  },
];

export const employees: Employee[] = [
  {
    id: "e1",
    name: "Asha Patil",
    role: "Plant Operator",
    siteId: "s1",
    skillScore: 91,
    trainingStatus: "compliant",
  },
  {
    id: "e2",
    name: "Rohan Deshmukh",
    role: "Plant Operator",
    siteId: "s1",
    skillScore: 74,
    trainingStatus: "due-soon",
  },
  {
    id: "e3",
    name: "Meera Kulkarni",
    role: "Technician",
    siteId: "s2",
    skillScore: 68,
    trainingStatus: "overdue",
  },
  {
    id: "e4",
    name: "Imran Shaikh",
    role: "Technician",
    siteId: "s3",
    skillScore: 82,
    trainingStatus: "compliant",
  },
  {
    id: "e5",
    name: "Sneha Joshi",
    role: "Lab Analyst",
    siteId: "s4",
    skillScore: 95,
    trainingStatus: "compliant",
  },
  {
    id: "e6",
    name: "Vikram Nair",
    role: "Site Supervisor",
    siteId: "s5",
    skillScore: 58,
    trainingStatus: "overdue",
  },
  {
    id: "e7",
    name: "Priya Sawant",
    role: "Plant Operator",
    siteId: "s2",
    skillScore: 79,
    trainingStatus: "due-soon",
  },
  {
    id: "e8",
    name: "Arjun Mehta",
    role: "Maintenance Lead",
    siteId: "s3",
    skillScore: 71,
    trainingStatus: "overdue",
  },
  {
    id: "e9",
    name: "Kavita Rao",
    role: "Lab Analyst",
    siteId: "s1",
    skillScore: 88,
    trainingStatus: "compliant",
  },
  {
    id: "e10",
    name: "Suresh Pawar",
    role: "Plant Operator",
    siteId: "s6",
    skillScore: 77,
    trainingStatus: "due-soon",
  },
  {
    id: "e11",
    name: "Neha Gupta",
    role: "Technician",
    siteId: "s4",
    skillScore: 84,
    trainingStatus: "compliant",
  },
  {
    id: "e12",
    name: "Farhan Qureshi",
    role: "Site Supervisor",
    siteId: "s6",
    skillScore: 90,
    trainingStatus: "compliant",
  },
];

export const skillMatrix: SkillMatrixRow[] = [
  {
    role: "Plant Operator",
    etpOps: 86,
    roOps: 72,
    safety: 90,
    sampling: 65,
    maintenance: 58,
    compliance: 78,
  },
  {
    role: "Technician",
    etpOps: 70,
    roOps: 88,
    safety: 82,
    sampling: 74,
    maintenance: 91,
    compliance: 69,
  },
  {
    role: "Lab Analyst",
    etpOps: 45,
    roOps: 40,
    safety: 85,
    sampling: 96,
    maintenance: 35,
    compliance: 88,
  },
  {
    role: "Site Supervisor",
    etpOps: 78,
    roOps: 68,
    safety: 92,
    sampling: 60,
    maintenance: 70,
    compliance: 94,
  },
  {
    role: "Maintenance Lead",
    etpOps: 62,
    roOps: 75,
    safety: 80,
    sampling: 48,
    maintenance: 95,
    compliance: 72,
  },
];

export const trainingItems: TrainingItem[] = [
  {
    id: "t1",
    employeeId: "e3",
    employeeName: "Meera Kulkarni",
    siteName: "Belapur STP Unit",
    course: "Hazardous Waste Handling",
    dueDate: "2026-09-05",
    priority: "critical",
    status: "overdue",
  },
  {
    id: "t2",
    employeeId: "e6",
    employeeName: "Vikram Nair",
    siteName: "Vashi MEE Facility",
    course: "ETP Process Control",
    dueDate: "2026-09-10",
    priority: "critical",
    status: "overdue",
  },
  {
    id: "t3",
    employeeId: "e8",
    employeeName: "Arjun Mehta",
    siteName: "Pune RO Plant",
    course: "RO Membrane Safety",
    dueDate: "2026-09-12",
    priority: "high",
    status: "overdue",
  },
  {
    id: "t4",
    employeeId: "e2",
    employeeName: "Rohan Deshmukh",
    siteName: "Thane ETP Hub",
    course: "Confined Space Entry",
    dueDate: "2026-09-28",
    priority: "high",
    status: "due-soon",
  },
  {
    id: "t5",
    employeeId: "e7",
    employeeName: "Priya Sawant",
    siteName: "Belapur STP Unit",
    course: "Water Quality Sampling",
    dueDate: "2026-10-02",
    priority: "medium",
    status: "due-soon",
  },
  {
    id: "t6",
    employeeId: "e10",
    employeeName: "Suresh Pawar",
    siteName: "Aurangabad STP",
    course: "PPE & Site Induction Refresh",
    dueDate: "2026-10-08",
    priority: "medium",
    status: "due-soon",
  },
  {
    id: "t7",
    employeeId: "e4",
    employeeName: "Imran Shaikh",
    siteName: "Pune RO Plant",
    course: "Preventive Maintenance Schedule",
    dueDate: "2026-10-20",
    priority: "low",
    status: "scheduled",
  },
  {
    id: "t8",
    employeeId: "e11",
    employeeName: "Neha Gupta",
    siteName: "Nashik WTP",
    course: "Consent Compliance Reporting",
    dueDate: "2026-11-01",
    priority: "low",
    status: "scheduled",
  },
];

export function getSiteName(siteId: string): string {
  return sites.find((s) => s.id === siteId)?.name ?? "Unassigned";
}

export function getDashboardKpis() {
  const totalEmployees = employees.length;
  const activeSites = sites.length;
  const skillCoverage = Math.round(
    employees.reduce((sum, e) => sum + e.skillScore, 0) / totalEmployees,
  );
  const urgentTraining = trainingItems.filter(
    (t) => t.status === "overdue" || t.priority === "critical",
  ).length;
  const complianceReadySites = sites.filter((s) => s.readiness >= 80).length;

  return {
    totalEmployees,
    activeSites,
    skillCoverage,
    urgentTraining,
    complianceReadySites,
  };
}

export function getUrgentTraining() {
  return [...trainingItems]
    .filter((t) => t.status === "overdue" || t.status === "due-soon")
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
