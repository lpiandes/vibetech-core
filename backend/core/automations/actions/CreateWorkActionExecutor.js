import { WorkCreationService } from "../../pipelines/request-to-work/WorkCreationService.js";

import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { DEFAULT_WORK_ITEM_STATUS } from "../../pipelines/request-to-work/RequestToWorkDefaults.js";
import { AUTOMATION_ACTION_TYPES } from "../AutomationAction.js";
import {
  ACTION_EXECUTION_STATUSES,
  createAutomationActionExecutionResult,
} from "./AutomationActionExecutionResult.js";

function fail(message) {
  throw new Error(`CreateWorkActionExecutor: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

function uniqRelatedObjects(relatedObjects) {
  const arr = Array.isArray(relatedObjects) ? relatedObjects : [];
  const seen = new Set();
  const out = [];
  for (const o of arr) {
    const k = JSON.stringify(o);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

export class CreateWorkActionExecutor {
  static actionType = AUTOMATION_ACTION_TYPES.CREATE_WORK;

  constructor({ workCreationService, workPlatformEventPublisher } = {}) {
    this.workCreationService = workCreationService ?? new WorkCreationService();
    this.workPlatformEventPublisher = workPlatformEventPublisher;
  }

  get actionType() {
    return CreateWorkActionExecutor.actionType;
  }

  validatePlan({ action } = {}) {
    if (!action || typeof action !== "object") fail("action required.");
    if (String(action.actionType) !== AUTOMATION_ACTION_TYPES.CREATE_WORK) {
      fail(`unsupported actionType: ${String(action.actionType)}`);
    }

    const params = action.parameters ?? {};
    requireString(String(params.workItemId ?? "").trim(), "parameters.workItemId");
    requireString(String(params.title ?? ""), "parameters.title");
    requireString(String(params.description ?? ""), "parameters.description");
    requireString(String(params.workType ?? ""), "parameters.workType");
    requireString(String(params.priority ?? ""), "parameters.priority");
    requireString(String(params.assignedTo ?? ""), "parameters.assignedTo");
    requireString(String(params.stageId ?? ""), "parameters.stageId");
    requireString(String(params.queueId ?? ""), "parameters.queueId");

    return { ok: true };
  }

  execute({ action, context } = {}) {
    this.validatePlan({ action });

    if (!context || typeof context !== "object") fail("context required.");
    const workRuntime = context.workRuntime;
    if (!workRuntime) fail("context.workRuntime required.");
    if (!this.workPlatformEventPublisher) {
      fail("CreateWorkActionExecutor requires workPlatformEventPublisher for WORK_CREATED publication.");
    }

    const params = action.parameters ?? {};
    const workItemId = String(params.workItemId ?? "").trim();
    const nowISO = String(context.nowISO ?? "2026-07-01T00:00:00.000Z");
    const startedAt = nowISO;

    const existing = workRuntime.getWorkItem?.(workItemId) ?? null;
    if (existing) {
      return createAutomationActionExecutionResult({
        actionId: String(action.id),
        actionType: String(action.actionType),
        status: ACTION_EXECUTION_STATUSES.COMPLETED,
        startedAt,
        completedAt: nowISO,
        output: deepFreeze({ created: false, workItemId }),
        metadata: deepFreeze({ derivedFrom: { automationActionId: String(action.id) } }),
      });
    }

    const title = String(params.title);
    const description = String(params.description);
    const workType = String(params.workType);
    const priority = String(params.priority);
    const assignedTo = String(params.assignedTo);
    const dueAt = params.dueAt === null || params.dueAt === undefined ? null : String(params.dueAt);
    const relatedObjects = uniqRelatedObjects(Array.isArray(params.relatedObjects) ? params.relatedObjects : []);
    const stageId = String(params.stageId);
    const queueId = String(params.queueId);
    const status = String(params.status ?? DEFAULT_WORK_ITEM_STATUS ?? "new");

    const workItemInput = {
      id: workItemId,
      title,
      description,
      workType,
      status,
      priority,
      stageId,
      queueId,
      assignedTo,
      requestedBy: String(params.requestedBy ?? "tm_system"),
      source: String(params.source ?? "automation"),
      dueAt: dueAt === null ? null : dueAt,
      completedAt: null,
      blockedReason: null,
      relatedObjects,
      requirements: [],
      createdAt: nowISO,
      updatedAt: nowISO,
      metadata: isPlainObject(params.metadata) ? params.metadata : {},
    };

    const triggerEventId = String(context.triggerEventId ?? "evt_unknown");

    const created = this.workCreationService.createWorkItem({
      workRuntime,
      workItemInput,
      requestConvertedEventId: triggerEventId,
      convertedAtISO: nowISO,
    });

    if (created.status !== "SUCCESS") {
      return createAutomationActionExecutionResult({
        actionId: String(action.id),
        actionType: String(action.actionType),
        status: ACTION_EXECUTION_STATUSES.FAILED,
        startedAt,
        completedAt: nowISO,
        error: (created.errors ?? [created?.message ?? "Work creation failed."]).join("; "),
        metadata: deepFreeze({ derivedFrom: { workEventId: created.workEventId ?? null, workItemId } }),
      });
    }

    const createdWorkItem = workRuntime.getWorkItem(workItemId);
    const publishRes = this.workPlatformEventPublisher.publishWorkCreated({
      workRuntime,
      workCreatedEvent: null,
      createdWorkItem,
      createdAtISO: nowISO,
      metadata: deepFreeze({ derivedFrom: { actionType: action.actionType, source: "automation_engine" } }),
    });

    const published = String(publishRes?.status ?? "PUBLISHED") === "PUBLISHED";
    return createAutomationActionExecutionResult({
      actionId: String(action.id),
      actionType: String(action.actionType),
      status: published ? ACTION_EXECUTION_STATUSES.COMPLETED : ACTION_EXECUTION_STATUSES.FAILED,
      startedAt,
      completedAt: nowISO,
      output: deepFreeze({ created: true, workItemId }),
      error: published ? null : (publishRes?.errors ?? ["WORK_CREATED publication failed."]).join("; "),
      metadata: deepFreeze({ derivedFrom: { automationActionType: action.actionType } }),
    });
  }
}
