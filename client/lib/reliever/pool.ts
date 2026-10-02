import { employees, sites, type PlantType } from "@/lib/mock-data";
import { shifts } from "@/lib/overtime/data";
import { listCoverOptionsForSite } from "@/lib/shift-impact/engine";
import { registerPoolApi } from "@/lib/shift-impact/registry";
import { inferRequiredSkills } from "@/lib/shift-impact/skills";
import type { ShiftCode } from "@/lib/shift/types";
import { persistJson } from "@/lib/storage";

export type RelieverAvailability = "available" | "assigned" | "unavailable";

export type SkillTag =
  | "ETP Ops"
  | "STP Ops"
  | "RO Ops"
  | "WTP Ops"
  | "MEE Ops"
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
  /** Same-plant / cluster employee covering the shift */
  assignedCoverEmployeeId?: string;
  coverSource?:
    | "local_employee"
    | "cluster_employee"
    | "local_pool"
    | "cluster_pool"
    | "ot_fallback"
    | "auto_pool";
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
    id: "c-demo",
    name: "Demo Plant Cluster",
    region: "Maharashtra",
    siteIds: ["s-etp", "s-ro", "s-mee"],
    regularShifts: 3,
    generalShifts: 1,
    sharedRelieverSlots: 3,
  },
];

export const relievers: Reliever[] = [
  {
    id: "rv1",
    name: "Sanjay Kamble",
    phone: "+91 98765 22001",
    clusterId: "c-demo",
    homeSiteId: "s-etp",
    skills: ["ETP Ops", "Safety", "General Shift"],
    plantTypes: ["ETP"],
    availability: "available",
  },
  {
    id: "rv2",
    name: "Lata More",
    phone: "+91 98765 22002",
    clusterId: "c-demo",
    homeSiteId: "s-ro",
    skills: ["RO Ops", "Sampling", "Safety"],
    plantTypes: ["RO"],
    availability: "available",
  },
  {
    id: "rv3",
    name: "Deepak Salve",
    phone: "+91 98765 22003",
    clusterId: "c-demo",
    skills: ["ETP Ops", "MEE Ops", "Maintenance"],
    plantTypes: ["ETP", "MEE"],
    availability: "available",
  },
  {
    id: "rv4",
    name: "Rina Pawaskar",
    phone: "+91 98765 22004",
    clusterId: "c-demo",
    homeSiteId: "s-ro",
    skills: ["RO Ops", "Safety", "General Shift"],
    plantTypes: ["RO"],
    availability: "assigned",
    assignedSiteId: "s-ro",
    assignedAbsenceId: "ab2",
  },
  {
    id: "rv5",
    name: "Yogesh Kale",
    phone: "+91 98765 22005",
    clusterId: "c-demo",
    homeSiteId: "s-mee",
    skills: ["MEE Ops", "Sampling", "Safety"],
    plantTypes: ["MEE"],
    availability: "available",
  },
  {
    id: "rv6",
    name: "Nitin Jadhav",
    phone: "+91 98765 22006",
    clusterId: "c-demo",
    homeSiteId: "s-mee",
    skills: ["MEE Ops", "Maintenance", "General Shift"],
    plantTypes: ["MEE"],
    availability: "unavailable",
  },
  {
    id: "rv7",
    employeeId: "emp0127",
    name: "Rohit Kumar Singh",
    phone: "+91 98201 11005",
    clusterId: "c-demo",
    homeSiteId: "s-etp",
    skills: ["ETP Ops", "Safety"],
    plantTypes: ["ETP"],
    availability: "available",
  },
];

let absenceStore: AbsenceRecord[] = [
  {
    id: "ab1",
    employeeId: "emp0126",
    employeeName: "Shilpa Hotkar",
    siteId: "s-etp",
    clusterId: "c-demo",
    date: "2026-09-23",
    shiftId: "sh-morning",
    reason: "Sudden leave",
    requiredSkills: ["ETP Ops", "Safety"],
    status: "open",
  },
  {
    id: "ab2",
    employeeId: "emp0134",
    employeeName: "Rafik Shaikh",
    siteId: "s-ro",
    clusterId: "c-demo",
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
    employeeId: "emp0144",
    employeeName: "Meghal Salgaonkar",
    siteId: "s-mee",
    clusterId: "c-demo",
    date: "2026-09-22",
    shiftId: "sh-morning",
    reason: "Weekly-off clash",
    requiredSkills: ["MEE Ops"],
    status: "ot_fallback",
    resolutionNote: "No available pool match — OT authorized as last resort",
  },
  {
    id: "ab4",
    employeeId: "emp0128",
    employeeName: "Mohee Vinchu",
    siteId: "s-etp",
    clusterId: "c-demo",
    date: "2026-09-23",
    shiftId: "sh-night",
    reason: "Travel delay",
    requiredSkills: ["ETP Ops", "Maintenance"],
    status: "open",
  },
];

let eventStore: AssignmentEvent[] = [
  {
    id: "ev1",
    at: "2026-09-23T06:05:00Z",
    absenceId: "ab2",
    step: "local_check",
    message: "No local home-site reliever free at RO Plant.",
  },
  {
    id: "ev2",
    at: "2026-09-23T06:06:00Z",
    absenceId: "ab2",
    step: "pool_check",
    message: "Matched Rina Pawaskar in demo plant cluster (RO Ops).",
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
    message: "WhatsApp sent to +91 98765 22004: Report to RO Plant by 21:45.",
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
    message: "Demo cluster has no other available MEE-qualified reliever.",
  },
  {
    id: "ev7",
    at: "2026-09-22T05:42:00Z",
    absenceId: "ab3",
    step: "ot_last_resort",
    message: "Supervisor authorized OT extension for on-shift staff.",
  },
];

let relieverStore: Reliever[] = relievers.map((r) => ({
  ...r,
  skills: [...r.skills],
  plantTypes: [...r.plantTypes],
}));

function cloneReliever(r: Reliever): Reliever {
  return { ...r, skills: [...r.skills], plantTypes: [...r.plantTypes] };
}

const relieverSeed = relieverStore.map(cloneReliever);
const absenceSeed = absenceStore.map((a) => ({
  ...a,
  requiredSkills: [...a.requiredSkills],
}));
const eventSeed = eventStore.map((e) => ({ ...e }));

const RELIEVER_STORAGE_KEY = "nectar-enviro-reliever-pool-v2";
let relieverHydrated = false;

type RelieverPersisted = {
  relievers: Reliever[];
  absences: AbsenceRecord[];
  events: AssignmentEvent[];
};

function persistRelieverPool() {
  const payload: RelieverPersisted = { relievers: relieverStore, absences: absenceStore, events: eventStore };
  persistJson(RELIEVER_STORAGE_KEY, payload);
}

function pushRelieverAssign(
  relieverId: string,
  siteId: string,
  absenceId?: string,
) {
  if (typeof window === "undefined") return;
  void import("../api/relievers")
    .then(({ assignReliever }) =>
      assignReliever(relieverId, siteId, absenceId),
    )
    .catch(() => {});
}

function pushRelieverRelease(opts: {
  relieverId?: string;
  absenceId?: string;
}) {
  if (typeof window === "undefined") return;
  void import("../api/relievers")
    .then(({ releaseReliever }) => releaseReliever(opts))
    .catch(() => {});
}

function pushRelieverAvailability(
  relieverId: string,
  availability: RelieverAvailability,
) {
  if (typeof window === "undefined") return;
  void import("../api/relievers")
    .then(({ updateRelieverAvailability }) =>
      updateRelieverAvailability(relieverId, availability),
    )
    .catch(() => {});
}

function ensureRelieverHydrated() {
  if (relieverHydrated || typeof window === "undefined") return;
  relieverHydrated = true;
  try {
    const raw = localStorage.getItem(RELIEVER_STORAGE_KEY);
    if (!raw) {
      persistRelieverPool();
      return;
    }
    const parsed = JSON.parse(raw) as Partial<RelieverPersisted>;
    if (Array.isArray(parsed.relievers) && parsed.relievers.length) {
      relieverStore = parsed.relievers;
    }
    if (Array.isArray(parsed.absences) && parsed.absences.length) {
      absenceStore = parsed.absences;
    }
    if (Array.isArray(parsed.events)) {
      eventStore = parsed.events;
    }
  } catch {
    // keep seed
  }
}

export function getClusterById(id: string) {
  return siteClusters.find((c) => c.id === id);
}

export function getClusterForSite(siteId: string) {
  return siteClusters.find((c) => c.siteIds.includes(siteId));
}

export function getAbsences() {
  ensureRelieverHydrated();
  return [...absenceStore].sort((a, b) => b.date.localeCompare(a.date));
}

export function getRelievers(clusterId?: string) {
  ensureRelieverHydrated();
  return relieverStore.filter((r) =>
    clusterId ? r.clusterId === clusterId : true,
  );
}

export function getEvents(absenceId?: string) {
  ensureRelieverHydrated();
  return eventStore
    .filter((e) => (absenceId ? e.absenceId === absenceId : true))
    .sort((a, b) => b.at.localeCompare(a.at));
}

function skillMatch(reliever: Reliever, required: SkillTag[]) {
  if (!required.length) return true;
  // Prefer plant Ops tags; otherwise any overlap
  const plantOps = required.filter((s) => s.endsWith("Ops"));
  if (plantOps.length) {
    return plantOps.some((s) => reliever.skills.includes(s));
  }
  return required.some((s) => reliever.skills.includes(s));
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
  ensureRelieverHydrated();
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

export type ReplacementOption = {
  /** Reliever id or employee id */
  relieverId: string;
  name: string;
  phone: string;
  source: "local" | "cluster";
  homeSiteId?: string;
  kind?: "employee" | "reliever";
  coverSource?:
    | "local_employee"
    | "cluster_employee"
    | "local_pool"
    | "cluster_pool";
};

/** People the Shift In-Charge can choose. Does not assign anyone. */
export function listReplacementOptions(
  siteId: string,
  opts?: { date?: string; excludeEmployeeId?: string },
): {
  local: ReplacementOption[];
  cluster: ReplacementOption[];
} {
  const date = opts?.date ?? new Date().toISOString().slice(0, 10);
  const { local, cluster } = listCoverOptionsForSite(
    siteId,
    date,
    opts?.excludeEmployeeId,
  );
  const toOption = (
    c: {
      id: string;
      name: string;
      phone?: string;
      source: string;
      homeSiteId?: string;
      kind: string;
    },
  ): ReplacementOption => ({
    relieverId: c.id,
    name: c.name,
    phone: c.phone ?? "",
    source:
      c.source === "local_employee" || c.source === "local_pool"
        ? "local"
        : "cluster",
    homeSiteId: c.homeSiteId,
    kind: c.kind as ReplacementOption["kind"],
    coverSource: c.source as ReplacementOption["coverSource"],
  });
  return {
    local: local.map(toOption),
    cluster: cluster.map(toOption),
  };
}

function ensureLeaveAbsence(input: {
  leaveId: string;
  employeeId: string;
  employeeName: string;
  siteId: string;
  shiftId: string;
  date: string;
  reason: string;
}) {
  const clusterId = getClusterForSite(input.siteId)?.id ?? "";
  const shiftIdToCode: Record<string, ShiftCode> = {
    "sh-morning": "A",
    "sh-afternoon": "B",
    "sh-night": "C",
    "sh-general": "G",
  };
  const shiftCode = shiftIdToCode[input.shiftId] ?? "A";
  const requiredSkills = inferRequiredSkills(input.siteId, shiftCode);
  if (!absenceStore.some((a) => a.id === input.leaveId)) {
    absenceStore = [
      {
        id: input.leaveId,
        employeeId: input.employeeId,
        employeeName: input.employeeName,
        siteId: input.siteId,
        clusterId,
        date: input.date,
        shiftId: input.shiftId,
        reason: input.reason,
        requiredSkills,
        status: "open",
      },
      ...absenceStore,
    ];
  } else {
    absenceStore = absenceStore.map((a) =>
      a.id === input.leaveId && !a.requiredSkills.length
        ? { ...a, requiredSkills }
        : a,
    );
  }
  return absenceStore.find((a) => a.id === input.leaveId)!;
}

export function runReplacementFlow(absenceId: string): {
  absence: AbsenceRecord;
  events: AssignmentEvent[];
  outcome: "local_assigned" | "pool_assigned" | "ot_fallback";
} {
  ensureRelieverHydrated();
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
    persistRelieverPool();
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

  persistRelieverPool();
  pushRelieverAssign(pick.id, absence.siteId, absence.id);
  return { absence: { ...absence }, events: getEvents(absenceId), outcome };
}

export function assignRelieverForLeave(input: {
  leaveId: string;
  employeeId: string;
  employeeName: string;
  siteId: string;
  shiftId: string;
  date: string;
  reason: string;
}): {
  outcome: "local_assigned" | "pool_assigned" | "ot_fallback";
  relieverId?: string;
  relieverName?: string;
  plan: string;
} {
  ensureRelieverHydrated();
  ensureLeaveAbsence(input);
  const result = runReplacementFlow(input.leaveId);
  if (result.outcome === "ot_fallback") {
    return {
      outcome: "ot_fallback",
      plan: "No pool match — OT last resort",
    };
  }

  const reliever = relieverStore.find(
    (r) => r.id === result.absence.assignedRelieverId,
  );
  const where = result.outcome === "local_assigned" ? "local" : "cluster";
  return {
    outcome: result.outcome,
    relieverId: reliever?.id,
    relieverName: reliever?.name,
    plan: reliever
      ? `${reliever.name} arranged from ${where} reliever pool`
      : "Replacement arranged",
  };
}

/** Shift In-Charge picks one available person (employee or pool), or accepts OT. */
export function assignChosenRelieverForLeave(
  input: {
    leaveId: string;
    employeeId: string;
    employeeName: string;
    siteId: string;
    shiftId: string;
    date: string;
    reason: string;
  },
  choice:
    | { relieverId: string }
    | { coverEmployeeId: string }
    | { ot: true },
): {
  outcome: "local_assigned" | "pool_assigned" | "ot_fallback" | "employee_assigned";
  relieverId?: string;
  relieverName?: string;
  coverEmployeeId?: string;
  coverSource?: AbsenceRecord["coverSource"];
  plan: string;
} {
  ensureRelieverHydrated();
  const absence = ensureLeaveAbsence(input);

  if ("ot" in choice) {
    absence.status = "ot_fallback";
    absence.assignedRelieverId = undefined;
    absence.assignedCoverEmployeeId = undefined;
    absence.coverSource = "ot_fallback";
    absence.resolutionNote = "Shift In-Charge accepted OT — no reliever assigned";
    absenceStore = absenceStore.map((a) =>
      a.id === absence.id ? { ...absence } : a,
    );
    persistRelieverPool();
    return {
      outcome: "ot_fallback",
      coverSource: "ot_fallback",
      plan: "No cover chosen — OT last resort",
    };
  }

  const options = listReplacementOptions(input.siteId, {
    date: input.date,
    excludeEmployeeId: input.employeeId,
  });
  const choiceId =
    "coverEmployeeId" in choice ? choice.coverEmployeeId : choice.relieverId;
  const picked =
    options.local.find((o) => o.relieverId === choiceId) ??
    options.cluster.find((o) => o.relieverId === choiceId);
  if (!picked) {
    throw new Error("That person is not available for this site");
  }

  if (picked.kind === "employee" || picked.coverSource?.includes("employee")) {
    absence.status = "local_assigned";
    absence.assignedRelieverId = undefined;
    absence.assignedCoverEmployeeId = picked.relieverId;
    absence.coverSource = picked.coverSource ?? "local_employee";
    absence.resolutionNote = `${picked.name} (employee) chosen by Shift In-Charge`;
    absenceStore = absenceStore.map((a) =>
      a.id === absence.id ? { ...absence } : a,
    );
    persistRelieverPool();
    const where =
      picked.coverSource === "cluster_employee" ? "cluster" : "same plant";
    return {
      outcome: "employee_assigned",
      coverEmployeeId: picked.relieverId,
      coverSource: absence.coverSource,
      plan: `${picked.name} arranged from ${where} employees`,
    };
  }

  const outcome = picked.source === "local" ? "local_assigned" : "pool_assigned";
  relieverStore = relieverStore.map((r) =>
    r.id === picked.relieverId
      ? {
          ...r,
          availability: "assigned",
          assignedSiteId: input.siteId,
          assignedAbsenceId: input.leaveId,
        }
      : r,
  );
  absence.status = outcome;
  absence.assignedRelieverId = picked.relieverId;
  absence.assignedCoverEmployeeId = undefined;
  absence.coverSource =
    picked.coverSource ??
    (picked.source === "local" ? "local_pool" : "cluster_pool");
  absence.resolutionNote = `${picked.name} chosen by Shift In-Charge`;
  absenceStore = absenceStore.map((a) =>
    a.id === absence.id ? { ...absence } : a,
  );
  persistRelieverPool();
  pushRelieverAssign(picked.relieverId, input.siteId, input.leaveId);
  const where = outcome === "local_assigned" ? "local" : "cluster";
  return {
    outcome,
    relieverId: picked.relieverId,
    relieverName: picked.name,
    coverSource: absence.coverSource,
    plan: `${picked.name} arranged from ${where} reliever pool`,
  };
}

export function releaseRelieverForLeave(leaveId: string) {
  ensureRelieverHydrated();
  relieverStore = relieverStore.map((r) => {
    if (r.assignedAbsenceId !== leaveId) return r;
    return {
      ...r,
      availability: "available",
      assignedSiteId: undefined,
      assignedAbsenceId: undefined,
    };
  });
  absenceStore = absenceStore.map((a) =>
    a.id === leaveId
      ? {
          ...a,
          status: "resolved",
          assignedRelieverId: undefined,
          assignedCoverEmployeeId: undefined,
          coverSource: undefined,
        }
      : a,
  );
  persistRelieverPool();
  pushRelieverRelease({ absenceId: leaveId });
}

export function resetRelieverPool() {
  relieverStore = relieverSeed.map(cloneReliever);
  absenceStore = absenceSeed.map((a) => ({
    ...a,
    requiredSkills: [...a.requiredSkills],
  }));
  eventStore = eventSeed.map((e) => ({ ...e }));
  relieverHydrated = true;
  persistRelieverPool();
}

export function setRelieverAvailability(
  relieverId: string,
  availability: RelieverAvailability,
) {
  ensureRelieverHydrated();
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
  persistRelieverPool();
  if (availability === "available") {
    pushRelieverRelease({ relieverId });
  } else {
    pushRelieverAvailability(relieverId, availability);
  }
}

export function getPoolKpis() {
  ensureRelieverHydrated();
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
  ensureRelieverHydrated();
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

// ----------------------------------------------------
// Live NestJS Backend Synchronization
// ----------------------------------------------------
export async function syncRelieversWithApi(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { getRelievers, updateRelieverAvailability, assignReliever } =
      await import("../api/relievers");
    let live = await getRelievers().catch(() => [] as Awaited<
      ReturnType<typeof getRelievers>
    >);

    // Bootstrap: if Mongo pool empty, push local seed availability snapshot
    if (!live?.length) {
      ensureRelieverHydrated();
      for (const r of relieverStore) {
        try {
          if (r.availability === "assigned" && r.assignedSiteId) {
            await assignReliever(
              r.id,
              r.assignedSiteId,
              r.assignedAbsenceId,
            ).catch(() =>
              updateRelieverAvailability(r.id, r.availability).catch(() => null),
            );
          } else {
            await updateRelieverAvailability(r.id, r.availability).catch(
              () => null,
            );
          }
        } catch {
          /* seed may not exist on server until npm run seed */
        }
      }
      live = await getRelievers().catch(() => []);
    }

    if (live && live.length) {
      const byId = new Map(live.map((r) => [r.id, r]));
      // Merge API availability onto known pool members; keep local skill metadata
      ensureRelieverHydrated();
      relieverStore = relieverStore.map((local) => {
        const remote = byId.get(local.id);
        if (!remote) return local;
        return {
          ...local,
          name: remote.name || local.name,
          phone: remote.phone || local.phone,
          clusterId: remote.clusterId || local.clusterId,
          homeSiteId: remote.homeSiteId ?? local.homeSiteId,
          skills: (remote.skills ||
            remote.skillTags ||
            local.skills) as Reliever["skills"],
          availability: (remote.availability === "deployed"
            ? "assigned"
            : remote.availability === "on_leave" ||
                remote.availability === "inactive"
              ? "unavailable"
              : remote.availability) as RelieverAvailability,
          assignedSiteId: (remote as { assignedSiteId?: string })
            .assignedSiteId,
          assignedAbsenceId: (remote as { assignedAbsenceId?: string })
            .assignedAbsenceId,
        };
      });
      // Append any API-only relievers not in local seed
      for (const remote of live) {
        if (relieverStore.some((r) => r.id === remote.id)) continue;
        relieverStore.push({
          id: remote.id,
          employeeId: remote.employeeId,
          name: remote.name,
          phone: remote.phone || "",
          clusterId: remote.clusterId || "c-demo",
          homeSiteId: remote.homeSiteId,
          skills: (remote.skills || remote.skillTags || []) as Reliever["skills"],
          plantTypes: [],
          availability: (remote.availability === "deployed"
            ? "assigned"
            : remote.availability === "on_leave" ||
                remote.availability === "inactive"
              ? "unavailable"
              : remote.availability) as RelieverAvailability,
          assignedSiteId: (remote as { assignedSiteId?: string })
            .assignedSiteId,
          assignedAbsenceId: (remote as { assignedAbsenceId?: string })
            .assignedAbsenceId,
        });
      }
      relieverHydrated = true;
      persistRelieverPool();
    }
  } catch {
    // Graceful offline fallback
  }
}

registerPoolApi({
  getClusterForSite,
  getRelievers,
  sites: sites.map((s) => ({
    id: s.id,
    name: s.name,
    plantType: s.plantType,
    headcount: s.headcount,
  })),
});

