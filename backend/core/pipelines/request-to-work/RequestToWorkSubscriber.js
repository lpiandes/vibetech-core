import { REQUEST_TO_WORK_ACTION_TYPES, DEFAULT_WORK_QUEUE_ID } from "./RequestToWorkDefaults.js";
import { mapRequestConvertedToWorkItemInput } from "./RequestToWorkMapper.js";
import { validateRequestConvertedEvent } from "./RequestToWorkValidator.js";
import { WorkCreationService } from "./WorkCreationService.js";

function fail(message) {
  throw new Error(`RequestToWorkSubscriber: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Bus-compatible handler.
 * Returns an object with { status, message, actions, errors, metadata }.
 *
 * IMPORTANT:
 * - Never mutates RequestRuntime.
 * - Only applies to WorkRuntime if explicitly provided in `context.workRuntime`.
 */
export function requestToWorkHandle(event, context = {}) {
  const result = validateRequestConvertedEvent(event);
  if (!result.ok && result.skipped) {
    return { status: "SKIPPED", message: "", actions: [], errors: result.errors ?? [], metadata: {} };
  }
  if (!result.ok) {
    return { status: "FAILED", message: "Invalid REQUEST_CONVERTED payload.", actions: [], errors: result.errors ?? [], metadata: {} };
  }

  const payload = event.payload;
  const requestId = String(payload.requestId);

  // Deterministically map payload -> WorkItemInput.
  const workItemInput = mapRequestConvertedToWorkItemInput(payload);

  const action = {
    id: `act_create_work_item_${requestId}`,
    type: REQUEST_TO_WORK_ACTION_TYPES.CREATE_WORK_ITEM,
    payload: { workItemInput },
    // Keep priority deterministic; immediate because conversion is a lifecycle transition.
    priority: "immediate",
    metadata: { derivedFrom: { requestId } },
  };

  // If WorkRuntime exists in context, apply WORK_ITEM_CREATED.
  const workRuntime = context.workRuntime;
  if (workRuntime && typeof workRuntime.applyEvent === "function") {
    const service = new WorkCreationService();
    const created = service.createWorkItem({
      workRuntime,
      workItemInput,
      requestConvertedEventId: String(event?.eventId ?? "req_conv"),
      convertedAtISO: String(payload.convertedAt),
    });

    if (created.status !== "SUCCESS") {
      return {
        status: "FAILED",
        message: "Failed to create work item in WorkRuntime.",
        actions: [action],
        errors: Array.isArray(created.errors) && created.errors.length ? created.errors : ["Work creation failed."],
        metadata: { derivedFrom: { requestId, workItemId: String(workItemInput.id) } },
      };
    }
  } else if (workRuntime !== undefined) {
    // Context provided but invalid; treat as failed (deterministic).
    return {
      status: "FAILED",
      message: "context.workRuntime must be a runtime with applyEvent().",
      actions: [action],
      errors: ["Missing or invalid workRuntime.applyEvent()"],
      metadata: {},
    };
  }

  return {
    status: "SUCCESS",
    message: "Deterministic work item creation action prepared.",
    actions: [action],
    errors: [],
    metadata: { derivedFrom: { requestId }, queueId: workItemInput.queueId ?? DEFAULT_WORK_QUEUE_ID },
  };
}

