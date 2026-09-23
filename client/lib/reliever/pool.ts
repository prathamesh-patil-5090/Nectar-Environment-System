import { employees, sites, type PlantType } from "@/lib/mock-data";
import { shifts } from "@/lib/overtime/mock-data";

export type RelieverAvailability = "available" | "assigned" | "unavailable";

export type SkillTag =
  | "ETP Ops"
  | "STP Ops"
  | "RO Ops"
  | "WTP Ops"
  | "Safety"
  | "Sampling"
  | "Maintenance"
  | "General Shift";

export type SiteCluster = {
  id: string;
  name: string;
  region: string;
  siteIds: string[];
  /** Typical manpower model: 3 regular + 1 general + shared relievers */
  regularShifts: number;
  generalShifts: number;
  sharedRelieverSlots: number;
};

export type Reliever = {
  id: string;
  employeeId?: string;
  name: string;
  phone: string;
  clusterId: string;
  homeSiteId?: string;
  skills: SkillTag[];
  plantTypes: PlantType[];
  availability: RelieverAvailability;
  assignedSiteId?: string;
  assignedAbsenceId?: string;
};

export type AbsenceRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId: string;
  clusterId: string;
  date: string;
  shiftId: string;
  reason: string;
  requiredSkills: SkillTag[];
  status:
    | "open"
    | "local_assigned"
    | "pool_assigned"
    | "ot_fallback"
    | "resolved";
  assignedRelieverId?: string;
  resolutionNote?: string;
};

export type AssignmentEvent = {
  id: string;
  at: string;
  absenceId: string;
  step: "local_check" | "pool_check" | "assigned" | "ot_last_resort" | "notify";
  message: string;
  channel?: "whatsapp" | "sms" | "dashboard";
};

export const siteClusters: SiteCluster[] = [
  {
    id: "c-navi",
    name: "Navi Mumbai Cluster",
    region: "Navi Mumbai / Thane",
    siteIds: ["s1", "s2", "s5"],
    regularShifts: 3,
    generalShifts: 1,
    sharedRelieverSlots: 2,
  },
  {
    id: "c-pune",
    name: "Pune–Nashik Corridor",
    region: "Pune / Nashik",
    siteIds: ["s3", "s4"],
    regularShifts: 3,
    generalShifts: 1,
    sharedRelieverSlots: 1,
  },
  {
    id: "c-aura",
    name: "Aurangabad Cluster",
    region: "Marathwada",
    siteIds: ["s6"],
    regularShifts: 3,
    generalShifts: 1,
    sharedRelieverSlots: 1,
  },
];

export const relievers: Reliever[] = [
  {
    id: "rv1",
    name: "Sanjay Kamble",
    phone: "+91 98765 22001",
    clusterId: "c-navi",
    homeSiteId: "s1",
    skills: ["ETP Ops", "Safety", "General Shift"],
    plantTypes: ["ETP"],
    availability: "available",
  },
  {
    id: "rv2",
    name: "Lata More",
    phone: "+91 98765 22002",
    clusterId: "c-navi",
    homeSiteId: "s2",
    skills: ["STP Ops", "Sampling", "Safety"],
    plantTypes: ["STP"],
    availability: "available",
  },
  {
    id: "rv3",
    name: "Deepak Salve",
    phone: "+91 98765 22003",
    clusterId: "c-navi",
    skills: ["ETP Ops", "STP Ops", "Maintenance"],
    plantTypes: ["ETP", "STP"],
    availability: "available",
  },
  {
    id: "rv4",
    name: "Rina Pawaskar",
    phone: "+91 98765 22004",
    clusterId: "c-pune",
    homeSiteId: "s3",
    skills: ["RO Ops", "Safety", "General Shift"],
    plantTypes: ["RO"],
    availability: "assigned",
    assignedSiteId: "s3",
    assignedAbsenceId: "ab2",
  },
  {
    id: "rv5",
    name: "Yogesh Kale",
    phone: "+91 98765 22005",
    clusterId: "c-pune",
    homeSiteId: "s4",
    skills: ["WTP Ops", "Sampling", "Safety"],
    plantTypes: ["WTP"],
    availability: "available",
  },
  {
    id: "rv6",
    name: "Nitin Jadhav",
    phone: "+91 98765 22006",
    clusterId: "c-aura",
    homeSiteId: "s6",
    skills: ["STP Ops", "Maintenance", "General Shift"],
    plantTypes: ["STP"],
    availability: "unavailable",
  },
  {
    id: "rv7",
    employeeId: "e2",
    name: "Rohan Deshmukh",
    phone: "+91 98201 11002",
    clusterId: "c-navi",
    homeSiteId: "s1",
    skills: ["ETP Ops", "Safety"],
    plantTypes: ["ETP"],
    availability: "available",
  },
];

let absenceStore: AbsenceRecord[] = [
  {
    id: "ab1",
    employeeId: "e1",
    employeeName: "Asha Patil",
    siteId: "s1",
    clusterId: "c-navi",
    date: "2026-09-23",
    shiftId: "sh-morning",
    reason: "Sudden leave",
    requiredSkills: ["ETP Ops", "Safety"],
    status: "open",
  },
  {
    id: "ab2",
    employeeId: "e4",
    employeeName: "Imran Shaikh",
    siteId: "s3",
    clusterId: "c-pune",
    date: "2026-09-23",
    shiftId: "sh-night",
    reason: "Medical",
    requiredSkills: ["RO Ops", "Safety"],
    status: "pool_assigned",
    assignedRelieverId: "rv4",
    resolutionNote: "Cluster reliever Rina Pawaskar assigned",
  },
  {
    id: "ab3",
    employeeId: "e10",
    employeeName: "Suresh Pawar",
    siteId: "s6",
    clusterId: "c-aura",
    date: "2026-09-22",
    shiftId: "sh-morning",
    reason: "Weekly-off clash",
    requiredSkills: ["STP Ops"],
    status: "ot_fallback",
    resolutionNote: "No available pool match — OT authorized as last resort",
  },
  {
    id: "ab4",
    employeeId: "e3",
    employeeName: "Meera Kulkarni",
    siteId: "s2",
    clusterId: "c-navi",
    date: "2026-09-23",
    shiftId: "sh-afternoon",
    reason: "Travel delay",
    requiredSkills: ["STP Ops", "Maintenance"],
    status: "open",
  },
];

let eventStore: AssignmentEvent[] = [
  {
    id: "ev1",
    at: "2026-09-23T06:05:00Z",
    absenceId: "ab2",
    step: "local_check",
    message: "No local home-site reliever free at Pune RO Plant.",
  },
  {
    id: "ev2",
    at: "2026-09-23T06:06:00Z",
    absenceId: "ab2",
    step: "pool_check",
    message: "Matched Rina Pawaskar in Pune–Nashik corridor pool (RO Ops).",
  },
  {
    id: "ev3",
    at: "2026-09-23T06:07:00Z",
    absenceId: "ab2",
    step: "assigned",
    message: "Replacement confirmed for Night Shift.",
  },
  {
    id: "ev4",
    at: "2026-09-23T06:07:30Z",
    absenceId: "ab2",
    step: "notify",
    channel: "whatsapp",
    message: "WhatsApp sent to +91 98765 22004: Report to Pune RO Plant by 21:45.",
  },
  {
    id: "ev5",
    at: "2026-09-22T05:40:00Z",
    absenceId: "ab3",
    step: "local_check",
    message: "Local reliever Nitin Jadhav marked Unavailable.",
  },
  {
    id: "ev6",
    at: "2026-09-22T05:41:00Z",
    absenceId: "ab3",
    step: "pool_check",
    message: "Aurangabad cluster has no other available STP-qualified reliever.",
  },
  {
    id: "ev7",
    at: "2026-09-22T05:42:00Z",
    absenceId: "ab3",
    step: "ot_last_resort",
    message: "Supervisor authorized OT extension for on-shift staff.",
  },
];

let relieverStore: Reliever[] = relievers.map((r) => ({ ...r }));

export function getClusterById(id: string) {
  return siteClusters.find((c) => c.id === id);
}

export function getClusterForSite(siteId: string) {
  return siteClusters.find((c) => c.siteIds.includes(siteId));
}

export function getAbsences() {
  return [...absenceStore].sort((a, b) => b.date.localeCompare(a.date));
}

export function getRelievers(clusterId?: string) {
  return relieverStore.filter((r) =>
    clusterId ? r.clusterId === clusterId : true,
  );
}

export function getEvents(absenceId?: string) {
  return eventStore
    .filter((e) => (absenceId ? e.absenceId === absenceId : true))
    .sort((a, b) => b.at.localeCompare(a.at));
}

function skillMatch(reliever: Reliever, required: SkillTag[]) {
  if (!required.length) return true;
  return required.every((s) => reliever.skills.includes(s));
}

function plantMatch(reliever: Reliever, siteId: string) {
  const site = sites.find((s) => s.id === siteId);
  if (!site) return true;
  return reliever.plantTypes.includes(site.plantType);
}

/**
 * Absence → local reliever → cluster pool → OT last resort
 */
export function findReplacementCandidates(absence: AbsenceRecord) {
  const pool = relieverStore.filter(
    (r) =>
      r.clusterId === absence.clusterId &&
      r.availability === "available" &&
      skillMatch(r, absence.requiredSkills) &&
      plantMatch(r, absence.siteId),
  );

  const local = pool.filter((r) => r.homeSiteId === absence.siteId);
  const cluster = pool.filter((r) => r.homeSiteId !== absence.siteId);

  return { local, cluster, all: [...local, ...cluster] };
}

export function runReplacementFlow(absenceId: string): {
  absence: AbsenceRecord;
  events: AssignmentEvent[];
  outcome: "local_assigned" | "pool_assigned" | "ot_fallback";
} {
  const absence = absenceStore.find((a) => a.id === absenceId);
  if (!absence) throw new Error("Absence not found");

  const now = new Date().toISOString();
  const push = (
    step: AssignmentEvent["step"],
    message: string,
    channel?: AssignmentEvent["channel"],
  ) => {
    const ev: AssignmentEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: now,
      absenceId,
      step,
      message,
      channel,
    };
    eventStore = [ev, ...eventStore];
    return ev;
  };

  const { local, cluster } = findReplacementCandidates(absence);

  push(
    "local_check",
    local.length
      ? `${local.length} local reliever(s) available at home site.`
      : "No local reliever available at the affected site.",
  );

  let pick = local[0];
  let outcome: "local_assigned" | "pool_assigned" | "ot_fallback" =
    "local_assigned";

  if (!pick) {
    push(
      "pool_check",
      cluster.length
        ? `${cluster.length} cluster pool candidate(s) matched skills.`
        : "Cluster pool has no matching available reliever.",
    );
    pick = cluster[0];
    if (pick) outcome = "pool_assigned";
  } else {
    push("pool_check", "Local match found — cluster search skipped.");
  }

  if (!pick) {
    push(
      "ot_last_resort",
      "No replacement found. OT authorized as last resort so the shift can continue.",
    );
    absence.status = "ot_fallback";
    absence.resolutionNote =
      "No backup manpower — existing staff may extend shift (OT).";
    absence.assignedRelieverId = undefined;
    absenceStore = absenceStore.map((a) =>
      a.id === absenceId ? { ...absence } : a,
    );
    return { absence: { ...absence }, events: getEvents(absenceId), outcome: "ot_fallback" };
  }

  relieverStore = relieverStore.map((r) =>
    r.id === pick!.id
      ? {
          ...r,
          availability: "assigned",
          assignedSiteId: absence.siteId,
          assignedAbsenceId: absence.id,
        }
      : r,
  );

  absence.status = outcome;
  absence.assignedRelieverId = pick.id;
  absence.resolutionNote = `${pick.name} assigned from ${
    outcome === "local_assigned" ? "local" : "cluster"
  } pool`;

  push(
    "assigned",
    `${pick.name} assigned to ${sites.find((s) => s.id === absence.siteId)?.name ?? absence.siteId}.`,
  );
  push(
    "notify",
    `WhatsApp/SMS queued to ${pick.phone}: Report to site for ${
      shifts.find((s) => s.id === absence.shiftId)?.name ?? "shift"
    }.`,
    "whatsapp",
  );

  absenceStore = absenceStore.map((a) =>
    a.id === absenceId ? { ...absence } : a,
  );

  return { absence: { ...absence }, events: getEvents(absenceId), outcome };
}

export function setRelieverAvailability(
  relieverId: string,
  availability: RelieverAvailability,
) {
  relieverStore = relieverStore.map((r) => {
    if (r.id !== relieverId) return r;
    if (availability === "available") {
      return {
        ...r,
        availability,
        assignedSiteId: undefined,
        assignedAbsenceId: undefined,
      };
    }
    return { ...r, availability };
  });
}

export function getPoolKpis() {
  const open = absenceStore.filter((a) => a.status === "open").length;
  const covered = absenceStore.filter(
    (a) => a.status === "local_assigned" || a.status === "pool_assigned",
  ).length;
  const otFallback = absenceStore.filter((a) => a.status === "ot_fallback").length;
  const available = relieverStore.filter((r) => r.availability === "available")
    .length;
  const assigned = relieverStore.filter((r) => r.availability === "assigned")
    .length;

  return {
    clusters: siteClusters.length,
    sitesCovered: siteClusters.reduce((n, c) => n + c.siteIds.length, 0),
    poolSize: relieverStore.length,
    available,
    assigned,
    openAbsences: open,
    coveredByPool: covered,
    otLastResort: otFallback,
    otAvoidanceRate:
      covered + otFallback > 0
        ? Math.round((covered / (covered + otFallback)) * 1000) / 10
        : 100,
  };
}

export function getSiteManpowerRequirement(siteId: string) {
  const cluster = getClusterForSite(siteId);
  const siteStaff = employees.filter(
    (e) => e.siteId === siteId && e.employmentStatus === "active",
  );
  const localRelievers = relieverStore.filter((r) => r.homeSiteId === siteId);
  return {
    siteId,
    siteName: sites.find((s) => s.id === siteId)?.name ?? siteId,
    clusterId: cluster?.id,
    clusterName: cluster?.name,
    regularShifts: cluster?.regularShifts ?? 3,
    generalShifts: cluster?.generalShifts ?? 1,
    headcount: siteStaff.length,
    localRelievers: localRelievers.length,
    openAbsences: absenceStore.filter(
      (a) => a.siteId === siteId && a.status === "open",
    ).length,
  };
}
