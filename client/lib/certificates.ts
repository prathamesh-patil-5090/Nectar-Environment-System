import { employees, getEmployeeById } from "@/lib/mock-data";

export type CertificateStatus = "valid" | "expiring_soon" | "expired";

export type Certificate = {
  id: string;
  employeeId: string;
  employeeName: string;
  siteName: string;
  name: string;
  issuer: string;
  issuedOn: string;
  expiresOn: string;
  status: CertificateStatus;
  certificateNo: string;
};

function statusFor(expiresOn: string): CertificateStatus {
  const exp = new Date(expiresOn + "T00:00:00Z").getTime();
  const now = new Date("2026-09-26T00:00:00Z").getTime();
  const days = (exp - now) / 86400000;
  if (days < 0) return "expired";
  if (days <= 60) return "expiring_soon";
  return "valid";
}

const TEMPLATES: { name: string; issuer: string; monthsValid: number }[] = [
  { name: "Confined Space Entry", issuer: "SafeWork MH", monthsValid: 24 },
  { name: "PPE & Site Induction", issuer: "Site HSE", monthsValid: 12 },
  { name: "First Aid / CPR", issuer: "Indian Red Cross", monthsValid: 24 },
  { name: "Hazardous Waste Handling", issuer: "Nectar Academy", monthsValid: 18 },
  { name: "Lockout / Tagout", issuer: "Nectar Academy", monthsValid: 24 },
  { name: "Fire Fighting Basics", issuer: "Site HSE", monthsValid: 12 },
];

function buildCertificates(): Certificate[] {
  const list: Certificate[] = [];
  let seq = 1;
  for (const emp of employees) {
    const siteName =
      emp.siteId === "s-etp"
        ? "ETP Plant"
        : emp.siteId === "s-ro"
          ? "RO Plant"
          : "MEE Plant";
    const picks = TEMPLATES.filter((_, i) => (emp.id.charCodeAt(emp.id.length - 1) + i) % 2 === 0).slice(
      0,
      emp.employeeCategory === "shift" || emp.employeeCategory === "general"
        ? 4
        : 3,
    );
    picks.forEach((t, idx) => {
      const issuedYear = 2024 + (idx % 2);
      const issuedMonth = ((idx * 3) % 11) + 1;
      const issuedOn = `${issuedYear}-${String(issuedMonth).padStart(2, "0")}-15`;
      const expDate = new Date(issuedOn + "T00:00:00Z");
      expDate.setUTCMonth(expDate.getUTCMonth() + t.monthsValid);
      const expiresOn = expDate.toISOString().slice(0, 10);
      list.push({
        id: `cert-${seq++}`,
        employeeId: emp.id,
        employeeName: emp.name,
        siteName,
        name: t.name,
        issuer: t.issuer,
        issuedOn,
        expiresOn,
        status: statusFor(expiresOn),
        certificateNo: `NE-${emp.siteId.toUpperCase().replace("S-", "")}-${1000 + seq}`,
      });
    });
  }

  // Rich set for Asha (primary employee demo)
  const asha = getEmployeeById("e-etp-s1");
  if (asha) {
    const extras: Omit<Certificate, "id" | "status">[] = [
      {
        employeeId: asha.id,
        employeeName: asha.name,
        siteName: "ETP Plant",
        name: "ETP Process Operator Licence",
        issuer: "Nectar Academy",
        issuedOn: "2024-06-12",
        expiresOn: "2026-06-12",
        certificateNo: "NE-ETP-OP-2041",
      },
      {
        employeeId: asha.id,
        employeeName: asha.name,
        siteName: "ETP Plant",
        name: "Working at Height",
        issuer: "External — SafeWork MH",
        issuedOn: "2025-01-20",
        expiresOn: "2027-01-20",
        certificateNo: "NE-ETP-WAH-881",
      },
    ];
    for (const e of extras) {
      if (!list.some((c) => c.employeeId === e.employeeId && c.name === e.name)) {
        list.push({
          ...e,
          id: `cert-${seq++}`,
          status: statusFor(e.expiresOn),
        });
      }
    }
  }

  // Executive certification set for Manager (Rajesh Kulkarni)
  const mgr = getEmployeeById("e-etp-mgr");
  if (mgr) {
    const mgrCerts: Omit<Certificate, "id" | "status">[] = [
      {
        employeeId: mgr.id,
        employeeName: mgr.name,
        siteName: "ETP Plant",
        name: "Plant Operations & Safety Management",
        issuer: "Central Pollution Control Board",
        issuedOn: "2024-03-10",
        expiresOn: "2027-03-10",
        certificateNo: "CPCB-IND-MGR-994",
      },
      {
        employeeId: mgr.id,
        employeeName: mgr.name,
        siteName: "ETP Plant",
        name: "ISO 14001:2015 Environmental Lead Auditor",
        issuer: "Bureau Veritas",
        issuedOn: "2024-07-15",
        expiresOn: "2027-07-15",
        certificateNo: "BV-ISO-14001-442",
      },
      {
        employeeId: mgr.id,
        employeeName: mgr.name,
        siteName: "ETP Plant",
        name: "Hazardous Industrial Effluent Compliance",
        issuer: "Maharashtra Pollution Control Board",
        issuedOn: "2025-01-10",
        expiresOn: "2026-12-31",
        certificateNo: "MPCB-ETP-DIR-1120",
      },
    ];
    for (const m of mgrCerts) {
      if (!list.some((c) => c.employeeId === m.employeeId && c.name === m.name)) {
        list.push({
          ...m,
          id: `cert-${seq++}`,
          status: statusFor(m.expiresOn),
        });
      }
    }
  }

  return list;
}

export const certificates: Certificate[] = buildCertificates();

export function getCertificatesForEmployee(employeeId: string): Certificate[] {
  return certificates
    .filter((c) => c.employeeId === employeeId)
    .sort((a, b) => b.expiresOn.localeCompare(a.expiresOn));
}

export function getAllCertificates(siteId?: string): Certificate[] {
  const allowed = siteId
    ? new Set(
        employees.filter((e) => e.siteId === siteId).map((e) => e.id),
      )
    : null;
  return certificates
    .filter((c) => (allowed ? allowed.has(c.employeeId) : true))
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
}

export const CERT_STATUS_LABELS: Record<CertificateStatus, string> = {
  valid: "Valid",
  expiring_soon: "Expiring soon",
  expired: "Expired",
};
