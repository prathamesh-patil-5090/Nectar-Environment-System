/**
 * Plant time — the one clock and calendar every schedule uses.
 *
 * The plants run on Indian Standard Time (UTC+05:30, no daylight saving). Whatever timezone the
 * device is set to, times are shown and shift maths is done in IST. "Now" comes from the server's
 * clock, so a phone or PC with a wrong clock still sees the right running shift and free slots.
 * Nothing here is shown to the user; it only makes the times correct.
 */
import { intlLocale } from "@/lib/i18n";
import { API_BASE_URL } from "@/lib/api/client";

export const PLANT_TZ = "Asia/Kolkata";

/** Re-read the server clock this often, so a device clock corrected mid-session is picked up. */
const RESYNC_MS = 10 * 60_000;
/** After a failed sync (e.g. /health down), wait this long before asking again. */
const RETRY_MS = 30_000;

/** Server clock minus device clock, in ms. 0 until the first sync. */
let skewMs = 0;
let inFlight: Promise<void> | null = null;
/** Device time of the last successful sync / last failure (null = never). */
let lastOkAt: number | null = null;
let lastFailAt: number | null = null;
const listeners = new Set<() => void>();

/** Current time by the server's clock (epoch ms). */
export const plantNow = () => Date.now() + skewMs;

/** Device-clock jumps can make "elapsed" negative; treat any jump as long ago. */
const olderThan = (at: number | null, ms: number) => at === null || Math.abs(Date.now() - at) >= ms;

/**
 * Reads the server time (round-trip midpoint) and corrects the device clock. Cheap to call often:
 * it fetches at most every 10 minutes, and backs off 30 s after a failure. Ignores failures — the last
 * known skew (or the device clock) is used until a sync succeeds.
 */
export function syncPlantClock(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (inFlight) return inFlight;
  if (!olderThan(lastOkAt, RESYNC_MS) || !olderThan(lastFailAt, RETRY_MS)) return Promise.resolve();
  inFlight = (async () => {
    try {
      const sent = Date.now();
      const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
      const received = Date.now();
      const server = Date.parse((await res.json())?.timestamp);
      if (!Number.isFinite(server)) throw new Error("no server time");
      const skew = server - (sent + received) / 2;
      // Under a second is network noise, not a wrong clock.
      const next = Math.abs(skew) < 1000 ? 0 : Math.round(skew);
      lastOkAt = Date.now();
      lastFailAt = null;
      if (next !== skewMs) {
        skewMs = next;
        listeners.forEach((l) => l());
      }
    } catch {
      lastFailAt = Date.now();
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
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
