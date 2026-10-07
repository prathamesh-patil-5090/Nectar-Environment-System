"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getSession } from "@/lib/auth";
import { ePermitViewerOf } from "@/lib/rbac";
import type { PermitViewer } from "./rules";
import {
  departmentIdsOf,
  getCachedMasters,
  getEPermits,
  loadMasters,
  subscribeEPermits,
  syncEPermitsWithApi,
} from "./store";
import type { EPermit, EPermitMasters } from "./types";

const EMPTY: EPermit[] = [];

/** Cached permits (instant) + a fresh API load on mount. `error` is set when the API is unreachable. */
export function useEPermits() {
  const permits = useSyncExternalStore(subscribeEPermits, getEPermits, () => EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await syncEPermitsWithApi();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    syncEPermitsWithApi()
      .then(() => alive && setError(null))
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not reach the server"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { permits, loading, error, reload };
}

const EMPTY_MASTERS: EPermitMasters = { departments: [], locations: [], contacts: [] };

/** Departments, locations and emergency contacts (cached, refreshed from the API). */
export function useEPermitMasters() {
  const [masters, setMasters] = useState<EPermitMasters>(EMPTY_MASTERS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const cached = getCachedMasters();
    const id = requestAnimationFrame(() => {
      if (alive && cached) setMasters(cached);
    });
    loadMasters()
      .then((m) => alive && setMasters(m))
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not load departments"));
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, []);

  const reloadMasters = useCallback(async () => {
    const m = await loadMasters(true);
    setMasters(m);
  }, []);

  const deptName = useCallback(
    (id?: string) => (id ? masters.departments.find((d) => d.id === id)?.name ?? id : ""),
    [masters.departments],
  );
  const locationName = useCallback(
    (id?: string) => (id ? masters.locations.find((l) => l.id === id)?.name ?? id : ""),
    [masters.locations],
  );
  return { ...masters, error, deptName, locationName, reloadMasters };
}

/** The signed-in person as a rule viewer (HoDs carry their departments). Undefined until mounted. */
export function usePermitViewer(masters: EPermitMasters): PermitViewer | null | undefined {
  const [session, setSession] = useState<ReturnType<typeof getSession> | undefined>(undefined);
  useEffect(() => {
    const id = requestAnimationFrame(() => setSession(getSession()));
    return () => cancelAnimationFrame(id);
  }, []);
  return useMemo(() => {
    if (session === undefined) return undefined;
    if (!session) return null;
    const base = ePermitViewerOf(session);
    return ePermitViewerOf(session, departmentIdsOf(base?.id, masters));
  }, [session, masters]);
}

/** Re-render every `ms` so countdowns and the red overdue clock stay current. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
