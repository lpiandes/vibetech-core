import test from "node:test";
import assert from "node:assert/strict";

import {
  describeHowAutomationStarts,
  presentTriggerStartCopy,
} from "./triggerHowItStarts.js";

test("describeHowAutomationStarts spells out manual vs LIVE", () => {
  const off = describeHowAutomationStarts({
    trigger: {
      mode: "manual_or_events",
      eventTypes: ["SCHEDULE_CHANGE", "EVENT_UPDATE"],
    },
    live: false,
  });
  assert.match(off, /Manual:/i);
  assert.match(off, /Run now/i);
  assert.match(off, /Calendar/i);

  const live = describeHowAutomationStarts({
    trigger: {
      mode: "manual_or_events",
      eventTypes: ["SCHEDULE_CHANGE"],
    },
    live: true,
  });
  assert.match(live, /LIVE now listens/i);
});

test("presentTriggerStartCopy keeps START title obvious", () => {
  const copy = presentTriggerStartCopy({
    trigger: {
      mode: "manual_or_events",
      eventTypes: ["SCHEDULE_CHANGE", "EVENT_UPDATE"],
    },
  });
  assert.match(copy.title, /manual|events/i);
  assert.match(copy.summary, /Run now/i);
  assert.match(copy.summary, /Calendar/i);
});
