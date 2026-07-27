/**
 * Postgres-backed durable job queue — same contract as InMemoryPlatformJobQueue.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function mapJobRow(row, { deduped = false } = {}) {
  if (!row) return null;
  return deepFreeze({
    id: String(row.id),
    businessId: String(row.business_id),
    jobType: String(row.job_type),
    idempotencyKey: String(row.idempotency_key),
    status: String(row.status),
    payload: row.payload ?? {},
    result: row.result ?? null,
    errorMessage: row.error_message ?? null,
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? 5),
    runAfter: row.run_after?.toISOString?.() ?? row.run_after,
    lockedAt: row.locked_at?.toISOString?.() ?? row.locked_at ?? null,
    lockedBy: row.locked_by ?? null,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
    completedAt: row.completed_at?.toISOString?.() ?? row.completed_at ?? null,
    deduped,
  });
}

export class PostgresPlatformJobQueue {
  /**
   * @param {{ withClient: (fn: (client: any) => Promise<any>) => Promise<any> }} deps
   */
  constructor({ withClient } = {}) {
    if (typeof withClient !== "function") {
      throw new Error("PostgresPlatformJobQueue requires withClient");
    }
    this.withClient = withClient;
  }

  async enqueue({
    businessId,
    jobType,
    idempotencyKey,
    payload = {},
    runAfter = null,
    maxAttempts = 5,
  }) {
    const key = String(idempotencyKey);
    const existing = await this.withClient((client) =>
      client.query(
        `SELECT * FROM platform_jobs
         WHERE business_id = $1::uuid AND job_type = $2 AND idempotency_key = $3
         LIMIT 1`,
        [String(businessId), String(jobType), key],
      ),
    );
    if (existing.rows[0]) {
      return mapJobRow(existing.rows[0], { deduped: true });
    }

    const { rows } = await this.withClient((client) =>
      client.query(
        `INSERT INTO platform_jobs (
           business_id, job_type, idempotency_key, status, payload, max_attempts, run_after
         ) VALUES ($1::uuid, $2, $3, 'pending', $4::jsonb, $5, COALESCE($6::timestamptz, NOW()))
         RETURNING *`,
        [
          String(businessId),
          String(jobType),
          key,
          JSON.stringify(payload ?? {}),
          Number(maxAttempts) || 5,
          runAfter,
        ],
      ),
    );
    const job = mapJobRow(rows[0]);
    await this._audit(job.id, job.businessId, "enqueued", { jobType });
    return job;
  }

  async claimNext({ workerId = "worker", jobTypes = null } = {}) {
    return this.withClient(async (client) => {
      await client.query("BEGIN");
      try {
        let result;
        if (Array.isArray(jobTypes) && jobTypes.length) {
          result = await client.query(
            `SELECT * FROM platform_jobs
             WHERE status IN ('pending', 'failed')
               AND attempt_count < max_attempts
               AND run_after <= NOW()
               AND job_type = ANY($1::text[])
             ORDER BY run_after ASC, created_at ASC
             FOR UPDATE SKIP LOCKED
             LIMIT 1`,
            [jobTypes.map(String)],
          );
        } else {
          result = await client.query(
            `SELECT * FROM platform_jobs
             WHERE status IN ('pending', 'failed')
               AND attempt_count < max_attempts
               AND run_after <= NOW()
             ORDER BY run_after ASC, created_at ASC
             FOR UPDATE SKIP LOCKED
             LIMIT 1`,
          );
        }
        const row = result.rows[0];
        if (!row) {
          await client.query("COMMIT");
          return null;
        }
        const updated = await client.query(
          `UPDATE platform_jobs
           SET status = 'running',
               attempt_count = attempt_count + 1,
               locked_at = NOW(),
               locked_by = $2,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [row.id, String(workerId)],
        );
        await client.query(
          `INSERT INTO platform_job_audit (job_id, business_id, event_type, detail)
           VALUES ($1, $2::uuid, 'claimed', $3::jsonb)`,
          [
            row.id,
            row.business_id,
            JSON.stringify({ workerId, attempt: Number(row.attempt_count) + 1 }),
          ],
        );
        await client.query("COMMIT");
        return mapJobRow(updated.rows[0]);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    });
  }

  async complete(jobId, result = {}) {
    const { rows } = await this.withClient((client) =>
      client.query(
        `UPDATE platform_jobs
         SET status = 'completed',
             result = $2::jsonb,
             error_message = NULL,
             locked_at = NULL,
             locked_by = NULL,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [String(jobId), JSON.stringify(result ?? {})],
      ),
    );
    const job = mapJobRow(rows[0]);
    if (job) await this._audit(job.id, job.businessId, "completed", { ok: true });
    return job;
  }

  async fail(jobId, error, { retryDelayMs = 5000 } = {}) {
    const message = error instanceof Error ? error.message : String(error ?? "failed");
    const { rows: current } = await this.withClient((client) =>
      client.query(`SELECT * FROM platform_jobs WHERE id = $1`, [String(jobId)]),
    );
    const row = current[0];
    if (!row) return null;
    const exhausted = Number(row.attempt_count) >= Number(row.max_attempts);
    const status = exhausted ? "dead" : "failed";
    const delaySec = Math.max(1, Math.floor(Number(retryDelayMs) / 1000) || 5);
    const { rows } = await this.withClient((client) =>
      client.query(
        `UPDATE platform_jobs
         SET status = $2,
             error_message = $3,
             result = NULL,
             locked_at = NULL,
             locked_by = NULL,
             run_after = CASE WHEN $2 = 'failed' THEN NOW() + ($4 || ' seconds')::interval ELSE run_after END,
             updated_at = NOW(),
             completed_at = CASE WHEN $2 = 'dead' THEN NOW() ELSE NULL END
         WHERE id = $1
         RETURNING *`,
        [String(jobId), status, message, String(delaySec)],
      ),
    );
    const job = mapJobRow(rows[0]);
    if (job) await this._audit(job.id, job.businessId, status === "dead" ? "dead" : "failed", { message });
    return job;
  }

  async get(jobId) {
    const { rows } = await this.withClient((client) =>
      client.query(`SELECT * FROM platform_jobs WHERE id = $1`, [String(jobId)]),
    );
    return mapJobRow(rows[0]);
  }

  async listForBusiness(businessId, { status = null, limit = 50 } = {}) {
    const lim = Math.min(200, Math.max(1, Number(limit) || 50));
    if (status) {
      const { rows } = await this.withClient((client) =>
        client.query(
          `SELECT * FROM platform_jobs
           WHERE business_id = $1::uuid AND status = $2
           ORDER BY created_at DESC LIMIT $3`,
          [String(businessId), String(status), lim],
        ),
      );
      return rows.map((r) => mapJobRow(r));
    }
    const { rows } = await this.withClient((client) =>
      client.query(
        `SELECT * FROM platform_jobs
         WHERE business_id = $1::uuid
         ORDER BY created_at DESC LIMIT $2`,
        [String(businessId), lim],
      ),
    );
    return rows.map((r) => mapJobRow(r));
  }

  /**
   * Cancel pending/failed calendar reminder jobs for an event so reschedule can re-enqueue.
   */
  async cancelPendingByIdempotencyPrefix({ businessId, jobType, idempotencyPrefix }) {
    const prefix = String(idempotencyPrefix ?? "");
    if (!prefix) return { cancelled: 0 };
    const { rowCount } = await this.withClient((client) =>
      client.query(
        `UPDATE platform_jobs
         SET status = 'cancelled',
             updated_at = NOW(),
             completed_at = NOW(),
             locked_at = NULL,
             locked_by = NULL,
             idempotency_key = idempotency_key || ':cancelled:' || extract(epoch from now())::text
         WHERE business_id = $1::uuid
           AND job_type = $2
           AND status IN ('pending', 'failed')
           AND idempotency_key LIKE $3`,
        [String(businessId), String(jobType), `${prefix}%`],
      ),
    );
    return { cancelled: Number(rowCount ?? 0) };
  }

  async _audit(jobId, businessId, eventType, detail = {}) {
    await this.withClient((client) =>
      client.query(
        `INSERT INTO platform_job_audit (job_id, business_id, event_type, detail)
         VALUES ($1, $2::uuid, $3, $4::jsonb)`,
        [String(jobId), String(businessId), String(eventType), JSON.stringify(detail ?? {})],
      ),
    );
  }
}
