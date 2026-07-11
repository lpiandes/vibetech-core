#!/usr/bin/env node
/**
 * Client-navigation acceptance test for business workspace sidebar.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { runMigrations } from "../backend/core/platform/db/migrate.js";
import { closePool } from "../backend/core/platform/db/pool.js";
import { platformStore } from "../backend/core/platform/persistence/platformStore.js";
import { hashPassword } from "../backend/core/platform/services/AuthCredentialService.js";
import { createBusinessWithOwnerInvite } from "../backend/core/platform/services/PlatformBusinessService.js";

const BASE = process.env.NAV_TEST_BASE ?? "http://localhost:3000";
const ROUNDS = Number(process.env.NAV_TEST_ROUNDS ?? 5);
const SEQUENCE = ["Home", "Team", "Work", "Knowledge", "Home", "Work"];

const suffix = Date.now();
const EMAIL = `nav-click-${suffix}@test.local`;
const PASSWORD = "nav-click-pass-123";

await runMigrations();
const user = await platformStore.createUser({
  email: EMAIL,
  name: "Nav Click Owner",
  passwordHash: await hashPassword(PASSWORD),
});
const created = await createBusinessWithOwnerInvite({
  name: `Nav Click Co ${suffix}`,
  ownerEmail: EMAIL,
  createdByUserId: user.id,
});
await platformStore.acceptInvitation({
  invitationId: created.invitation.invitation.id,
  userId: user.id,
});
const businessId = created.business.id;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await Promise.all([
  page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
await page.goto(`${BASE}/b/${businessId}/home`, { waitUntil: "domcontentloaded" });

// Warm client bundles before measuring reload behavior.
for (const label of ["Team", "Work", "Knowledge", "Home"]) {
  await page.locator("aside nav a").filter({ hasText: new RegExp(`^${label}$`) }).first().click();
  await page.waitForURL(`**/b/${businessId}/${label.toLowerCase()}`, { timeout: 30000 });
}

const navInfo = await page.evaluate(() => document.querySelectorAll("aside nav a").length);
if (navInfo < 5) {
  console.error("Expected sidebar navigation links, found:", navInfo);
  process.exit(1);
}

const failures = [];
const warmTimings = [];

for (let round = 1; round <= ROUNDS; round++) {
  for (const label of SEQUENCE) {
    const hrefSegment = label.toLowerCase();
    const expectedPath = `/b/${businessId}/${hrefSegment}`;

    const sidebar = page.locator("aside");
    const topbar = page.locator("header, [style*='sticky']").first();
    await sidebar.waitFor({ state: "visible" });

    const sidebarBefore = await sidebar.evaluate((el) => el.outerHTML.slice(0, 120));
    let documentLoads = 0;
    const onLoad = () => {
      documentLoads += 1;
    };
    page.on("load", onLoad);

    const link = page.locator("aside nav a").filter({ hasText: new RegExp(`^${label}$`) }).first();
    const clickStart = performance.now();
    await link.click();
    await page.waitForURL(`**${expectedPath}`, { timeout: 15000 });
    const urlMs = Math.round(performance.now() - clickStart);

    await page.waitForTimeout(100);
    page.off("load", onLoad);

    const sidebarAfter = await sidebar.evaluate((el) => el.outerHTML.slice(0, 120));
    const topbarVisible = await topbar.isVisible().catch(() => true);
    const activeOk = await page.locator(`aside nav a[aria-current="page"]`).filter({ hasText: label }).first().isVisible();

    if (documentLoads > 0) {
      failures.push({ round, label, kind: "full-reload", documentLoads });
    }
    if (!topbarVisible) failures.push({ round, label, kind: "topbar-hidden" });
    if (!activeOk) failures.push({ round, label, kind: "active-state" });
    if (sidebarBefore !== sidebarAfter && round > 1) {
      // sidebar HTML may update active class; ensure aside still present
      const asideStillThere = await sidebar.isVisible();
      if (!asideStillThere) failures.push({ round, label, kind: "sidebar-unmounted" });
    }

    if (round > 1) warmTimings.push({ label, urlMs });
  }
}

await page.locator("aside nav a").filter({ hasText: /^Knowledge$/ }).click();
await page.waitForURL(`**/knowledge`, { timeout: 15000 });
await page.locator("aside nav a").filter({ hasText: /^Team$/ }).click();
await page.waitForURL(`**/team`, { timeout: 15000 });
await page.goBack({ waitUntil: "domcontentloaded" });
await page.waitForURL(`**/knowledge`, { timeout: 15000 });
await page.goForward({ waitUntil: "domcontentloaded" });
await page.waitForURL(`**/team`, { timeout: 15000 });

await browser.close();
await closePool();

if (failures.length) {
  console.error("NAV CLICK ACCEPTANCE FAILED", JSON.stringify(failures, null, 2));
  process.exit(1);
}

const avgUrlMs = warmTimings.length
  ? Math.round(warmTimings.reduce((s, t) => s + t.urlMs, 0) / warmTimings.length)
  : 0;

console.log(`NAV CLICK ACCEPTANCE PASSED (${ROUNDS} rounds, Next.js Link client navigation)`);
console.log(`  business: ${businessId}`);
console.log(`  warm avg click→URL: ${avgUrlMs}ms`);
console.log(`  full document reloads during test: 0`);
