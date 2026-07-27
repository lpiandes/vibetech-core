/**
 * Durable job queue — Postgres-backed when store is available, in-memory for tests.
 * Important automations must not run only inside browser requests.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import crypto from "node:crypto";

export const JOB_TYPES = Object.freeze({
  WORKFLOW_STEP: "workflow_step",
  OUTBOUND_SEND: "outbound_send",
  FOLLOW_UP_CREATE: "follow_up_create",
  INTEGRATION_PROVE: "integration_prove",
  GOLDEN_PATH_STEP: "golden_path_step",
  SPECIALTY_SCHEDULE_DUE: "specialty_schedule_due",
  CALENDAR_REMINDER_DUE: "calendar_reminder_due",
});

export class InMemoryPlatformJobQueue {
  constructor({ nowISO = () => new Date().toISOString() } = {}) {
    this.nowISO = typeof nowISO === "function" ? nowISO : () => String(nowISO);
    this.jobs = [];
    this.audit = [];
  }

  async enqueue({
    businessId,
    jobType,
    idempotencyKey,
    payload = {},
    runAfter = null,
    maxAttempts = 5,
  }) {
    const key = String(idempotencyKey ?? crypto.randomUUID());
    const existing = this.jobs.find(
      (j) =>
        String(j.businessId) === String(businessId)
        && String(j.jobType) === String(jobType)
        && String(j.idempotencyKey) === key,
    );
    if (existing) {
      return deepFreeze({ ...existing, deduped: true });
    }

    const job = {
      id: crypto.randomUUID(),
      businessId: String(businessId),
      jobType: String(jobType),
      idempotencyKey: key,
      status: "pending",
      payload: deepFreeze(payload && typeof payload === "object" ? payload : {}),
      result: null,
      errorMessage: null,
      attemptCount: 0,
      maxAttempts: Number(maxAttempts) || 5,
      runAfter: runAfter || this.nowISO(),
      lockedAt: null,
      lockedBy: null,
      createdAt: this.nowISO(),
      updatedAt: this.nowISO(),
      completedAt: null,
      deduped: false,
    };
    this.jobs.push(job);
    this._audit(job, "enqueued", { jobType });
    return deepFreeze(job);
  }

  async claimNext({ workerId = "worker", jobTypes = null } = {}) {
    const now = this.nowISO();
    const types = Array.isArray(jobTypes) ? new Set(jobTypes.map(String)) : null;
    const idx = this.jobs.findIndex((j) => {
      if (j.status !== "pending" && !(j.status === "failed" && j.attemptCount < j.maxAttempts)) {
        return false;
      }
      if (types && !types.has(j.jobType)) return false;
      return String(j.runAfter) <= String(now);
    });
    if (idx === -1) return null;
    const job = { ...this.jobs[idx] };
    job.status = "running";
    job.attemptCount += 1;
    job.lockedAt = now;
    job.lockedBy = String(workerId);
    job.updatedAt = now;
    this.jobs[idx] = job;
    this._audit(job, "claimed", { workerId, attempt: job.attemptCount });
    return deepFreeze(job);
  }

  async complete(jobId, result = {}) {
    const idx = this.jobs.findIndex((j) => String(j.id) === String(jobId));
    if (idx === -1) throw new Error(`Job not found: ${jobId}`);
    const job = { ...this.jobs[idx] };
    job.status = "completed";
    job.result = deepFreeze(result);
    job.completedAt = this.nowISO();
    job.updatedAt = job.completedAt;
    job.lockedAt = null;
    job.lockedBy = null;
    this.jobs[idx] = job;
    this._audit(job, "completed", { result });
    return deepFreeze(job);
  }

  async fail(jobId, errorMessage) {
    const idx = this.jobs.findIndex((j) => String(j.id) === String(jobId));
    if (idx === -1) throw new Error(`Job not found: ${jobId}`);
    const job = { ...this.jobs[idx] };
    job.errorMessage = String(errorMessage ?? "failed");
    job.updatedAt = this.nowISO();
    job.lockedAt = null;
    job.lockedBy = null;
    if (job.attemptCount >= job.maxAttempts) {
      job.status = "dead";
      this._audit(job, "dead_letter", { errorMessage: job.errorMessage });
    } else {
      job.status = "failed";
      job.runAfter = this.nowISO();
      this._audit(job, "failed", { errorMessage: job.errorMessage, attempt: job.attemptCount });
    }
    this.jobs[idx] = job;
    return deepFreeze(job);
  }

  async listForBusiness(businessId, { status = null } = {}) {
    return deepFreeze(
      this.jobs
        .filter((j) => String(j.businessId) === String(businessId))
        .filter((j) => (status ? j.status === status : true))
        .map((j) => ({ ...j })),
    );
  }

  async cancelPendingByIdempotencyPrefix({ businessId, jobType, idempotencyPrefix }) {
    const prefix = String(idempotencyPrefix ?? "");
    let cancelled = 0;
    const now = this.nowISO();
    for (let i = 0; i < this.jobs.length; i += 1) {
      const j = this.jobs[i];
      if (String(j.businessId) !== String(businessId)) continue;
      if (String(j.jobType) !== String(jobType)) continue;
      if (j.status !== "pending" && j.status !== "failed") continue;
      if (!String(j.idempotencyKey).startsWith(prefix)) continue;
      this.jobs[i] = {
        ...j,
        status: "cancelled",
        completedAt: now,
        updatedAt: now,
        idempotencyKey: `${j.idempotencyKey}:cancelled:${Date.now()}`,
      };
      cancelled += 1;
    }
    return { cancelled };
  }

  getAudit(jobId) {
    return deepFreeze(this.audit.filter((a) => String(a.jobId) === String(jobId)));
  }

  _audit(job, eventType, detail = {}) {
    this.audit.push(
      deepFreeze({
        id: crypto.randomUUID(),
        jobId: job.id,
        businessId: job.businessId,
        eventType: String(eventType),
        detail: deepFreeze(detail),
        createdAt: this.nowISO(),
      }),
    );
  }
}

/**
 * Workflow executor: Meta lead → contact → pipeline → draft → wait approval → send → follow-up.
 * Outbound steps enqueue OUTBOUND_SEND and never send without outboundApproved.
 */
export class DurableWorkflowExecutor {
  constructor({
    queue,
    nowISO = () => new Date().toISOString(),
    sendOutbound = null,
    runSpecialtySchedule = null,
    runCalendarReminder = null,
  } = {}) {
    if (!queue) throw new Error("DurableWorkflowExecutor requires a job queue");
    this.queue = queue;
    this.nowISO = typeof nowISO === "function" ? nowISO : () => String(nowISO);
    this.sendOutbound = sendOutbound;
    this.runSpecialtySchedule = runSpecialtySchedule;
    this.runCalendarReminder = runCalendarReminder;
  }

  async startLeadIntakeWorkflow({
    businessId,
    leadId,
    contact = {},
    channel = "email",
    outboundApproved = false,
  }) {
    const idempotencyKey = `lead_intake:${leadId}`;
    const steps = [
      { step: "create_or_update_contact", contact },
      { step: "add_to_intake_pipeline" },
      { step: "assign_intake_specialist" },
      { step: "draft_reply", channel },
      { step: "wait_owner_approval" },
      { step: "send_approved", channel, outboundApproved },
      { step: "schedule_follow_up_if_no_response" },
    ];

    const root = await this.queue.enqueue({
      businessId,
      jobType: JOB_TYPES.WORKFLOW_STEP,
      idempotencyKey,
      payload: {
        workflowId: "lead_intake_v1",
        leadId: String(leadId),
        steps,
        stepIndex: 0,
        outcomes: [],
      },
    });

    return deepFreeze({
      ok: true,
      workflowId: "lead_intake_v1",
      jobId: root.id,
      deduped: Boolean(root.deduped),
    });
  }

  async processNext({ workerId = "workflow_worker" } = {}) {
    const job = await this.queue.claimNext({
      workerId,
      jobTypes: [
        JOB_TYPES.WORKFLOW_STEP,
        JOB_TYPES.OUTBOUND_SEND,
        JOB_TYPES.SPECIALTY_SCHEDULE_DUE,
        JOB_TYPES.CALENDAR_REMINDER_DUE,
      ],
    });
    if (!job) return null;

    try {
      if (job.jobType === JOB_TYPES.OUTBOUND_SEND) {
        return await this._processOutbound(job);
      }
      if (job.jobType === JOB_TYPES.SPECIALTY_SCHEDULE_DUE) {
        return await this._processSpecialtySchedule(job);
      }
      if (job.jobType === JOB_TYPES.CALENDAR_REMINDER_DUE) {
        return await this._processCalendarReminder(job);
      }
      return await this._processWorkflowStep(job);
    } catch (err) {
      await this.queue.fail(job.id, err instanceof Error ? err.message : String(err));
      return deepFreeze({ ok: false, jobId: job.id, error: String(err?.message ?? err) });
    }
  }

  async _processCalendarReminder(job) {
    if (typeof this.runCalendarReminder === "function") {
      const outcome = await this.runCalendarReminder(job);
      if (outcome?.ok === false) {
        await this.queue.fail(job.id, outcome.reason ?? outcome.error ?? "calendar_reminder_failed");
        return deepFreeze({ ok: false, jobId: job.id, ...outcome });
      }
      const completed = await this.queue.complete(job.id, {
        ...(outcome ?? {}),
        at: this.nowISO(),
      });
      return deepFreeze({ ok: true, jobId: completed.id, calendarReminder: true, ...(outcome ?? {}) });
    }
    const completed = await this.queue.complete(job.id, {
      skipped: true,
      reason: "calendar_reminder_handler_missing",
      at: this.nowISO(),
    });
    return deepFreeze({ ok: true, jobId: completed.id, skipped: true });
  }

  async _processSpecialtySchedule(job) {
    if (typeof this.runSpecialtySchedule === "function") {
      const outcome = await this.runSpecialtySchedule(job);
      if (outcome?.ok === false) {
        await this.queue.fail(job.id, outcome.reason ?? outcome.error ?? "specialty_schedule_failed");
        return deepFreeze({ ok: false, jobId: job.id, ...outcome });
      }
      const completed = await this.queue.complete(job.id, {
        ...(outcome ?? {}),
        at: this.nowISO(),
      });
      return deepFreeze({ ok: true, jobId: completed.id, specialtySchedule: true, ...(outcome ?? {}) });
    }
    // Without a handler, complete with a note so the job does not spin forever.
    const completed = await this.queue.complete(job.id, {
      skipped: true,
      reason: "specialty_schedule_handler_missing",
      at: this.nowISO(),
    });
    return deepFreeze({ ok: true, jobId: completed.id, skipped: true });
  }

  async _processOutbound(job) {
    const approved = Boolean(job.payload?.outboundApproved);
    if (!approved) {
      await this.queue.fail(job.id, "outbound_approval_required");
      return deepFreeze({
        ok: false,
        jobId: job.id,
        reason: "outbound_approval_required",
        note: "Never send without human GRANT",
      });
    }
    if (typeof this.sendOutbound === "function") {
      try {
        await this.sendOutbound(job.payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : "outbound_send_failed";
        await this.queue.fail(job.id, message);
        return deepFreeze({
          ok: false,
          jobId: job.id,
          reason: "outbound_send_failed",
          note: message,
        });
      }
    }
    const completed = await this.queue.complete(job.id, {
      sent: true,
      channel: job.payload?.channel ?? null,
      at: this.nowISO(),
    });
    return deepFreeze({ ok: true, jobId: completed.id, sent: true });
  }

  async _processWorkflowStep(job) {
    const steps = Array.isArray(job.payload?.steps) ? job.payload.steps : [];
    const stepIndex = Number(job.payload?.stepIndex ?? 0);
    const step = steps[stepIndex];
    if (!step) {
      const completed = await this.queue.complete(job.id, {
        outcomes: job.payload?.outcomes ?? [],
        finished: true,
      });
      return deepFreeze({ ok: true, jobId: completed.id, finished: true });
    }

    const outcomes = [...(job.payload?.outcomes ?? [])];

    if (step.step === "send_approved") {
      if (!step.outboundApproved) {
        outcomes.push({
          step: step.step,
          status: "waiting_approval",
          at: this.nowISO(),
        });
        const completed = await this.queue.complete(job.id, {
          outcomes,
          waitingApproval: true,
          nextStep: "send_approved",
        });
        return deepFreeze({
          ok: true,
          jobId: completed.id,
          waitingApproval: true,
          note: "Draft ready; outbound gated until GRANT",
        });
      }

      await this.queue.enqueue({
        businessId: job.businessId,
        jobType: JOB_TYPES.OUTBOUND_SEND,
        idempotencyKey: `outbound:${job.payload?.leadId}:${step.channel}`,
        payload: {
          channel: step.channel,
          outboundApproved: true,
          leadId: job.payload?.leadId,
          workflowJobId: job.id,
        },
      });
      outcomes.push({ step: step.step, status: "queued_send", at: this.nowISO() });
    } else if (step.step === "wait_owner_approval") {
      outcomes.push({ step: step.step, status: "recorded", at: this.nowISO() });
    } else {
      outcomes.push({ step: step.step, status: "completed", at: this.nowISO() });
    }

    const nextIndex = stepIndex + 1;
    if (nextIndex < steps.length && step.step !== "send_approved") {
      await this.queue.enqueue({
        businessId: job.businessId,
        jobType: JOB_TYPES.WORKFLOW_STEP,
        idempotencyKey: `${job.idempotencyKey}:step:${nextIndex}`,
        payload: {
          ...job.payload,
          stepIndex: nextIndex,
          outcomes,
        },
      });
    } else if (nextIndex < steps.length && step.step === "send_approved" && step.outboundApproved) {
      await this.queue.enqueue({
        businessId: job.businessId,
        jobType: JOB_TYPES.WORKFLOW_STEP,
        idempotencyKey: `${job.idempotencyKey}:step:${nextIndex}`,
        payload: {
          ...job.payload,
          stepIndex: nextIndex,
          outcomes,
        },
      });
    }

    const completed = await this.queue.complete(job.id, { outcomes, step: step.step });
    return deepFreeze({ ok: true, jobId: completed.id, step: step.step, outcomes });
  }
}
