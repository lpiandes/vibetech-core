import assert from "node:assert/strict";
import { test } from "node:test";
import {
  presentCompiledWorkflowPurpose,
  presentTeammateHomeGlance,
} from "./presentTeammateHomeGlance.js";

test("collapses Runs: playbook dumps into a one-line glance", () => {
  const glance = presentTeammateHomeGlance({
    purpose: "Runs: Phone call comes in -> AI receptionist answers from club info -> logs the caller and question as a contact/note -> flags anything needing a callback. New family inquiry -> added to CRM pipeline -> follow-up email/text drafted for our approval -> moved through stages (inquired -> tryout -> registered). Drafts work for review — Email/SMS need your approval before send.",
  });
  assert.ok(glance.length <= 100);
  assert.match(glance, /Phone call comes in/i);
  assert.match(glance, /Drafts for your review/i);
  assert.doesNotMatch(glance, /->/);
  assert.doesNotMatch(glance, /^Runs:/i);
});

test("keeps already-short pack purposes readable", () => {
  const glance = presentTeammateHomeGlance({
    purpose: "Draft practice plans and drill notes from club knowledge for coach review before sharing.",
  });
  assert.equal(
    glance,
    "Draft practice plans and drill notes from club knowledge for coach review before sharing.",
  );
});

test("compiled workflow purpose is short and generic", () => {
  const purpose = presentCompiledWorkflowPurpose(
    "FB lead comes in -> email -> sms -> update pipeline",
    { summary: "Meta / Facebook lead arrives" },
  );
  assert.ok(purpose.length <= 100);
  assert.match(purpose, /Meta \/ Facebook lead arrives/i);
  assert.doesNotMatch(purpose, /->/);
});
