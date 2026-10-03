/**
 * Safety store — the server (Mongo) is the source of truth. This module keeps a cache of
 * events so synchronous checks (leave return gate, OT / cover soft-blocks) can read them,
 * and so pages render instantly from the last known state when offline.
 * Writes always go to the API first; the cache is updated from the server's response.
 * Never imports leave / OT / shift code (they import from here).
 */
import { getSession } from "@/lib/auth";
import { safetyActorOf } from "@/lib/rbac";
import { persistJson, readJson } from "@/lib/storage";
import type { SafetyEvent } from "./types";

/** Old shared cache — one browser handed the last user's copy (meeting links included) to the next one. */
const LEGACY_KEY = "nectar-enviro-safety-cache-v1";
/** Cached per signed-in person: each copy only holds what the server sent them (e.g. meeting links). */
const storageKey = (owner: string) => `nectar-enviro-safety-cache-v2:${owner}`;

let events: SafetyEvent[] = [];
let hydrated = false;
let owner: string | null = null;
let loadedFromApi = false;
const listeners = new Set<() => void>();

const viewer = () => safetyActorOf(getSession());

/** (Re)load the cache for whoever is signed in now; switching user drops the previous person's cases. */
function ensureHydrated() {
  if (typeof window === "undefined") return;
  const who = viewer()?.id ?? null;
  if (hydrated && who === owner) return;
  hydrated = true;
  owner = who;
  loadedFromApi = false;
  events = [];
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* storage blocked */
  }
  if (!who) return;
  const cached = readJson<SafetyEvent[]>(storageKey(who), []);
  if (Array.isArray(cached)) events = cached;
}

function emit() {
  if (owner) persistJson(storageKey(owner), events);
  for (const l of listeners) l();
}

export function subscribeSafety(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** All cached events, newest first. */
export function getSafetyEvents(): SafetyEvent[] {
  ensureHydrated();
  return events;
}

export function getCachedSafetyEvent(id: string): SafetyEvent | undefined {
  ensureHydrated();
  return events.find((e) => e.id === id);
}

/** True once the cache reflects a successful API load in this session. */
export function safetyLoadedFromApi(): boolean {
  return loadedFromApi;
}

/** Replace / insert from a server response. */
export function upsertSafetyEvent(ev: SafetyEvent | null | undefined) {
  if (!ev?.id) return;
  ensureHydrated();
  const i = events.findIndex((e) => e.id === ev.id);
  events = i === -1 ? [ev, ...events] : events.map((e) => (e.id === ev.id ? ev : e));
  events = [...events].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
  emit();
}

export async function syncSafetyWithApi(): Promise<void> {
  if (typeof window === "undefined") return;
  ensureHydrated();
  const me = viewer();
  if (!me) return;
  const { listSafetyEvents } = await import("../api/safety");
  const live = await listSafetyEvents(me);
  // Ignore a late answer if someone else signed in meanwhile
  if (Array.isArray(live) && me.id === owner) {
    events = live;
    loadedFromApi = true;
    emit();
  }
}

/** Test helper — node tests have no window/localStorage. */
export function __setSafetyEventsForTest(next: SafetyEvent[]) {
  hydrated = true;
  events = next;
}
