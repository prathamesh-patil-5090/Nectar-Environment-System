import { t } from "./translate";
import { trData } from "./phrases";

/**
 * Translate seeded / API English data labels for UI display.
 * Falls back to the phrase catalogue, then the original string.
 */
function dataLabel(prefix: string, value: string | undefined | null): string {
  if (!value) return "";
  const key = `${prefix}.${value}`;
  const translated = t(key);
  return translated === key ? (trData(value) as string) : translated;
}

export function translateDesignation(value?: string | null): string {
  return dataLabel("data.designation", value);
}

export function translateDepartment(value?: string | null): string {
  return dataLabel("data.department", value);
}

export function translateSiteName(value?: string | null): string {
  return dataLabel("data.site", value);
}

/** Person name → Devanagari (HI/MR) when available. */
export function translatePersonName(value?: string | null): string {
  return dataLabel("data.name", value);
}

/** Training course title → localized display title when available. */
export function translateCourseTitle(value?: string | null): string {
  return dataLabel("data.course", value);
}
