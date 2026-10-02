/**
 * Browser smoke test of the redesigned Training section, against the TEST API (never the main DB).
 *
 *   # server: PORT=3011 MONGODB_DB_NAME=nectar_enviro_test CLIENT_URL=http://localhost:3100 node dist/src/main.js
 *   # client: NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_API_URL=http://localhost:3011/api npx next build && npx next start -p 3100
 *   node e2e/training-flow.mjs
 *
 * Screenshots go to e2e/results/training/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const API = process.env.API ?? "http://localhost:3011/api";
const OUT = "e2e/results/training";
mkdirSync(OUT, { recursive: true });

const USERS = {
  shilpa: { email: "shilpa.hotkar@nectarenviro.com", name: "Shilpa Hotkar", role: "employee", siteId: "s-etp", employeeId: "emp0126" },
  anand: { email: "etp.manager@nectarenviro.com", name: "Anand Dakave", role: "manager", siteId: "s-etp", employeeId: "emp0123" },
  director: { email: "director@nectarenviro.com", name: "Prashant Rohidas Adsul", role: "director" },
  hr: { email: "hr@nectarenviro.com", name: "Swati Ingle", role: "hr", employeeId: "emp0147" },
  supervisor: { email: "etp.supervisor@nectarenviro.com", name: "Neetesh Diwathe", role: "supervisor", siteId: "s-etp", employeeId: "emp0125" },
};

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();

async function as(user, width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: "en-IN", timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript((u) => localStorage.setItem("nectar-enviro-session", JSON.stringify(u)), user);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|404/.test(m.text()) && errors.push(m.text()));
  return { ctx, page, errors };
}

async function visit(page, path, shot, waitFor) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  // The shell loads its own data first; wait until skeletons are gone (and optional text shows)
  await page.waitForFunction(() => !document.querySelector(".ant-skeleton"), null, { timeout: 20000 }).catch(() => {});
  if (waitFor) await page.getByText(waitFor).first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
  if (shot) await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
}

const text = async (page) => (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ");

// ---------------------------------------------------------------- learner
{
  const { ctx, page, errors } = await as(USERS.shilpa);
  await visit(page, "/training", "01-home-employee", /Welcome back/);
  const t = await text(page);
  ok(/Welcome back, Shilpa/.test(t), "Home greets the learner by name");
  ok(/Assigned to you/.test(t) && /Recommended for you/.test(t) && /Upcoming events/.test(t), "Home shows the shelves");
  const recCards = await page.locator('section[aria-label="Recommended for you"] a[href^="/training/course/"]').count();
  ok(recCards > 0 && recCards <= 4, `Recommended shelf shows at most 4 cards (${recCards})`);
  ok(!/Shilpa Hotkar.*Plant Operator.*ETP Plant Ops|% Match/.test(t), "no fake '% Match' or fallback labels");

  await visit(page, "/training/explore?q=membrane", "02-explore-search");
  const n = await page.locator('a[href^="/training/course/"]').count();
  ok(n > 0, `Explore search finds courses (${n})`);
  await visit(page, "/training/explore?q=zzzz-no-match");
  ok(/No courses match these filters/.test(await text(page)), "Explore shows an empty state");

  await visit(page, "/training/course/course-etp-101", "03-course-page");
  const ct = await text(page);
  ok(/Syllabus/.test(ct) && /Assessment/.test(ct), "Course page has About / Syllabus / Assessment tabs");

  await visit(page, "/training/my-learning", "04-my-learning");
  ok(/My Learning/.test(await text(page)), "My Learning loads");

  await visit(page, "/training/events", "05-events");
  ok(/Communities/.test(await text(page)), "Events page lists communities");

  // RSVP to the migrated MEE event (test DB)
  await visit(page, "/training/events/evt-session-mee-waghaskar", "06-event-page");
  const et = await text(page);
  ok(/Attendees/.test(et) && /Hosts/.test(et) && /Discussion/.test(et), "Event page sections render");
  const attend = page.getByRole("button", { name: /^(Attend|Join waitlist)$/ });
  if (await attend.count()) {
    await attend.first().click();
    await page.waitForTimeout(1500);
    ok(/Going ✓|On waitlist/.test(await text(page)), "RSVP from the event page");
  } else {
    ok(/Going ✓/.test(et), "already going");
  }
  await page.screenshot({ path: `${OUT}/07-event-after-rsvp.png`, fullPage: true });
  ok(errors.length === 0, `no page errors for the learner${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);

  // Mobile layout
  const m = await as(USERS.shilpa, 375);
  await visit(m.page, "/training", "08-home-mobile");
  const overflow = await m.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 1, `no horizontal scroll at 375px (overflow ${overflow}px)`);
  await m.ctx.close();
  await ctx.close();
}

// The mentor (host of the MEE event) gets the RSVP notification
{
  const res = await fetch(`${API}/notifications?employeeId=emp0139`);
  const rows = await res.json();
  ok(rows.some((n) => n.kind === "event_rsvp_going" && /Shilpa Hotkar/.test(n.body)), "mentor Sanjay notified: 'Shilpa Hotkar … is going'");
}

// ---------------------------------------------------------------- manager (mentor + allotted manager)
{
  const { ctx, page, errors } = await as(USERS.anand);
  await visit(page, "/training", "09-records-manager");
  const t = await text(page);
  ok(/Academic Records/.test(t) && /My team/.test(t), "Manager sees Academic Records with their team");
  ok(/Shilpa Hotkar/.test(t) && !/Rafik Shaikh/.test(t), "Manager's team = allotted employees only");

  // Flag a weak area for Shilpa from the team table
  await page.getByRole("row", { name: /Shilpa Hotkar/ }).getByRole("button", { name: "Flag / assign", exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/10-flag-modal.png` });
  await page.getByPlaceholder("e.g. Polymer dosing during shock loads").fill("Polymer dosing");
  await page.getByPlaceholder("e.g. Overdosing seen in the last 3 shifts").fill("Overdosing seen in 3 shifts");
  await page.getByRole("button", { name: /^Flag$/ }).click();
  await page.waitForTimeout(1500);

  await visit(page, "/training/mentor", "11-mentor-studio");
  ok(/Mentor Studio/.test(await text(page)), "Mentor Studio loads for a mentor");
  await page.getByRole("button", { name: "Create event" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/12-create-event-form.png`, fullPage: true });
  await page.keyboard.press("Escape");

  await visit(page, "/training?tab=reports", "13-reports");
  ok(/Completion by site/.test(await text(page)), "Reports tab");
  await visit(page, "/training?tab=evaluations", "14-evaluations");
  ok(/Evaluations/.test(await text(page)), "Evaluations tab");
  ok(errors.length === 0, `no page errors for the manager${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  await ctx.close();
}

{
  const rows = await (await fetch(`${API}/notifications?employeeId=emp0126`)).json();
  ok(rows.some((n) => n.kind === "training_flagged"), "Shilpa notified of the manager's flag");
  const { ctx, page } = await as(USERS.shilpa);
  await visit(page, "/training", "15-home-after-flag", /Welcome back/);
  ok(/Suggested by Anand Dakave/.test(await text(page)), "Flag shows on Shilpa's Home with the manager's name");
  await visit(page, "/notifications", "16-notifications");
  ok(/Training & events/.test(await text(page)), "Notifications page lists server notifications");
  await ctx.close();
}

// ---------------------------------------------------------------- director / HR / supervisor
{
  const { ctx, page, errors } = await as(USERS.director);
  await visit(page, "/training", "17-records-director");
  const t = await text(page);
  ok(/Mentors & communities/.test(t), "Director sees the admin tab");
  await visit(page, "/notifications", "18-director-notifications");
  ok(!/require/.test(await text(page)), "Director (non-employee) can open notifications");
  ok(errors.length === 0, `no page errors for the director${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  await ctx.close();
}
{
  const { ctx, page } = await as(USERS.hr);
  await visit(page, "/training");
  const t = await text(page);
  ok(!/Assign & flag/.test(t), "HR cannot flag (no Assign & flag tab)");
  await ctx.close();
}
{
  const { ctx, page } = await as(USERS.supervisor);
  await visit(page, "/training/team", "19-supervisor-team");
  ok(/My team/.test(await text(page)), "Supervisor has a My team page");
  ok((await page.getByRole("button", { name: /Flag \/ assign/ }).count()) === 0, "Supervisor cannot flag");
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
