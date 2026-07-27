/**
 * Smoke test: Postgres job queue enqueue/claim/complete against local DB.
 */
import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PostgresPlatformJobQueue } from "./PostgresPlatformJobQueue.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
const run = DATABASE_URL ? test : test.skip;

run("PostgresPlatformJobQueue enqueue claim complete", async () => {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const withClient = async (fn) => {
    const client = await pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  };

  // Use a real business id from DB if present.
  const { rows: businesses } = await withClient((client) =>
    client.query(`SELECT id FROM businesses ORDER BY created_at ASC LIMIT 1`),
  );
  if (!businesses[0]) {
    await pool.end();
    return; // no businesses yet — skip softly
  }
  const businessId = String(businesses[0].id);
  const queue = new PostgresPlatformJobQueue({ withClient });
  const key = `test:${Date.now()}`;
  const job = await queue.enqueue({
    businessId,
    jobType: "workflow_step",
    idempotencyKey: key,
    payload: { smoke: true },
  });
  assert.equal(job.deduped, false);
  const claimed = await queue.claimNext({ workerId: "test_worker", jobTypes: ["workflow_step"] });
  assert.ok(claimed);
  assert.equal(claimed.status, "running");
  const done = await queue.complete(claimed.id, { ok: true });
  assert.equal(done.status, "completed");
  await pool.end();
});
