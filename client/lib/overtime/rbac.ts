import type { SessionUser } from "@/lib/auth";

export type OtRole = "management" | "hr" | "site_incharge";

export type OtSessionUser = SessionUser & {
  role: OtRole;
  siteId?: string;
};

export function getOtRole(user: SessionUser | null): OtRole {
  if (!user) return "site_incharge";
  const extended = user as OtSessionUser;
  if (extended.role) return extended.role;
  // Demo default: ops admin sees everything
  return "management";
}

export function canViewAllSites(user: SessionUser | null): boolean {
  const role = getOtRole(user);
  return role === "management" || role === "hr";
}

export function canDownloadReports(user: SessionUser | null): boolean {
  const role = getOtRole(user);
  return role === "management" || role === "hr";
}

export function scopedSiteId(user: SessionUser | null): string | undefined {
  if (canViewAllSites(user)) return undefined;
  const extended = user as OtSessionUser;
  return extended.siteId ?? "s1";
}
