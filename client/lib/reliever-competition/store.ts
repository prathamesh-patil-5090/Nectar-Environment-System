import type { CompetitionAck, CompetitionAward } from "./types";

const STORAGE_KEY = "nectar.relieverCompetition.v1";

let acks: CompetitionAck[] = [];
let awards: CompetitionAward[] = [];
let hydrated = false;

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ acks, awards }),
    );
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
    const parsed = JSON.parse(raw) as {
      acks?: CompetitionAck[];
      awards?: CompetitionAward[];
    };
    acks = parsed.acks ?? [];
    awards = parsed.awards ?? [];
  } catch {
    /* ignore */
  }
}

export function getCompetitionAcks(): CompetitionAck[] {
  hydrate();
  return acks.map((a) => ({ ...a }));
}

export function getCompetitionAwards(): CompetitionAward[] {
  hydrate();
  return awards.map((a) => ({ ...a }));
}

export function hasCompetitionAck(
  leaveId: string,
  candidateId: string,
): boolean {
  hydrate();
  return acks.some(
    (a) => a.leaveId === leaveId && a.candidateId === candidateId,
  );
}

export function hasCompetitionAward(
  contestId: string,
  winnerLeaveId: string,
  candidateId: string,
): boolean {
  hydrate();
  return awards.some(
    (a) =>
      a.contestId === contestId &&
      a.winnerLeaveId === winnerLeaveId &&
      a.candidateId === candidateId,
  );
}

export function addCompetitionAck(
  input: Omit<CompetitionAck, "id" | "at"> & { at?: string },
): CompetitionAck {
  hydrate();
  const existing = acks.find(
    (a) =>
      a.leaveId === input.leaveId && a.candidateId === input.candidateId,
  );
  if (existing) return { ...existing };
  const row: CompetitionAck = {
    id: `ack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    contestId: input.contestId,
    leaveId: input.leaveId,
    candidateId: input.candidateId,
    actor: input.actor,
    remark: input.remark,
    at: input.at ?? new Date().toISOString(),
  };
  acks = [...acks, row];
  persist();
  return { ...row };
}

export function addCompetitionAward(
  input: Omit<CompetitionAward, "id" | "at"> & { at?: string },
): CompetitionAward {
  hydrate();
  const row: CompetitionAward = {
    id: `awd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    contestId: input.contestId,
    winnerLeaveId: input.winnerLeaveId,
    candidateId: input.candidateId,
    actor: input.actor,
    at: input.at ?? new Date().toISOString(),
  };
  awards = [...awards, row];
  persist();
  return { ...row };
}

export function resetCompetitionStore() {
  acks = [];
  awards = [];
  hydrated = true;
  persist();
}
