#!/usr/bin/env node
/**
 * End-to-end browser navigation timing for five workspace flows.
 * Captures click → RSC response → destination content visible.
 *
 * Usage:
 *   NAV_TEST_BASE=http://localhost:3000 node scripts/measure-browser-navigation-e2e.mjs
 *   NAV_TEST_MODE=production NAV_TEST_BASE=http://localhost:3001 node scripts/measure-browser-navigation-e2e.mjs
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
import { connectBusinessEmailDev } from "../backend/core/integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "../backend/core/integration/ProspectInquiryOperatingLoopService.js";
import { workspaceCompositionRegistry } from "../frontend/lib/workspace/WorkspaceCompositionRegistry.js";
import { workspaceActivationRegistry } from "../backend/core/workspace/activation/WorkspaceActivationRegistry.js";
import { businessRecordToActivation } from "../backend/core/platform/persistence/platformMappers.js";
import { ConnectedBusinessWorkspace } from "../frontend/lib/workspace/ConnectedBusinessWorkspace.ts";
import { persistAffectedRuntimes } from "../backend/core/persistence/PersistedMutationCoordinator.js";
import { PROSPECT_LOOP_SNAPSHOT_KINDS } from "../backend/core/persistence/RuntimeSnapshotKinds.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

const BASE = process.env.NAV_TEST_BASE ?? "http://localhost:3000";
const MODE = process.env.NAV_TEST_MODE ?? "dev";
const BUSINESS_ID = process.env.NAV_TEST_BUSINESS_ID ?? null;

function isRscRequest(response) {
  const request = response.request();
  const url = String(response.url());
  const headers = request.headers();
  return (
    headers["rsc"] === "1" ||
    headers["next-router-prefetch"] === "1" ||
    url.includes("_rsc=") ||
    url.includes("?_rsc") ||
    url.includes("&_rsc")
  );
}

function isDocumentNavigation(url, businessId) {
  const u = new URL(url);
  return u.pathname.startsWith(`/b/${businessId}/`) && !isRscUrl(url);
}

function isRscUrl(url) {
  const u = String(url);
  return u.includes("_rsc=") || u.includes("?_rsc") || u.includes("&_rsc");
}

async function bootstrapBusiness() {
  if (BUSINESS_ID) {
    const members = await platformStore.listMembershipsForBusiness(BUSINESS_ID);
    if (!members.length) throw new Error(`No members for business ${BUSINESS_ID}`);
    const user = await platformStore.getUserById(members[0].userId);
    return { businessId: BUSINESS_ID, email: user.email, password: process.env.NAV_TEST_PASSWORD ?? null };
  }

  const suffix = Date.now();
  const EMAIL = `nav-e2e-${suffix}@test.local`;
  const PASSWORD = "nav-e2e-pass-123";
  const user = await platformStore.createUser({
    email: EMAIL,
    name: "Nav E2E",
    passwordHash: await hashPassword(PASSWORD),
  });
  const created = await createBusinessWithOwnerInvite({
    name: `Nav E2E Co ${suffix}`,
    ownerEmail: EMAIL,
    createdByUserId: user.id,
  });
  await platformStore.acceptInvitation({
    invitationId: created.invitation.invitation.id,
    userId: user.id,
  });
  const businessId = created.business.id;

  const business = await platformStore.getBusinessById(businessId);
  const activation = businessRecordToActivation(business);
  workspaceActivationRegistry.ensure(businessId, activation);
  const connected = workspaceCompositionRegistry.getOrCreate(businessId, ({ workspaceId }) =>
    new ConnectedBusinessWorkspace({ workspaceId, activation }),
  );
  await connectBusinessEmailDev({
    integrationPlatform: connected.integrationPlatform,
    workspaceId: businessId,
    nowISO: NOW_ISO,
  });
  await platformStore.createKnowledgeDocument({
    businessId,
    title: "E2E handbook",
    originalFilename: "handbook.txt",
    storageKey: `e2e/${businessId}/handbook.txt`,
    mimeType: "text/plain",
    sizeBytes: 12,
    sourceType: "MARKDOWN",
    uploadedByUserId: user.id,
  });
  await runProspectInquiryOperatingLoop({
    stack: connected.operatingStack,
    integrationPlatform: connected.integrationPlatform,
    workspaceId: businessId,
    nowISO: NOW_ISO,
    inquiry: {
      name: "E2E Prospect",
      email: `prospect-${suffix}@example.com`,
      phone: "555-0100",
      message: "Interested in a 2BR unit",
    },
  });
  await persistAffectedRuntimes({
    workspaceId: businessId,
    stack: connected.operatingStack,
    integrationPlatform: connected.integrationPlatform,
    kinds: [...PROSPECT_LOOP_SNAPSHOT_KINDS],
  });

  return { businessId, email: EMAIL, password: PASSWORD };
}

async function login(page, email, password) {
  const csrfRes = await page.request.get(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  await page.request.post(`${BASE}/api/auth/callback/credentials`, {
    form: {
      csrfToken,
      email,
      password,
      callbackUrl: `${BASE}/`,
    },
  });
  const cookies = await page.context().cookies(BASE);
  const hasSession = cookies.some((cookie) => cookie.name.includes("session-token"));
  if (!hasSession) {
    throw new Error(`Login failed for ${email}: no session cookie`);
  }
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
}

function createNetworkCollector(page, businessId) {
  const events = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.startsWith(BASE)) return;
    if (!isRscRequest(response) && !isDocumentNavigation(url, businessId)) return;
    const timing = response.request().timing();
    const headers = response.headers();
    events.push({
      url: new URL(url).pathname + new URL(url).search,
      kind: isRscRequest(response) ? "rsc" : "document",
      status: response.status(),
      middlewareMs: Number(headers["x-vibetech-middleware-ms"] ?? 0) || null,
      serverTiming: headers["server-timing"] ?? null,
      responseEndMs: timing?.responseEnd ?? null,
      size: Number(headers["content-length"] ?? 0) || null,
    });
  });
  return {
    drain: () => {
      const copy = events.splice(0, events.length);
      return copy;
    },
  };
}

async function waitForDestination(page, { selector, urlPattern, timeout = 20000 }) {
  const start = performance.now();
  await Promise.all([
    selector ? page.waitForSelector(selector, { state: "visible", timeout }) : Promise.resolve(),
    urlPattern ? page.waitForURL(urlPattern, { timeout }) : Promise.resolve(),
  ]);
  return Math.round(performance.now() - start);
}

async function clickLink(locator) {
  await locator.waitFor({ state: "visible", timeout: 15000 });
  await locator.evaluate((el) => {
    el.click();
  });
}

async function measureClick(page, businessId, collector, { name, click, destination }) {
  collector.drain();
  const clickAt = performance.now();
  await click();
  const navStartMs = Math.round(performance.now() - clickAt);

  const contentWaitMs = await waitForDestination(page, destination);
  const totalMs = Math.round(performance.now() - clickAt);
  const network = collector.drain();
  const rsc = network.filter((e) => e.kind === "rsc");
  const primaryRsc = rsc[rsc.length - 1] ?? null;

  return {
    flow: name,
    clickToNavStartMs: navStartMs,
    clickToContentVisibleMs: totalMs,
    contentWaitMs,
    rscCount: rsc.length,
    rscResponseEndMs: primaryRsc?.responseEndMs ?? null,
    rscMiddlewareMs: primaryRsc?.middlewareMs ?? null,
    rscServerTiming: primaryRsc?.serverTiming ?? null,
    rscSize: primaryRsc?.size ?? null,
  };
}

async function runFlows(page, businessId, collector, { warm }) {
  const inboxThreadLink = page.locator(`a[href*="/b/${businessId}/inbox/"]`).first();
  const hasThread = await inboxThreadLink.count().then((n) => n > 0);

  const flows = [];

  flows.push(
    await measureClick(page, businessId, collector, {
      name: warm ? "home→email(warm)" : "home→email(cold)",
      click: async () => {
        await clickLink(page.getByRole("link", { name: /Connect your email/i }).first());
      },
      destination: {
        selector: "text=Integrations",
        urlPattern: `**/b/${businessId}/integrations**`,
      },
    }),
  );

  flows.push(
    await measureClick(page, businessId, collector, {
      name: warm ? "sidebar→inbox(warm)" : "sidebar→inbox(cold)",
      click: async () => {
        await clickLink(page.locator("aside nav a").filter({ hasText: /^Inbox$/ }).first());
      },
      destination: {
        selector: "text=Inbox",
        urlPattern: `**/b/${businessId}/inbox`,
      },
    }),
  );

  if (hasThread) {
    flows.push(
      await measureClick(page, businessId, collector, {
        name: warm ? "inbox→detail(warm)" : "inbox→detail(cold)",
        click: async () => {
          await clickLink(inboxThreadLink);
        },
        destination: {
          urlPattern: `**/b/${businessId}/inbox/**`,
        },
      }),
    );
  } else {
    flows.push({ flow: warm ? "inbox→detail(warm)" : "inbox→detail(cold)", skipped: true, reason: "no threads" });
  }

  flows.push(
    await measureClick(page, businessId, collector, {
      name: warm ? "sidebar→work(warm)" : "sidebar→work(cold)",
      click: async () => {
        await clickLink(page.locator("aside nav a").filter({ hasText: /^Work$/ }).first());
      },
      destination: {
        selector: "text=Work",
        urlPattern: `**/b/${businessId}/work`,
      },
    }),
  );

  flows.push(
    await measureClick(page, businessId, collector, {
      name: warm ? "sidebar→team(warm)" : "sidebar→team(cold)",
      click: async () => {
        await clickLink(page.locator("aside nav a").filter({ hasText: /^Team$/ }).first());
      },
      destination: {
        selector: "text=Team",
        urlPattern: `**/b/${businessId}/team`,
      },
    }),
  );

  return flows;
}

function printTable(title, rows) {
  console.log(`\n=== ${title} (${MODE}, ${BASE}) ===\n`);
  console.log(
    [
      "Flow".padEnd(24),
      "Click→Content".padStart(14),
      "RSC end".padStart(10),
      "MW".padStart(6),
      "RSC#".padStart(5),
      "Bytes".padStart(8),
    ].join(" "),
  );
  for (const row of rows) {
    if (row.skipped) {
      console.log(`${row.flow.padEnd(24)} SKIPPED (${row.reason})`);
      continue;
    }
    console.log(
      [
        row.flow.padEnd(24),
        `${row.clickToContentVisibleMs}ms`.padStart(14),
        `${row.rscResponseEndMs ?? "—"}`.padStart(10),
        `${row.rscMiddlewareMs ?? "—"}`.padStart(6),
        `${row.rscCount}`.padStart(5),
        `${row.rscSize ?? "—"}`.padStart(8),
      ].join(" "),
    );
  }
}

await runMigrations();
const { businessId, email, password } = await bootstrapBusiness();
if (!password) {
  console.error("Set NAV_TEST_PASSWORD for NAV_TEST_BUSINESS_ID or use auto-bootstrap.");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const collector = createNetworkCollector(page, businessId);

await login(page, email, password);
await page.goto(`${BASE}/b/${businessId}/home`, { waitUntil: "domcontentloaded" });

const cold = await runFlows(page, businessId, collector, { warm: false });
await page.goto(`${BASE}/b/${businessId}/home`, { waitUntil: "domcontentloaded" });
const warm = await runFlows(page, businessId, collector, { warm: true });

printTable("COLD (first click each flow)", cold);
printTable("WARM (second pass)", warm);

console.log(`\nbusinessId: ${businessId}`);
console.log(`email: ${email}`);

await browser.close();
await closePool();
