import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { isValidRequestStatus, REQUEST_STATUSES } from "./RequestStatus.js";
import { computeRequestMetrics } from "./RequestMetrics.js";

function fail(message) {
  throw new Error(`RequestRuntimeValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} must be a non-empty string.`);
}

function requireNullableString(value, name) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") fail(`${name} must be string or null.`);
  return value;
}

function parseISO(value, name) {
  if (typeof value !== "string") fail(`${name} must be ISO string.`);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) fail(`${name} must be valid ISO timestamp.`);
  return ms;
}

function validateMetrics(metrics, runtime) {
  if (!metrics || typeof metrics !== "object") fail("metrics required.");

  const fields = ["totalRequests", "newRequests", "qualifiedRequests", "convertedRequests", "closedRequests", "averageAgeMs"];
  for (const f of fields) {
    if (typeof metrics[f] !== "number" || !Number.isFinite(metrics[f])) fail(`metrics.${f} must be finite number.`);
  }

  const recomputed = computeRequestMetrics({ requests: runtime._state.requests, nowISO: String(runtime.nowISO) });
  for (const k of Object.keys(recomputed)) {
    if (metrics[k] !== recomputed[k]) fail(`metrics.${k} mismatch (expected ${recomputed[k]} got ${metrics[k]}).`);
  }
}

function validateRequest(req) {
  if (!req || typeof req !== "object") fail("request must be object.");
  if (!Object.isFrozen(req)) fail(`request ${String(req?.id ?? "")} must be frozen.`);

  requireString(req.id, "request.id");
  requireString(req.title, "request.title");
  requireString(req.description, "request.description");
  requireString(req.requestType, "request.requestType");
  requireString(req.priority, "request.priority");
  requireString(req.channel, "request.channel");
  requireString(req.source, "request.source");
  requireString(req.requester, "request.requester");
  requireString(req.receivedAt, "request.receivedAt");

  if (!isValidRequestStatus(req.status)) fail(`request.status invalid: ${String(req.status)} (allowed: ${REQUEST_STATUSES.join(", ")})`);

  requireNullableString(req.dueAt, "request.dueAt");
  if (req.dueAt !== null) parseISO(req.dueAt, "request.dueAt");

  requireNullableString(req.assignedWorkId, "request.assignedWorkId");
  requireNullableString(req.assignedTeamMemberId, "request.assignedTeamMemberId");
  requireNullableString(req.qualificationStatus, "request.qualificationStatus");

  if (!Array.isArray(req.attachments)) fail("request.attachments must be array.");
  if (!Object.isFrozen(req.attachments)) fail("request.attachments must be frozen.");

  if (!isPlainObject(req.metadata)) fail("request.metadata must be plain object.");
  if (!Object.isFrozen(req.metadata)) fail("request.metadata must be frozen.");
}

export function validateRequestRuntime(runtime) {
  const state = runtime?._state ?? runtime;
  if (!state || typeof state !== "object") fail("runtime state required.");
  if (!runtime || typeof runtime !== "object") fail("runtime required.");

  if (!runtime._state || typeof runtime._state !== "object") fail("runtime._state required.");
  if (!Object.isFrozen(runtime._state)) fail("request runtime state must be frozen.");

  const { requests, metrics } = state;
  if (!Array.isArray(requests)) fail("requests must be array.");

  // Unique IDs.
  const seen = new Set();
  for (const r of requests) {
    const id = String(r?.id ?? "");
    if (!id) fail("request entry missing id.");
    if (seen.has(id)) fail(`duplicate request id: ${id}`);
    seen.add(id);
  }

  for (const r of requests) validateRequest(r);
  validateMetrics(metrics, runtime);

  return { ok: true };
}

