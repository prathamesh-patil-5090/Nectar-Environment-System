"use client";

import { useMemo, useState } from "react";
import { getSession } from "@/lib/auth";
import {
  defaultOtFilters,
  scopedSiteId,
  type OtFilters,
} from "@/lib/overtime";
import { createContext, useContext } from "react";

type OtFilterContextValue = {
  filters: OtFilters;
  setFilters: (next: OtFilters) => void;
  lockedSiteId?: string;
};

const OtFilterContext = createContext<OtFilterContextValue | null>(null);

function initialLockedSiteId() {
  if (typeof window === "undefined") return undefined;
  return scopedSiteId(getSession());
}

export function OtFilterProvider({ children }: { children: React.ReactNode }) {
  const [lockedSiteId] = useState<string | undefined>(initialLockedSiteId);
  const [filters, setFilters] = useState<OtFilters>(() => {
    const locked = initialLockedSiteId();
    const base = defaultOtFilters();
    return locked ? { ...base, siteId: locked } : base;
  });

  const value = useMemo(
    () => ({
      filters: lockedSiteId ? { ...filters, siteId: lockedSiteId } : filters,
      setFilters,
      lockedSiteId,
    }),
    [filters, lockedSiteId],
  );

  return (
    <OtFilterContext.Provider value={value}>{children}</OtFilterContext.Provider>
  );
}

export function useOtFilters() {
  const ctx = useContext(OtFilterContext);
  if (!ctx) throw new Error("useOtFilters must be used within OtFilterProvider");
  return ctx;
}
