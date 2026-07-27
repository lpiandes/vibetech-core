#!/usr/bin/env node
/**
 * Local / staging production-readiness check.
 * Exits non-zero when health, migrations, or worker gates fail.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });
dotenv.config({ path: path.join(root, ".env") });

const BASE = String(process.env.ONBOARD_CHECK_URL ?? process.env.PILOT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  try {
    const res = await fetch(`${BASE}/api/health`, { redirect: "manual" });
    const body = await res.json().catch(() => ({}));
    record("health_http", res.status === 200 && body.ok === true, `HTTP ${res.status} ok=${body.ok}`);
    record("database", body.database === "ok", `database=${body.database}`);
    record("jobs_schema", body.jobsSchema === "ok", `jobsSchema=${body.jobsSchema}`);
    record("worker", body.worker === "ok", `worker=${body.worker}`);
    record("status_healthy", body.status === "healthy", `status=${body.status}`);
  } catch (err) {
    record("health_http", false, err instanceof Error ? err.message : String(err));
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    record("migrations", false, "DATABASE_URL missing");
  } else {
    const client = new pg.Client({ connectionString: databaseUrl });
    try {
      await client.connect();
      const { rows } = await client.query("SELECT id FROM schema_migrations ORDER BY id");
      const ids = rows.map((r) => r.id);
      const required = [
        "015_platform_jobs_and_proofs.sql",
        "016_worker_heartbeat.sql",
        "017_ai_ask_quota.sql",
      ];
      const missing = required.filter((id) => !ids.includes(id));
      record("migrations", missing.length === 0, missing.length ? `missing ${missing.join(", ")}` : `${ids.length} applied`);
    } catch (err) {
      record("migrations", false, err instanceof Error ? err.message : String(err));
    } finally {
      await client.end().catch(() => {});
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log("");
  if (failed.length) {
    console.error(`Onboard check failed: ${failed.length} blocker(s). See docs/product/BEACHHEAD_PROVE_CHECKLIST.md`);
    process.exit(1);
  }
  console.log("Onboard check passed. Ready for production client install.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
