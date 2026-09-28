export type EmployeeCategory =
  | "director"
  | "manager"
  | "shift_incharge"
  | "supervisor"
  | "shift"
  | "general"
  | "hr";

export type TrainingPriority = "critical" | "high" | "medium" | "low";

export type Employee = {
  id: string;
  name: string;
  role: string;
  siteId?: string;
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
  reportsToEmployeeId?: string;
  managerId?: string;
  shiftInChargeId?: string;
  supervisorId?: string;
};
