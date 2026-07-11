#!/usr/bin/env node
/**
 * Verifies production migrations apply cleanly from an empty database.
 * Uses vibetech_test (created by db:test:setup) as the empty-ish target after migrate.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

const dbUrl = process.env.DATABASE_URL_TEST
  ?? "postgresql://vibetech:vibetech@localhost:5432/vibetech_test";

console.log("Dropping and recreating vibetech_test for empty-DB migrate proof…");
spawnSync("dropdb", ["--if-exists", "vibetech_test"], { stdio: "inherit" });
spawnSync("createdb", ["-O", "vibetech", "vibetech_test"], { stdio: "inherit" });

const migrate = spawnSync(
  process.execPath,
  [path.join(root, "scripts/db-migrate.js")],
  {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      DATABASE_URL_TEST: dbUrl,
      VIBETECH_TEST_DB: "1",
    },
    stdio: "inherit",
  },
);

if (migrate.status !== 0) {
  console.error("Empty-database migration failed.");
  process.exit(migrate.status ?? 1);
}

console.log("Empty-database migration verified.");
