"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Locale } from "./types";
import { LOCALE_META } from "./types";
import {
  getLocale,
  pageTitle,
  readStoredLocale,
  setLocale as setLocaleGlobal,
  t as translate,
  type TranslateParams,
} from "./translate";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslateParams) => string;
  pageTitle: (pathname: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredLocale();
    setLocaleGlobal(stored);
    setLocaleState(stored);
    setReady(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleGlobal(next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, params?: TranslateParams) => translate(key, params, locale),
    [locale],
  );

  const titleOf = useCallback(
    (pathname: string) => pageTitle(pathname, locale),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, pageTitle: titleOf }),
    [locale, setLocale, t, titleOf],
  );

  useEffect(() => {
    if (ready) setLocaleGlobal(locale);
  }, [locale, ready]);

  return (
    <I18nContext.Provider value={value}>
      <div
        lang={LOCALE_META[locale].htmlLang}
        data-locale={locale}
        style={{ display: "contents" }}
        suppressHydrationWarning
      >
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: getLocale(),
      setLocale: setLocaleGlobal,
      t: (key, params) => translate(key, params),
      pageTitle: (pathname) => pageTitle(pathname),
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
