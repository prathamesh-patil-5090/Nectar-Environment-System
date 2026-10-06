import { t } from "./translate";

/** Live-translated record: each access uses the current locale. */
export function localizedRecord<K extends string>(
  prefix: string,
  keys: readonly K[],
): Record<K, string> {
  const keySet = new Set<string>(keys);
  const base = Object.fromEntries(keys.map((k) => [k, k])) as unknown as Record<
    K,
    string
  >;
  return new Proxy(base, {
    get(_target, prop: string | symbol) {
      if (typeof prop !== "string") return undefined;
      if (keySet.has(prop)) return t(`${prefix}.${prop}`);
      return undefined;
    },
    ownKeys() {
      return [...keys];
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === "string" && keySet.has(prop)) {
        return {
          configurable: true,
          enumerable: true,
          writable: false,
          value: t(`${prefix}.${prop}`),
        };
      }
      return undefined;
    },
  });
}
