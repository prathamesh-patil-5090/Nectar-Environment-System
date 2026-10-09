/**
 * E-Permits feature flag. On by default; set NEXT_PUBLIC_FEATURE_EPERMITS=off to hide the menu and pages
 * (the server keeps its API; EPERMIT_SCHEDULER=off stops its reminders).
 */
export const E_PERMITS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_EPERMITS !== "off";
