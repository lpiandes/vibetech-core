import assert from "node:assert/strict";
import { test } from "node:test";

import { CapabilityRuntime } from "./CapabilityRuntime.js";

import { CAPABILITY_EVENT_TYPES } from "./CapabilityEventTypes.js";

import { createCapability } from "./Capability.js";

const CAPABILITY_REGISTERED_AT = "2026-07-02T00:00:00.000Z";

function makeCapabilityInput({ id = "cap_1", category = "operations", providedBy = ["human"], status = "active", level = 3 } = {}) {
  return createCapability({
    id,
    name: "Capability",
    description: "A deterministic capability definition.",
    category,
    level,
    status,
    requirements: [{ id: "req_1", description: "req desc" }],
    providedBy,
    requiredKnowledge: ["knowledge_1"],
    requiredConnectedSystems: ["system_1"],
    metadata: { legacy: true },
  });
}

function makeEvent({ eventType, eventId = "evt_1", payload = {} }) {
  return {
    id: eventId,
    timestampISO: String(CAPABILITY_REGISTERED_AT),
    type: String(eventType),
    source: "test",
    payload,
  };
}

test("Runtime creation: categories exist, capabilities empty, metrics computed", () => {
  const runtime = new CapabilityRuntime({ seed: null });
  assert.ok(Array.isArray(runtime.getCategories()));
  assert.ok(runtime.getCategories().length > 0);
  assert.equal(runtime.getCapabilities().length, 0);
  assert.equal(runtime.getMetrics().totalCapabilities, 0);
  assert.equal(runtime.getMetrics().activeCapabilities, 0);
});

test("Capability creation: CAPABILITY_REGISTERED adds capability + updates metrics", () => {
  const runtime = new CapabilityRuntime({ seed: null });

  const cap = makeCapabilityInput({ id: "cap_ops_1", category: "operations", providedBy: ["human"] });
  runtime.applyEvent(makeEvent({ eventType: CAPABILITY_EVENT_TYPES.CAPABILITY_REGISTERED, eventId: "evt_cap_1", payload: { capability: cap } }));

  assert.equal(runtime.getCapabilities().length, 1);
  const stored = runtime.getCapability("cap_ops_1");
  assert.ok(stored);
  assert.equal(stored.category, "operations");
  assert.deepEqual(stored.providedBy, ["human"]);

  const metrics = runtime.getMetrics();
  assert.equal(metrics.totalCapabilities, 1);
  assert.equal(metrics.activeCapabilities, 1);
  assert.equal(metrics.capabilitiesByCategory.operations, 1);
  assert.equal(metrics.capabilitiesByProvider.human, 1);
});

test("Provider updates: provider added and removed updates providedBy + metrics", () => {
  const runtime = new CapabilityRuntime({ seed: null });

  const cap = makeCapabilityInput({ id: "cap_ops_2", category: "operations", providedBy: ["human"] });
  runtime.applyEvent(makeEvent({ eventType: CAPABILITY_EVENT_TYPES.CAPABILITY_REGISTERED, eventId: "evt_cap_2", payload: { capability: cap } }));

  runtime.applyEvent(makeEvent({ eventType: CAPABILITY_EVENT_TYPES.CAPABILITY_PROVIDER_ADDED, eventId: "evt_cap_provider_add", payload: { capabilityId: "cap_ops_2", provider: "digital_employee" } }));
  let stored = runtime.getCapability("cap_ops_2");
  assert.deepEqual(stored.providedBy, ["human", "digital_employee"]);
  assert.equal(runtime.getMetrics().capabilitiesByProvider.human, 1);
  assert.equal(runtime.getMetrics().capabilitiesByProvider.digital_employee, 1);

  runtime.applyEvent(makeEvent({ eventType: CAPABILITY_EVENT_TYPES.CAPABILITY_PROVIDER_REMOVED, eventId: "evt_cap_provider_remove", payload: { capabilityId: "cap_ops_2", provider: "human" } }));
  stored = runtime.getCapability("cap_ops_2");
  assert.deepEqual(stored.providedBy, ["digital_employee"]);
  assert.equal(runtime.getMetrics().capabilitiesByProvider.human, undefined);
  assert.equal(runtime.getMetrics().capabilitiesByProvider.digital_employee, 1);
});

test("Archive: CAPABILITY_ARCHIVED flips status and metrics activeCapabilities", () => {
  const runtime = new CapabilityRuntime({ seed: null });
  const cap = makeCapabilityInput({ id: "cap_arch_1", category: "operations", providedBy: ["human"] });
  runtime.applyEvent(makeEvent({ eventType: CAPABILITY_EVENT_TYPES.CAPABILITY_REGISTERED, eventId: "evt_cap_arch", payload: { capability: cap } }));

  assert.equal(runtime.getMetrics().activeCapabilities, 1);
  runtime.applyEvent(makeEvent({ eventType: CAPABILITY_EVENT_TYPES.CAPABILITY_ARCHIVED, eventId: "evt_cap_archived", payload: { capabilityId: "cap_arch_1" } }));

  const stored = runtime.getCapability("cap_arch_1");
  assert.equal(stored.status, "archived");
  assert.equal(runtime.getMetrics().activeCapabilities, 0);
});

test("Immutability: runtime state and capability objects are frozen", () => {
  const runtime = new CapabilityRuntime({ seed: null });
  const cap = makeCapabilityInput({ id: "cap_immut_1" });
  runtime.applyEvent(makeEvent({ eventType: CAPABILITY_EVENT_TYPES.CAPABILITY_REGISTERED, eventId: "evt_cap_immut_1", payload: { capability: cap } }));

  assert.ok(Object.isFrozen(runtime._state));
  const stored = runtime.getCapability("cap_immut_1");
  assert.ok(Object.isFrozen(stored));
  assert.ok(Object.isFrozen(stored.metadata));
  assert.ok(Object.isFrozen(stored.requirements));
});

test("Validation: invalid CAPABILITY_REGISTERED payload throws", () => {
  const runtime = new CapabilityRuntime({ seed: null });
  assert.throws(() => {
    runtime.applyEvent(makeEvent({ eventType: CAPABILITY_EVENT_TYPES.CAPABILITY_REGISTERED, eventId: "evt_invalid", payload: { capability: null } }));
  });
});

