/**
 * Browser test of /safety/protocols against the TEST API (see e2e/safety-flow.mjs header for the servers).
 *   node e2e/protocols-flow.mjs
 * Creates one protocol titled "[E2E] …" in the test DB. Screenshots: e2e/results/protocols/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = "e2e/results/protocols";
mkdirSync(OUT, { recursive: true });

const U = {
  shilpa: { email: "shilpa.hotkar@nectarenviro.com", name: "Shilpa Hotkar", role: "employee", siteId: "s-etp", employeeId: "emp0126" },
  safety: { email: "safety@nectarenviro.com", name: "Safety In-Charge", role: "safety_incharge", siteId: "s-etp" },
  anand: { email: "etp.manager@nectarenviro.com", name: "Anand Dakave", role: "manager", siteId: "s-etp", employeeId: "emp0123" },
};

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};
const browser = await chromium.launch();
const allErrors = [];

async function as(user, width = 1440, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "en-IN", timezoneId: "Asia/Kolkata", permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript((u) => localStorage.setItem("nectar-enviro-session", JSON.stringify(u)), user);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`${user.role}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource|404|favicon/.test(t)) return;
    errors.push(`${user.role}: ${t}`);
  });
  return { page, done: async () => { allErrors.push(...errors); await ctx.close(); } };
}
const go = async (page, path) => {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.locator("nav[aria-label='Protocols'] button").first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
};
const body = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const reader = (page) => page.locator("article");
const items = (page) => page.locator("nav[aria-label='Protocols'] button");

// ── Employee, desktop
{
  const { page, done } = await as(U.shilpa);
  await go(page, "/safety/protocols");
  await page.screenshot({ path: `${OUT}/01-desktop-employee.png`, fullPage: true });
  const tels = await page.locator("section[aria-label='Emergency numbers'] a[href^='tel:']").evaluateAll((a) => a.map((x) => x.getAttribute("href")));
  ok(tels.slice(0, 3).join(",") === "tel:112,tel:108,tel:101", `call strip lists 112, 108, 101 first (${tels.join(",")})`);
  ok((await items(page).count()) >= 6, `index lists protocols (${await items(page).count()})`);
  ok(await reader(page).getByText("Do this first").isVisible(), "reader opens first protocol with 'Do this first'");
  ok(!(await page.getByRole("button", { name: /New protocol/ }).count()) && !(await page.getByRole("button", { name: /^edit Edit$/ }).count()), "employee: no New / Edit");
  ok(!(await page.getByRole("button", { name: /All protocols/ }).isVisible()), "desktop: no back button");
  ok(!(await items(page).first().locator("[aria-hidden] .anticon-right, .anticon-right").first().isVisible()), "desktop: no list chevrons");

  await page.getByRole("button", { name: /Electrical/ }).first().click();
  await page.waitForTimeout(300);
  ok((await items(page).count()) === 1 && /Electric shock/.test(await reader(page).innerText()), "Electrical chip filters to Electric shock");
  await page.getByRole("button", { name: /^All/ }).first().click();

  await page.getByLabel("Search protocols").fill("chlorine");
  await page.waitForTimeout(300);
  const titles = await items(page).allInnerTexts();
  ok(titles.length >= 1 && titles.every((t) => /chlorine|gas/i.test(t)), `search 'chlorine' narrows the list (${titles.length})`);
  ok((await page.locator("mark").count()) > 0, "search term is highlighted");
  await page.getByLabel("Search protocols").fill("zzzz-no-match");
  await page.waitForTimeout(300);
  ok(/Nothing matches “zzzz-no-match”/.test(await body(page)), "no-match empty state");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.waitForTimeout(300);
  ok((await items(page).count()) >= 6, "clear filters restores the list");

  await items(page).filter({ hasText: "Fire or smoke" }).click();
  await page.waitForURL(/p=sp-fire/);
  ok(/Fire or smoke/.test(await reader(page).innerText()), "selecting updates reader and URL (?p=sp-fire)");
  await go(page, "/safety/protocols?p=sp-electrical");
  ok(/Electric shock/.test(await reader(page).innerText()), "deep link opens the protocol");

  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(300);
  ok(!(await page.locator("nav[aria-label='Protocols']").isVisible()) && !(await page.locator(".ant-layout-sider").first().isVisible()), "print view hides index and sidebar");
  ok(await reader(page).isVisible(), "print view keeps the protocol");
  await page.screenshot({ path: `${OUT}/02-print.png`, fullPage: true });
  await page.emulateMedia({ media: "screen" });
  await done();
}

// ── Employee, phone
{
  const { page, done } = await as(U.shilpa, 390, 844);
  await go(page, "/safety/protocols");
  ok(!(await reader(page).isVisible()) && (await items(page).first().isVisible()), "phone: starts on the list");
  await page.screenshot({ path: `${OUT}/03-phone-list.png`, fullPage: true });
  await items(page).filter({ hasText: "Gas leak" }).click();
  await page.waitForTimeout(400);
  ok((await reader(page).isVisible()) && !(await items(page).first().isVisible()), "phone: tapping opens the reader");
  await page.screenshot({ path: `${OUT}/04-phone-reader.png`, fullPage: true });
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 1, `phone reader: no horizontal scroll (${overflow}px)`);
  await page.getByRole("button", { name: /All protocols/ }).click();
  await page.waitForTimeout(300);
  ok(await items(page).first().isVisible(), "phone: back returns to list");
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 1, `phone list: no horizontal scroll (${overflow}px)`);
  await done();
}

// ── Manager: read-only
{
  const { page, done } = await as(U.anand);
  await go(page, "/safety/protocols");
  ok(!(await page.getByRole("button", { name: /New protocol/ }).count()), "manager: cannot add protocols");
  await done();
}

// ── Safety In-charge: publish, edit, discard guard
{
  const { page, done } = await as(U.safety);
  await go(page, "/safety/protocols");
  await page.getByRole("button", { name: /New protocol/ }).click();
  const drawer = page.locator(".ant-drawer");
  await drawer.getByLabel("Title").fill("[E2E] Confined space rescue");
  await drawer.getByLabel("Category").fill("Confined space");
  await drawer.getByLabel("Title").click(); // close the suggestions without Escape (Escape closes the drawer)
  await drawer.getByLabel("Key message").fill("Never enter to rescue without breathing apparatus.");
  const steps = drawer.locator("textarea[id^='steps_']");
  await steps.nth(0).fill("Raise the alarm");
  await steps.nth(1).fill("Call the rescue team");
  await drawer.getByRole("button", { name: "Move step 2 up" }).click();
  await drawer.getByRole("button", { name: /Add step/ }).click();
  await drawer.locator("textarea[id^='steps_']").nth(2).fill("Ventilate before re-entry");
  await drawer.getByRole("button", { name: /\+ 108 Ambulance/ }).click();
  await page.screenshot({ path: `${OUT}/05-editor.png`, fullPage: true });
  await drawer.getByRole("button", { name: "Publish protocol" }).click();
  await page.getByText("Protocol published").waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  const r = await reader(page).innerText();
  ok(/\[E2E\] Confined space rescue/.test(r), "new protocol published and opened");
  const stepTexts = await reader(page).locator("ol li p").allInnerTexts();
  ok(stepTexts.join(" | ") === "Call the rescue team | Raise the alarm | Ventilate before re-entry", `steps saved in reordered order (${stepTexts.join(" | ")})`);
  ok(/Confined Space/i.test(r) && /Version 1/.test(r), "custom category label + version 1");
  ok((await reader(page).locator("a[href='tel:108']").count()) === 1, "quick-added 108 contact saved");

  await reader(page).getByRole("button", { name: /^edit Edit$/ }).click();
  await drawer.getByLabel("Key message").fill("Never enter to rescue without breathing apparatus and a standby.");
  await drawer.getByRole("button", { name: "Save changes" }).click();
  await page.getByText(/Saved — version 2/).waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  ok(/Version 2/.test(await reader(page).innerText()), "edit bumps to version 2");

  await reader(page).getByRole("button", { name: /^edit Edit$/ }).click();
  await drawer.getByLabel("Title").fill("[E2E] changed but not saved");
  await drawer.getByRole("button", { name: "Cancel" }).click();
  ok(await page.locator(".ant-modal-confirm-title", { hasText: "Discard changes?" }).waitFor({ timeout: 5000 }).then(() => true, () => false), "closing with edits asks to discard");
  await page.getByRole("button", { name: "Discard" }).click();
  await page.waitForTimeout(500);
  ok(/\[E2E\] Confined space rescue/.test(await reader(page).innerText()), "discard keeps the saved protocol");

  await drawer.waitFor({ state: "hidden" }).catch(() => {});
  await page.getByRole("button", { name: "Copy link" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  ok(/\/safety\/protocols\?p=sp-/.test(link), "copy link puts a deep link on the clipboard");
  await done();
}

ok(allErrors.length === 0, `no browser console errors (${allErrors.length})`);
for (const e of allErrors.slice(0, 10)) console.log("   ", e.slice(0, 300));
await browser.close();
console.log(`\n${failures ? `${failures} FAILED` : "ALL PASSED"}`);
process.exit(failures ? 1 : 0);
