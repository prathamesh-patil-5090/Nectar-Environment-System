/**
 * i18n guard — run with `npm run i18n:check`.
 *
 * 1. Flags English UI text in app/ and components/ that is not wrapped in
 *    tr()/trNode() (JSX text, and string literals on display props).
 * 2. Collects every phrase key (tr / trNode / trTable / extra keys in
 *    lib/i18n/catalog/dynamic.ts) and reports keys with no Hindi or Marathi
 *    entry in lib/i18n/catalog/*.
 *
 * Options:
 *   --missing-json <file>  write the missing keys to a JSON array (for translators)
 *   --used-json <file>     write every phrase key the code uses
 *   --warn                 report but exit 0
 *
 * Silence a deliberate English string with an `i18n-ignore` comment on the
 * same or the previous line, or a whole file with `i18n-ignore-file`.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(import.meta.url)("typescript");
const args = process.argv.slice(2);
const warnOnly = args.includes("--warn");
const jsonOut = args.includes("--missing-json") ? args[args.indexOf("--missing-json") + 1] : null;
const usedOut = args.includes("--used-json") ? args[args.indexOf("--used-json") + 1] : null;

const DISPLAY_ATTRS = new Set([
  "title", "label", "placeholder", "description", "okText", "cancelText",
  "tooltip", "message", "content", "subtitle", "emptyText", "help", "extra",
  "caption", "heading", "aria-label", "alt", "subTitle", "text", "reason",
  "unCheckedChildren", "checkedChildren", "notFoundContent", "sub", "hint",
]);
// attributes whose string values are never shown as text
const NON_DISPLAY_ATTRS = /^(className|class\w*|id|key|href|src|type|name|rel|target|role|data-[\w-]+|htmlFor|mode|size|variant|color|status|placement|trigger|layout|align|justify|direction|shape|theme|autoComplete|method|action|pattern|inputMode|lang|dir|form|value|defaultValue|format|picker|d|viewBox|fill|stroke\w*|transform|points|xmlns|preserveAspectRatio|sizes|loading|decoding|accept|allow|sandbox|strategy|crossOrigin|referrerPolicy|as|tone|icon|presets|tab\w*|activeKey|defaultActiveKey|rowKey|dataIndex|path|scroll|prefixCls|\w*ClassName|gradient\w*|textAnchor|dominantBaseline|fontFamily|fontWeight)$/;
const ID_FIELDS = new Set([
  "value", "key", "id", "kind", "type", "status", "code", "href", "path",
  "color", "icon", "dataIndex", "name", "role", "slug", "tone", "variant",
  "field", "unit", "format", "level", "severity", "mode", "route", "url",
  "src", "image", "className", "tab", "anchor", "category", "group",
]);
// keep in sync with looksLikeText() in lib/i18n/phrases.ts
const looksLikeText = (s) => !/^https?:/.test(s) &&
  /[A-Za-z]{2,}/.test(s) && !/^[a-z0-9_\-./:#@?=&%]+$/.test(s) && !/^[A-Z0-9_\-]+$/.test(s);
// acronyms and codes that read the same in every language
const UNTRANSLATED = /^(CSV|PDF|IST|NE|ETP|RO|MEE|ZLD|STP|WTP|OT|ID|SOP|PPE|LOTO|CIP|SCADA|DO|KPI|HR|[A-Z]{2,}(-[A-Z0-9]+)+)$/;
const words = (s) => {
  const t = s.replace(/&[a-z]+;/g, "").trim();
  return /[A-Za-z]{2,}/.test(t) && !UNTRANSLATED.test(t);
};

const files = execSync("git ls-files -co --exclude-standard app components lib", { cwd: root })
  .toString()
  .split("\n")
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.|\/i18n\/(locales|catalog)\//.test(f));

const violations = [];
const keys = new Map(); // key -> first location

function addKey(text, where) {
  if (!text || !words(text)) return;
  if (!keys.has(text)) keys.set(text, where);
}

/** String literals reachable as the value of an expression (through ?:, ||, ??). */
function literalsOf(e) {
  if (!e) return [];
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e)) return literalsOf(e.expression);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
  if (ts.isConditionalExpression(e)) return [...literalsOf(e.whenTrue), ...literalsOf(e.whenFalse)];
  if (ts.isBinaryExpression(e)) return [...literalsOf(e.left), ...literalsOf(e.right)];
  return [];
}

function tableStrings(n, key, where) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
    if (!ID_FIELDS.has(key) && looksLikeText(n.text)) addKey(n.text, where);
    return;
  }
  if (ts.isObjectLiteralExpression(n)) {
    for (const p of n.properties) if (ts.isPropertyAssignment(p)) tableStrings(p.initializer, p.name.getText().replace(/["']/g, ""), where);
  } else if (ts.isArrayLiteralExpression(n)) {
    for (const e of n.elements) tableStrings(e, key, where);
  } else if (ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n)) {
    tableStrings(n.expression, key, where);
  }
}

for (const file of files) {
  const src = readFileSync(join(root, file), "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lines = src.split("\n");
  const loc = (n) => {
    const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
    return { line, where: `${file}:${line + 1}` };
  };
  const ignored = (line) => /i18n-ignore/.test(lines[line] ?? "") || /i18n-ignore/.test(lines[line - 1] ?? "");
  const checkUi = (file.startsWith("app/") || file.startsWith("components/")) && !/i18n-ignore-file/.test(src);

  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText();
      if ((callee === "tr" || callee === "trNode") && n.arguments[0]) {
        for (const s of literalsOf(n.arguments[0])) addKey(s, loc(n).where);
      } else if (callee === "trTable" && n.arguments[0]) {
        tableStrings(n.arguments[0], "", loc(n).where);
      }
    }
    if (checkUi) {
      if (ts.isJsxText(n) && words(n.text)) {
        const { line, where } = loc(n);
        if (!ignored(line)) violations.push(`${where}: unwrapped JSX text: ${n.text.trim().replace(/\s+/g, " ").slice(0, 80)}`);
      } else if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && looksLikeText(n.initializer.text) && (DISPLAY_ATTRS.has(n.name.getText()) || (!NON_DISPLAY_ATTRS.test(n.name.getText()) && / [A-Za-z]/.test(n.initializer.text)))) {
        const { line, where } = loc(n);
        if (!ignored(line)) violations.push(`${where}: unwrapped ${n.name.getText()}="${n.initializer.text.slice(0, 60)}"`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// Catalogue: every lib/i18n/catalog/*.ts is `{ "English": ["हिन्दी", "मराठी"], ... }`
const catalogDir = join(root, "lib/i18n/catalog");
const catalog = new Map();
const duplicates = [];
for (const f of readdirSync(catalogDir).filter((f) => f.endsWith(".ts") && f !== "index.ts")) {
  const src = readFileSync(join(catalogDir, f), "utf8");
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const visit = (n) => {
    if (ts.isPropertyAssignment(n) && ts.isArrayLiteralExpression(n.initializer) && ts.isObjectLiteralExpression(n.parent)) {
      const k = ts.isStringLiteral(n.name) || ts.isNoSubstitutionTemplateLiteral(n.name) ? n.name.text : n.name.getText();
      const [hi, mr] = n.initializer.elements.map((e) => (ts.isStringLiteral(e) ? e.text : ""));
      if (catalog.has(k)) duplicates.push(`${f}: duplicate key ${JSON.stringify(k)}`);
      catalog.set(k, { hi, mr });
      // dynamic.ts lists keys built at runtime (enum labels etc.) — treat them as used
      if (f === "dynamic.ts") addKey(k, `lib/i18n/catalog/${f}`);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const missing = [];
const badParams = [];
for (const [k, where] of keys) {
  const e = catalog.get(k);
  if (!e || !e.hi || !e.mr) {
    missing.push({ key: k, where });
    continue;
  }
  for (const [lang, v] of [["hi", e.hi], ["mr", e.mr]]) {
    if (placeholders(v) !== placeholders(k)) badParams.push(`${where}: ${lang} placeholders differ for ${JSON.stringify(k)}`);
  }
}

const out = (title, list) => {
  if (!list.length) return;
  console.log(`\n${title} (${list.length})`);
  for (const l of list.slice(0, 200)) console.log("  " + (typeof l === "string" ? l : `${l.where}: ${JSON.stringify(l.key)}`));
  if (list.length > 200) console.log(`  … ${list.length - 200} more`);
};
out("Unwrapped English UI text", violations);
out("Missing Hindi/Marathi translations", missing);
out("Placeholder mismatches", badParams);
out("Duplicate catalogue keys", duplicates);
console.log(`\n${keys.size} phrases used · ${catalog.size} in catalogue · ${missing.length} missing · ${violations.length} unwrapped`);

if (usedOut) writeFileSync(usedOut, JSON.stringify([...keys.keys()], null, 1));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(missing.map((m) => m.key), null, 1));
const failed = violations.length + missing.length + badParams.length + duplicates.length > 0;
process.exit(failed && !warnOnly ? 1 : 0);
