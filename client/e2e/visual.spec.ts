import { test, expect, type Page } from "@playwright/test";
import { DEMO_USERS, DEMO_USERS_HIDDEN } from "../lib/auth";

/**
 * Pixel baseline of every page × one demo user per role.
 * Each test gets a fresh browser context → empty localStorage → stores load
 * their in-code seed, so runs are reproducible. Backend calls are blocked so
 * nothing depends on Mongo contents.
 */

const FIXED_NOW = new Date("2026-09-23T04:30:00Z"); // 10:00 IST, the app's demo "today"

const LOGIN_EMAILS = [
  "director@nectarenviro.com",
  "hr@nectarenviro.com",
  "etp.manager@nectarenviro.com",
  "etp.shift@nectarenviro.com",
  "etp.supervisor@nectarenviro.com",
  "shilpa.hotkar@nectarenviro.com",
  "site@nectarenviro.com",
  "safety@nectarenviro.com",
];

// Same session object login() would store
const USERS = LOGIN_EMAILS.map((email) => {
  const u = [...DEMO_USERS, ...DEMO_USERS_HIDDEN].find((d) => d.email === email)!;
  return { email: u.email, name: u.name, role: u.role, siteId: u.siteId, employeeId: u.employeeId };
});

const ROUTES = [
  "/dashboard",
  "/certifications",
  "/employees",
  "/employees/emp0126",
  "/leave",
  "/leave/management",
  "/leave/pending",
  "/leave/requests",
  "/leave/requests/lv1",
  "/meetings",
  "/notifications",
  "/overtime",
  "/overtime/overview",
  "/overtime/analysis",
  "/overtime/assign",
  "/overtime/employees",
  "/overtime/employees/emp0126",
  "/overtime/reports",
  "/overtime/sites",
  "/overtime/sites/s-etp",
  "/reliever-pool",
  "/salary",
  "/shifts",
  "/shifts/change-requests",
  "/shifts/deviations",
  "/shifts/master",
  "/shifts/reliever-allocation",
  "/shifts/rotation",
  "/shifts/schedule",
  "/sites",
  "/training",
  "/training/learn/course-etp-101",
  "/training/track/track-etp-specialist",
];

async function prepare(page: Page, session?: object) {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript((sessionJson) => {
    // Seeded PRNG so ids / canvas particles are identical every run
    let s = 0x2f6b1d3;
    Math.random = () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    if (sessionJson && !localStorage.getItem("nectar-enviro-session")) {
      localStorage.setItem("nectar-enviro-session", sessionJson);
    }
  }, session ? JSON.stringify(session) : "");
  // Block the Nest API: data must come only from the seeded client stores
  await page.route(/localhost:3001|\/api\//, (route) => route.abort());
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500); // recharts / antd enter animations (JS-driven)
}

// Line paths on this route re-animate indefinitely (pre-existing recharts quirk);
// mask only the curves so axes, KPIs and tables are still compared.
const UNSTABLE_LINES = ["/overtime/sites/s-etp"];

async function snap(page: Page, name: string, route = "") {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: [
      page.locator("canvas"), // free-running particle animation
      ...(UNSTABLE_LINES.includes(route) ? [page.locator(".recharts-line-curve")] : []),
    ],
  });
}

test("login", async ({ page }) => {
  await prepare(page);
  await page.goto("/login");
  await settle(page);
  await snap(page, "login");
});

for (const user of USERS) {
  for (const route of ROUTES) {
    const name = `${user.role}${route.replace(/\//g, "_")}`;
    test(name, async ({ page }) => {
      await prepare(page, user);
      await page.goto(route);
      await settle(page);
      await snap(page, name, route);
    });
  }
}
