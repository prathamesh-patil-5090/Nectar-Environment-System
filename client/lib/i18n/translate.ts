import en from "./locales/en";
import hi from "./locales/hi";
import mr from "./locales/mr";
import type { Locale, MessageTree } from "./types";
import { LOCALE_STORAGE_KEY } from "./types";

const DICTS: Record<Locale, MessageTree> = { en, hi, mr };

let currentLocale: Locale = "en";

function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "hi" || v === "mr";
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
    document.documentElement.lang =
      locale === "hi" ? "hi" : locale === "mr" ? "mr" : "en";
    document.documentElement.dataset.locale = locale;
  }
}

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "en";
}

function lookup(tree: MessageTree, path: string): string | undefined {
  const parts = path.split(".");
  let node: string | MessageTree | undefined = tree;
  for (const p of parts) {
    if (node == null || typeof node === "string") return undefined;
    node = node[p];
  }
  return typeof node === "string" ? node : undefined;
}

export type TranslateParams = Record<string, string | number>;

/** Translate a dotted key. Falls back to English, then the key itself. */
export function t(
  key: string,
  params?: TranslateParams,
  locale: Locale = currentLocale,
): string {
  const primary = lookup(DICTS[locale], key);
  const fallback = locale === "en" ? undefined : lookup(DICTS.en, key);
  let text = primary ?? fallback ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function translateRole(
  role: string,
  locale: Locale = currentLocale,
): string {
  return t(`roles.${role}`, undefined, locale);
}

export function pageTitle(
  pathname: string,
  locale: Locale = currentLocale,
): string {
  const exact = t(`pages.${pathname}`, undefined, locale);
  if (exact !== `pages.${pathname}`) return exact;
  // Longest prefix match for dynamic routes e.g. /leave/requests/xyz
  const keys = Object.keys(
    (DICTS.en.pages as MessageTree) ?? {},
  ) as string[];
  const match = keys
    .filter((k) => pathname === k || pathname.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (match) return t(`pages.${match}`, undefined, locale);
  return t("app.name", undefined, locale);
}
