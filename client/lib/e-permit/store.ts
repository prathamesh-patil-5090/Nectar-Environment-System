/**
 * E-Permit store — the server (Mongo) is the source of truth. This module keeps a per-person cache of the
 * permits the server let them see, so pages render instantly from the last known state and synchronous
 * checks (Safety breakdown → permit link, shift hub counts) can read them.
 * Writes always go to the API first; the cache is updated from the server's response.
 */
import { getSession } from "@/lib/auth";
import { ePermitActorOf } from "@/lib/rbac";
import { persistJson, readJson } from "@/lib/storage";
import type { EPermit, EPermitMasters } from "./types";

const storageKey = (owner: string) => `nectar-enviro-e-permit-cache-v1:${owner}`;
const MASTERS_KEY = "nectar-enviro-e-permit-masters-v1";

let permits: EPermit[] = [];
let hydrated = false;
let owner: string | null = null;
let loadedFromApi = false;
const listeners = new Set<() => void>();

const viewer = () => ePermitActorOf(getSession());

/** (Re)load the cache for whoever is signed in now; switching user drops the previous person's permits. */
function ensureHydrated() {
  if (typeof window === "undefined") return;
  const who = viewer()?.id ?? null;
  if (hydrated && who === owner) return;
  hydrated = true;
  owner = who;
  loadedFromApi = false;
  permits = [];
  if (!who) return;
  const cached = readJson<EPermit[]>(storageKey(who), []);
  if (Array.isArray(cached)) permits = cached;
}

function emit() {
  if (owner) persistJson(storageKey(owner), permits);
  for (const l of listeners) l();
}

const newestFirst = (a: EPermit, b: EPermit) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");

export function subscribeEPermits(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** All cached permits, most recently changed first. */
export function getEPermits(): EPermit[] {
  ensureHydrated();
  return permits;
}

export function getCachedEPermit(id: string): EPermit | undefined {
  ensureHydrated();
  return permits.find((p) => p.id === id);
}

export function ePermitsLoadedFromApi(): boolean {
  return loadedFromApi;
}

/** Replace / insert from a server response. */
export function upsertEPermit(p: EPermit | null | undefined) {
  if (!p?.id) return;
  ensureHydrated();
  const i = permits.findIndex((x) => x.id === p.id);
  permits = i === -1 ? [p, ...permits] : permits.map((x) => (x.id === p.id ? p : x));
  permits = [...permits].sort(newestFirst);
  emit();
}

export async function syncEPermitsWithApi(): Promise<void> {
  if (typeof window === "undefined") return;
  ensureHydrated();
  const me = viewer();
  if (!me) return;
  const { listEPermits } = await import("../api/e-permits");
  const live = await listEPermits(me);
  // Ignore a late answer if someone else signed in meanwhile
  if (Array.isArray(live) && me.id === owner) {
    permits = [...live].sort(newestFirst);
    loadedFromApi = true;
    emit();
  }
}

// ── Masters (departments, locations, emergency contacts) ─────────────────

let masters: EPermitMasters | null = null;
let mastersPromise: Promise<EPermitMasters> | null = null;

export function getCachedMasters(): EPermitMasters | null {
  if (masters) return masters;
  if (typeof window === "undefined") return null;
  const cached = readJson<EPermitMasters | null>(MASTERS_KEY, null);
  if (cached && Array.isArray(cached.departments)) masters = cached;
  return masters;
}

export function loadMasters(force = false): Promise<EPermitMasters> {
  if (!mastersPromise || force) {
    mastersPromise = import("../api/e-permits")
      .then((m) => m.getEPermitMasters())
      .then((m) => {
        masters = m;
        persistJson(MASTERS_KEY, m);
        return m;
      })
      .catch((err) => {
        mastersPromise = null; // retry next time
        throw err;
      });
  }
  return mastersPromise;
}

/** Departments this person heads or deputises (HoDs) — for rule checks. */
export function departmentIdsOf(personId: string | undefined, m: EPermitMasters | null = getCachedMasters()): string[] {
  if (!personId || !m) return [];
  return m.departments.filter((d) => d.headUserId === personId || d.deputyUserIds.includes(personId)).map((d) => d.id);
}

/** Test helper — node tests have no window/localStorage. */
export function __setEPermitsForTest(next: EPermit[], nextMasters: EPermitMasters | null = null) {
  hydrated = true;
  permits = next;
  masters = nextMasters;
}
