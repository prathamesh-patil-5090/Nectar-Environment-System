/**
 * Plant time — the one clock and calendar every schedule uses.
 *
 * The plants run on Indian Standard Time (UTC+05:30, no daylight saving). Whatever timezone the
 * device is set to, times are shown and shift maths is done in IST. "Now" comes from the server's
 * clock, so a phone or PC with a wrong clock still sees the right running shift and free slots.
 * Nothing here is shown to the user; it only makes the times correct.
 */
import { intlLocale } from "@/lib/i18n";

export const PLANT_TZ = "Asia/Kolkata";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

/** Server clock minus device clock, in ms. 0 until the first sync. */
let skewMs = 0;
let synced: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Current time by the server's clock (epoch ms). */
export const plantNow = () => Date.now() + skewMs;

/**
 * Reads the server time once per page load (round-trip midpoint) and corrects the device clock.
 * Ignores failures: the device clock is used until a sync succeeds.
 */
export function syncPlantClock(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  synced ??= (async () => {
    try {
      const sent = Date.now();
      const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
      const received = Date.now();
      const server = Date.parse((await res.json())?.timestamp);
      if (!Number.isFinite(server)) throw new Error("no server time");
      const skew = server - (sent + received) / 2;
      // Under a second is network noise, not a wrong clock.
      skewMs = Math.abs(skew) < 1000 ? 0 : Math.round(skew);
      listeners.forEach((l) => l());
    } catch {
      synced = null; // try again next time
    }
  })();
  return synced;
}

/** Called when the server clock sync changes `plantNow()`. */
export function onPlantClockSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 24-hour "HH:mm" in IST. */
export const plantTime = (ms: number | string) =>
  new Date(ms).toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: PLANT_TZ });

/** "Fri, 9 Oct" in IST. */
export const plantDay = (ms: number | string) =>
  new Date(ms).toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short", timeZone: PLANT_TZ });

/** "09 Oct 06:00" in IST. */
export const plantDayTime = (ms: number | string) =>
  `${new Date(ms).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short", timeZone: PLANT_TZ })} ${plantTime(ms)}`;

/** "2026-10-09" — the IST calendar day, for grouping and comparing days. */
export const plantDayKey = (ms: number | string) => new Date(ms).toLocaleDateString("en-CA", { timeZone: PLANT_TZ });
