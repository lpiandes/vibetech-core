import { isValidPlatformEventType } from "../PlatformEventType.js";

import { validatePlatformEvent } from "../PlatformEventValidator.js";

import { DISPATCH_RESULT_STATUS_LIST } from "./PlatformEventBusDefaults.js";

function fail(message) {
  throw new Error(`PlatformEventBusValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function requireFiniteInt(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.floor(value) !== value || value < 0) {
    fail(`${name} must be a finite int >= 0.`);
  }
  return value;
}

export function validateSubscriberShape(subscriber) {
  if (!subscriber || typeof subscriber !== "object") fail("subscriber must be object.");
  requireString(subscriber.id, "subscriber.id");
  requireString(subscriber.name, "subscriber.name");
  if (!Array.isArray(subscriber.supportedEvents)) fail("subscriber.supportedEvents must be array.");
  requireFiniteInt(subscriber.priority, "subscriber.priority");
  if (typeof subscriber.handle !== "function") fail("subscriber.handle must be function.");
  return true;
}

export function validateDispatchResultStatus(status) {
  if (!DISPATCH_RESULT_STATUS_LIST.includes(String(status))) fail(`invalid dispatch result status: ${String(status)}`);
}

export function validatePlatformEventBusConfigEventType(eventType) {
  if (!isValidPlatformEventType(eventType)) fail(`invalid eventType: ${String(eventType)}`);
  return String(eventType);
}

export function validatePlatformEventCanonical(event) {
  if (!event || typeof event !== "object") fail("event required.");
  if (!Object.isFrozen(event)) fail("event must be deep frozen.");
  validatePlatformEvent(event);
  if (!isValidPlatformEventType(event.eventType)) fail(`invalid eventType: ${String(event.eventType)}`);
  return true;
}

export function validateSubscriptionRegistry(registry) {
  if (!registry || typeof registry !== "object") fail("registry required.");
  if (!Array.isArray(registry.subscriptions)) fail("registry.subscriptions must be array.");
  return true;
}

export function validateDispatchReportShape(report) {
  if (!report || typeof report !== "object") fail("report required.");
  requireString(report.eventId, "report.eventId");
  requireString(report.eventType, "report.eventType");
  requireString(report.dispatchedAt, "report.dispatchedAt");
  if (!Array.isArray(report.results)) fail("report.results must be array.");
  return true;
}

