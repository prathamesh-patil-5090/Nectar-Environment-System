"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSession, type SessionUser } from "@/lib/auth";
import { isManagerRole, normalizeRole } from "@/lib/rbac";
import { getMentors } from "@/lib/api/training";
import { personIdOf } from "./identity";

import { intlLocale } from "@/lib/i18n/phrases";
/** Run an async loader; re-runs when deps change. No fallback data: errors surface as `error`. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify(deps);
  useEffect(() => {
    const mine = ++seq.current;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const value = await loadRef.current();
        if (mine === seq.current) setData(value);
      } catch (err) {
        if (mine === seq.current) setError((err as Error).message || "Something went wrong");
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, nonce]);
  const reload = useCallback(async () => setNonce((n) => n + 1), []);
  return { data, error, loading, reload, setData };
}

export type Viewer = {
  session: SessionUser | null;
  /** Employee id, or "user:<email>" for non-employees (Director) */
  personId?: string;
  role: ReturnType<typeof normalizeRole>;
  /** HR / Manager / Director see Training as "Academic Records" */
  isRecords: boolean;
};

export function useViewer(): Viewer {
  const [session] = useState(() => getSession());
  const role = normalizeRole(session?.role);
  return {
    session,
    personId: personIdOf(session),
    role,
    isRecords: role === "hr" || isManagerRole(role) || role === "director",
  };
}

/** Active mentor ids, fetched once per page load (a list call, so non-mentors don't trigger 404s). */
let mentorIds: Promise<Set<string>> | null = null;
const activeMentorIds = () =>
  (mentorIds ??= getMentors()
    .then((rows) => new Set(rows.filter((m) => m.active).map((m) => m.employeeId)))
    .catch(() => {
      mentorIds = null;
      return new Set<string>();
    }));

/** True when the viewer has an active mentor profile. */
export function useIsMentor(personId?: string): boolean {
  const [isMentor, setIsMentor] = useState(false);
  useEffect(() => {
    if (!personId) return;
    let live = true;
    void activeMentorIds().then((ids) => live && setIsMentor(ids.has(personId)));
    return () => {
      live = false;
    };
  }, [personId]);
  return isMentor;
}

/** "Thu, 8 Oct · 15:00" in IST */
export function fmtIst(iso: string, withYear = false): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(intlLocale(), {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
  const time = d.toLocaleTimeString(intlLocale(), { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${time}`;
}

export function fmtTimeRange(startIso: string, endIso: string): string {
  const t = (iso: string) =>
    new Date(iso).toLocaleTimeString(intlLocale(), { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fmtIst(startIso)} – ${t(endIso)} IST`;
}

export function dayParts(iso: string): { month: string; day: string } {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString(intlLocale(), { timeZone: "Asia/Kolkata", month: "short" }),
    day: d.toLocaleDateString(intlLocale(), { timeZone: "Asia/Kolkata", day: "numeric" }),
  };
}
