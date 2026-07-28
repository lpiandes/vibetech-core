/**
 * HighLevel/Zapier-style workflow runner.
 * Evaluates conditions (AND/OR), runs actions, can chain into other workflows.
 */
import crypto from "node:crypto";
import {
  readWorkflowState,
  listLiveWorkflowsForEvent,
  TRIGGER_TYPES,
} from "./WorkflowAutomationStore.js";
import {
  ensureCrmContactAndOptionalCard,
  findContact,
} from "../crm/ensureCrmContactAndOptionalCard.js";
import {
  readCrmState,
  writeCrmState,
  upsertContact,
} from "../crm/CrmStore.js";

function getByPath(root, path) {
  const parts = String(path || "").split(".").filter(Boolean);
  let cur = root;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function toStr(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(String).join(",");
  return String(v);
}

export function evaluateRule(rule, ctx) {
  const actual = getByPath(ctx, rule.field);
  const op = String(rule.op || "equals");
  const expected = rule.value;

  switch (op) {
    case "exists":
      if (Array.isArray(actual)) return actual.length > 0;
      return actual !== undefined && actual !== null && String(actual).trim() !== "";
    case "not_exists":
      if (Array.isArray(actual)) return actual.length === 0;
      return actual === undefined || actual === null || String(actual).trim() === "";
    case "contains": {
      const hay = toStr(actual).toLowerCase();
      return hay.includes(toStr(expected).toLowerCase());
    }
    case "in": {
      const list = Array.isArray(expected)
        ? expected.map((x) => toStr(x).toLowerCase())
        : toStr(expected).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
      if (Array.isArray(actual)) {
        return actual.some((a) => list.includes(toStr(a).toLowerCase()));
      }
      return list.includes(toStr(actual).toLowerCase());
    }
    case "not_equals":
      return toStr(actual).toLowerCase() !== toStr(expected).toLowerCase();
    case "equals":
    default:
      if (Array.isArray(actual)) {
        return actual.some((a) => toStr(a).toLowerCase() === toStr(expected).toLowerCase());
      }
      return toStr(actual).toLowerCase() === toStr(expected).toLowerCase();
  }
}

export function evaluateConditionStep(step, ctx) {
  const rules = Array.isArray(step.rules) ? step.rules : [];
  if (!rules.length) return true;
  const logic = String(step.logic || "and").toLowerCase();
  if (logic === "or") return rules.some((r) => evaluateRule(r, ctx));
  return rules.every((r) => evaluateRule(r, ctx));
}

function buildContext(payload = {}, installation = null) {
  let contact = payload.contact && typeof payload.contact === "object"
    ? payload.contact
    : {
      id: payload.contactId ?? null,
      name: payload.name ?? "",
      email: payload.email ?? "",
      phone: payload.phone ?? "",
      kind: payload.kind ?? "lead",
      tags: payload.tags ?? [],
      notes: payload.notes ?? "",
    };

  // Hydrate contact from CrmStore when only contactId is present
  if ((!contact.name && !contact.email) && (payload.contactId || contact.id) && installation) {
    try {
      const crm = readCrmState(installation);
      const found = findContact(crm, { id: payload.contactId || contact.id });
      if (found) contact = found;
    } catch {
      /* optional */
    }
  }

  return {
    contact,
    pipeline: payload.pipeline && typeof payload.pipeline === "object"
      ? payload.pipeline
      : {
        id: payload.pipelineId ?? null,
        name: payload.pipelineName ?? "",
        stageId: payload.stageId ?? null,
        stageLabel: payload.stageLabel ?? "",
      },
    source: payload.source ?? payload.eventType ?? "",
    eventType: payload.eventType ?? "",
    payload,
  };
}

/**
 * Execute a list of steps (actions + nested conditions).
 */
export async function executeSteps({
  steps,
  ctx,
  env,
  log,
  depth = 0,
}) {
  const list = Array.isArray(steps) ? steps : [];
  for (const step of list) {
    if (!step) continue;
    if (step.type === "condition") {
      const pass = evaluateConditionStep(step, ctx);
      log.push({ stepId: step.id, type: "condition", passed: pass });
      await executeSteps({
        steps: pass ? step.thenSteps : step.elseSteps,
        ctx,
        env,
        log,
        depth,
      });
      continue;
    }
    if (step.type === "action") {
      const result = await executeAction({ step, ctx, env, depth });
      log.push({ stepId: step.id, type: "action", action: step.action, ...result });
      if (result.ctx) Object.assign(ctx, result.ctx);
    }
  }
}

async function executeAction({ step, ctx, env, depth }) {
  const action = String(step.action || "");
  const params = step.params || {};

  switch (action) {
    case "tag_contact": {
      const tags = Array.isArray(params.tags)
        ? params.tags.map(String)
        : String(params.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
      if (!ctx.contact?.id && !ctx.contact?.email) {
        return { ok: false, reason: "no_contact" };
      }
      let crm = readCrmState(env.installation);
      const existing = findContact(crm, ctx.contact) || ctx.contact;
      const mergedTags = [...new Set([...(existing.tags || []), ...tags])];
      const ensured = ensureCrmContactAndOptionalCard(crm, {
        contact: { ...existing, tags: mergedTags },
        addToPipeline: false,
      });
      await writeCrmState({
        platformStore: env.platformStore,
        installation: env.installation,
        crm: ensured.crm,
        actorId: env.actorId,
      });
      env.installation = {
        ...env.installation,
        configuration: { ...(env.installation.configuration || {}), crm: ensured.crm },
      };
      return { ok: true, tags: mergedTags, ctx: { contact: ensured.contact } };
    }

    case "update_contact": {
      if (!ctx.contact?.id && !ctx.contact?.email) return { ok: false, reason: "no_contact" };
      let crm = readCrmState(env.installation);
      const existing = findContact(crm, ctx.contact) || ctx.contact;
      const patch = {
        ...existing,
        kind: params.kind || existing.kind,
        notes: params.notes != null
          ? [existing.notes, params.notes].filter(Boolean).join("\n")
          : existing.notes,
        ownerUserId: params.ownerUserId !== undefined ? params.ownerUserId : existing.ownerUserId,
      };
      if (params.name) patch.name = params.name;
      const ensured = ensureCrmContactAndOptionalCard(crm, {
        contact: patch,
        addToPipeline: false,
      });
      await writeCrmState({
        platformStore: env.platformStore,
        installation: env.installation,
        crm: ensured.crm,
        actorId: env.actorId,
      });
      env.installation = {
        ...env.installation,
        configuration: { ...(env.installation.configuration || {}), crm: ensured.crm },
      };
      return { ok: true, ctx: { contact: ensured.contact } };
    }

    case "add_to_pipeline": {
      let crm = readCrmState(env.installation);
      const existing = findContact(crm, ctx.contact) || {
        name: ctx.contact?.name || "Automation lead",
        email: ctx.contact?.email || "",
        phone: ctx.contact?.phone || "",
        kind: ctx.contact?.kind || "lead",
        id: ctx.contact?.id,
      };
      const ensured = ensureCrmContactAndOptionalCard(crm, {
        contact: existing,
        addToPipeline: true,
        pipelineId: params.pipelineId || null,
        stageId: params.stageId || null,
        cardTitle: params.title || existing.name || "Opportunity",
        skipExistingCard: params.skipExisting !== false,
      });
      await writeCrmState({
        platformStore: env.platformStore,
        installation: env.installation,
        crm: ensured.crm,
        actorId: env.actorId,
      });
      env.installation = {
        ...env.installation,
        configuration: { ...(env.installation.configuration || {}), crm: ensured.crm },
      };
      return {
        ok: true,
        cardId: ensured.cardId,
        ctx: { contact: ensured.contact },
      };
    }

    case "create_work":
    case "notify_team": {
      const title = String(
        params.title
          || (action === "notify_team" ? `Alert: ${ctx.contact?.name || "automation"}` : "Follow up"),
      );
      const brief = String(
        params.brief
          || [
            action === "notify_team" ? "Automation notification." : "Automation created this work.",
            ctx.contact?.name ? `Contact: ${ctx.contact.name}` : null,
            ctx.contact?.email ? `Email: ${ctx.contact.email}` : null,
          ].filter(Boolean).join("\n"),
      );
      if (typeof env.createWork === "function") {
        const work = await env.createWork({ title, brief, contactId: ctx.contact?.id, params });
        return { ok: true, workId: work?.id ?? work?.workId ?? null };
      }
      if (env.workRuntime?.applyEvent) {
        const now = new Date().toISOString();
        const workId = `wi_auto_${crypto.randomUUID().slice(0, 10)}`;
        const queues = typeof env.workRuntime.getQueues === "function"
          ? env.workRuntime.getQueues()
          : [];
        const stages = typeof env.workRuntime.getStages === "function"
          ? env.workRuntime.getStages()
          : [];
        const queueId = String(
          params.queueId
          || queues.find((q) => String(q.id) === "queue_needs_review")?.id
          || queues[0]?.id
          || "queue_needs_review",
        );
        const stageId = String(
          params.stageId
          || stages.find((s) => String(s.id) === "stage_intake")?.id
          || stages[0]?.id
          || "stage_intake",
        );
        try {
          env.workRuntime.applyEvent({
            id: `evt_${workId}`,
            timestampISO: now,
            type: "WORK_ITEM_CREATED",
            source: "workflow_automation",
            payload: {
              workItem: {
                id: workId,
                title,
                description: brief,
                workType: action === "notify_team" ? "notification" : "follow_up",
                status: "new",
                priority: String(params.priority || "normal"),
                stageId,
                queueId,
                assignedTo: String(params.assignedTo || env.actorId || "owner"),
                requestedBy: String(env.actorId || "automation"),
                source: "workflow_automation",
                dueAt: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
                blockedReason: null,
                relatedObjects: ctx.contact?.id ? [{ type: "contact", id: ctx.contact.id }] : [],
                requirements: [],
                metadata: {
                  automation: true,
                  contactId: ctx.contact?.id ?? null,
                  action,
                },
              },
            },
          });
          return { ok: true, workId };
        } catch (err) {
          return {
            ok: true,
            simulated: true,
            title,
            brief,
            reason: String(err?.message ?? err),
          };
        }
      }
      return { ok: true, simulated: true, title, brief };
    }

    case "run_workflow": {
      if (depth >= 5) return { ok: false, reason: "max_chain_depth" };
      const targetId = String(params.workflowId || "").trim();
      if (!targetId) return { ok: false, reason: "workflowId_required" };
      const state = readWorkflowState(env.installation);
      const target = (state.workflows || []).find((w) => String(w.id) === targetId);
      if (!target) return { ok: false, reason: "workflow_not_found" };
      if (String(target.status) !== "live" && !params.force) {
        return { ok: false, reason: "workflow_not_live" };
      }
      const nested = await runSingleWorkflow({
        workflow: target,
        payload: { ...ctx.payload, contact: ctx.contact, pipeline: ctx.pipeline, eventType: "CHAINED" },
        env,
        depth: depth + 1,
      });
      return { ok: true, chained: targetId, nested };
    }

    default:
      return { ok: false, reason: `unknown_action:${action}` };
  }
}

export async function runSingleWorkflow({ workflow, payload, env, depth = 0 }) {
  const ctx = buildContext(
    { ...payload, eventType: payload.eventType || workflow.trigger?.eventType },
    env.installation,
  );
  const log = [];
  // Optional trigger config filter (e.g. only when stage matches)
  const cfg = workflow.trigger?.config || {};
  if (cfg.stageId) {
    if (!ctx.pipeline?.stageId || String(cfg.stageId) !== String(ctx.pipeline.stageId)) {
      return { ok: true, skipped: true, reason: "trigger_stage_mismatch", log };
    }
  }
  if (cfg.pipelineId) {
    if (!ctx.pipeline?.id || String(cfg.pipelineId) !== String(ctx.pipeline.id)) {
      return { ok: true, skipped: true, reason: "trigger_pipeline_mismatch", log };
    }
  }

  await executeSteps({
    steps: workflow.steps,
    ctx,
    env,
    log,
    depth,
  });
  return { ok: true, workflowId: workflow.id, name: workflow.name, log };
}

/**
 * Map specialty / product event types onto workflow triggers and run live workflows.
 */
export async function runWorkflowsForEvent({
  platformStore,
  installation,
  eventType,
  payload = {},
  actorId = "automation",
  workRuntime = null,
  createWork = null,
  maxWorkflows = 25,
} = {}) {
  if (!platformStore || !installation) {
    return { ok: false, reason: "missing_installation", ran: [] };
  }

  // Refresh installation from store when possible
  let install = installation;
  try {
    const fresh = await platformStore.getBusinessOSInstallation(installation.businessId);
    if (fresh) install = fresh;
  } catch {
    /* use provided */
  }

  const state = readWorkflowState(install);
  const type = String(eventType || "").trim();
  // Also accept trigger ids
  const trigger = TRIGGER_TYPES.find((t) => t.eventType === type || t.id === type);
  const matchType = trigger?.eventType || type;

  const workflows = listLiveWorkflowsForEvent(state, matchType).slice(0, maxWorkflows);
  const env = {
    platformStore,
    installation: install,
    actorId,
    workRuntime,
    createWork,
  };

  const ran = [];
  for (const wf of workflows) {
    try {
      const result = await runSingleWorkflow({
        workflow: wf,
        payload: { ...payload, eventType: matchType },
        env,
      });
      ran.push(result);
      // keep installation pointer updated after CRM writes
      install = env.installation;
      env.installation = install;
    } catch (err) {
      ran.push({
        ok: false,
        workflowId: wf.id,
        name: wf.name,
        error: String(err?.message ?? err),
      });
    }
  }

  return {
    ok: true,
    eventType: matchType,
    matched: workflows.length,
    ran,
  };
}

/** Emit helper used by APIs after CRM mutations */
export async function emitWorkflowEvent({
  platformStore,
  installation,
  eventType,
  payload,
  actorId,
  workRuntime,
  createWork,
}) {
  return runWorkflowsForEvent({
    platformStore,
    installation,
    eventType,
    payload,
    actorId,
    workRuntime,
    createWork,
  });
}
