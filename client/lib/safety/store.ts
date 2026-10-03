/**
 * Safety store — the server (Mongo) is the source of truth. This module keeps a cache of
 * events so synchronous checks (leave return gate, OT / cover soft-blocks) can read them,
 * and so pages render instantly from the last known state when offline.
 * Writes always go to the API first; the cache is updated from the server's response.
 * Never imports leave / OT / shift code (they import from here).
 */
import { persistJson, readJson } from "@/lib/storage";
import type { SafetyEvent } from "./types";

const STORAGE_KEY = "nectar-enviro-safety-cache-v1";

let events: SafetyEvent[] = [];
let hydrated = false;
let loadedFromApi = false;
const listeners = new Set<() => void>();

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const cached = readJson<SafetyEvent[]>(STORAGE_KEY, []);
  if (Array.isArray(cached)) events = cached;
}

function emit() {
  persistJson(STORAGE_KEY, events);
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
  const { listSafetyEvents } = await import("../api/safety");
  const live = await listSafetyEvents();
  if (Array.isArray(live)) {
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
