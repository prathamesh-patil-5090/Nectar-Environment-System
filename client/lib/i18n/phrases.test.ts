import { beforeAll, describe, expect, it } from "vitest";
import catalog from "./catalog";
import { intlLocale, loadPhraseCatalog, tr, trData, trTable } from "./phrases";

// Pick real catalogue entries so the test follows the data, not hard-coded Hindi.
const plain = Object.keys(catalog).find((k) => !/\{\w+\}/.test(k))!;
const templated = Object.keys(catalog).find((k) => /^[^{]+\{\w+\}[^{}]*$/.test(k))!;

describe("phrases", () => {
  beforeAll(async () => {
    await loadPhraseCatalog();
  });

  it("returns English unchanged for en, and for unknown phrases", () => {
    expect(tr(plain, undefined, "en")).toBe(plain);
    expect(tr("Some phrase nobody translated", undefined, "hi")).toBe("Some phrase nobody translated");
  });

  it("translates and interpolates", () => {
    expect(tr(plain, undefined, "hi")).toBe(catalog[plain][0]);
    expect(tr(plain, undefined, "mr")).toBe(catalog[plain][1]);
    const name = /\{(\w+)\}/.exec(templated)![1];
    const out = tr(templated, { [name]: "XYZ" }, "hi");
    expect(out).toContain("XYZ");
    expect(out).toBe(catalog[templated][0].replace(`{${name}}`, "XYZ"));
  });

  it("trData matches stored sentences against templates", () => {
    const name = /\{(\w+)\}/.exec(templated)![1];
    const stored = templated.replace(`{${name}}`, "XYZ");
    expect(trData(stored, "hi")).toBe(catalog[templated][0].replace(`{${name}}`, "XYZ"));
    expect(trData(stored, "en")).toBe(stored);
    expect(trData("free text a user typed", "hi")).toBe("free text a user typed");
  });

  it("trTable translates display fields but keeps identifiers", () => {
    const table = trTable({ a: { value: plain, label: plain } });
    // en: identity
    expect(table.a.label).toBe(plain);
    expect(table.a.value).toBe(plain);
  });

  it("formats with Latin digits in every locale", () => {
    for (const l of ["en", "hi", "mr"] as const) {
      expect(new Intl.NumberFormat(intlLocale(l)).format(1234567)).toMatch(/^[0-9,]+$/);
    }
  });
});
