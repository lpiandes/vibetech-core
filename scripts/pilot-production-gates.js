#!/usr/bin/env node
/**
 * Production gates for the hosted app (or PILOT_BASE_URL / PRODUCTION_BASE_URL).
 * Does not mutate production data. Exits non-zero on blockers.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lookup } from "node:dns/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });
dotenv.config({ path: path.join(root, "frontend/.env.production.local") });

const BASE = String(
  process.env.PRODUCTION_BASE_URL ?? process.env.PILOT_BASE_URL ?? "https://app.vtechdevelopment.com",
).replace(/\/$/, "");
const host = new URL(BASE).hostname;

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

async function main() {
  try {
    const { spawnSync } = await import("node:child_process");
    const guard = spawnSync(process.execPath, ["--test", path.join(root, "scripts/assert-frontend-composition-boundary.js")], {
      cwd: root,
      encoding: "utf8",
    });
    const ok = guard.status === 0;
    record("composition_boundary", ok, ok ? "frontend does not import backend infra singletons" : (guard.stderr || guard.stdout || "").slice(0, 300));
  } catch (err) {
    record("composition_boundary", false, err instanceof Error ? err.message : String(err));
  }

  try {
    const addrs = await lookup(host, { all: true });
    record("dns", addrs.length > 0, addrs.map((a) => a.address).join(", "));
  } catch (err) {
    record("dns", false, err instanceof Error ? err.message : String(err));
  }

  try {
    const res = await fetch(`${BASE}/api/health`, { redirect: "manual" });
    const body = await res.json().catch(() => ({}));
    const ok = res.status === 200 && body.ok === true && body.database === "ok" && body.status === "healthy";
    record("health", ok, `HTTP ${res.status} ${JSON.stringify(body)}`);
  } catch (err) {
    record("health", false, err instanceof Error ? err.message : String(err));
  }

  try {
    const res = await fetch(`${BASE}/login`, { redirect: "manual" });
    record("login_page", res.status === 200, `HTTP ${res.status}`);
  } catch (err) {
    record("login_page", false, err instanceof Error ? err.message : String(err));
  }

  record("https_scheme", BASE.startsWith("https://"), BASE);

  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      record("env_DATABASE_URL", !isLocalHost(u.hostname), `set (${u.hostname})`);
    } catch {
      record("env_DATABASE_URL", false, "set but unparseable");
    }
  } else {
    record("env_DATABASE_URL", false, "missing");
  }

  record("env_AUTH_SECRET", Boolean(process.env.AUTH_SECRET), process.env.AUTH_SECRET ? "set" : "missing");

  if (process.env.NEXTAUTH_URL) {
    const local = process.env.NEXTAUTH_URL.includes("localhost");
    record("env_NEXTAUTH_URL", !local, process.env.NEXTAUTH_URL);
  } else {
    record("env_NEXTAUTH_URL", false, "missing");
  }

  const emailOk = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
  record("env_email_provider", emailOk, emailOk ? "Resend or SMTP set" : "missing RESEND_API_KEY and SMTP_HOST");
  record(
    "env_storage",
    Boolean(process.env.KNOWLEDGE_STORAGE_ROOT || process.env.OBJECT_STORAGE_ROOT),
    process.env.KNOWLEDGE_STORAGE_ROOT || process.env.OBJECT_STORAGE_ROOT || "using default .dev path (not prod)",
  );

  const trustHubOk = Boolean(
    String(process.env.TWILIO_A2P_CUSTOMER_PROFILE_SID || "").trim()
    && String(process.env.TWILIO_A2P_PROFILE_BUNDLE_SID || "").trim(),
  );
  record(
    "env_twilio_a2p_trust_hub",
    trustHubOk,
    trustHubOk ? "Trust Hub SIDs set" : "missing TWILIO_A2P_CUSTOMER_PROFILE_SID / TWILIO_A2P_PROFILE_BUNDLE_SID",
  );

  try {
    const res = await fetch(`${BASE}/api/health`, { redirect: "manual" });
    const body = await res.json().catch(() => ({}));
    const jobsOk = body.jobsSchema === "ok";
    record("jobs_schema", jobsOk, `jobsSchema=${body.jobsSchema ?? "unknown"}`);
    const workerRequired = process.env.REQUIRE_WORKER !== "0" && process.env.PILOT_REQUIRE_WORKER !== "0";
    const workerOk = body.worker === "ok";
    record(
      "worker_heartbeat",
      workerRequired ? workerOk : true,
      `worker=${body.worker ?? "unknown"}${workerRequired ? "" : " (REQUIRE_WORKER=0)"}`,
    );
  } catch (err) {
    record("jobs_schema", false, err instanceof Error ? err.message : String(err));
    record("worker_heartbeat", false, err instanceof Error ? err.message : String(err));
  }

  const failed = results.filter((r) => !r.ok);
  console.log("");
  if (failed.length) {
    console.error(`Production gates failed: ${failed.length} blocker(s).`);
    console.error(failed.map((f) => `- ${f.name}: ${f.detail}`).join("\n"));
    process.exit(1);
  }
  console.log("Production gates passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
