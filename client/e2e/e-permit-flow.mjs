/**
 * Browser test of E-Permits — issue wizard, approvals, acknowledgements, renewal, PDF, visibility,
 * Hindi, phone width and the Safety-breakdown / shift-hub links — against the TEST API (never the main DB).
 *
 *   # seed:   cd server && MONGODB_DB_NAME=nectar_enviro_test npm run seed:e-permits
 *   # server: PORT=3011 MONGODB_DB_NAME=nectar_enviro_test CLIENT_URL=http://localhost:3100 EPERMIT_SCHEDULER=off node dist/src/main.js
 *   # client: NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_API_URL=http://localhost:3011/api npx next dev -p 3100
 *   node e2e/e-permit-flow.mjs
 *
 * Creates permits described "[E2E] …" in the test DB. Screenshots go to e2e/results/e-permits/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const API = process.env.API ?? "http://localhost:3011/api";
if (/localhost:3001/.test(API)) throw new Error("Point API at the test server, not the main one");
const OUT = "e2e/results/e-permits";
mkdirSync(OUT, { recursive: true });

const U = {
  sup: { email: "etp.supervisor@nectarenviro.com", name: "Neetesh Diwathe", role: "supervisor", siteId: "s-etp", employeeId: "emp0125" },
  sic: { email: "etp.shift@nectarenviro.com", name: "Bidhichand Rajbhar", role: "shift_incharge", siteId: "s-etp", employeeId: "emp0124" },
  anand: { email: "etp.manager@nectarenviro.com", name: "Anand Dakave", role: "manager", siteId: "s-etp", employeeId: "emp0123" },
  shilpa: { email: "shilpa.hotkar@nectarenviro.com", name: "Shilpa Hotkar", role: "employee", siteId: "s-etp", employeeId: "emp0126" },
  rohit: { email: "rohit.singh@nectarenviro.com", name: "Rohit Kumar Singh", role: "employee", siteId: "s-etp", employeeId: "emp0127" },
  mohee: { email: "mohee.vinchu@nectarenviro.com", name: "Mohee Vinchu", role: "employee", siteId: "s-etp", employeeId: "emp0128" },
  hodOps: { email: "hod.operations@nectarenviro.com", name: "Rajendra Kulkarni", role: "hod" },
  hodMech: { email: "hod.mechanical@nectarenviro.com", name: "Suresh Gaikwad", role: "hod" },
  director: { email: "director@nectarenviro.com", name: "Prashant Rohidas Adsul", role: "director" },
  hr: { email: "hr@nectarenviro.com", name: "Swati Ingle", role: "hr", employeeId: "emp0147" },
};

let failures = 0;
let passes = 0;
const ok = (cond, msg, extra) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}${!cond && extra !== undefined ? `  → ${String(extra).slice(0, 300)}` : ""}`);
  if (cond) passes++;
  else failures++;
};

const browser = await chromium.launch();
const allErrors = [];

async function as(user, { width = 1440, locale } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: "en-IN", timezoneId: "Asia/Kolkata", acceptDownloads: true });
  await ctx.addInitScript(
    ([u, loc]) => {
      localStorage.setItem("nectar-enviro-session", JSON.stringify(u));
      if (loc) localStorage.setItem("nectar-enviro-locale", loc);
    },
    [user, locale],
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`${user.role}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource|404|favicon|Download the React DevTools|\[HMR\]|webpack-hmr|Fast Refresh/.test(t)) return;
    errors.push(`${user.role}: ${t}`);
  });
  return { ctx, page, errors, done: async () => { allErrors.push(...errors); await ctx.close(); } };
}

async function visit(page, path, shot) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.querySelector(".ant-spin-spinning"), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
  if (shot) await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
}

const body = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const btn = (page, name) => page.getByRole("button", { name, exact: false });
/** The permit page keeps its audit trail on its own tab. */
const auditText = async (page) => {
  await page.locator(".ant-segmented-item", { hasText: "Audit trail" }).click();
  await page.waitForTimeout(300);
  return body(page);
};
const openOptions = (page) => page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option");

async function choose(page, field, text) {
  await page.locator(`[data-field="${field}"] .ant-select`).first().click();
  if (text) await page.keyboard.type(text, { delay: 25 });
  await page.waitForTimeout(300);
  await openOptions(page).filter({ hasText: text ?? "" }).first().click();
  await page.waitForTimeout(200);
}

// ── 1. Supervisor issues a permit through the wizard ─────────────────────────
let permitId = "";
let permitNo = "";
{
  const s = await as(U.sup);
  await visit(s.page, "/e-permits", "01-inbox-supervisor");
  ok((await body(s.page)).includes("Issue permit"), "supervisor sees Issue permit");
  await visit(s.page, "/e-permits/new", "02-wizard-step1-empty");
  await choose(s.page, "location", "ETP clarifier");
  await choose(s.page, "subCategory", "General maintenance");
  await s.page.locator('[data-field="shift"] [data-running]').first().click();
  await s.page.locator('[data-field="description"] textarea').fill("[E2E] Replace clarifier scraper bearing");
  await s.page.locator('[data-field="hazards"] textarea').fill("Pinch points — gloves");
  ok((await body(s.page)).includes("Authoriser: Operations HoD"), "wizard previews the Authoriser (Operations HoD)");
  {
    const w = await body(s.page);
    ok(w.includes("Mechanical clearance") && w.includes("Electrical clearance"), "wizard lists every concerned department at the clarifier (Mechanical + Electrical)");
  }
  await s.page.screenshot({ path: `${OUT}/03-wizard-step1.png`, fullPage: true });
  await s.page.getByRole("button", { name: "Next", exact: true }).click();

  const workers = s.page.locator('[data-field="workers"] .ant-select');
  await workers.click();
  for (const n of ["Shilpa", "Rohit"]) {
    await s.page.keyboard.type(n, { delay: 25 });
    await s.page.waitForTimeout(300);
    await s.page.keyboard.press("Enter");
  }
  await s.page.keyboard.press("Escape");
  await choose(s.page, "holder", "Shilpa");
  await s.page.screenshot({ path: `${OUT}/04-wizard-people.png`, fullPage: true });
  await s.page.getByRole("button", { name: "Next", exact: true }).click();

  const na = s.page.locator("label.ant-radio-button-wrapper", { hasText: /^NA$/ });
  const count = await na.count();
  for (let i = 0; i < count; i++) await na.nth(i).click();
  ok(count === 10 + 15 + 9 + 11, "checklists show B1 (10) + PPE (15) + fire & gas (9) + certificates (11)", count);
  await s.page.locator("label.ant-radio-button-wrapper", { hasText: /^Yes$/ }).nth(10 + 4).click(); // PPE: head protection
  await s.page.screenshot({ path: `${OUT}/05-wizard-checklists.png`, fullPage: true });
  await s.page.getByRole("button", { name: "Next", exact: true }).click();
  ok((await body(s.page)).includes("Ready to submit"), "review step says ready to submit");
  await s.page.screenshot({ path: `${OUT}/06-wizard-review.png`, fullPage: true });
  await btn(s.page, "Acknowledge & submit").click();
  await s.page.waitForURL(/\/e-permits\/ep-/, { timeout: 30000 }).catch(() => {});
  permitId = s.page.url().split("/e-permits/")[1] ?? "";
  await s.page.waitForTimeout(1200);
  const b = await body(s.page);
  permitNo = (b.match(/ETP\/FY\d{2}\/\d{5}/) ?? [""])[0];
  ok(permitId.startsWith("ep-") && permitNo, "submitted → permit page with a permit number", `${permitId} ${permitNo}`);
  ok(b.includes("Pending approval"), "status shows Pending approval");
  ok(b.includes("Part A — the work") && b.includes("Part C — approvals & acknowledgements") && b.includes("Return & renewals") && b.includes("Permit rules"), "permit shows Parts A–C, the Return & renewals tab and the rules panel");
  await s.page.screenshot({ path: `${OUT}/07-permit-pending.png`, fullPage: true });
  await s.done();
}

// ── 2. Worker acknowledges, outsider cannot see ──────────────────────────────
{
  const r = await as(U.rohit);
  await visit(r.page, `/e-permits/${permitId}`);
  await btn(r.page, "Acknowledge").first().click();
  await r.page.waitForTimeout(1500);
  ok((await auditText(r.page)).includes("Rohit Kumar Singh acknowledged as worker"), "worker acknowledges from their own login");
  await r.done();

  const m = await as(U.mohee);
  await visit(m.page, `/e-permits/${permitId}`);
  ok((await body(m.page)).includes("Could not open this permit"), "employee not on the permit cannot open it");
  await m.done();
}

// ── 3. HoD approves from the inbox ───────────────────────────────────────────
{
  const h = await as(U.hodOps);
  await visit(h.page, "/dashboard");
  await h.page.waitForURL(/\/e-permits$/, { timeout: 15000 }).catch(() => {});
  ok(h.page.url().endsWith("/e-permits"), "HoD lands on the E-Permits inbox, not a plant dashboard", h.page.url());
  await visit(h.page, "/e-permits", "08-inbox-hod");
  const b = await body(h.page);
  ok(b.includes(permitNo) && b.includes("Approve"), "HoD inbox lists the permit under Needs you");
  const nav = await h.page.locator(".ant-layout-sider").innerText();
  ok(nav.includes("E-Permits") && !nav.includes("Leave"), "HoD sidebar: E-Permits, no plant modules");
  await visit(h.page, `/e-permits/${permitId}`);
  await h.page.locator("[data-approvals]").getByRole("button", { name: "Approve" }).first().click();
  await h.page.waitForTimeout(300);
  await h.page.locator(".ant-modal").getByRole("button", { name: "Confirm" }).click();
  await h.page.waitForTimeout(1500);
  ok((await auditText(h.page)).includes("Authoriser approved"), "HoD approves as Authoriser");
  await h.done();

  // Every concerned department clears too: Mechanical in the browser, Electrical through the API.
  const mech = await as(U.hodMech);
  await visit(mech.page, `/e-permits/${permitId}`);
  await mech.page.locator("[data-approvals]").getByRole("button", { name: "Approve" }).first().click();
  await mech.page.waitForTimeout(300);
  await mech.page.locator(".ant-modal").getByRole("button", { name: "Confirm" }).click();
  await mech.page.waitForTimeout(1500);
  ok((await auditText(mech.page)).includes("Department clearance — Mechanical approved"), "Mechanical HoD clears from their own login (audit names the department)");
  await mech.done();
  const elec = await fetch(`${API}/e-permits/${permitId}/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actor: { id: "user:hod.electrical@nectarenviro.com", name: "Vinod Deshmukh", role: "hod" },
      kind: "department",
      departmentId: "dept-electrical",
      decision: "approve",
    }),
  });
  ok(elec.ok, "Electrical HoD clears", elec.status);
}

// ── 4. Holder acknowledges → active ──────────────────────────────────────────
{
  const sh = await as(U.shilpa);
  await visit(sh.page, `/e-permits/${permitId}`);
  await btn(sh.page, "Acknowledge").first().click();
  await sh.page.waitForTimeout(1800);
  const b = await body(sh.page);
  ok(b.includes("Active") && / left|Overdue by/.test(b), "holder acknowledges → Active with a countdown");
  await sh.page.screenshot({ path: `${OUT}/09-permit-active.png`, fullPage: true });
  const nav = await sh.page.locator(".ant-layout-sider").innerText();
  ok(nav.includes("E-Permits") && !nav.includes("Issue permit"), "employee sees E-Permits but cannot issue");
  await sh.done();
}

// ── 5. Supervisor: renewal request, PDF ──────────────────────────────────────
{
  const s = await as(U.sup);
  await visit(s.page, `/e-permits/${permitId}`);
  const [download] = await Promise.all([s.page.waitForEvent("download", { timeout: 15000 }).catch(() => null), btn(s.page, "PDF").click()]);
  ok(download && /permit-ETP-FY\d{2}-\d{5}\.pdf/.test(download.suggestedFilename()), "PDF downloads as permit-ETP-FYyy-nnnnn.pdf", download?.suggestedFilename());
  await btn(s.page, "Request renewal").click();
  await s.page.waitForTimeout(400);
  ok((await body(s.page)).includes("/R1: shift"), "renewal modal shows R1 and the next shift window");
  await s.page.locator(".ant-modal").getByRole("button", { name: "Confirm" }).click();
  await s.page.waitForTimeout(1500);
  ok((await body(s.page)).includes("Renewal pending"), "renewal requested → Renewal pending");
  await s.page.screenshot({ path: `${OUT}/10-renewal-pending.png`, fullPage: true });
  await s.done();
}

// ── 6. Shift hub, HR, Hindi, phone width ─────────────────────────────────────
{
  const c = await as(U.sic);
  await visit(c.page, "/shifts", "11-shift-hub");
  ok((await body(c.page)).includes("Active E-Permits") && (await body(c.page)).includes(permitNo), "shift hub lists the live permit");
  await c.done();

  const hr = await as(U.hr);
  await visit(hr.page, "/dashboard");
  ok(!(await hr.page.locator(".ant-layout-sider").innerText()).includes("E-Permits"), "HR has no E-Permits menu");
  await hr.done();

  const hi = await as(U.sup, { locale: "hi" });
  await visit(hi.page, `/e-permits/${permitId}`, "12-permit-hindi");
  const hb = await body(hi.page);
  ok(hb.includes("भाग A — काम") && hb.includes("परमिट नियम"), "permit page renders in Hindi");
  await hi.done();

  const mr = await as(U.sup, { locale: "mr" });
  await visit(mr.page, "/e-permits/new", "13-wizard-marathi");
  ok((await body(mr.page)).includes("परमिट जारी करा"), "wizard renders in Marathi");
  await mr.done();

  const phone = await as(U.sup, { width: 390 });
  await visit(phone.page, `/e-permits/${permitId}`, "14-permit-phone");
  const overflow = await phone.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 1, "no horizontal scroll at phone width", overflow);
  await phone.done();
}

// ── 6b. Policy → Locations: concerned departments, edited only by Director / Plant Manager ──
{
  const pm = await as(U.anand);
  await visit(pm.page, "/e-permits/policies");
  await pm.page.locator(".ant-segmented-item", { hasText: "Locations" }).click();
  await pm.page.waitForTimeout(500);
  const row = pm.page.locator('[data-location="loc-etp-aeration"]');
  const t = (await row.innerText()).replace(/\s+/g, " ");
  ok(/Also clears:.*Mechanical.*Electrical.*Chemical/.test(t), "Aeration tank lists Mechanical, Electrical and Chemical as concerned", t);
  ok((await row.getByRole("button", { name: "Edit" }).count()) === 1, "Plant Manager can edit their plant's locations");
  ok((await pm.page.locator('[data-location="loc-ro-skid"]').getByRole("button", { name: "Edit" }).count()) === 0, "but not another plant's");
  await pm.done();

  const hod = await as(U.hodOps);
  await visit(hod.page, "/e-permits/policies");
  await hod.page.locator(".ant-segmented-item", { hasText: "Locations" }).click();
  await hod.page.waitForTimeout(500);
  ok((await hod.page.locator("[data-location]").getByRole("button", { name: "Edit" }).count()) === 0, "HoD cannot edit concerned departments");
  await hod.done();
}

// ── 7. Safety breakdown → issue an emergency permit ──────────────────────────
{
  const res = await fetch(`${API}/safety/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actor: { id: "emp0123", name: "Anand Dakave", role: "manager", siteId: "s-etp" },
      type: "breakdown",
      siteId: "s-etp",
      title: "[E2E] Sludge pump tripped",
      equipment: "Sludge pump P-3",
    }),
  });
  const ev = await res.json();
  ok(res.status === 201 && ev.id, "breakdown logged for the link test", ev.message);
  const s = await as(U.sup);
  await visit(s.page, `/safety/breakdowns/${ev.id}`, "15-breakdown");
  const b = await body(s.page);
  ok(b.includes("None yet — repair work needs an E-Permit") && b.includes("Issue E-Permit for this repair"), "breakdown asks for an E-Permit");
  await s.page.getByRole("button", { name: "Issue E-Permit for this repair" }).click();
  await s.page.waitForURL(/\/e-permits\/new\?breakdown=/, { timeout: 20000 }).catch(() => {});
  await s.page.waitForTimeout(1200);
  const w = await body(s.page);
  ok(w.includes(`Linked to breakdown ${ev.id}`) && w.includes("Breakdown repair"), "wizard prefilled as breakdown repair, linked to the case");
  await s.page.screenshot({ path: `${OUT}/16-wizard-breakdown.png`, fullPage: true });
  await s.done();
}

await browser.close();
ok(allErrors.length === 0, "no page or console errors", allErrors.join("\n"));
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
