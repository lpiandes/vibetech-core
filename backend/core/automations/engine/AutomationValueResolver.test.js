import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveAutomationParameters, getSupportedAutomationValueResolverSourceTypes } from "./AutomationValueResolver.js";

const EVENT = Object.freeze({
  eventId: "evt_1",
  eventType: "INTERACTION_OUTCOME_RECORDED",
  payload: Object.freeze({
    interactionId: "int_1",
    outcome: "review_required",
    followUpAt: "2026-07-03T15:00:00.000Z",
    nested: Object.freeze({ value: "x" }),
  }),
  metadata: Object.freeze({ companyId: "co_1" }),
});

const INTERACTION = Object.freeze({
  ownerId: "tm_owner",
  relatedObjects: [{ partyId: "party_1" }],
});

test("AutomationValueResolver: literal and event field resolution", () => {
  const resolved = resolveAutomationParameters({
    parameters: {
      title: { sourceType: "LITERAL", value: "Configured title" },
      interactionId: { sourceType: "EVENT_FIELD", fieldPath: "payload.interactionId" },
      companyId: { sourceType: "EVENT_FIELD", fieldPath: "metadata.companyId" },
      nested: { sourceType: "EVENT_FIELD", fieldPath: "payload.nested.value" },
    },
    event: EVENT,
    interaction: INTERACTION,
  });

  assert.equal(resolved.title, "Configured title");
  assert.equal(resolved.interactionId, "int_1");
  assert.equal(resolved.companyId, "co_1");
  assert.equal(resolved.nested, "x");
  assert.ok(Object.isFrozen(resolved));
});

test("AutomationValueResolver: interaction field + concat + array concat", () => {
  const resolved = resolveAutomationParameters({
    parameters: {
      workItemId: {
        sourceType: "CONCAT",
        parts: [
          { sourceType: "LITERAL", value: "work_" },
          { sourceType: "EVENT_FIELD", fieldPath: "payload.interactionId" },
        ],
      },
      relatedObjects: {
        sourceType: "ARRAY_CONCAT",
        parts: [
          { sourceType: "INTERACTION_FIELD", fieldPath: "relatedObjects" },
          {
            sourceType: "LITERAL",
            value: [{ interactionId: { sourceType: "EVENT_FIELD", fieldPath: "payload.interactionId" } }],
          },
        ],
      },
    },
    event: EVENT,
    interaction: INTERACTION,
  });

  assert.equal(resolved.workItemId, "work_int_1");
  assert.deepEqual(resolved.relatedObjects, [{ partyId: "party_1" }, { interactionId: "int_1" }]);
});

test("AutomationValueResolver: rejects invalid source type and missing path", () => {
  assert.throws(
    () =>
      resolveAutomationParameters({
        parameters: { x: { sourceType: "EVAL", value: "1+1" } },
        event: EVENT,
        interaction: INTERACTION,
      }),
    /Unsupported sourceType/,
  );

  const resolved = resolveAutomationParameters({
    parameters: { missing: { sourceType: "EVENT_FIELD", fieldPath: "payload.doesNotExist" } },
    event: EVENT,
    interaction: INTERACTION,
  });
  assert.equal(resolved.missing, undefined);
});

test("AutomationValueResolver: does not mutate input event", () => {
  const eventCopy = structuredClone(EVENT);
  resolveAutomationParameters({
    parameters: { x: { sourceType: "EVENT_FIELD", fieldPath: "payload.outcome" } },
    event: EVENT,
    interaction: INTERACTION,
  });
  assert.deepEqual(EVENT, eventCopy);
});

test("AutomationValueResolver: exposes supported source types", () => {
  const types = getSupportedAutomationValueResolverSourceTypes();
  assert.ok(types.includes("LITERAL"));
  assert.ok(types.includes("EVENT_FIELD"));
  assert.ok(Object.isFrozen(types));
});
