import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import {
  APPROVAL_INTERNAL_EVENT_TYPES as INTERNAL_TYPES,
  APPROVAL_REQUEST_STATUSES,
} from "./ApprovalEventTypes.js";

import { createApprovalRequest } from "./ApprovalRequest.js";
import { computeApprovalMetrics } from "./ApprovalMetrics.js";

function fail(message) {
  throw new Error(`ApprovalEventEngine: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

function safeClone(arr) {
  return Array.isArray(arr) ? [...arr] : [];
}

function findById(items, id) {
  return items.find((x) => String(x?.id) === String(id)) ?? null;
}

function findIndexById(items, id) {
  return items.findIndex((x) => String(x?.id) === String(id));
}

export class ApprovalEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) fail("ApprovalEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    if (!event || typeof event !== "object") fail("event required.");
    requireString(event.id, "event.id");
    requireString(event.timestampISO, "event.timestampISO");
    requireString(event.type, "event.type");
    if (!isPlainObject(event.payload)) fail("event.payload required.");

    const prev = this.runtime._state;
    let requests = safeClone(prev.requests);
    const payload = event.payload;
    const type = String(event.type);

    switch (type) {
      case INTERNAL_TYPES.APPROVAL_REQUESTED: {
        const request = payload.request;
        if (!request || typeof request !== "object") fail("request required.");
        const built = createApprovalRequest(request);
        if (findById(requests, built.id)) {
          throw new Error(`APPROVAL_REQUESTED: request already exists: ${String(built.id)}`);
        }
        requests.push(built);
        break;
      }

      case INTERNAL_TYPES.APPROVAL_GRANTED: {
        const approvalId = payload.approvalId;
        requireString(String(approvalId ?? ""), "payload.approvalId");
        const idx = findIndexById(requests, approvalId);
        if (idx === -1) fail(`APPROVAL_GRANTED: request not found: ${String(approvalId)}`);
        if (String(requests[idx].status) !== APPROVAL_REQUEST_STATUSES.PENDING) {
          throw new Error(`APPROVAL_GRANTED: request not pending: ${String(approvalId)}`);
        }
        requests[idx] = createApprovalRequest({
          ...requests[idx],
          status: APPROVAL_REQUEST_STATUSES.GRANTED,
          decision: payload.decision ?? "granted",
          decidedAt: payload.decidedAt ?? event.timestampISO,
        });
        break;
      }

      case INTERNAL_TYPES.APPROVAL_REJECTED: {
        const approvalId = payload.approvalId;
        requireString(String(approvalId ?? ""), "payload.approvalId");
        const idx = findIndexById(requests, approvalId);
        if (idx === -1) fail(`APPROVAL_REJECTED: request not found: ${String(approvalId)}`);
        if (String(requests[idx].status) !== APPROVAL_REQUEST_STATUSES.PENDING) {
          throw new Error(`APPROVAL_REJECTED: request not pending: ${String(approvalId)}`);
        }
        requests[idx] = createApprovalRequest({
          ...requests[idx],
          status: APPROVAL_REQUEST_STATUSES.REJECTED,
          decision: payload.decision ?? "rejected",
          decidedAt: payload.decidedAt ?? event.timestampISO,
        });
        break;
      }

      case INTERNAL_TYPES.APPROVAL_CANCELLED: {
        const approvalId = payload.approvalId;
        requireString(String(approvalId ?? ""), "payload.approvalId");
        const idx = findIndexById(requests, approvalId);
        if (idx === -1) fail(`APPROVAL_CANCELLED: request not found: ${String(approvalId)}`);
        if (String(requests[idx].status) !== APPROVAL_REQUEST_STATUSES.PENDING) {
          throw new Error(`APPROVAL_CANCELLED: request not pending: ${String(approvalId)}`);
        }
        requests[idx] = createApprovalRequest({
          ...requests[idx],
          status: APPROVAL_REQUEST_STATUSES.CANCELLED,
          decision: payload.decision ?? "cancelled",
          decidedAt: payload.decidedAt ?? event.timestampISO,
        });
        break;
      }

      default:
        throw new Error(`ApprovalEventEngine: Unhandled event type: ${type}`);
    }

    this.runtime._state = deepFreeze({
      requests: deepFreeze(requests),
      metrics: computeApprovalMetrics({ requests }),
    });
  }
}
