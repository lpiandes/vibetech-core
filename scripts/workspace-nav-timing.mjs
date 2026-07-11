#!/usr/bin/env node
/**
 * Measures browser navigation timing (full reload vs client Link).
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
import { createBusinessWithOwnerInvite } from "../backend/core/platform/services/platformBusinessService.default.js";
import { authorizeBusinessAccess } from "../backend/core/platform/authorizeBusinessAccess.js";

const BASE = process.env.NAV_TEST_BASE ?? "http://localhost:3000";

async function timed(label, fn) {
  const start = performance.now();
  const result = await fn();
  return { label, ms: Math.round(performance.now() - start), result };
}

await runMigrations();
const suffix = Date.now();
const EMAIL = `nav-timing-${suffix}@test.local`;
const PASSWORD = "nav-timing-pass-123";
const user = await platformStore.createUser({
  email: EMAIL,
  name: "Nav Timing",
  passwordHash: await hashPassword(PASSWORD),
});
const created = await createBusinessWithOwnerInvite({
  name: `Nav Timing Co ${suffix}`,
  ownerEmail: EMAIL,
  createdByUserId: user.id,
});
await platformStore.acceptInvitation({
  invitationId: created.invitation.invitation.id,
  userId: user.id,
});
const businessId = created.business.id;

console.log("\n=== SERVER-SIDE DB TIMING (warm) ===\n");
const authz = await timed("authorizeBusinessAccess", () =>
  authorizeBusinessAccess({ userId: user.id, businessId, platformRole: null }),
);
console.log(`  ${authz.label}: ${authz.ms}ms`);

const homeDb = await timed("home checklist queries (parallel)", () =>
  Promise.all([
    platformStore.countActiveKnowledgeDocuments(businessId),
    platformStore.isTeamInviteChecklistComplete(businessId),
  ]),
);
console.log(`  ${homeDb.label}: ${homeDb.ms}ms`);

const teamDb = await timed("team members + invites (parallel)", () =>
  Promise.all([
    platformStore.listMembershipsForBusiness(businessId),
    platformStore.listPendingInvitationsForBusiness(businessId),
  ]),
);
console.log(`  ${teamDb.label}: ${teamDb.ms}ms`);

const { businessKnowledgeService } = await import(
  "../backend/core/platform/knowledge/BusinessKnowledgeService.js"
);
const knowledgeDb = await timed("knowledge listDocuments", () =>
  businessKnowledgeService.listDocuments(businessId),
);
console.log(`  ${knowledgeDb.label}: ${knowledgeDb.ms}ms`);

console.log("\n=== BROWSER CLIENT NAVIGATION (Next.js Link, warm round 2+) ===\n");

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

// Warm compile: one full navigation cycle
for (const label of ["Team", "Work", "Knowledge", "Home"]) {
  await page.locator("aside nav a").filter({ hasText: new RegExp(`^${label}$`) }).first().click();
  await page.waitForURL(`**/b/${businessId}/${label.toLowerCase()}`, { timeout: 30000 });
}

const transitions = [
  ["Home", "Team"],
  ["Team", "Work"],
  ["Work", "Knowledge"],
  ["Knowledge", "Home"],
];

for (const [from, to] of transitions) {
  let documentLoads = 0;
  const onLoad = () => {
    documentLoads += 1;
  };
  page.on("load", onLoad);

  const clickStart = performance.now();
  await page.locator("aside nav a").filter({ hasText: new RegExp(`^${to}$`) }).first().click();
  await page.waitForURL(`**/b/${businessId}/${to.toLowerCase()}`, { timeout: 15000 });
  const urlMs = Math.round(performance.now() - clickStart);

  const loadingVisible = await page
    .getByText("Loading…")
    .isVisible()
    .catch(() => false);

  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  const contentMs = Math.round(performance.now() - clickStart);
  page.off("load", onLoad);

  const sidebarVisible = await page.locator("aside").isVisible();
  const topbarVisible = await page.getByPlaceholder("Search people, units, work…").isVisible();

  console.log(`  ${from} → ${to}:`);
  console.log(`    click → URL: ${urlMs}ms`);
  console.log(`    click → domcontentloaded: ${contentMs}ms`);
  console.log(`    loading state seen: ${loadingVisible}`);
  console.log(`    full document reloads: ${documentLoads}`);
  console.log(`    sidebar visible: ${sidebarVisible}, topbar visible: ${topbarVisible}`);
}

await browser.close();
await closePool();
console.log("\nDone.\n");
