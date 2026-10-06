export type { Locale, MessageTree } from "./types";
export { LOCALES, LOCALE_META, LOCALE_STORAGE_KEY } from "./types";
export {
  t,
  getLocale,
  setLocale,
  readStoredLocale,
  pageTitle,
  translateRole,
} from "./translate";
export { I18nProvider, useI18n, useT } from "./I18nProvider";
export { default as LanguageSwitcher } from "./LanguageSwitcher";
export {
  translateDesignation,
  translateDepartment,
  translateSiteName,
  translatePersonName,
  translateCourseTitle,
} from "./data-labels";
