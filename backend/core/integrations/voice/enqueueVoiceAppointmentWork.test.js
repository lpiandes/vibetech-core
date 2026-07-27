import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVoiceAppointmentWorkDraft,
  enqueueVoiceAppointmentWork,
} from "./enqueueVoiceAppointmentWork.js";

test("appointment draft marks Needs you", () => {
  const draft = buildVoiceAppointmentWorkDraft({
    businessId: "biz_1",
    speech: "I want to book tomorrow",
    from: "+15551212",
    callSid: "CA123",
  });
  assert.equal(draft.workType, "appointment_request");
  assert.equal(draft.metadata.needsYou, true);
  assert.match(draft.metadata.glance.summary, /booking/i);
});

test("enqueue applies WORK_ITEM_CREATED and persists WORK snapshot", async () => {
  const events = [];
  const persistCalls = [];
  const result = await enqueueVoiceAppointmentWork({
    businessId: "biz_1",
    speech: "Book me in",
    from: "+1555",
    callSid: "CA9",
    getWorkspace: async () => ({
      workspaceId: "biz_1",
      workRuntime: {
        applyEvent: (evt) => { events.push(evt); },
      },
      connected: {
        operatingStack: {},
        integrationPlatform: {},
      },
    }),
    persist: async (args) => { persistCalls.push(args); },
  });
  assert.equal(result.ok, true);
  assert.equal(events[0].type, "WORK_ITEM_CREATED");
  assert.equal(result.persisted, true);
  assert.equal(persistCalls.length, 1);
  assert.deepEqual(persistCalls[0].kinds, ["work"]);
});
