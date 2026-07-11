#!/usr/bin/env node
/**
 * Production pilot gates for app.vtechdevelopment.com (or PILOT_BASE_URL).
 * Does not mutate production data. Exits non-zero on blockers.
 */
import { lookup } from "node:dns/promises";

const BASE = String(process.env.PILOT_BASE_URL ?? "https://app.vtechdevelopment.com").replace(/\/$/, "");
const host = new URL(BASE).hostname;

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  // 1. DNS
  try {
    const addrs = await lookup(host, { all: true });
    record("dns", addrs.length > 0, addrs.map((a) => a.address).join(", "));
  } catch (err) {
    record("dns", false, err instanceof Error ? err.message : String(err));
  }

  // 2. HTTPS + health
  try {
    const res = await fetch(`${BASE}/api/health`, { redirect: "manual" });
    const body = await res.json().catch(() => ({}));
    const ok = res.status === 200 && body.ok === true && body.database === "ok";
    record("health", ok, `HTTP ${res.status} ${JSON.stringify(body)}`);
  } catch (err) {
    record("health", false, err instanceof Error ? err.message : String(err));
  }

  // 3. Login page
  try {
    const res = await fetch(`${BASE}/login`, { redirect: "manual" });
    record("login_page", res.status === 200, `HTTP ${res.status}`);
  } catch (err) {
    record("login_page", false, err instanceof Error ? err.message : String(err));
  }

  // 4. TLS is implied by https fetch success
  record("https_scheme", BASE.startsWith("https://"), BASE);

  // 5. Env presence hints (local gate only — never print values)
  const required = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "NEXTAUTH_URL",
  ];
  for (const key of required) {
    record(`env_${key}`, Boolean(process.env[key]), process.env[key] ? "set" : "missing in process env");
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
