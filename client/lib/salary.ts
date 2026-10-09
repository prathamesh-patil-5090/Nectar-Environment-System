import { employees, getEmployeeById } from "@/lib/mock-data";

import { intlLocale } from "@/lib/i18n/phrases";
export type SalaryPayment = {
  id: string;
  employeeId: string;
  employeeName: string;
  /** YYYY-MM */
  salaryMonth: string;
  amount: number;
  currency: "INR";
  paymentDate: string;
  paymentTime: string;
  bankName: string;
  accountLast4: string;
  paymentMode: "NEFT" | "RTGS" | "UPI" | "Cheque";
  status: "paid" | "pending" | "failed";
  remarks?: string;
};

const BANKS = ["HDFC Bank", "SBI", "ICICI Bank", "Axis Bank"] as const;

function baseSalary(empId: string): number {
  const emp = getEmployeeById(empId);
  if (!emp) return 28000;
  switch (emp.employeeCategory) {
    case "manager":
      return 95000;
    case "shift_incharge":
      return 62000;
    case "supervisor":
      return 48000;
    case "general":
      return 32000;
    default:
      return 28000 + (emp.yearsExperience % 5) * 1500;
  }
}

function buildSalaryHistory(): SalaryPayment[] {
  const months = [
    "2026-08",
    "2026-07",
    "2026-06",
    "2026-05",
    "2026-04",
    "2026-03",
  ];
  const list: SalaryPayment[] = [];
  let seq = 1;

  for (const emp of employees) {
    const base = baseSalary(emp.id);
    const bank = BANKS[emp.id.length % BANKS.length];
    const last4 = String(1000 + (emp.id.charCodeAt(emp.id.length - 1) % 9) * 1111).slice(-4);

    months.forEach((month, i) => {
      const otBonus = i === 0 && emp.otEligible ? 2400 : i === 1 ? 1200 : 0;
      const amount = base + otBonus;
      const day = 28 - (i % 3);
      list.push({
        id: `sal-${seq++}`,
        employeeId: emp.id,
        employeeName: emp.name,
        salaryMonth: month,
        amount,
        currency: "INR",
        paymentDate: `${month}-${String(day).padStart(2, "0")}`,
        paymentTime: i % 2 === 0 ? "10:42:18" : "14:15:03",
        bankName: bank,
        accountLast4: last4,
        paymentMode: i % 3 === 0 ? "NEFT" : i % 3 === 1 ? "RTGS" : "UPI",
        status: i === 0 && emp.id === "emp0128" ? "pending" : "paid",
        remarks: otBonus ? `Includes OT payout ₹${otBonus}` : undefined,
      });
    });
  }

  return list;
}

export const salaryPayments: SalaryPayment[] = buildSalaryHistory();

export function getSalaryHistory(employeeId: string): SalaryPayment[] {
  return salaryPayments
    .filter((s) => s.employeeId === employeeId)
    .sort((a, b) => b.salaryMonth.localeCompare(a.salaryMonth));
}

export function formatInrAmount(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function salaryMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(intlLocale(), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
