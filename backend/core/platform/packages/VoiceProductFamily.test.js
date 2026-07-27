import test from "node:test";
import assert from "node:assert/strict";
import {
  listVoiceProductFamily,
  getVoiceProduct,
  isVoiceFamilySellableToday,
  VOICE_FAMILY_PACKAGE_IDS,
} from "./VoiceProductFamily.js";

test("voice family has six sheet SKUs", () => {
  assert.equal(VOICE_FAMILY_PACKAGE_IDS.length, 6);
  assert.equal(listVoiceProductFamily().length, 6);
});

test("only receptionist is sellable today", () => {
  assert.equal(isVoiceFamilySellableToday("ai_receptionist"), true);
  assert.equal(isVoiceFamilySellableToday("voice_outbound_agent"), false);
  const outbound = getVoiceProduct("voice_outbound_agent");
  assert.ok(outbound.requiredProveMissionIds.includes("voice_calls"));
  assert.equal(outbound.grantRequiredForOutbound, true);
});

test("scheduling agent requires calendar prove and liveSlotBook flag", () => {
  const scheduling = getVoiceProduct("voice_scheduling_agent");
  assert.ok(scheduling.requiredProveMissionIds.includes("calendar_scheduling"));
  assert.equal(scheduling.liveSlotBook, true);
  assert.match(scheduling.honestyBoundary, /slot/i);
});
