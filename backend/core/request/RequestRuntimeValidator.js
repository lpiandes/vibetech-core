import { REQUEST_CHANNEL_TYPES, isValidRequestChannel } from "./RequestChannel.js";
import { REQUEST_PRIORITY_TYPES, isValidRequestPriority } from "./RequestPriority.js";
import { REQUEST_STATUSES, isValidRequestStatus } from "./RequestStatus.js";
import { isValidRequestType } from "./RequestType.js";
import { isValidRequestSource } from "./RequestSource.js";

import { computeRequestMetrics } from "./RequestMetrics.js";

function fail(message) {
  throw new Error(`RequestRuntimeValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireNonEmptyString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} must be non-empty string.`);
}

function requireNullableString(value, name) {
  if (value === null || value === undefined) return;
  if (typeof value !== "string") fail(`${name} must be string or null.`);
}

function parseISO(value, name) {
  if (typeof value !== "string") fail(`${name} must be ISO string.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail(`${name} must be valid ISO timestamp.`);
  return ms;
}

function validateRequest(request) {
  if (!request || typeof request !== "object") fail("request must be an object.");
  if (!Object.isFrozen(request)) fail(`request ${String(request?.id ?? "")} must be frozen.`);

  requireNonEmptyString(request.id, "request.id");
  requireNonEmptyString(request.title, "request.title");
  requireNonEmptyString(request.description, "request.description");
  requireNonEmptyString(request.requester, "request.requester");
  requireNonEmptyString(request.requestType, "request.requestType");
  requireNonEmptyString(request.priority, "request.priority");
  requireNonEmptyString(request.channel, "request.channel");
  requireNonEmptyString(request.source, "request.source");
  requireNonEmptyString(request.receivedAt, "request.receivedAt");

  if (!isValidRequestType(request.requestType)) fail(`request.requestType invalid: ${String(request.requestType)}`);
  if (!isValidRequestPriority(request.priority)) fail(`request.priority invalid: ${String(request.priority)}.`);
  if (!isValidRequestChannel(request.channel)) fail(`request.channel invalid: ${String(request.channel)}.`);
  if (!isValidRequestStatus(request.status)) fail(`request.status invalid: ${String(request.status)}.`);
  if (!isValidRequestSource(request.source)) fail(`request.source invalid: ${String(request.source)}.`);

  // Lifecyle timestamps (null allowed for optional fields).
  if (request.dueAt !== null && request.dueAt !== undefined) {
    parseISO(request.dueAt, "request.dueAt");
  }

  requireNullableString(request.assignedWorkId, "request.assignedWorkId");
  requireNullableString(request.assignedTeamMemberId, "request.assignedTeamMemberId");
  requireNullableString(request.qualificationStatus, "request.qualificationStatus");

  if (!Array.isArray(request.attachments)) fail("request.attachments must be array.");
  if (!Object.isFrozen(request.attachments)) fail("request.attachments must be frozen.");
  for (const a of request.attachments) {
    if (!isPlainObject(a)) fail("request.attachments[] must be plain object.");
    if (!Object.isFrozen(a)) fail("request.attachments[] must be frozen.");
  }

  if (!isPlainObject(request.metadata)) fail("request.metadata must be plain object.");
  if (!Object.isFrozen(request.metadata)) fail("request.metadata must be frozen.");
}

function uniqueIds(arr, label) {
  const seen = new Set();
  for (const item of arr) {
    const id = String(item?.id ?? "");
    if (!id) fail(`${label} entry missing id`);
    if (seen.has(id)) fail(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function validateRequestRuntime(runtime) {
  const state = runtime?._state ?? runtime;
  if (!state || typeof state !== "object") fail("runtime state required.");
  if (!Object.isFrozen(state)) fail("request runtime state must be frozen.");

  if (!runtime || typeof runtime !== "object") fail("runtime required.");
  if (!runtime.nowISO || typeof runtime.nowISO !== "string") {
    // not strictly required by spec, but we compute/validate metrics deterministically.
    fail("runtime.nowISO required for metrics validation.");
  }

  const { requests, metrics } = state;
  if (!Array.isArray(requests)) fail("requests must be array.");

  uniqueIds(requests, "request");
  for (const r of requests) validateRequest(r);

  if (!metrics || typeof metrics !== "object") fail("metrics required.");
  const metricFields = ["totalRequests", "newRequests", "qualifiedRequests", "convertedRequests", "closedRequests", "averageAgeDays"];
  for (const f of metricFields) {
    const v = metrics[f];
    if (typeof v !== "number" || !Number.isFinite(v)) fail(`metrics.${f} must be finite number.`);
  }

  // Ensure metrics are deterministic and match current requests.
  const recomputed = computeRequestMetrics({ requests, nowISO: String(runtime.nowISO) });
  for (const k of Object.keys(recomputed)) {
    if (metrics[k] !== recomputed[k]) {
      fail(`metrics.${k} mismatch (expected ${recomputed[k]} got ${metrics[k]}).`);
    }
  }

  return { ok: true };
}

