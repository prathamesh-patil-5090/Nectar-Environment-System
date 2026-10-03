import type { OtDecision } from "./types";

const STORAGE_KEY = "nectar.otDecisions.v1";

const SEED: OtDecision[] = [
  {
    id: "otd-seed-mee-ab3",
    status: "pending",
    trigger: "roster_vacancy",
    siteId: "s-mee",
    date: "2026-09-22",
    shiftId: "sh-morning",
    absenceId: "ab3",
    hours: 8,
    cost: 2160,
    flags: [],
    proposedAssignees: [],
    createdAt: "2026-09-22T05:45:00Z",
    title: "MEE morning — no pool match",
    message:
      "Meghal Salgaonkar absence left uncovered; OT last resort pending Manager review.",
  },
  {
    id: "otd-seed-etp-gap",
    status: "pending",
    trigger: "leave_cover",
    siteId: "s-etp",
    date: "2026-09-23",
    shiftCode: "A",
    hours: 8,
    cost: 2160,
    flags: ["reliever_available"],
    proposedAssignees: [],
    createdAt: "2026-09-23T06:00:00Z",
    title: "ETP gap — cover still available",
    message:
      "Open ETP vacancy with ranked cover candidates. Accepting OT needs Manager remark (reliever-first).",
  },
];

let decisions: OtDecision[] = SEED.map((d) => ({
  ...d,
  flags: [...d.flags],
  proposedAssignees: [...d.proposedAssignees],
}));
let hydrated = false;

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));
  } catch {
    /* ignore */
  }
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      persist();
      return;
    }
    const parsed = JSON.parse(raw) as OtDecision[];
    if (Array.isArray(parsed) && parsed.length) {
      decisions = parsed;
    } else {
      persist();
    }
  } catch {
    /* ignore */
  }
}

export function getOtDecisions(opts?: {
  siteId?: string;
  status?: OtDecision["status"];
  leaveId?: string;
}): OtDecision[] {
  hydrate();
  return decisions
    .filter((d) => (opts?.siteId ? d.siteId === opts.siteId : true))
    .filter((d) => (opts?.status ? d.status === opts.status : true))
    .filter((d) => (opts?.leaveId ? d.leaveId === opts.leaveId : true))
    .map((d) => ({
      ...d,
      flags: [...d.flags],
      proposedAssignees: d.proposedAssignees.map((a) => ({ ...a })),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getOtDecisionById(id: string): OtDecision | undefined {
  hydrate();
  const d = decisions.find((x) => x.id === id);
  return d
    ? {
        ...d,
        flags: [...d.flags],
        proposedAssignees: d.proposedAssignees.map((a) => ({ ...a })),
      }
    : undefined;
}

export function findClearingOtDecision(opts: {
  siteId: string;
  date: string;
  leaveId?: string;
  vacancyId?: string;
}): OtDecision | undefined {
  hydrate();
  return decisions.find(
    (d) =>
      d.status === "approved" &&
      d.siteId === opts.siteId &&
      d.date === opts.date &&
      (opts.leaveId
        ? d.leaveId === opts.leaveId
        : opts.vacancyId
          ? d.vacancyId === opts.vacancyId
          : true),
  );
}

export function upsertOtDecision(
  input: Omit<OtDecision, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): OtDecision {
  hydrate();
  const id =
    input.id ?? `otd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const existing = decisions.findIndex((d) => d.id === id);
  const row: OtDecision = {
    ...input,
    id,
    createdAt: input.createdAt ?? new Date().toISOString(),
    flags: [...input.flags],
    proposedAssignees: input.proposedAssignees.map((a) => ({ ...a })),
  };
  if (existing >= 0) {
    decisions = decisions.map((d, i) => (i === existing ? row : d));
  } else {
    decisions = [row, ...decisions];
  }
  persist();
  return getOtDecisionById(id)!;
}

export function updateOtDecision(
  id: string,
  patch: Partial<OtDecision>,
): OtDecision {
  hydrate();
  const cur = decisions.find((d) => d.id === id);
  if (!cur) throw new Error("OT decision not found");
  const next: OtDecision = {
    ...cur,
    ...patch,
    flags: patch.flags ? [...patch.flags] : [...cur.flags],
    proposedAssignees: patch.proposedAssignees
      ? patch.proposedAssignees.map((a) => ({ ...a }))
      : cur.proposedAssignees.map((a) => ({ ...a })),
  };
  decisions = decisions.map((d) => (d.id === id ? next : d));
  persist();
  return getOtDecisionById(id)!;
}

export function resetOtDecisionStore() {
  decisions = SEED.map((d) => ({
    ...d,
    flags: [...d.flags],
    proposedAssignees: [...d.proposedAssignees],
  }));
  hydrated = true;
  persist();
}
