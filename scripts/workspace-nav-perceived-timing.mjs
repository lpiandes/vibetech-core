#!/usr/bin/env node
/**
 * Reads dev nav perf overlay timings after optimistic navigation.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { runMigrations } from "../backend/core/platform/db/migrate.js";
import { closePool } from "../backend/core/platform/db/pool.js";
import { platformStore } from "../backend/core/platform/persistence/platformStore.js";
import { hashPassword } from "../backend/core/platform/services/AuthCredentialService.js";
import { createBusinessWithOwnerInvite } from "../backend/core/platform/services/PlatformBusinessService.js";

const BASE = process.env.NAV_TEST_BASE ?? "http://localhost:3000";
const suffix = Date.now();
const EMAIL = `nav-perf-${suffix}@test.local`;
const PASSWORD = "nav-perf-pass-123";

await runMigrations();
const user = await platformStore.createUser({
  email: EMAIL,
  name: "Nav Perf",
  passwordHash: await hashPassword(PASSWORD),
});
const created = await createBusinessWithOwnerInvite({
  name: `Nav Perf Co ${suffix}`,
  ownerEmail: EMAIL,
  createdByUserId: user.id,
});
await platformStore.acceptInvitation({
  invitationId: created.invitation.invitation.id,
  userId: user.id,
});
const businessId = created.business.id;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await Promise.all([
  page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
await page.goto(`${BASE}/b/${businessId}/home`, { waitUntil: "domcontentloaded" });

for (const label of ["Team", "Work", "Knowledge", "Home"]) {
  await page.locator("aside nav a").filter({ hasText: new RegExp(`^${label}$`) }).first().click();
  await page.waitForURL(`**/b/${businessId}/${label.toLowerCase()}`, { timeout: 30000 });
}

const results = [];
for (const label of ["Team", "Work", "Knowledge", "Home"]) {
  const clickAt = Date.now();
  await page.locator("aside nav a").filter({ hasText: new RegExp(`^${label}$`) }).first().click();

  const activeMs = await page
    .waitForFunction(
      (target) => {
        const el = document.querySelector(`aside nav a[aria-current="page"]`);
        return el && el.textContent?.trim() === target;
      },
      label,
      { timeout: 2000 },
    )
    .then(() => Date.now() - clickAt)
    .catch(() => -1);

  const loadingMs = await page
    .waitForSelector('[aria-busy="true"]', { timeout: 2000 })
    .then(() => Date.now() - clickAt)
    .catch(() => -1);

  await page.waitForURL(`**/b/${businessId}/${label.toLowerCase()}`, { timeout: 15000 });
  const contentMs = Date.now() - clickAt;

  const perfText = await page.locator("text=nav perf").locator("..").textContent().catch(() => "");

  results.push({ label, activeMs, loadingMs, contentMs, perfText });
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
await closePool();
