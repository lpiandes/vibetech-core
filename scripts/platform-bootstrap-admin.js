#!/usr/bin/env node
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { bootstrapPlatformAdmin } from "../backend/core/platform/services/AuthCredentialService.js";
import { runMigrations } from "../backend/core/platform/db/migrate.js";
import { closePool } from "../backend/core/platform/db/pool.js";

function readArg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

const email = readArg("--email");
const password = readArg("--password");
const name = readArg("--name") ?? "Platform Admin";

if (!email || !password) {
  console.error("Usage: node scripts/platform-bootstrap-admin.js --email you@example.com --password 'your-password' [--name 'Your Name']");
  process.exit(1);
}

await runMigrations();
const result = await bootstrapPlatformAdmin({ email, password, name });
console.log(result.created ? "Created platform admin:" : "Platform admin already exists (password reset):");
console.log(`  id: ${result.user.id}`);
console.log(`  email: ${result.user.email}`);
console.log(`  database: ${process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).host : "(unset)"}`);
await closePool();
