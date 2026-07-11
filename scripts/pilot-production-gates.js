#!/usr/bin/env node
/**
 * Production pilot gates for app.vtechdevelopment.com (or PILOT_BASE_URL).
 * Does not mutate production data. Exits non-zero on blockers.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lookup } from "node:dns/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });
dotenv.config({ path: path.join(root, "frontend/.env.production.local") });

const BASE = String(process.env.PILOT_BASE_URL ?? "https://app.vtechdevelopment.com").replace(/\/$/, "");
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
    const addrs = await lookup(host, { all: true });
    record("dns", addrs.length > 0, addrs.map((a) => a.address).join(", "));
  } catch (err) {
    record("dns", false, err instanceof Error ? err.message : String(err));
  }

  try {
    const res = await fetch(`${BASE}/api/health`, { redirect: "manual" });
    const body = await res.json().catch(() => ({}));
    const ok = res.status === 200 && body.ok === true && body.database === "ok";
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

  const failed = results.filter((r) => !r.ok);
  console.log("");
  if (failed.length) {
    console.error(`Pilot gates failed: ${failed.length} blocker(s).`);
    console.error(failed.map((f) => `- ${f.name}: ${f.detail}`).join("\n"));
    process.exit(1);
  }
  console.log("Pilot gates passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
