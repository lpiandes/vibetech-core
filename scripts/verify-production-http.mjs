#!/usr/bin/env node
/**
 * Verify production server returns valid HTTP responses (not 500).
 *
 * Usage:
 *   NAV_TEST_BASE=http://localhost:3001 node scripts/verify-production-http.mjs
 *   PROD_VERIFY_EMAIL=you@example.com PROD_VERIFY_PASSWORD=secret node scripts/verify-production-http.mjs
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { runMigrations } from "../backend/core/platform/db/migrate.js";
import { closePool } from "../backend/core/platform/db/pool.js";
import { platformStore } from "../backend/core/platform/persistence/PostgresPlatformStore.js";
import { hashPassword } from "../backend/core/platform/services/AuthCredentialService.js";
import { createBusinessWithOwnerInvite } from "../backend/core/platform/services/PlatformBusinessService.js";
import { withClient } from "../backend/core/platform/db/pool.js";

const BASE = process.env.NAV_TEST_BASE ?? "http://localhost:3001";
const MAGNA_MARE_ID = process.env.MAGNA_MARE_BUSINESS_ID ?? "e58a7a52-969b-4377-a77e-98500e5bf648";

async function assertStatus(label, url, { expect = [], not = [500], cookies = "" } = {}) {
  const res = await fetch(url, {
    redirect: "manual",
    headers: cookies ? { cookie: cookies } : undefined,
  });
  const status = res.status;
  if (not.includes(status)) {
    throw new Error(`${label}: ${url} returned ${status} (forbidden)`);
  }
  if (expect.length && !expect.includes(status)) {
    throw new Error(`${label}: ${url} returned ${status}, expected one of ${expect.join(",")}`);
  }
  return { status, location: res.headers.get("location") };
}

async function loginSession(page, email, password) {
  const csrfRes = await page.request.get(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  await page.request.post(`${BASE}/api/auth/callback/credentials`, {
    form: { csrfToken, email, password, callbackUrl: `${BASE}/` },
  });
  const cookies = await page.context().cookies(BASE);
  const session = cookies.find((c) => c.name.includes("session-token"));
  if (!session) throw new Error(`Login failed for ${email}`);
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function resolveCredentials() {
  const email = process.env.PROD_VERIFY_EMAIL;
  const password = process.env.PROD_VERIFY_PASSWORD;
  if (email && password) {
    return { email, password, businessId: process.env.PROD_VERIFY_BUSINESS_ID ?? MAGNA_MARE_ID };
  }

  const suffix = Date.now();
  const bootstrapEmail = `prod-verify-${suffix}@test.local`;
  const bootstrapPassword = "prod-verify-pass-123";
  await runMigrations();
  const user = await platformStore.createUser({
    email: bootstrapEmail,
    name: "Prod Verify",
    passwordHash: await hashPassword(bootstrapPassword),
  });
  const created = await createBusinessWithOwnerInvite({
    name: `Prod Verify ${suffix}`,
    ownerEmail: bootstrapEmail,
    createdByUserId: user.id,
  });
  await platformStore.acceptInvitation({
    invitationId: created.invitation.invitation.id,
    userId: user.id,
  });
  return { email: bootstrapEmail, password: bootstrapPassword, businessId: created.business.id, bootstrapped: true };
}

const publicChecks = [
  ["GET /", `${BASE}/`, { expect: [307, 302] }],
  ["GET /login", `${BASE}/login`, { expect: [200] }],
];

for (const [label, url, opts] of publicChecks) {
  const result = await assertStatus(label, url, opts);
  console.log(`PASS ${label} -> ${result.status}`);
}

const creds = await resolveCredentials();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const cookieHeader = await loginSession(page, creds.email, creds.password);
console.log(`PASS login -> session cookie (${creds.bootstrapped ? "bootstrapped" : "provided"} user)`);

const routes = [
  ["home", `/b/${creds.businessId}/home`],
  ["team", `/b/${creds.businessId}/team`],
  ["work", `/b/${creds.businessId}/work`],
  ["inbox", `/b/${creds.businessId}/inbox`],
  ["integrations", `/b/${creds.businessId}/integrations`],
];

for (const [name, pathSuffix] of routes) {
  const result = await assertStatus(`GET ${name}`, `${BASE}${pathSuffix}`, {
    expect: [200],
    not: [500, 401, 403],
    cookies: cookieHeader,
  });
  console.log(`PASS GET ${name} -> ${result.status}`);
}

if (!creds.bootstrapped && creds.businessId === MAGNA_MARE_ID) {
  const snaps = await withClient((client) =>
    client.query(
      `SELECT runtime_kind FROM workspace_runtime_snapshots WHERE workspace_id = $1 ORDER BY runtime_kind`,
      [MAGNA_MARE_ID],
    ),
  );
  const kinds = snaps.rows.map((r) => r.runtime_kind);
  if (!kinds.length) throw new Error("magna mare has no persisted runtime snapshots");
  console.log(`PASS magna mare persistence -> ${kinds.length} snapshot kinds (${kinds.join(", ")})`);
}

await browser.close();
await closePool();
console.log("\nProduction HTTP verification passed.");
