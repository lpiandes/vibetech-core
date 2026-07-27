import test from "node:test";
import assert from "node:assert/strict";
import { buildChannelGoLiveChecklist } from "./ChannelGoLiveChecklist.js";

test("voice ready requires origin and prove", () => {
  const blocked = buildChannelGoLiveChecklist({
    connections: [{ connectionType: "voice_channel", status: "CONNECTED" }],
    proofRecords: {},
    appOrigin: "http://localhost:3000",
  });
  assert.equal(blocked.items.find((i) => i.id === "voice")?.ready, false);

  const ready = buildChannelGoLiveChecklist({
    connections: [{ connectionType: "voice_channel", status: "CONNECTED" }],
    proofRecords: { voice_calls: { ok: true, status: "proven" } },
    appOrigin: "https://app.vibetech.ai",
  });
  assert.equal(ready.items.find((i) => i.id === "voice")?.ready, true);
});

test("sms ready requires brand + prove", () => {
  const checklist = buildChannelGoLiveChecklist({
    connections: [{ connectionType: "sms_channel", status: "CONNECTED" }],
    proofRecords: { sms_send: { ok: true } },
    smsSetup: { brandComplete: false },
    appOrigin: "https://app.example.com",
  });
  assert.equal(checklist.items.find((i) => i.id === "sms")?.ready, false);
});
