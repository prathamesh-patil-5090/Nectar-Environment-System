export type Locale = "en" | "hi" | "mr";

export const LOCALES: Locale[] = ["en", "hi", "mr"];

export const LOCALE_STORAGE_KEY = "nectar-enviro-locale";

export const LOCALE_META: Record<
  Locale,
  { label: string; nativeLabel: string; htmlLang: string }
> = {
  en: { label: "English", nativeLabel: "English", htmlLang: "en" },
  hi: { label: "Hindi", nativeLabel: "हिन्दी", htmlLang: "hi" },
  mr: { label: "Marathi", nativeLabel: "मराठी", htmlLang: "mr" },
};

/** Nested message dictionary (string leaves only). */
export type MessageTree = { [key: string]: string | MessageTree };
