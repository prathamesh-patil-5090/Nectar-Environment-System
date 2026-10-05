/** Tiny localStorage JSON helpers shared by the client-side demo stores. */

const isServer = () => typeof window === "undefined";

/** Parsed value at `key`, or `fallback` when missing, unparseable or on the server. */
export function readJson<T>(key: string, fallback: T): T {
  if (isServer()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Write `value` as JSON (errors such as quota exceeded propagate). */
export function writeJson(key: string, value: unknown): void {
  if (isServer()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

/** Write `value` as JSON, silently ignoring quota / private-mode errors. */
export function persistJson(key: string, value: unknown): void {
  if (isServer()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}
