import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyCrmState,
  upsertContact,
  upsertCalendarEvent,
  upsertPipelineCard,
  movePipelineCard,
  createPipeline,
  renamePipeline,
  deletePipeline,
  renamePipelineStage,
  addPipelineStage,
  removePipelineStage,
  reorderPipelineStages,
  buildCrmReportingStrip,
  setOwnerColor,
  normalizeOwnerColors,
  readCrmState,
  OWNER_COLOR_PALETTE,
  CONTACT_KINDS,
} from "./CrmStore.js";
import { proposeAutomationPathChange } from "../ai-builder/specialty/proposeAutomationPathChange.js";
import { buildOperatingContract } from "../ai-builder/operating-contract/buildOperatingContract.js";

test("CRM contact kinds and upsert", () => {
  let crm = emptyCrmState();
  crm = upsertContact(crm, { name: "Alex Parent", kind: "family", email: "a@b.com" });
  assert.equal(crm.contacts.length, 1);
  assert.ok(CONTACT_KINDS.includes(crm.contacts[0].kind));
});

test("CRM owner colors + card owner preserved on rename without ownerUserId", () => {
  let crm = emptyCrmState();
  assert.deepEqual(crm.ownerColors, {});
  crm = setOwnerColor(crm, { userId: "user_jake", colorId: "blue", label: "Blue · Jake" });
  assert.equal(crm.ownerColors.user_jake.hex, "#2563eb");
  assert.equal(crm.ownerColors.user_jake.label, "Blue · Jake");

  const pipeId = crm.pipelines[0].id;
  const stageId = crm.pipelines[0].stages[0].id;
  crm = upsertPipelineCard(crm, {
    pipelineId: pipeId,
    card: { title: "Lead", stageId, ownerUserId: "user_jake" },
  }).crm;
  const cardId = crm.pipelines[0].cards[0].id;
  assert.equal(crm.pipelines[0].cards[0].ownerUserId, "user_jake");

  crm = upsertPipelineCard(crm, {
    pipelineId: pipeId,
    card: { id: cardId, title: "Lead renamed", stageId },
  }).crm;
  assert.equal(crm.pipelines[0].cards[0].ownerUserId, "user_jake");
  assert.equal(crm.pipelines[0].cards[0].title, "Lead renamed");

  const roundTrip = readCrmState({ configuration: { crm } });
  assert.equal(roundTrip.ownerColors.user_jake.colorId, "blue");
  assert.ok(OWNER_COLOR_PALETTE.length >= 4);
  assert.equal(normalizeOwnerColors({ user_x: "green" }).user_x.colorId, "green");
});

test("CRM calendar + pipeline move", () => {
  let crm = emptyCrmState();
  crm = upsertCalendarEvent(crm, {
    title: "Practice",
    start: "2026-07-27T15:00:00.000Z",
    end: "2026-07-27T16:00:00.000Z",
  });
  assert.equal(crm.calendarEvents.length, 1);

  const pipeId = crm.pipelines[0].id;
  const stageNew = crm.pipelines[0].stages[0].id;
  const stageNext = crm.pipelines[0].stages[1].id;
  crm = upsertPipelineCard(crm, {
    pipelineId: pipeId,
    card: { title: "U12 tryout lead", stageId: stageNew, value: 100 },
  }).crm;
  const cardId = crm.pipelines[0].cards[0].id;
  crm = movePipelineCard(crm, { pipelineId: pipeId, cardId, stageId: stageNext });
  assert.equal(crm.pipelines[0].cards[0].stageId, stageNext);

  const strip = buildCrmReportingStrip(crm, { nowISO: "2026-07-20T00:00:00.000Z" });
  assert.equal(strip.openOpportunities, 1);
  assert.ok(strip.upcomingEvents >= 1);
});

test("CRM pipeline rename stages and multi-pipeline", () => {
  let crm = emptyCrmState();
  const pipeId = crm.pipelines[0].id;
  crm = renamePipeline(crm, { pipelineId: pipeId, name: "Tryouts" });
  assert.equal(crm.pipelines[0].name, "Tryouts");

  const stageId = crm.pipelines[0].stages[0].id;
  crm = renamePipelineStage(crm, { pipelineId: pipeId, stageId, label: "Applied" });
  assert.equal(crm.pipelines[0].stages[0].label, "Applied");

  crm = addPipelineStage(crm, { pipelineId: pipeId, label: "Waitlist" });
  crm = crm.crm;
  assert.equal(crm.pipelines[0].stages.length, 6);
  assert.equal(crm.pipelines[0].stages.at(-1).label, "Waitlist");

  const waitlistId = crm.pipelines[0].stages.at(-1).id;
  crm = upsertPipelineCard(crm, {
    pipelineId: pipeId,
    card: { title: "Lead", stageId: waitlistId },
  }).crm;
  crm = removePipelineStage(crm, { pipelineId: pipeId, stageId: waitlistId });
  assert.equal(crm.pipelines[0].stages.length, 5);
  assert.equal(crm.pipelines[0].cards[0].stageId, crm.pipelines[0].stages[0].id);

  const created = createPipeline(crm, { name: "Sponsorships" });
  crm = created.crm;
  assert.equal(crm.pipelines.length, 2);
  assert.equal(crm.pipelines[1].name, "Sponsorships");
  assert.equal(crm.pipelines[1].stages.length, 0);
  assert.ok(created.pipelineId);

  crm = deletePipeline(crm, { pipelineId: created.pipelineId });
  assert.equal(crm.pipelines.length, 1);

  const firstId = crm.pipelines[0].stages[0].id;
  const secondId = crm.pipelines[0].stages[1].id;
  crm = reorderPipelineStages(crm, { pipelineId: pipeId, stageId: secondId, toIndex: 0 });
  assert.equal(crm.pipelines[0].stages[0].id, secondId);
  assert.equal(crm.pipelines[0].stages[1].id, firstId);
});

test("proposeAutomationPathChange adds email from plain English", () => {
  const built = buildOperatingContract({
    employee: { employeeId: "emp_1", label: "Comms" },
    industry: "sports",
  });
  const proposal = proposeAutomationPathChange({
    instruction: 'Add an email to the team with subject "New signup"',
    contract: built.contract,
  });
  assert.equal(proposal.ok, true);
  assert.ok(proposal.proposedPath.steps.some((s) => s.type === "send_email" && /team/i.test(s.label)));
});
