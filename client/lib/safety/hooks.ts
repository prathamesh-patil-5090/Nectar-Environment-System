"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { getEmployees } from "@/lib/api/employees";
import { getSites } from "@/lib/api/sites";
import { getSession, type SessionUser } from "@/lib/auth";
import type { Employee } from "@/lib/types/employee.types";
import type { Site } from "@/lib/types/site.types";
import { getSafetyEvents, subscribeSafety, syncSafetyWithApi } from "./store";
import type { SafetyEvent } from "./types";

const EMPTY: SafetyEvent[] = [];

/** Cached events (instant) + a fresh API load on mount. `error` is set when the API is unreachable. */
export function useSafetyEvents() {
  const events = useSyncExternalStore(subscribeSafety, getSafetyEvents, () => EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await syncSafetyWithApi();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    syncSafetyWithApi()
      .then(() => alive && setError(null))
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not reach the server"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { events, loading, error, reload };
}

// ── People + sites from the API (no mock data) ────────────────────────────

type Directory = { employees: Employee[]; sites: Site[] };
let directoryPromise: Promise<Directory> | null = null;

function loadDirectory(): Promise<Directory> {
  if (!directoryPromise) {
    directoryPromise = Promise.all([getEmployees(), getSites()])
      .then(([employees, sites]) => ({ employees, sites }))
      .catch((err) => {
        directoryPromise = null; // retry next time
        throw err;
      });
  }
  return directoryPromise;
}

export function useDirectory() {
  const [dir, setDir] = useState<Directory>({ employees: [], sites: [] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadDirectory()
      .then((d) => alive && setDir(d))
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not load people"));
    return () => {
      alive = false;
    };
  }, []);

  const empName = useCallback(
    (id?: string) => (id ? dir.employees.find((e) => e.id === id)?.name ?? id : ""),
    [dir.employees],
  );
  const siteName = useCallback(
    (id?: string) => (id ? dir.sites.find((s) => s.id === id)?.name ?? id : ""),
    [dir.sites],
  );
  return { ...dir, empName, siteName, error };
}

/** Session read after mount (localStorage) to avoid hydration mismatch. */
export function useSessionUser(): SessionUser | null | undefined {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  useEffect(() => {
    const id = requestAnimationFrame(() => setUser(getSession()));
    return () => cancelAnimationFrame(id);
  }, []);
  return user;
}
