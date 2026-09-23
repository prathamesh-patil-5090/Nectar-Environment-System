"use client";

import { useEffect, useMemo, useState } from "react";
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

export function OtFilterProvider({ children }: { children: React.ReactNode }) {
  const [lockedSiteId, setLockedSiteId] = useState<string | undefined>();
  const [filters, setFilters] = useState<OtFilters>(defaultOtFilters);

  useEffect(() => {
    const locked = scopedSiteId(getSession());
    setLockedSiteId(locked);
    if (locked) {
      setFilters((prev) => ({ ...prev, siteId: locked }));
    }
  }, []);

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
