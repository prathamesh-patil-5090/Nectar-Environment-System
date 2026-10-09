import type { Locale } from "./types";
import { getLocale, t } from "./translate";

/**
 * English-keyed phrase catalogue.
 *
 * UI copy is written in English at the call site — `tr("Safety training")` —
 * and the English sentence is the lookup key. Hindi/Marathi live in
 * `./catalog/*` as `{ "English": ["हिन्दी", "मराठी"] }` and are loaded on
 * demand the first time a non-English locale is picked. Missing entries fall
 * back to the English text, so an untranslated string never breaks a screen.
 *
 * `tr()` reads the active locale at call time; I18nProvider remounts the app
 * when the locale changes, so calling it during render is enough. Do not call
 * it at module scope — the result would be frozen in whatever locale loaded
 * first. Keep module-level tables in English and translate where rendered.
 */

export type PhraseEntry = readonly [hi: string, mr: string];
export type PhraseCatalog = Record<string, PhraseEntry>;
export type PhraseParams = Record<string, string | number | null | undefined>;

let catalog: PhraseCatalog | null = null;
let loading: Promise<void> | null = null;

const LOCALE_INDEX: Record<Exclude<Locale, "en">, 0 | 1> = { hi: 0, mr: 1 };

/** Load the Hindi/Marathi catalogue (no-op once loaded). */
export function loadPhraseCatalog(): Promise<void> {
  if (catalog) return Promise.resolve();
  if (!loading) {
    loading = import("./catalog").then((m) => {
      catalog = m.default;
    });
  }
  return loading;
}

export function isPhraseCatalogLoaded(): boolean {
  return catalog !== null;
}

function interpolate(text: string, params?: PhraseParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = params[name];
    return v === undefined || v === null ? whole : String(v);
  });
}

function lookup(text: string, locale: Locale): string | undefined {
  if (locale === "en" || !catalog) return undefined;
  const entry = catalog[text] ?? catalog[text.trim().replace(/\s+/g, " ")];
  const translated = entry?.[LOCALE_INDEX[locale]];
  return translated || undefined;
}

/** Translate an English UI phrase. `{name}` placeholders are filled from params. */
export function tr(
  text: string,
  params?: PhraseParams,
  locale: Locale = getLocale(),
): string {
  return interpolate(lookup(text, locale) ?? text, params);
}

const LEGACY_DATA_PREFIXES = ["data.name", "data.designation", "data.department", "data.site", "data.course"];

/** Exact match: phrase catalogue, then the older keyed `data.*` dictionaries (names, sites…). */
function lookupData(value: string, locale: Locale): string | undefined {
  const hit = lookup(value, locale);
  if (hit) return hit;
  if (value.includes(".")) return undefined; // dotted keys can't be addressed in the keyed dicts
  for (const prefix of LEGACY_DATA_PREFIXES) {
    const key = `${prefix}.${value}`;
    const v = t(key, undefined, locale);
    if (v !== key && v !== value) return v;
  }
  return undefined;
}

type Pattern = { re: RegExp; names: string[]; key: string; literal: number };
let patterns: Pattern[] | null = null;

/**
 * Generic joins used when building display strings ("Drill — ETP Plant",
 * "Plant Manager · Operations"). Matched last, so specific templates win.
 */
const JOINERS = ["{a} — {b}", "{a} · {b}", "{a}: {b}", "{a} ({b})", "{a}. {b}", "{a}, {b}"];

/** Catalogue keys with `{placeholders}` double as patterns for stored sentences. */
function getPatterns(): Pattern[] {
  if (patterns || !catalog) return patterns ?? [];
  patterns = [...Object.keys(catalog), ...JOINERS]
    .filter((k) => /\{\w+\}/.test(k) && k.replace(/\{\w+\}/g, "").trim().length >= 1)
    .map((key) => {
      const names: string[] = [];
      const body = key
        .split(/(\{\w+\})/)
        .map((part) => {
          const m = /^\{(\w+)\}$/.exec(part);
          if (m) {
            names.push(m[1]);
            // {value}/{value2} are optional suffixes in generated keys; everything else needs text
            // an optional suffix starts with a separator (" — reason", ": note", ", above…")
            return /^value\d*$/.test(m[1]) ? "((?:[\\s,:;(·—–-].*?)?)" : "(.+?)";
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("");
      return { re: new RegExp(`^${body}$`, "s"), names, key, literal: key.replace(/\{\w+\}/g, "").trim().length };
    });
  return patterns;
}

const dataCache: Record<Locale, Map<string, string>> = { en: new Map(), hi: new Map(), mr: new Map() };

/** English words left in a candidate translation (acronyms like OT, RO, CIP don't count). */
const leftoverEnglish = (s: string) => (s.match(/[A-Za-z]*[a-z][A-Za-z]*/g) ?? []).filter((w) => w.length > 2).length;

/** Best catalogue template for a stored sentence, with its parts translated too. */
function matchPattern(value: string, locale: Locale, depth: number): string | undefined {
  let best: { score: number; text: string } | undefined;
  for (const p of getPatterns()) {
    const joiner = JOINERS.includes(p.key);
    if (p.literal < 3 && !joiner) continue;
    const m = p.re.exec(value);
    if (!m) continue;
    let translatedParts = 0;
    const params: PhraseParams = {};
    p.names.forEach((n, i) => {
      const part = m[i + 1];
      if (!/[A-Za-z]{2,}/.test(part)) {
        params[n] = part; // numbers, dates, codes — nothing to translate
        return;
      }
      const t = depth < 2 ? translateValue(part, locale, depth + 1) : lookupData(part, locale);
      if (t !== undefined && t !== part) translatedParts++;
      params[n] = t ?? part;
    });
    // a generic join only helps when it translates at least one side ("Closed: <typed title>")
    if (joiner && translatedParts === 0) continue;
    const text = tr(p.key, params, locale);
    // fewest English words left wins; then the template with more literal text
    const score = -leftoverEnglish(text) * 1000 + p.literal - (joiner ? 500 : 0);
    if (!best || score > best.score) best = { score, text };
  }
  return best?.text;
}

function translateValue(value: string, locale: Locale, depth: number): string | undefined {
  return lookupData(value, locale) ?? matchPattern(value, locale, depth);
}

/**
 * Translate a value that came from the API/database or a stored record
 * (course title, reason, audit-trail line…). Tries an exact catalogue match,
 * then the keyed name/site dictionaries, then catalogue templates — so the
 * stored "Approved by Anand Dakave" renders via "Approved by {name}" with the
 * name itself translated. Unknown values are returned unchanged; never
 * interpolates the value itself.
 */
export function trData<T extends string | null | undefined>(
  value: T,
  locale: Locale = getLocale(),
): T | string {
  if (!value || locale === "en" || !catalog) return value;
  const cache = dataCache[locale];
  const cached = cache.get(value);
  if (cached !== undefined) return cached;
  const result = translateValue(value, locale, 0) ?? value;
  if (cache.size > 5000) cache.clear();
  cache.set(value, result);
  return result;
}

/** True when a translation exists for the phrase in the given locale. */
export function hasPhrase(text: string, locale: Locale): boolean {
  return locale === "en" || lookup(text, locale) !== undefined;
}

/** Fields that identify rather than describe; their strings are never translated. */
const ID_FIELDS = new Set([
  "value", "key", "id", "kind", "type", "status", "code", "href", "path",
  "color", "icon", "dataIndex", "name", "role", "slug", "tone", "variant",
  "field", "unit", "format", "level", "severity", "mode", "route", "url",
  "src", "image", "className", "tab", "anchor", "category", "group",
]);

const looksLikeText = (s: string) =>
  /[A-Za-z]{2,}/.test(s) && !/^[a-z0-9_\-./:#@?=&%]+$/.test(s) && !/^[A-Z0-9_\-]+$/.test(s);

const proxies = new WeakMap<object, object>();

/**
 * Wrap a module-level table of English UI strings so every read returns the
 * current-locale text. Lets constants like `{ leave_consent: "Leave consent" }`
 * stay at module scope (where `tr()` would freeze them). Nested objects and
 * arrays are wrapped too; identifier fields (`value`, `key`, `status`…) are
 * returned untouched so lookups and comparisons keep working.
 */
export function trTable<T extends object>(table: T): T {
  const cached = proxies.get(table);
  if (cached) return cached as T;
  const proxy = new Proxy(table, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string" || ID_FIELDS.has(prop)) return v;
      if (typeof v === "string") return looksLikeText(v) ? tr(v) : v;
      if (v && typeof v === "object" && !Object.isFrozen(v) && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype)) {
        return trTable(v);
      }
      return v;
    },
  });
  proxies.set(table, proxy);
  return proxy;
}

/** BCP-47 tag for Intl / toLocale*String in the active locale. Latin digits everywhere, so formatted numbers match the raw ones beside them. */
export function intlLocale(locale: Locale = getLocale()): string {
  return `${locale}-IN-u-nu-latn`;
}

/**
 * Display an enum/status code ("open_vacancy", "pending", "PAID") in the
 * active language. English keeps the existing behaviour (underscores → spaces);
 * other locales look up the humanized phrase, then its capitalized form.
 */
export function trEnum(code: string | null | undefined, locale: Locale = getLocale()): string {
  if (!code) return "";
  const spaced = code.replace(/_/g, " ");
  if (locale === "en") return spaced;
  const lower = spaced.toLowerCase();
  const cap = lower.charAt(0).toUpperCase() + lower.slice(1);
  return lookup(spaced, locale) ?? lookup(lower, locale) ?? lookup(cap, locale) ?? spaced;
}
