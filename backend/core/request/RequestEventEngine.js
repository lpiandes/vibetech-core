import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { createRequest } from "./Request.js";

import { computeRequestMetrics } from "./RequestMetrics.js";

import { REQUEST_EVENT_TYPES, SUPPORTED_REQUEST_EVENT_TYPES } from "./RequestEventTypes.js";

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") throw new Error(`RequestEventEngine: expected ${name} to be a string.`);
}

function safeCloneArray(arr) {
  return Array.isArray(arr) ? [...arr] : [];
}

function findRequestById(requests, id) {
  const sid = String(id);
  return requests.find((r) => String(r?.id) === sid) ?? null;
}

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
    if (!SUPPORTED_REQUEST_EVENT_TYPES.includes(event.type)) throw new Error(`RequestEventEngine: Unsupported event type: ${event.type}`);

    const prev = this.runtime._state;
    let requests = safeCloneArray(prev.requests);
    const payload = event.payload;

    switch (event.type) {
      case REQUEST_EVENT_TYPES.REQUEST_RECEIVED: {
        const { request } = payload;
        if (!isPlainObject(request)) throw new Error("REQUEST_RECEIVED: request payload required.");

        const created = createRequest({
          ...request,
          status: "received",
          receivedAt: event.timestampISO,
        });

        if (findRequestById(requests, created.id)) throw new Error("REQUEST_RECEIVED: request already exists.");

        requests.push(created);
        break;
      }

      case REQUEST_EVENT_TYPES.REQUEST_UPDATED: {
        const { requestId, patch } = payload;
        requireString(requestId, "payload.requestId");
        if (!isPlainObject(patch)) throw new Error("REQUEST_UPDATED: patch must be a plain object.");

        const idx = requests.findIndex((r) => String(r.id) === String(requestId));
        if (idx === -1) throw new Error("REQUEST_UPDATED: request does not exist.");

        // Guard immutability invariants: id/receivedAt/status are not patchable.
        for (const k of Object.keys(patch)) {
          if (!REQUEST_UPDATED_PATCH_ALLOWED_KEYS.has(k)) throw new Error(`REQUEST_UPDATED: patch key not allowed: ${k}`);
        }
        const prevReq = requests[idx];
        const merged = {
          ...prevReq,
          ...patch,
          id: prevReq.id,
          receivedAt: prevReq.receivedAt,
          status: prevReq.status,
        };
        requests[idx] = createRequest(merged);
        break;
      }

      case REQUEST_EVENT_TYPES.REQUEST_QUALIFIED: {
        const { requestId, qualificationStatus } = payload;
        requireString(requestId, "payload.requestId");

        const idx = requests.findIndex((r) => String(r.id) === String(requestId));
        if (idx === -1) throw new Error("REQUEST_QUALIFIED: request does not exist.");

        const prevReq = requests[idx];
        requests[idx] = createRequest({
          ...prevReq,
          status: "qualified",
          qualificationStatus: qualificationStatus === undefined ? prevReq.qualificationStatus : String(qualificationStatus),
        });
        break;
      }

      case REQUEST_EVENT_TYPES.REQUEST_REJECTED: {
        const { requestId, qualificationStatus } = payload;
        requireString(requestId, "payload.requestId");

        const idx = requests.findIndex((r) => String(r.id) === String(requestId));
        if (idx === -1) throw new Error("REQUEST_REJECTED: request does not exist.");

        const prevReq = requests[idx];
        requests[idx] = createRequest({
          ...prevReq,
          status: "rejected",
          qualificationStatus: qualificationStatus === undefined ? prevReq.qualificationStatus : String(qualificationStatus),
        });
        break;
      }

      case REQUEST_EVENT_TYPES.REQUEST_CONVERTED: {
        const { requestId, assignedWorkId, assignedTeamMemberId, qualificationStatus } = payload;
        requireString(requestId, "payload.requestId");

        const idx = requests.findIndex((r) => String(r.id) === String(requestId));
        if (idx === -1) throw new Error("REQUEST_CONVERTED: request does not exist.");

        const prevReq = requests[idx];
        requests[idx] = createRequest({
          ...prevReq,
          status: "converted",
          assignedWorkId: assignedWorkId === undefined ? prevReq.assignedWorkId : String(assignedWorkId),
          assignedTeamMemberId:
            assignedTeamMemberId === undefined ? prevReq.assignedTeamMemberId : String(assignedTeamMemberId),
          qualificationStatus:
            qualificationStatus === undefined ? prevReq.qualificationStatus : String(qualificationStatus),
        });
        break;
      }

      case REQUEST_EVENT_TYPES.REQUEST_CLOSED: {
        const { requestId } = payload;
        requireString(requestId, "payload.requestId");

        const idx = requests.findIndex((r) => String(r.id) === String(requestId));
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

