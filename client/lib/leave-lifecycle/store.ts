import type { CoverDisruption } from "./types";

const STORAGE_KEY = "nectar.leaveLifecycle.v1";

let disruptions: CoverDisruption[] = [];
let hydrated = false;

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ disruptions }));
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
    if (!raw) return;
    const parsed = JSON.parse(raw) as { disruptions?: CoverDisruption[] };
    disruptions = parsed.disruptions ?? [];
  } catch {
    /* ignore */
  }
}

export function getCoverDisruptions(leaveId?: string): CoverDisruption[] {
  hydrate();
  return disruptions
    .filter((d) => (leaveId ? d.leaveId === leaveId : true))
    .map((d) => ({ ...d }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function hasOpenCoverDisruption(leaveId: string): boolean {
  return getCoverDisruptions(leaveId).length > 0;
}

export function addCoverDisruption(
  input: Omit<CoverDisruption, "id" | "at"> & { at?: string },
): CoverDisruption {
  hydrate();
  const row: CoverDisruption = {
    id: `lcd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    leaveId: input.leaveId,
    kind: input.kind,
    note: input.note,
    actor: input.actor,
    coverRelieverId: input.coverRelieverId,
    coverEmployeeId: input.coverEmployeeId,
    at: input.at ?? new Date().toISOString(),
  };
  disruptions = [row, ...disruptions];
  persist();
  return { ...row };
}

export function clearCoverDisruptions(leaveId: string) {
  hydrate();
  disruptions = disruptions.filter((d) => d.leaveId !== leaveId);
  persist();
}

export function resetLifecycleStore() {
  disruptions = [];
  hydrated = true;
  persist();
}
