import {
  REQUEST_EVENT_TYPES,
  SUPPORTED_REQUEST_EVENT_TYPES,
} from "./RequestEventTypes.js";

import { createRequest } from "./Request.js";
import { computeRequestMetrics } from "./RequestMetrics.js";

import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") {
    throw new Error(`RequestEventEngine: expected ${name} to be a string.`);
  }
}

function safeClone(arr) {
  return Array.isArray(arr) ? [...arr] : [];
}

function findIndexById(items, id) {
  const sid = String(id);
  return items.findIndex((x) => String(x?.id) === sid);
}

// Guard immutability invariants: identity + lifecycle timestamps are not patchable here.
const REQUEST_UPDATED_PATCH_ALLOWED_KEYS = new Set([
  "title",
  "description",
  "requestType",
  "priority",
  "channel",
  "source",
  "requester",
  "dueAt",
  "assignedWorkId",
  "assignedTeamMemberId",
  "qualificationStatus",
  "attachments",
  "metadata",
  "inboundAttribution",
  "subjectRefs",
]);

export class RequestEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("RequestEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    if (!event || typeof event !== "object") throw new Error("RequestEventEngine: event must be an object.");
    requireString(event.id, "event.id");
    requireString(event.timestampISO, "event.timestampISO");
    requireString(event.type, "event.type");
    requireString(event.source, "event.source");

    if (!isPlainObject(event.payload)) throw new Error("RequestEventEngine: event.payload must be a plain object.");
    if (!SUPPORTED_REQUEST_EVENT_TYPES.includes(event.type)) {
      throw new Error(`RequestEventEngine: Unsupported event type: ${event.type}`);
    }

    const prev = this.runtime._state;
    let requests = safeClone(prev.requests);

    const payload = event.payload;

    switch (event.type) {
      case REQUEST_EVENT_TYPES.REQUEST_RECEIVED: {
        const { request } = payload;
        if (!isPlainObject(request)) throw new Error("REQUEST_RECEIVED: payload.request required.");

        const created = createRequest({
          ...request,
          status: "received",
          receivedAt: request.receivedAt ?? event.timestampISO,
        });

        if (requests.some((r) => String(r.id) === String(created.id))) {
          throw new Error("REQUEST_RECEIVED: request already exists.");
        }
        requests.push(created);
        break;
      }

      case REQUEST_EVENT_TYPES.REQUEST_UPDATED: {
        const { requestId, patch } = payload;
        requireString(requestId, "payload.requestId");
        if (!isPlainObject(patch)) throw new Error("REQUEST_UPDATED: payload.patch must be a plain object.");

        // Disallow patching identity and lifecycle timestamps/status.
        for (const k of Object.keys(patch)) {
          if (!REQUEST_UPDATED_PATCH_ALLOWED_KEYS.has(k)) {
            throw new Error(`REQUEST_UPDATED: patch key not allowed: ${k}`);
          }
        }

        const idx = findIndexById(requests, requestId);
        if (idx === -1) throw new Error("REQUEST_UPDATED: request does not exist.");

        const prevReq = requests[idx];
        const merged = { ...prevReq, ...patch, id: prevReq.id, receivedAt: prevReq.receivedAt, status: prevReq.status };
        requests[idx] = createRequest(merged);
        break;
      }

      case REQUEST_EVENT_TYPES.REQUEST_QUALIFIED: {
        const { requestId, qualificationStatus } = payload;
        requireString(requestId, "payload.requestId");

        const idx = findIndexById(requests, requestId);
        if (idx === -1) throw new Error("REQUEST_QUALIFIED: request does not exist.");

        const prevReq = requests[idx];
        requests[idx] = createRequest({
          ...prevReq,
          status: "qualified",
          qualificationStatus:
            qualificationStatus === undefined
              ? prevReq.qualificationStatus
              : qualificationStatus === null
                ? null
                : String(qualificationStatus),
        });
        break;
      }

      case REQUEST_EVENT_TYPES.REQUEST_REJECTED: {
        const { requestId, qualificationStatus } = payload;
        requireString(requestId, "payload.requestId");

        const idx = findIndexById(requests, requestId);
        if (idx === -1) throw new Error("REQUEST_REJECTED: request does not exist.");

        const prevReq = requests[idx];
        requests[idx] = createRequest({
          ...prevReq,
          status: "rejected",
          qualificationStatus:
            qualificationStatus === undefined
              ? prevReq.qualificationStatus
              : qualificationStatus === null
                ? null
                : String(qualificationStatus),
        });
        break;
      }

      case REQUEST_EVENT_TYPES.REQUEST_CONVERTED: {
        const { requestId, assignedWorkId, assignedTeamMemberId } = payload;
        requireString(requestId, "payload.requestId");

        const idx = findIndexById(requests, requestId);
        if (idx === -1) throw new Error("REQUEST_CONVERTED: request does not exist.");

        const prevReq = requests[idx];
        requests[idx] = createRequest({
          ...prevReq,
          status: "converted",
          assignedWorkId:
            assignedWorkId === undefined ? prevReq.assignedWorkId : assignedWorkId === null ? null : String(assignedWorkId),
          assignedTeamMemberId:
            assignedTeamMemberId === undefined
              ? prevReq.assignedTeamMemberId
              : assignedTeamMemberId === null
                ? null
                : String(assignedTeamMemberId),
        });
        break;
      }

      case REQUEST_EVENT_TYPES.REQUEST_CLOSED: {
        const { requestId } = payload;
        requireString(requestId, "payload.requestId");

        const idx = findIndexById(requests, requestId);
        if (idx === -1) throw new Error("REQUEST_CLOSED: request does not exist.");

        const prevReq = requests[idx];
        requests[idx] = createRequest({
          ...prevReq,
          status: "closed",
        });
        break;
      }

      default:
        throw new Error(`RequestEventEngine: Unhandled event type: ${event.type}`);
    }

    const metrics = computeRequestMetrics({
      requests,
      nowISO: String(this.runtime.nowISO ?? "2026-07-01T00:00:00.000Z"),
    });

    const nextState = deepFreeze({
      ...prev,
      requests,
      metrics,
    });

    this.runtime._state = nextState;
  }
}

