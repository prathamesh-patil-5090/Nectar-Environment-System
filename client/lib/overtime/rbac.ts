import type { SessionUser } from "@/lib/auth";
import {
  canDownloadOtReports,
  canViewAllSites,
  scopedSiteId as rbacScopedSiteId,
} from "@/lib/rbac";

/** @deprecated Prefer lib/rbac — kept for OT module imports */
export type OtRole = SessionUser["role"];

export function getOtRole(user: SessionUser | null): OtRole {
  return user?.role ?? "site_incharge";
}

export { canViewAllSites };

export function canDownloadReports(user: SessionUser | null): boolean {
  return canDownloadOtReports(user);
}

export function scopedSiteId(user: SessionUser | null): string | undefined {
  return rbacScopedSiteId(user);
}
