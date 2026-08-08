import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOwnerInputsPayload,
  ownerActionStepsForFields,
  validateOwnerInputs,
} from "./ownerInputFieldCatalog.js";
import {
  resolveOpsNotifyDecision,
  resolveOwnerSetupForm,
  resolveOwnerSetupRequest,
  registerOwnerSetupAutoFulfiller,
  tryAutoFulfillOwnerSetup,
} from "./resolveOwnerSetupRequest.js";
import { proveGuidanceForAction } from "../prove/proveOwnerGuidance.js";
import { proveNeedsDestination, proveNeedsOwnerConfirm } from "../prove/proveOwnerFlow.js";
import { getWhiteGloveConnection } from "../whiteglove/WhiteGloveConnectionRegistry.js";

test("HighLevel collectFromOwner drives Location ID + access how-to", () => {
  const form = resolveOwnerSetupForm("highlevel");
  const ids = form.fields.map((f) => f.id);
  assert.ok(ids.includes("locationId"));
  assert.ok(ids.includes("accessInvite"));
  const steps = ownerActionStepsForFields(ids);
  assert.ok(steps.some((s) => s.fieldId === "locationId" && s.howTo.length >= 2));
  assert.match(form.intro, /Location ID|set this up/i);
});

test("validateOwnerInputs blocks HighLevel without required fields", () => {
  const fieldIds = getWhiteGloveConnection("highlevel").collectFromOwner;
  const missing = validateOwnerInputs(fieldIds, { notes: "hi" });
  assert.equal(missing.ok, false);
  assert.ok(missing.missing.includes("locationId"));
  assert.ok(missing.missing.includes("accessInvite"));

  const ok = validateOwnerInputs(fieldIds, {
    locationId: "loc_123",
    accessInvite: "Invited support@vtechdevelopment.com",
  });
  assert.equal(ok.ok, true);
});

test("buildOwnerInputsPayload maps field ids to payload keys", () => {
  const payload = buildOwnerInputsPayload(["locationId", "accessInvite", "notes"], {
    locationId: "abc",
    accessInvite: "invited",
    notes: "n",
  });
  assert.equal(payload.locationId, "abc");
  assert.equal(payload.accessInvite, "invited");
  assert.equal(payload.notes, "n");
});

test("ops notify skipped when auto fulfill handles setup", async () => {
  registerOwnerSetupAutoFulfiller("highlevel", async () => ({
    ok: true,
    opsStillNeeded: false,
    message: "Connected via platform agency key",
  }));
  const auto = await tryAutoFulfillOwnerSetup({
    connectionId: "highlevel",
    ownerInputs: { locationId: "x", accessInvite: "y" },
  });
  assert.equal(auto.ok, true);
  assert.equal(auto.opsStillNeeded, false);
  const decision = resolveOpsNotifyDecision({
    connectionId: "highlevel",
    autoResult: auto,
  });
  assert.equal(decision.notify, false);
  assert.equal(decision.reason, "auto_handled");
  registerOwnerSetupAutoFulfiller("highlevel", null);
});

test("ops notify required by default when no auto handle", () => {
  const decision = resolveOpsNotifyDecision({
    connectionId: "hubspot",
    autoResult: { ok: false, opsStillNeeded: true },
  });
  assert.equal(decision.notify, true);
});

test("resolveOwnerSetupRequest canSubmit for voice with empty optional fields", () => {
  const resolved = resolveOwnerSetupRequest({ connectionId: "voice_channel", values: {} });
  assert.equal(resolved.canSubmit, true);
});

test("prove guidance: website forms does not send owners to People", () => {
  const g = proveGuidanceForAction("submit_test_form");
  assert.equal(proveNeedsDestination("submit_test_form"), null);
  assert.equal(proveNeedsOwnerConfirm("submit_test_form"), false);
  assert.ok(g.beforeSteps.length >= 1);
  assert.ok(g.successSteps.every((s) => !/open people/i.test(s)));
  assert.ok(g.successSteps.some((s) => /Decisions/i.test(s)));
});

test("prove verification deep-links Decisions and shows proof without People", async () => {
  const { buildProveOwnerVerification } = await import("../prove/proveOwnerVerification.js");
  const verification = buildProveOwnerVerification({
    action: "submit_test_form",
    businessId: "biz_1",
    ok: true,
    peopleVisible: false,
    result: {
      contactId: "contact_form_prove_x",
      followUpDraft: { id: "draft_1", subject: "Thanks — we received your inquiry" },
      detail: { pendingApproval: true },
    },
  });
  assert.ok(verification.evidence.length >= 1);
  assert.equal(verification.primaryCta?.href, "/b/biz_1/intelligence");
  assert.ok(verification.steps.every((s) => !/open people/i.test(String(s.text ?? s))));
});

test("prove guidance: email needs destination + confirm", () => {
  assert.equal(proveNeedsDestination("send_test_email"), "email");
  assert.equal(proveNeedsOwnerConfirm("send_test_email"), true);
  const g = proveGuidanceForAction("send_test_email");
  assert.ok(g.confirmSteps.length >= 2);
});
