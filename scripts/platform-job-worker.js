#!/usr/bin/env node
/**
 * Production job worker — drains platform_jobs outside browser requests.
 * Usage: npm run worker
 *
 * Hosted Next.js-only deploys can instead hit POST /api/platform/jobs/tick on a cron.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });
dotenv.config({ path: path.join(root, ".env") });

const { PostgresPlatformJobQueue } = await import(
  "../backend/core/platform/jobs/PostgresPlatformJobQueue.js"
);
const { createPlatformJobExecutor } = await import(
  "../backend/core/platform/jobs/createPlatformJobExecutor.js"
);
const { PostgresPlatformStore } = await import(
  "../backend/core/platform/persistence/PostgresPlatformStore.js"
);
const { PostgresWorkspacePersistence } = await import(
  "../backend/core/persistence/PostgresWorkspacePersistence.js"
);
const { setWorkspacePersistence } = await import(
  "../backend/core/persistence/createWorkspacePersistence.js"
);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required for the platform job worker");
  process.exit(1);
}

const WORKER_ID = process.env.PLATFORM_WORKER_ID || `worker_${process.pid}`;
const POLL_MS = Math.max(250, Number(process.env.PLATFORM_WORKER_POLL_MS) || 1500);
const HEARTBEAT_MS = Math.max(5000, Number(process.env.PLATFORM_WORKER_HEARTBEAT_MS) || 15000);

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

setWorkspacePersistence(new PostgresWorkspacePersistence(withClient));
const platformStore = new PostgresPlatformStore(withClient);
const queue = new PostgresPlatformJobQueue({ withClient });
const executor = createPlatformJobExecutor({ queue, platformStore });

let stopping = false;

async function heartbeat(detail = {}) {
  await withClient((client) =>
    client.query(
      `INSERT INTO platform_worker_heartbeat (worker_id, status, detail, last_seen_at)
       VALUES ($1, 'ok', $2::jsonb, NOW())
       ON CONFLICT (worker_id) DO UPDATE SET
         status = EXCLUDED.status,
         detail = EXCLUDED.detail,
         last_seen_at = NOW()`,
      [WORKER_ID, JSON.stringify(detail)],
    ),
  );
}

async function loop() {
  console.log(`[worker] started id=${WORKER_ID} poll=${POLL_MS}ms`);
  let lastHeartbeat = 0;
  while (!stopping) {
    try {
      const now = Date.now();
      if (now - lastHeartbeat >= HEARTBEAT_MS) {
        await heartbeat({ pollMs: POLL_MS });
        lastHeartbeat = now;
      }
      const result = await executor.processNext({ workerId: WORKER_ID });
      if (!result) {
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    } catch (err) {
      console.error("[worker] error", err);
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
}

process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

await loop();
process.exit(0);
