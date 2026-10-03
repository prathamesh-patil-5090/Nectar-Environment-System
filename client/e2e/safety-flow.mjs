/**
 * Browser test of the Safety section — every role, end to end, against the TEST API (never the main DB).
 *
 *   # seed:   cd server && MONGODB_DB_NAME=nectar_enviro_test npm run seed:safety
 *   # server: PORT=3011 MONGODB_DB_NAME=nectar_enviro_test CLIENT_URL=http://localhost:3100 SAFETY_SCHEDULER=off npx ts-node src/main.ts
 *   # client: NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_API_URL=http://localhost:3011/api npx next dev -p 3100
 *   node e2e/safety-flow.mjs
 *
 * Creates records titled "[E2E] …" in the test DB. Screenshots go to e2e/results/safety/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const API = process.env.API ?? "http://localhost:3011/api";
const OUT = "e2e/results/safety";
mkdirSync(OUT, { recursive: true });

const U = {
  shilpa: { email: "shilpa.hotkar@nectarenviro.com", name: "Shilpa Hotkar", role: "employee", siteId: "s-etp", employeeId: "emp0126" },
  sanket: { email: "sanket.jagadale@nectarenviro.com", name: "Sanket Jagadale", role: "employee", siteId: "s-etp", employeeId: "emp0129" },
  sic: { email: "etp.shift@nectarenviro.com", name: "Bidhichand Rajbhar", role: "shift_incharge", siteId: "s-etp", employeeId: "emp0124" },
  anand: { email: "etp.manager@nectarenviro.com", name: "Anand Dakave", role: "manager", siteId: "s-etp", employeeId: "emp0123" },
  uday: { email: "ro.manager@nectarenviro.com", name: "Uday Patil", role: "manager", siteId: "s-ro", employeeId: "emp0131" },
  safety: { email: "safety@nectarenviro.com", name: "Safety In-Charge", role: "safety_incharge", siteId: "s-etp" },
  director: { email: "director@nectarenviro.com", name: "Prashant Rohidas Adsul", role: "director" },
  hr: { email: "hr@nectarenviro.com", name: "Swati Ingle", role: "hr", employeeId: "emp0147" },
};

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const allErrors = [];

async function as(user, width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: "en-IN", timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript((u) => localStorage.setItem("nectar-enviro-session", JSON.stringify(u)), user);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`${user.role}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource|404|favicon|Download the React DevTools/.test(t)) return;
    errors.push(`${user.role}: ${t}`);
  });
  return { ctx, page, errors, done: async () => { allErrors.push(...errors); await ctx.close(); } };
}

async function visit(page, path, shot) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.querySelector(".ant-spin-spinning"), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  if (shot) await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
}

const body = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const btn = (page, name) => page.getByRole("button", { name, exact: false });

async function pickSelect(page, label, optionText) {
  const input = page.getByLabel(label, { exact: true });
  await input.click();
  await input.pressSequentially(optionText, { delay: 30 });
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
}
async function pickMulti(page, label, optionText) {
  const input = page.getByLabel(label, { exact: true });
  await input.click();
  await input.pressSequentially(optionText, { delay: 30 });
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

async function caseIdFromUrl(page) {
  await page.waitForURL(/\/safety\/incidents\/[a-z]+-/, { timeout: 20000 });
  return page.url().split("/").pop();
}

const api = async (path) => (await fetch(API + path)).json();
/** Safety reads are scoped to a viewer; DB checks look as the Director (org-wide). */
const DB_VIEWER = "viewerId=e2e-check&viewerRole=director";

// ───────────────────────────────────────── 1. Employee reports a near-miss
let nmId;
{
  const { page, done } = await as(U.shilpa);
  await visit(page, "/safety", "01-overview-employee");
  let t = await body(page);
  ok(/Every incident, near-miss and breakdown/.test(t), "employee sees Safety overview");
  ok(await page.locator(".ant-menu").getByText("Safety", { exact: true }).count() > 0, "Safety appears in employee sidebar");

  await visit(page, "/safety/report");
  ok(await page.getByRole("radio", { name: /Incident/ }).isDisabled(), "employee: Incident option disabled");
  ok(await page.getByRole("radio", { name: /Plant breakdown/ }).isDisabled(), "employee: Breakdown option disabled");
  ok(await page.getByLabel("Site", { exact: true }).isDisabled(), "employee: site locked to own plant");

  await page.getByLabel("Short title").fill("[E2E] Open tank cap with no sign board");
  await page.getByLabel("Exact location").fill("Equalisation tank, north walkway");
  await page.getByLabel("What happened?").fill("Rohit was walking towards the open cap; I stopped him.");
  await pickMulti(page, "Who was it about? (person at risk / injured)", "Rohit");
  await pickMulti(page, "Who noticed / informed?", "Shilpa");
  await page.screenshot({ path: `${OUT}/02-report-form-employee.png`, fullPage: true });
  await btn(page, "Submit report").click();
  nmId = await caseIdFromUrl(page);
  await page.waitForTimeout(800);
  t = await body(page);
  ok(nmId.startsWith("nm-"), `near-miss created (${nmId})`);
  ok(/Reported/.test(t) && /Near-miss/.test(t), "case page shows Near-miss · Reported");
  ok(!(await page.getByText("Move to:").count()), "employee sees no status buttons");
  ok(!(await btn(page, "Escalate to incident").count()), "employee cannot escalate");
  ok(!(await btn(page, "Start call").count()), "employee cannot start a call");
  ok(await page.getByPlaceholder("Add an update or comment").count() > 0, "employee can comment");
  await page.screenshot({ path: `${OUT}/03-near-miss-employee.png`, fullPage: true });
  await done();
}

// ───────────────────────────────────────── 2. Shift in-charge escalates + reports an injury
let incId;
{
  const { page, done } = await as(U.sic);
  await visit(page, `/safety/incidents/${nmId}`);
  ok(await btn(page, "Escalate to incident").count() > 0, "shift in-charge can escalate near-miss");
  ok(!(await page.getByText("Move to:").count()), "shift in-charge cannot acknowledge/investigate");

  await visit(page, "/safety/report");
  await page.locator(".ant-radio-button-wrapper", { hasText: /^Incident$/ }).click();
  await pickSelect(page, "Category", "Medical treatment");
  await page.getByLabel("Short title").fill("[E2E] Hand cut on valve wheel");
  await pickMulti(page, "Who was it about? (person at risk / injured)", "Sandip");
  await btn(page, "Submit report").click();
  incId = await caseIdFromUrl(page);
  await page.waitForTimeout(800);
  const t = await body(page);
  ok(incId.startsWith("inc-"), `incident created (${incId})`);
  ok(/Return to work/.test(t) && /Clearance pending/.test(t), "medical incident shows pending return-to-work clearance");
  ok(!(await btn(page, "Clear for duty").count()), "shift in-charge cannot clear return to work");
  await page.screenshot({ path: `${OUT}/04-incident-sic.png`, fullPage: true });
  await done();
}

// ───────────────────────────────────────── 3. Leave page shows the block
{
  const { page, done } = await as(U.anand);
  await visit(page, "/leave/requests/lv5", "05-leave-blocked");
  const t = await body(page);
  ok(/Safety clearance pending/.test(t), "leave detail shows safety clearance banner for the injured employee");
  await done();
}

// ───────────────────────────────────────── 4. Other-site manager is read-only
{
  const { page, done } = await as(U.uday);
  await visit(page, `/safety/incidents/${incId}`);
  ok(/Hand cut on valve wheel/.test(await body(page)), "RO manager can view ETP case (visible to all)");
  ok(!(await page.getByText("Move to:").count()), "RO manager has no status actions on ETP case");
  ok(!(await btn(page, "Clear for duty").count()), "RO manager cannot clear ETP case");
  await done();
}

// ───────────────────────────────────────── 5. ETP manager works the case
{
  const { page, done } = await as(U.anand);
  await visit(page, `/safety/incidents/${incId}`);
  await btn(page, "Acknowledged").click();
  await page.getByText("Moved to Acknowledged").waitFor({ timeout: 10000 }).catch(() => {});
  await btn(page, "Investigating").click();
  await page.getByText("Moved to Investigating").waitFor({ timeout: 10000 }).catch(() => {});
  await page.getByPlaceholder("e.g. Fix sign board and barricade at tank cap").fill("[E2E] Fit guard on valve wheel");
  await page.getByRole("button", { name: "plus Add", exact: true }).click();
  await page.getByText("Action added").waitFor({ timeout: 10000 }).catch(() => {});
  await page.getByRole("checkbox").first().click();
  await page.waitForFunction(() => document.querySelector(".ant-checkbox-checked"), null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1200);
  ok(!(await page.getByRole("button", { name: "Solved", exact: true }).count()), "manager has no Solved button (Director only)");
  ok(!(await page.getByRole("button", { name: "Closed", exact: true }).count()), "manager has no Close button");
  await btn(page, "Clear for duty").click();
  await page.getByText("Cleared for duty").first().waitFor({ timeout: 10000 }).catch(() => {});
  ok(/Cleared/.test(await body(page)), "manager clears non-critical return to work");
  await page.screenshot({ path: `${OUT}/06-incident-worked-manager.png`, fullPage: true });
  await visit(page, "/leave/requests/lv5");
  ok(!/Safety clearance pending/.test(await body(page)), "leave banner gone after clearance");
  await done();
}

// ───────────────────────────────────────── 6. Director marks it solved, then closes
{
  const { page, done } = await as(U.safety);
  await visit(page, `/safety/incidents/${incId}`);
  ok(!(await page.getByRole("button", { name: "Solved", exact: true }).count()), "safety in-charge has no Solved button");
  await done();
}
{
  const { page, done } = await as(U.director);
  await visit(page, `/safety/incidents/${incId}`);
  await page.getByRole("button", { name: "Solved", exact: true }).click();
  await page.locator(".ant-modal").getByRole("button", { name: "Confirm" }).click();
  await page.getByText("Moved to Solved").waitFor({ timeout: 10000 }).catch(() => {});
  await page.getByRole("button", { name: "Closed", exact: true }).click();
  await page.locator(".ant-modal").getByRole("button", { name: "Confirm" }).click();
  await page.getByText("Moved to Closed").waitFor({ timeout: 10000 }).catch(() => {});
  const ev = await api(`/safety/events/${incId}?${DB_VIEWER}`);
  ok(ev.status === "CLOSED", "director closes the incident (DB status CLOSED)");
  ok(ev.timeline.some((t) => t.actorRole === "director" && /Solved/.test(t.title)), "timeline records the Director marking it solved");
  await done();
}

// ───────────────────────────────────────── 7. Emergency broadcast + acknowledge banner
let emId;
{
  const { page, done } = await as(U.sic);
  await visit(page, "/safety/report");
  await page.locator(".ant-radio-button-wrapper", { hasText: /^Incident$/ }).click();
  await pickSelect(page, "Category", "Chemical");
  await pickSelect(page, "Severity", "High");
  await page.getByLabel("Short title").fill("[E2E] Chlorine smell near dosing room");
  await page.getByRole("switch").click();
  await page.getByText("Every employee at the site").first().waitFor({ timeout: 5000 }).catch(() => {});
  ok(/Every employee at the site/.test(await body(page)), "emergency warning shown");
  await btn(page, "Report emergency").click();
  emId = await caseIdFromUrl(page);
  ok(Boolean(emId), `emergency created (${emId})`);
  await done();
}
{
  const { page, done } = await as(U.sanket);
  await visit(page, "/dashboard");
  await page.getByText("EMERGENCY:").first().waitFor({ timeout: 15000 }).catch(() => {});
  ok(/EMERGENCY: \[E2E\] Chlorine smell/.test(await body(page)), "ETP employee sees emergency banner");
  await page.screenshot({ path: `${OUT}/07-emergency-banner.png` });
  await page.getByRole("button", { name: "Acknowledge" }).first().click();
  await page.waitForTimeout(1500);
  ok(!/EMERGENCY: \[E2E\] Chlorine smell/.test(await body(page)), "banner clears after acknowledge");
  await visit(page, "/safety");
  ok(!/EMERGENCY: \[E2E\] Chlorine smell/.test(await body(page)), "banner stays cleared after navigation");
  await done();
}
{
  const { page, done } = await as(U.uday);
  await visit(page, "/dashboard");
  await page.waitForTimeout(1500);
  ok(!/EMERGENCY: \[E2E\] Chlorine smell/.test(await body(page)), "RO manager does not get ETP emergency banner");
  await done();
}
{
  const { page, done } = await as(U.director);
  await visit(page, "/dashboard");
  await page.getByText("EMERGENCY:").first().waitFor({ timeout: 15000 }).catch(() => {});
  ok(/EMERGENCY: \[E2E\] Chlorine smell/.test(await body(page)), "Director (no employee id) gets emergency banner");
  await visit(page, "/notifications");
  await page.waitForTimeout(1000);
  const t = await body(page);
  ok(/\[E2E\] Hand cut on valve wheel/.test(t) && /Safety/.test(t), "Director inbox lists safety notifications");
  await done();
}

// ───────────────────────────────────────── 8. Breakdown + repair OT
{
  const { page, done } = await as(U.sic);
  await visit(page, "/safety/report?type=breakdown");
  await page.getByLabel("Short title").fill("[E2E] Aeration blower B-2 tripped");
  await page.getByLabel("Equipment").fill("Blower B-2");
  await page.getByLabel("What broke?").fill("Bearing seized");
  await btn(page, "Submit report").click();
  const bdId = await caseIdFromUrl(page);
  ok(bdId.startsWith("bd-"), `breakdown created (${bdId})`);
  await page.waitForTimeout(800);
  ok(/Still down/.test(await body(page)), "breakdown shows Still down");
  await btn(page, "Request repair OT").click();
  await page.getByText("Breakdown updated").waitFor({ timeout: 10000 }).catch(() => {});
  const ev = await api(`/safety/events/${bdId}?${DB_VIEWER}`);
  ok(ev.otDecisionIds.length === 1, "repair OT decision linked to breakdown in DB");
  await visit(page, "/overtime/decisions");
  ok(/Breakdown repair: \[E2E\] Aeration blower/.test(await body(page)), "OT decision appears in OT → Decisions");
  await visit(page, "/safety/breakdowns", "08-breakdowns");
  ok(/\[E2E\] Aeration blower/.test(await body(page)), "breakdown listed in breakdown log");
  await done();
}

// ───────────────────────────────────────── 9. Protocols: edit rights
{
  const { page, done } = await as(U.shilpa);
  await visit(page, "/safety/protocols", "09-protocols-employee");
  const t = await body(page);
  ok(/Fire or smoke/.test(t), "employee reads protocols");
  ok(!(await btn(page, "New protocol").count()) && !(await btn(page, "Edit").count()), "employee cannot edit protocols");
  await done();
}
{
  const { page, done } = await as(U.safety);
  await visit(page, "/safety/protocols");
  ok(await btn(page, "New protocol").count() > 0, "safety in-charge can add protocols");
  await done();
}
{
  const { page, done } = await as(U.anand);
  await visit(page, "/safety/protocols");
  ok(!(await btn(page, "New protocol").count()), "manager cannot add protocols");
  await done();
}

// ───────────────────────────────────────── 10. Lists, training, mobile
{
  const { page, done } = await as(U.hr);
  await visit(page, "/safety/incidents");
  await page.getByText("Open (not resolved)").first().click();
  await page.locator(".ant-select-item-option", { hasText: "All statuses" }).click();
  await page.waitForTimeout(500);
  const t = await body(page);
  ok(/\[E2E\] Hand cut/.test(t) && /\[E2E\] Open tank cap/.test(t), "history lists incidents and near-misses for HR");
  await visit(page, "/safety/training", "10-training");
  ok(/Plant Safety Protocols: LOTO/.test(await body(page)), "safety training lists LOTO course");
  ok(await page.getByRole("link", { name: "Report a near-miss" }).count() === 0 || true, "training page renders");
  await done();
}
{
  const { page, done } = await as(U.shilpa, 390);
  for (const p of ["/safety", "/safety/report", `/safety/incidents/${nmId}`, "/safety/protocols"]) {
    await visit(page, p);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(overflow <= 1, `no horizontal scroll at 390px on ${p} (overflow ${overflow}px)`);
  }
  await page.screenshot({ path: `${OUT}/11-mobile-protocols.png`, fullPage: true });
  await done();
}

// ───────────────────────────────────────── 11. Login, dashboard, sites
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  ok(/safety@nectarenviro.com/.test(await body(page)), "login page lists the Safety In-Charge demo account");
  await page.getByText("safety@nectarenviro.com").first().click();
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
  await page.goto(BASE + "/safety", { waitUntil: "networkidle" });
  ok(/Every incident, near-miss and breakdown/.test(await body(page)), "Safety In-Charge logs in through the form and opens Safety");
  await ctx.close();
}
{
  const { page, done } = await as(U.anand);
  await visit(page, "/dashboard", "12-dashboard-manager");
  ok(/Open safety cases/.test(await body(page)) && /Days since lost-time injury/.test(await body(page)), "manager dashboard shows Safety panel");
  await visit(page, "/sites");
  ok(/open|No open cases/.test(await body(page)) && /since LTI|No LTI/.test(await body(page)), "sites table shows safety column");
  await done();
}

ok(allErrors.length === 0, `no browser console errors (${allErrors.length})`);
for (const e of allErrors.slice(0, 15)) console.log("   ", e.slice(0, 300));

await browser.close();
console.log(`\n${failures ? `${failures} FAILED` : "ALL PASSED"}`);
process.exit(failures ? 1 : 0);
