import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { WORK_CREATION_ACTION_TYPE, WORK_CREATION_EVENT_SOURCE } from "./WorkCreationDefaults.js";

import { deterministicWorkEventId, mapWorkItemInputToWorkItemCreatedEvent } from "./WorkCreationMapper.js";

import { validateWorkCreationInputs, validateWorkItemCreatedEvent } from "./WorkCreationValidator.js";

function fail(message) {
  throw new Error(`WorkCreationService: ${message}`);
}

function isErrorLike(err) {
  return Boolean(err) && typeof err === "object" && ("message" in err || "name" in err);
}

function toErrorMessage(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (isErrorLike(err)) return String(err.message ?? err.name);
  return String(err);
}

export class WorkCreationService {
  createWorkItem({ workRuntime, workItemInput, requestConvertedEventId, convertedAtISO } = {}) {
    const errors = [];
    try {
      validateWorkCreationInputs({ workRuntime, workItemInput });
    } catch (err) {
      errors.push(toErrorMessage(err));
      return deepFreeze({
        created: false,
        workItemId: workItemInput?.id ? String(workItemInput.id) : null,
        workEventId: null,
        status: "FAILED",
        workRuntimeUpdated: false,
        errors: deepFreeze(errors),
        metadata: deepFreeze({ derivedFrom: { actionType: WORK_CREATION_ACTION_TYPE, source: WORK_CREATION_EVENT_SOURCE } }),
      });
    }

    const workEventId = deterministicWorkEventId({
      workItemId: String(workItemInput.id),
      requestConvertedEventId: requestConvertedEventId ?? "req_conv",
    });

    const timestampISO = convertedAtISO ? String(convertedAtISO) : String(workItemInput.createdAt);

    const workEvent = mapWorkItemInputToWorkItemCreatedEvent({
      workItemInput,
      workEventId,
      timestampISO,
    });

    validateWorkItemCreatedEvent(workEvent);

    // Apply only via WorkRuntime.applyEvent().
    let before = null;
    try {
      before = workRuntime.getWorkItem(String(workItemInput.id));
    } catch (err) {
      before = null;
    }

    try {
      workRuntime.applyEvent(workEvent);
    } catch (err) {
      errors.push(toErrorMessage(err));
      return deepFreeze({
        created: false,
        workItemId: String(workItemInput.id),
        workEventId,
        status: "FAILED",
        workRuntimeUpdated: false,
        errors: deepFreeze(errors),
        metadata: deepFreeze({ derivedFrom: { workEventId } }),
      });
    }

    const createdItem = workRuntime.getWorkItem(String(workItemInput.id));
    const created = Boolean(createdItem) && !before;

    return deepFreeze({
      created,
      workItemId: String(workItemInput.id),
      workEventId,
      status: created ? "SUCCESS" : "FAILED",
      workRuntimeUpdated: true,
      errors: deepFreeze([]),
      metadata: deepFreeze({ derivedFrom: { actionType: WORK_CREATION_ACTION_TYPE } }),
    });
  }
}

